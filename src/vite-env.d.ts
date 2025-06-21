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
  BitcoinConnect?: unknown;
}

// Bitcoin Connect web components
declare namespace JSX {
  interface IntrinsicElements {
    'bc-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    'bc-modal': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
  }
}
