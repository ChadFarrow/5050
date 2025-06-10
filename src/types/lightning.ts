export interface LightningInvoice {
  bolt11: string;
  payment_request: string;
  amount_msat: number;
  description: string;
  payment_hash: string;
  expires_at: number;
  checking_id: string;
}