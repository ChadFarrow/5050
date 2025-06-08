import type { NostrEvent } from '@nostrify/nostrify';
import { nip04, nip19, generateSecretKey, getPublicKey } from 'nostr-tools';

// Add type definition for window.nostr
declare global {
  interface Window {
    nostr: {
      signEvent(event: Omit<NostrEvent, 'id' | 'sig'>): Promise<NostrEvent>;
    };
  }
}

// NWC request and response types are defined inline where used

type NWCRequest = {
  method: string;
  params: Record<string, unknown>;
};

export type NWCMethod = 'get_info' | 'pay_invoice' | 'make_invoice' | 'lookup_invoice' | 'list_transactions' | 'get_balance';

interface NWCError {
  code: 'RATE_LIMITED' | 'NOT_IMPLEMENTED' | 'INSUFFICIENT_BALANCE' | 'QUOTA_EXCEEDED' | 'RESTRICTED' | 'UNAUTHORIZED' | 'INTERNAL' | 'OTHER';
  message: string;
}

interface NWCResponse {
  result_type: NWCMethod;
  error?: NWCError;
  result?: Record<string, unknown>;
}

export interface NWCConnection {
  walletPubkey: string;
  relayUrl: string;
  secret: string;
  lud16?: string;
}

interface NWCCapabilities {
  methods: NWCMethod[];
}

interface NWCInfoResponse extends NWCResponse {
  result_type: 'get_info';
  result: {
    alias: string;
    pubkey: string;
    network: string;
    block_height: number;
    block_hash: string;
    methods: NWCMethod[];
  };
}

interface LightningInvoice {
  bolt11: string;
  payment_hash: string;
  payment_request: string;
  amount_msat: number;
  description: string;
  expires_at: number;
  checking_id: string;
}

export interface NWCGetBalanceResponse extends NWCResponse {
  result_type: 'get_balance';
  result: {
    balance: number;
  };
}

export class NWCClient {
  private connection: NWCConnection;
  private clientSecret: Uint8Array;
  private clientPubkey: string;
  private capabilities?: NWCCapabilities;

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

      const relayUrl = url.searchParams.get('relay');
      if (!relayUrl) {
        throw new Error('Missing relay parameter');
      }

      const secret = url.searchParams.get('secret');
      if (!secret || secret.length !== 64) {
        throw new Error('Invalid secret parameter');
      }

      const lud16 = url.searchParams.get('lud16') || undefined;

