/// <reference types="vite/client" />

// WebLN interface
interface Window {
  webln?: {
    enabled?: boolean;
    enable(): Promise<void>;
    makeInvoice(args: { amount: number; defaultMemo?: string }): Promise<{ paymentRequest: string }>;
    sendPayment(paymentRequest: string): Promise<{ preimage: string }>;
    getBalance?(): Promise<{ balance: number }>;
    getInfo?(): Promise<{ node?: { alias?: string; pubkey?: string } }>;
  };
}
