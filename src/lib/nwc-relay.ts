import { webln } from '@getalby/sdk';
import { NostrWebLNProvider } from '@getalby/lightning-tools';
import { nip04, nip19, generateSecretKey, getPublicKey, finalizeEvent, getEventHash } from 'nostr-tools';
import { NostrRelayPool, waitForEventResponse } from './nostr-relay';
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
  private provider: NostrWebLNProvider | null = null;
  private relayPool: NostrRelayPool | null = null;

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
      // Try to initialize Alby's Nostr WebLN Provider first
      try {
        this.provider = new NostrWebLNProvider({
          relayUrls: this.connection.relayUrls,
          walletPubkey: this.connection.walletPubkey,
          secret: this.connection.secret,
        });
        await this.provider.enable();
        console.log('Initialized Alby NWC provider');
        return;
      } catch (albyError) {
        console.log('Alby provider not available, falling back to manual relay communication');
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
    if (!this.provider) {
      await this.initialize();
    }

    try {
      // Use Alby's provider if available
      if (this.provider) {
        const response = await this.provider.request(request.method, request.params);
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
      const eventId = getEventHash(unsignedEvent);
      const signedEvent = finalizeEvent(unsignedEvent, this.clientSecret);

      // Send to relay and wait for response
      const responseEvent = await this.sendEventAndWaitForResponse(signedEvent);
      
      if (!responseEvent) {
        throw new Error('No response received from wallet service');
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

  private async sendEventAndWaitForResponse(event: NostrEvent): Promise<NostrEvent | null> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000); // 30 second timeout

      // TODO: Implement actual relay communication
      // This is where you'd connect to the Nostr relay and:
      // 1. Send the signed event to relay
      // 2. Subscribe to response events (kind 23195)
      // 3. Filter for responses to this request (matching event ID)
      // 4. Decrypt and return the response

      // For now, return null to indicate relay communication needs implementation
      clearTimeout(timeoutId);
      resolve(null);

      // Example implementation would look like:
      /*
      const relay = new WebSocket(this.connection.relayUrls[0]);
      
      relay.onopen = () => {
        // Send the event
        relay.send(JSON.stringify(['EVENT', event]));
        
        // Subscribe to responses
        const subscriptionId = crypto.randomUUID();
        relay.send(JSON.stringify([
          'REQ', 
          subscriptionId,
          { 
            kinds: [23195], 
            '#p': [this.clientPubkey],
            '#e': [event.id],
            since: Math.floor(Date.now() / 1000)
          }
        ]));
      };

      relay.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (data[0] === 'EVENT' && data[2].kind === 23195) {
          clearTimeout(timeoutId);
          relay.close();
          resolve(data[2]);
        }
      };

      relay.onerror = (error) => {
        clearTimeout(timeoutId);
        reject(error);
      };
      */
    });
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
    
    // Try Alby SDK WebLN
    await webln.enable();
    return true;
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
    
    // Fallback to Alby SDK
    return await webln.sendPayment(bolt11);
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