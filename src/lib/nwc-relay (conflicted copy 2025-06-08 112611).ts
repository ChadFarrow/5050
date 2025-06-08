/* eslint-disable @typescript-eslint/no-explicit-any */
import { webln, nwc } from '@getalby/sdk';
import { nip04, nip19, generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { NostrRelayPool, waitForEventResponse } from './nostr-relay';
import { createNWCClient, type MCPNWCResponse } from './nwc-mcp-client';
import type { NostrEvent } from '@nostrify/nostrify';

export interface NWCConnection {
  walletPubkey: string;
  relayUrls: string[];
  secret: string;
  lud16?: string;
}

export interface NWCRequest {
  method: string;
  params: Record<string, unknown>;
}

export interface NWCResponse {
  result_type: string;
  result?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
}

export class AlbyNWCClient {
  private connection: NWCConnection;
  private clientSecret: Uint8Array;
  private clientPubkey: string;
  private nwcClient: unknown = null;
  private relayPool: NostrRelayPool | null = null;
  private mcpClient: ReturnType<typeof createNWCClient> | null = null;

  constructor(connectionString: string) {
    this.connection = this.parseConnectionString(connectionString);
    this.clientSecret = this.hexToBytes(this.connection.secret);
    this.clientPubkey = getPublicKey(this.clientSecret);
  }

  private parseConnectionString(connectionString: string): NWCConnection {
    try {
      const url = new URL(connectionString);
      
      if (url.protocol !== 'nostr+walletconnect:') {
        throw new Error('Invalid protocol. Expected nostr+walletconnect:');
      }

      const walletPubkey = url.hostname;
      if (!walletPubkey || walletPubkey.length !== 64) {
        throw new Error('Invalid wallet pubkey');
      }

      // Get all relay URLs (can be multiple)
      const relayParams = url.searchParams.getAll('relay');
      if (relayParams.length === 0) {
        throw new Error('Missing relay parameter');
      }
      const relayUrls = relayParams.map(relay => decodeURIComponent(relay));

      const secret = url.searchParams.get('secret');
      if (!secret || secret.length !== 64) {
        throw new Error('Invalid secret parameter');
      }

      const lud16 = url.searchParams.get('lud16') || undefined;

      return {
        walletPubkey,
        relayUrls,
        secret,
        lud16,
      };
    } catch (error) {
      throw new Error(`Invalid NWC connection string: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async initialize(): Promise<void> {
    try {
      // Try MCP client first (best option for reliability)
      try {
        this.mcpClient = createNWCClient({
          connectionString: this.reconstructConnectionString(),
          wsUrl: process.env.VITE_NWC_WS_URL || 'ws://localhost:8080/nwc',
        });
        await this.mcpClient.initialize();
        console.log('Initialized NWC MCP client');
        return;
      } catch {
        console.log('MCP client not available, trying Alby SDK');
      }

      // Try to initialize Alby's NWC client
      try {
        this.nwcClient = new nwc.NWCClient({
          nostrWalletConnectUrl: this.reconstructConnectionString(),
        });
        await (this.nwcClient as any).enable();
        console.log('Initialized Alby NWC client');
        return;
      } catch {
        console.log('Alby NWC client not available, falling back to manual relay communication');
      }

      // Fallback to manual relay communication
      this.relayPool = new NostrRelayPool(this.connection.relayUrls);
      await this.relayPool.connect();
      console.log('Initialized manual relay pool for NWC');
    } catch (error) {
      console.error('Failed to initialize NWC communication:', error);
      throw new Error('Failed to connect to NWC relay');
    }
  }

  private reconstructConnectionString(): string {
    const url = new URL(`nostr+walletconnect://${this.connection.walletPubkey}`);
    this.connection.relayUrls.forEach(relayUrl => {
      url.searchParams.append('relay', encodeURIComponent(relayUrl));
    });
    url.searchParams.set('secret', this.connection.secret);
    if (this.connection.lud16) {
      url.searchParams.set('lud16', this.connection.lud16);
    }
    return url.toString();
  }

  async makeInvoice(params: {
    amount: number;
    description?: string;
    expiry?: number;
  }): Promise<NWCResponse> {
    const request: NWCRequest = {
      method: 'make_invoice',
      params: {
        amount: params.amount,
        description: params.description,
        expiry: params.expiry || 3600,
      },
    };

    return this.sendRequest(request);
  }

  async payInvoice(params: {
    invoice: string;
    amount?: number;
  }): Promise<NWCResponse> {
    const request: NWCRequest = {
      method: 'pay_invoice',
      params,
    };

    return this.sendRequest(request);
  }

  async getInfo(): Promise<NWCResponse> {
    const request: NWCRequest = {
      method: 'get_info',
      params: {},
    };

    return this.sendRequest(request);
  }

  async getBalance(): Promise<NWCResponse> {
    const request: NWCRequest = {
      method: 'get_balance',
      params: {},
    };

    return this.sendRequest(request);
  }

  private async sendRequest(request: NWCRequest): Promise<NWCResponse> {
    if (!this.mcpClient && !this.nwcClient && !this.relayPool) {
      await this.initialize();
    }

    try {
      // Use MCP client if available (best option)
      if (this.mcpClient) {
        let mcpResponse: MCPNWCResponse;
        
        switch (request.method) {
          case 'make_invoice':
            mcpResponse = await this.mcpClient.makeInvoice(request.params as any);
            break;
          case 'pay_invoice':
            mcpResponse = await this.mcpClient.payInvoice(request.params as any);
            break;
          case 'get_balance':
            mcpResponse = await this.mcpClient.getBalance();
            break;
          case 'get_info':
            mcpResponse = await this.mcpClient.getInfo();
            break;
          default:
            throw new Error(`Unsupported method: ${request.method}`);
        }

        return {
          result_type: request.method,
          result: mcpResponse.result,
          error: mcpResponse.error,
        };
      }

      // Use Alby's NWC client if available
      if (this.nwcClient) {
        const response = await (this.nwcClient as any).request(request.method, request.params);
        return {
          result_type: request.method,
          result: response,
        };
      }

      // Fallback to manual relay communication
      return this.sendManualRequest(request);
    } catch (error) {
      return {
        result_type: request.method,
        error: {
          code: 'INTERNAL',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async sendManualRequest(request: NWCRequest): Promise<NWCResponse> {
    if (!this.relayPool) {
      throw new Error('Relay pool not initialized');
    }

    try {
      // Encrypt the request content
      const encryptedContent = await nip04.encrypt(
        this.connection.secret,
        this.connection.walletPubkey,
        JSON.stringify(request)
      );

      // Create the request event
      const unsignedEvent: Omit<NostrEvent, 'id' | 'sig'> = {
        kind: 23194, // NIP-47 request
        pubkey: this.clientPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['p', this.connection.walletPubkey],
        ],
        content: encryptedContent,
      };

      // Sign the event
      const signedEvent = finalizeEvent(unsignedEvent, this.clientSecret);

      // Send the request event to relays
      const sendResults = await this.relayPool.sendEvent(signedEvent);
      const successfulSends = sendResults.filter(r => r.success);
      
      if (successfulSends.length === 0) {
        throw new Error('Failed to send request to any relay');
      }

      console.log(`Request sent to ${successfulSends.length} relays`);

      // Wait for response event (kind 23195)
      const responseFilter = {
        kinds: [23195],
        '#p': [this.clientPubkey],
        '#e': [signedEvent.id],
        since: Math.floor(Date.now() / 1000) - 60, // Look for responses from 1 minute ago
      };

      const responseEvent = await waitForEventResponse(
        this.relayPool,
        responseFilter,
        30000 // 30 second timeout
      );
      
      if (!responseEvent) {
        throw new Error('No response received from wallet service within timeout');
      }

      // Decrypt the response
      const decryptedContent = await nip04.decrypt(
        this.connection.secret,
        this.connection.walletPubkey,
        responseEvent.content
      );

      return JSON.parse(decryptedContent) as NWCResponse;

    } catch (error) {
      throw new Error(`NWC request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Cleanup method
  async disconnect(): Promise<void> {
    if (this.mcpClient) {
      await this.mcpClient.disconnect();
      this.mcpClient = null;
    }
    if (this.relayPool) {
      this.relayPool.disconnect();
      this.relayPool = null;
    }
    this.nwcClient = null;
  }

  static generateConnectionString(params: {
    walletPubkey: string;
    relayUrls: string[];
    lud16?: string;
  }): { connectionString: string; secret: string } {
    const secret = AlbyNWCClient.bytesToHex(generateSecretKey());
    
    const url = new URL(`nostr+walletconnect://${params.walletPubkey}`);
    
    // Add all relay URLs
    params.relayUrls.forEach(relayUrl => {
      url.searchParams.append('relay', encodeURIComponent(relayUrl));
    });
    
    url.searchParams.set('secret', secret);
    
    if (params.lud16) {
      url.searchParams.set('lud16', params.lud16);
    }

    return {
      connectionString: url.toString(),
      secret,
    };
  }

  private static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  get walletNpub(): string {
    return nip19.npubEncode(this.connection.walletPubkey);
  }

  get connectionInfo(): NWCConnection {
    return { ...this.connection };
  }

  // Check if connection is valid and reachable
  async testConnection(): Promise<boolean> {
    try {
      if (this.mcpClient) {
        return await this.mcpClient.testConnection();
      }
      
      const infoResponse = await this.getInfo();
      return !infoResponse.error;
    } catch {
      return false;
    }
  }
}

// Utility functions
export function isValidNWCConnection(connectionString: string): boolean {
  try {
    new AlbyNWCClient(connectionString);
    return true;
  } catch {
    return false;
  }
}

// WebLN integration for direct payments
export async function enableWebLN(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && window.webln) {
      await window.webln.enable();
      return true;
    }
    
    // Try Alby SDK WebLN if available
    try {
      const albyWebLN = new webln.NostrWebLNProvider();
      await albyWebLN.enable();
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

export async function payInvoiceWithWebLN(bolt11: string): Promise<{ preimage: string; payment_hash?: string }> {
  try {
    // Try browser WebLN first
    if (typeof window !== 'undefined' && window.webln) {
      return await window.webln.sendPayment(bolt11);
    }
    
    // Try Alby SDK WebLN
    try {
      const albyWebLN = new webln.NostrWebLNProvider();
      await albyWebLN.enable();
      return await albyWebLN.sendPayment(bolt11);
    } catch {
      throw new Error('No WebLN provider available');
    }
  } catch (error) {
    throw new Error(`Payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Error codes from NIP-47
export const NWC_ERROR_CODES = {
  RATE_LIMITED: 'RATE_LIMITED',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED', 
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  RESTRICTED: 'RESTRICTED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL: 'INTERNAL',
  OTHER: 'OTHER',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  NOT_FOUND: 'NOT_FOUND',
} as const;