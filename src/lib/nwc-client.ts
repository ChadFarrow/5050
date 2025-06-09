import { nip19 } from 'nostr-tools';
import type { 
  NWCConnection, 
  NWCCapabilities, 
  LightningInvoice, 
  NWCInfoResponse,
  NWCGetBalanceResponse,
  MCPServerConfig,
  NWCMethod
} from './nwc-types';
import { parseConnectionString, generateConnectionString } from './nwc-utils';
import { NWCTransport } from './nwc-transport';

export class NWCClient {
  private connection: NWCConnection;
  private transport: NWCTransport;
  private capabilities?: NWCCapabilities;

  constructor(connectionString: string, mcpConfig?: MCPServerConfig) {
    this.connection = parseConnectionString(connectionString);
    this.transport = new NWCTransport(this.connection, mcpConfig);
  }

  // Helper methods
  get walletNpub(): string {
    return nip19.npubEncode(this.connection.walletPubkey);
  }

  get connectionInfo(): NWCConnection {
    return { ...this.connection };
  }

  static generateConnectionString = generateConnectionString;

  // Core NWC methods
  async getInfo(): Promise<NWCInfoResponse['result']> {
    const response = await this.transport.sendRequest({
      method: 'get_info',
      params: {}
    }) as NWCInfoResponse;

    if (response.result_type !== 'get_info') {
      throw new Error('Invalid response type for get_info');
    }

    // Cache capabilities
    this.capabilities = { methods: response.result.methods };

    return response.result;
  }

  async getBalance(): Promise<number> {
    const response = await this.transport.sendRequest({
      method: 'get_balance',
      params: {}
    }) as NWCGetBalanceResponse;

    if (response.result_type !== 'get_balance') {
      throw new Error('Invalid response type for get_balance');
    }

    return response.result.balance;
  }

  async makeInvoice(amount: number, description: string): Promise<LightningInvoice> {
    const response = await this.transport.sendRequest({
      method: 'make_invoice',
      params: { amount, description }
    });

    if (response.error) {
      throw new Error(`Failed to create invoice: ${response.error.message}`);
    }

    const result = response.result as {
      bolt11: string;
      payment_hash: string;
      payment_request: string;
      amount_msat: number;
      description: string;
      expires_at: number;
      checking_id: string;
    };

    return {
      bolt11: result.bolt11,
      payment_hash: result.payment_hash,
      payment_request: result.payment_request || result.bolt11,
      amount_msat: result.amount_msat || amount,
      description: result.description || description,
      expires_at: result.expires_at || Math.floor(Date.now() / 1000) + 3600,
      checking_id: result.checking_id || result.payment_hash,
    };
  }

  async payInvoice(paymentRequest: string): Promise<{ preimage: string }> {
    const response = await this.transport.sendRequest({
      method: 'pay_invoice',
      params: { invoice: paymentRequest }
    });

    if (response.error) {
      throw new Error(`Failed to pay invoice: ${response.error.message}`);
    }

    return response.result as { preimage: string };
  }

  // Capability checking
  private async ensureCapabilities(): Promise<void> {
    if (!this.capabilities) {
      try {
        await this.getInfo();
      } catch {
        // Default to basic capabilities if we can't get them
        this.capabilities = { methods: ['make_invoice', 'pay_invoice'] };
      }
    }
  }

  async hasCapability(method: string): Promise<boolean> {
    await this.ensureCapabilities();
    return this.capabilities?.methods.includes(method as NWCMethod) || false;
  }
}