import type { NostrEvent } from '@nostrify/nostrify';

// NWC Core Types
export type NWCMethod = 'get_info' | 'pay_invoice' | 'make_invoice' | 'lookup_invoice' | 'list_transactions' | 'get_balance';

export interface NWCError {
  code: 'RATE_LIMITED' | 'NOT_IMPLEMENTED' | 'INSUFFICIENT_BALANCE' | 'QUOTA_EXCEEDED' | 'RESTRICTED' | 'UNAUTHORIZED' | 'INTERNAL' | 'OTHER';
  message: string;
}

export interface NWCResponse {
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

export interface NWCCapabilities {
  methods: NWCMethod[];
}

export interface LightningInvoice {
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

export interface NWCInfoResponse extends NWCResponse {
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

// MCP Server Types
export interface MCPServerConfig {
  enabled: boolean;
  serverUrl?: string;
  apiKey?: string;
}

export interface MCPRequest {
  method: string;
  params: Record<string, unknown>;
  id?: string;
}

// Global Window Type
declare global {
  interface Window {
    nostr?: {
      signEvent(event: Omit<NostrEvent, 'id' | 'sig'>): Promise<NostrEvent>;
      getPublicKey?(): Promise<string>;
      nip04?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
      };
    };
  }
}