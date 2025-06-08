// Lightning Network integration
// This example uses LNbits API, but you can adapt it for other providers

export interface LightningInvoice {
  bolt11: string;
  payment_hash: string;
  payment_request: string;
  amount_msat: number;
  description: string;
  expires_at: number;
  checking_id: string;
}

export interface LightningPayment {
  payment_hash: string;
  bolt11: string;
  amount_msat: number;
  paid: boolean;
  preimage?: string;
  paid_at?: number;
}

export interface LightningConfig {
  baseUrl: string;
  apiKey: string;
  walletId: string;
}

export interface NWCConfig {
  connectionString: string;
  walletPubkey: string;
  secret: string;
  relays: string[];
  lud16?: string;
}

class LightningService {
  private config: LightningConfig | null = null;

  configure(config: LightningConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  async createInvoice(
    amountMsat: number,
    description: string,
    expiry: number = 3600 // 1 hour default
  ): Promise<LightningInvoice> {
    if (!this.config) {
      throw new Error('Lightning service not configured');
    }

    const response = await fetch(`${this.config.baseUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.config.apiKey,
      },
      body: JSON.stringify({
        out: false, // incoming payment
        amount: Math.floor(amountMsat / 1000), // convert to sats
        memo: description,
        expiry: expiry,
        webhook: undefined, // You can add webhook URL here
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create invoice: ${error}`);
    }

    const data = await response.json();
    
    return {
      bolt11: data.payment_request,
      payment_hash: data.payment_hash,
      payment_request: data.payment_request,
      amount_msat: amountMsat,
      description: description,
      expires_at: Date.now() + (expiry * 1000),
      checking_id: data.checking_id,
    };
  }

  async checkPayment(paymentHash: string): Promise<LightningPayment> {
    if (!this.config) {
      throw new Error('Lightning service not configured');
    }

    const response = await fetch(`${this.config.baseUrl}/api/v1/payments/${paymentHash}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to check payment: ${error}`);
    }

    const data = await response.json();
    
    return {
      payment_hash: data.payment_hash,
      bolt11: data.bolt11 || data.payment_request,
      amount_msat: data.amount * 1000, // convert from sats to msat
      paid: data.paid,
      preimage: data.preimage,
      paid_at: data.paid_at ? new Date(data.paid_at * 1000).getTime() : undefined,
    };
  }

  async waitForPayment(
    paymentHash: string, 
    timeoutMs: number = 300000 // 5 minutes default
  ): Promise<LightningPayment> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const payment = await this.checkPayment(paymentHash);
        if (payment.paid) {
          return payment;
        }
      } catch (error) {
        console.warn('Error checking payment:', error);
      }
      
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Payment timeout');
  }
}

// Alternative service implementations

// Strike API integration
export class StrikeService {
  private apiKey: string;
  private baseUrl = 'https://api.strike.me';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createInvoice(amountSats: number, description: string): Promise<LightningInvoice> {
    const response = await fetch(`${this.baseUrl}/v1/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        correlationId: crypto.randomUUID(),
        description: description,
        amount: {
          currency: 'BTC',
          amount: (amountSats / 100000000).toString(), // Convert sats to BTC
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Strike API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      bolt11: data.ln.invoice,
      payment_hash: data.ln.paymentHash,
      payment_request: data.ln.invoice,
      amount_msat: amountSats * 1000,
      description: description,
      expires_at: Date.now() + (3600 * 1000), // 1 hour
      checking_id: data.invoiceId,
    };
  }
}

// OpenNode API integration
export class OpenNodeService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, isTestnet: boolean = false) {
    this.apiKey = apiKey;
    this.baseUrl = isTestnet ? 'https://dev-api.opennode.com' : 'https://api.opennode.com';
  }

  async createInvoice(amountSats: number, description: string): Promise<LightningInvoice> {
    const response = await fetch(`${this.baseUrl}/v1/charges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
      },
      body: JSON.stringify({
        amount: amountSats,
        description: description,
        currency: 'BTC',
        callback_url: undefined, // Add your webhook URL here
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenNode API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      bolt11: data.data.lightning_invoice.payreq,
      payment_hash: data.data.lightning_invoice.payment_hash,
      payment_request: data.data.lightning_invoice.payreq,
      amount_msat: amountSats * 1000,
      description: description,
      expires_at: Date.now() + (data.data.lightning_invoice.expires_at * 1000),
      checking_id: data.data.id,
    };
  }
}

// NIP-47 Nostr Wallet Connect Service (Demo Implementation)
export class NWCService {
  private config: NWCConfig | null = null;

  configure(config: NWCConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  // Note: This is a demo implementation
  // In production, this would implement the full NWC protocol
  async createInvoice(
    amountMsat: number,
    description: string,
    _expiry: number = 3600
  ): Promise<LightningInvoice> {
    if (!this.config) {
      throw new Error('NWC service not configured');
    }

    // Demo implementation - would use actual NWC protocol in production
    throw new Error('NWC demo implementation - use the useNWC hook instead');
  }

  async payInvoice(_bolt11: string): Promise<{ preimage: string; fees_paid?: number }> {
    throw new Error('NWC demo implementation - use the useNWC hook instead');
  }

  async getBalance(): Promise<number> {
    throw new Error('NWC demo implementation - use the useNWC hook instead');
  }

  async getInfo(): Promise<Record<string, unknown>> {
    throw new Error('NWC demo implementation - use the useNWC hook instead');
  }
}

// Utility function to parse NWC connection string
export function parseNWCConnectionString(connectionString: string): NWCConfig {
  try {
    const url = new URL(connectionString);
    
    if (url.protocol !== 'nostr+walletconnect:') {
      throw new Error('Invalid NWC connection string protocol');
    }

    const walletPubkey = url.pathname.replace('//', '');
    const secret = url.searchParams.get('secret');
    const relayParams = url.searchParams.getAll('relay');
    const lud16 = url.searchParams.get('lud16') || undefined;

    if (!walletPubkey || !secret || relayParams.length === 0) {
      throw new Error('Missing required parameters in NWC connection string');
    }

    return {
      connectionString,
      walletPubkey,
      secret,
      relays: relayParams,
      lud16,
    };
  } catch (error) {
    throw new Error(`Invalid NWC connection string: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Export singleton instance
export const lightningService = new LightningService();
export const _nwcService = new NWCService();

// Utility function to copy invoice to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch {
      document.body.removeChild(textArea);
      return false;
    }
  }
}

// Utility to detect Lightning wallet apps
export function detectLightningWallet(): string | null {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('phoenix')) return 'phoenix';
  if (userAgent.includes('breez')) return 'breez';
  if (userAgent.includes('muun')) return 'muun';
  if (userAgent.includes('wallet of satoshi')) return 'walletofsatoshi';
  if (userAgent.includes('blue wallet')) return 'bluewallet';
  if (userAgent.includes('zeus')) return 'zeus';
  
  return null;
}

// Utility to open Lightning invoice in wallet
export function openInLightningWallet(bolt11: string): boolean {
  try {
    // Try lightning: protocol first
    window.location.href = `lightning:${bolt11}`;
    return true;
  } catch {
    try {
      // Fallback to bitcoin: protocol
      window.location.href = `bitcoin:?lightning=${bolt11}`;
      return true;
    } catch {
      return false;
    }
  }
}