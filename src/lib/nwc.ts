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

// Import types from global definitions
type MakeInvoiceRequest = {
  method: 'make_invoice';
  params: {
    amount: number;
    description?: string;
    description_hash?: string;
    expiry?: number;
  };
};

type MakeInvoiceResponse = {
  result_type: 'make_invoice';
  result?: {
    type: 'incoming';
    invoice: string;
    description?: string;
    description_hash?: string;
    preimage?: string;
    payment_hash: string;
    amount: number;
    fees_paid?: number;
    created_at: number;
    expires_at?: number;
    metadata?: Record<string, unknown>;
  };
  error?: {
    code: string;
    message: string;
  };
};

type PayInvoiceRequest = {
  method: 'pay_invoice';
  params: {
    invoice: string;
    amount?: number;
  };
};

type PayInvoiceResponse = {
  result_type: 'pay_invoice';
  result?: {
    preimage: string;
    fees_paid?: number;
  };
  error?: {
    code: string;
    message: string;
  };
};

type GetInfoRequest = {
  method: 'get_info';
  params: Record<string, never>;
};

type GetInfoResponse = {
  result_type: 'get_info';
  result?: {
    alias: string;
    color: string;
    pubkey: string;
    network: string;
    block_height: number;
    block_hash: string;
    methods: string[];
    notifications?: string[];
  };
  error?: {
    code: string;
    message: string;
  };
};

type NWCRequest = {
  method: string;
  params: Record<string, unknown>;
};

type NWCResponse = {
  result_type: string;
  result?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
};

export interface NWCConnection {
  walletPubkey: string;
  relayUrl: string;
  secret: string;
  lud16?: string;
}

export class NWCClient {
  private connection: NWCConnection;
  private clientSecret: Uint8Array;
  private clientPubkey: string;

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

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async makeInvoice(params: {
    amount: number;
    description?: string;
    expiry?: number;
  }): Promise<MakeInvoiceResponse> {
    const request: MakeInvoiceRequest = {
      method: 'make_invoice',
      params: {
        amount: params.amount,
        description: params.description,
        expiry: params.expiry || 3600, // 1 hour default
      },
    };

    return this.sendRequest(request) as Promise<MakeInvoiceResponse>;
  }

  async payInvoice(params: {
    invoice: string;
    amount?: number;
  }): Promise<PayInvoiceResponse> {
    const request: PayInvoiceRequest = {
      method: 'pay_invoice',
      params,
    };

    return this.sendRequest(request) as Promise<PayInvoiceResponse>;
  }

  async getInfo(): Promise<GetInfoResponse> {
    const request: GetInfoRequest = {
      method: 'get_info',
      params: {},
    };

    return this.sendRequest(request) as Promise<GetInfoResponse>;
  }

  private async sendRequest(request: NWCRequest): Promise<NWCResponse> {
    try {
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
            'nwc-response',
            {
              kinds: [23195], // NIP-47 response
              authors: [this.connection.walletPubkey],
              since: Math.floor(Date.now() / 1000),
            }
          ]));

          // Send the request event
          ws.send(JSON.stringify(['EVENT', signedEvent]));
          console.log('📤 NWC request sent:', request.method);
        };

        ws.onmessage = async (message) => {
          try {
            const data = JSON.parse(message.data);
            
            // Check if this is a response event (kind 23195)
            if (data[0] === 'EVENT' && data[2].kind === 23195) {
              const responseEvent = data[2];
              
              // Verify the response is from the wallet
              if (responseEvent.pubkey !== this.connection.walletPubkey) {
                console.warn('Received response from unexpected pubkey:', responseEvent.pubkey);
                return;
              }

              // Decrypt the response
              const decryptedContent = await nip04.decrypt(
                this.connection.secret,
                this.connection.walletPubkey,
                responseEvent.content
              );

              const response = JSON.parse(decryptedContent) as NWCResponse;

              // Check for errors
              if (response.error) {
                console.error('NWC error:', response.error);
                reject(new Error(`NWC error: ${response.error.message}`));
                return;
              }

              console.log('📥 NWC response received:', response.result_type);
              clearTimeout(timeout);
              ws.close();
              resolve(response);
            }
          } catch (error) {
            console.error('Error processing NWC response:', error);
            reject(error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          clearTimeout(timeout);
          ws.close();
          reject(new Error('Failed to connect to relay'));
        };

        ws.onclose = () => {
          clearTimeout(timeout);
        };
      });

      return await responsePromise;
    } catch (error) {
      console.error('NWC request failed:', error);
      throw error;
    }
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

  private static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Helper method to create an npub from wallet pubkey
  get walletNpub(): string {
    return nip19.npubEncode(this.connection.walletPubkey);
  }

  // Helper method to get connection info
  get connectionInfo(): NWCConnection {
    return { ...this.connection };
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