      return {
        walletPubkey,
        relayUrl: decodeURIComponent(relayUrl),
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

  private static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async checkCapabilities(): Promise<void> {
    if (this.capabilities) return;

    try {
      const response = await this.sendRequest({
        method: 'get_info',
        params: {}
      }) as NWCInfoResponse;

      if (response.error) {
        throw new Error(`Failed to get wallet capabilities: ${response.error.message}`);
      }

      this.capabilities = {
        methods: response.result.methods
      };

      console.log('✅ NWC capabilities:', this.capabilities);
    } catch (error) {
      console.error('❌ Failed to get wallet capabilities:', error);
      // Default to basic capabilities if we can't get them
      this.capabilities = {
        methods: ['make_invoice', 'pay_invoice']
      };
    }
  }

  private async sendRequest(request: NWCRequest): Promise<NWCResponse> {
    try {
      // Check capabilities first
      await this.checkCapabilities();

      // Validate the method against wallet capabilities
      if (!this.capabilities?.methods.includes(request.method as NWCMethod)) {
        throw new Error(`Unsupported NWC method: ${request.method}. Supported methods: ${this.capabilities?.methods.join(', ')}`);
      }

      // Encrypt the request
      const encryptedContent = await nip04.encrypt(
        this.connection.secret,
        this.connection.walletPubkey,
        JSON.stringify(request)
      );

      // Create the request event
      const event: Omit<NostrEvent, 'id' | 'sig'> = {
        kind: 23194, // NIP-47 request
        pubkey: this.clientPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['p', this.connection.walletPubkey],
        ],
        content: encryptedContent,
      };

      // Sign the event
      const signedEvent = await window.nostr.signEvent(event);

      // Create a WebSocket connection to the relay
      const ws = new WebSocket(this.connection.relayUrl);
      const subscriptionId = `nwc-${Date.now()}`;

      // Set up a promise to handle the response
      const responsePromise = new Promise<NWCResponse>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('NWC request timed out'));
        }, 30000); // 30 second timeout

        ws.onopen = () => {
          console.log('🔌 NWC WebSocket connected');
          
          // Subscribe to response events
          ws.send(JSON.stringify([
            'REQ',
            subscriptionId,
            {
              kinds: [23195], // NIP-47 response
              authors: [this.connection.walletPubkey],
              '#p': [this.clientPubkey],
              since: Math.floor(Date.now() / 1000),
            }
          ]));

          // Send the request event
          ws.send(JSON.stringify(['EVENT', signedEvent]));
        };

        ws.onmessage = async (message) => {
          try {
            const data = JSON.parse(message.data);
            
            // Handle subscription confirmation
            if (data[0] === 'EOSE' && data[1] === subscriptionId) {
              console.log('✅ NWC subscription confirmed');
              return;
            }

            // Handle response event
            if (data[0] === 'EVENT' && data[1] === subscriptionId) {
              const responseEvent = data[2];
              
              // Verify the response event
              if (responseEvent.kind !== 23195) {
                console.warn('⚠️ Unexpected event kind:', responseEvent.kind);
                return;
              }

              if (responseEvent.pubkey !== this.connection.walletPubkey) {
                console.warn('⚠️ Unexpected pubkey:', responseEvent.pubkey);
                return;
              }

              // Decrypt the response
              const decryptedContent = await nip04.decrypt(
                this.connection.secret,
                this.connection.walletPubkey,
                responseEvent.content
              );

              const response = JSON.parse(decryptedContent) as NWCResponse;
              
              // Handle errors
              if (response.error) {
                console.error('❌ NWC error:', response.error);
                const errorMessage = this.getErrorMessage(response.error);
                reject(new Error(errorMessage));
                return;
              }

              // Clean up
              clearTimeout(timeout);
              ws.close();
              
              console.log('✅ NWC response received:', response);
              resolve(response);
            }
          } catch (error) {
            console.error('❌ Error handling NWC message:', error);
            reject(error);
          }
        };

        ws.onerror = (error) => {
          console.error('❌ NWC WebSocket error:', error);
          clearTimeout(timeout);
          reject(new Error('NWC WebSocket error'));
        };

        ws.onclose = () => {
          console.log('🔌 NWC WebSocket closed');
          clearTimeout(timeout);
        };
      });

      return await responsePromise;
    } catch (error) {
      console.error('❌ NWC request failed:', error);
      throw error;
    }
  }

  private getErrorMessage(error: NWCError): string {
    const errorMessages: Record<NWCError['code'], string> = {
      RATE_LIMITED: 'Too many requests. Please try again later.',
      NOT_IMPLEMENTED: 'This method is not supported by the wallet.',
      INSUFFICIENT_BALANCE: 'Insufficient balance to complete the transaction.',
      QUOTA_EXCEEDED: 'You have exceeded your quota for this operation.',
      RESTRICTED: 'This operation is restricted.',
      UNAUTHORIZED: 'You are not authorized to perform this operation.',
      INTERNAL: 'An internal error occurred.',
      OTHER: error.message || 'An unknown error occurred.'
    };

    return errorMessages[error.code] || error.message;
  }

  static generateConnectionString(params: {
    walletPubkey: string;
    relayUrl: string;
    lud16?: string;
  }): { connectionString: string; secret: string } {
    const secret = this.bytesToHex(generateSecretKey());
    
    const url = new URL(`nostr+walletconnect://${params.walletPubkey}`);
    url.searchParams.set('relay', encodeURIComponent(params.relayUrl));
    url.searchParams.set('secret', secret);
    
    if (params.lud16) {
      url.searchParams.set('lud16', params.lud16);
    }

    return {
      connectionString: url.toString(),
      secret,
    };
  }

  // Helper method to create an npub from wallet pubkey
  get walletNpub(): string {
    return nip19.npubEncode(this.connection.walletPubkey);
  }

  // Helper method to get connection info
  get connectionInfo(): NWCConnection {
    return { ...this.connection };
  }

  async makeInvoice(amount: number, description: string): Promise<LightningInvoice> {
    try {
      const response = await this.sendRequest({
        method: 'make_invoice',
        params: {
          amount: amount,
          description: description
        }
      });

      if (response.error) {
        throw new Error(`Failed to create invoice: ${response.error.message}`);
      }

      return response.result as unknown as LightningInvoice;
    } catch (error) {
      console.error('❌ Failed to create invoice:', error);
      throw error;
    }
  }

  async payInvoice(paymentRequest: string): Promise<{ preimage: string }> {
    try {
      const response = await this.sendRequest({
        method: 'pay_invoice',
        params: {
          invoice: paymentRequest
        }
      });

      if (response.error) {
        throw new Error(`Failed to pay invoice: ${response.error.message}`);
      }

      return response.result as { preimage: string };
    } catch (error) {
      console.error('❌ Failed to pay invoice:', error);
      throw error;
    }
  }

  async getBalance(): Promise<number> {
    const response = await this.sendRequest({
      method: 'get_balance',
      params: {}
    }) as NWCGetBalanceResponse;

    if (response.result_type !== 'get_balance') {
      throw new Error('Invalid response type for get_balance');
    }

    return response.result.balance;
  }
}

// Utility function to validate NWC connection string
export function isValidNWCConnection(connectionString: string): boolean {
  try {
    new NWCClient(connectionString);
    return true;
  } catch {
    return false;
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