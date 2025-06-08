// WebLN type definitions
interface WebLNProvider {
  enable(): Promise<void>;
  sendPayment(bolt11: string): Promise<{ preimage: string; payment_hash?: string }>;
  makeInvoice(args: { amount?: number; defaultMemo?: string }): Promise<{ paymentRequest: string }>;
  signMessage(message: string): Promise<{ message: string; signature: string }>;
  verifyMessage(signature: string, message: string): Promise<void>;
}

declare global {
  interface Window {
    webln?: WebLNProvider;
  }
}

export {};