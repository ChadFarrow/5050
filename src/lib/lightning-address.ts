// Lightning Address and LNURL-pay utilities for generating invoices from fundraiser creators

export interface LightningAddressInfo {
  callback: string;
  maxSendable: number;
  minSendable: number;
  metadata: string;
  tag: string;
  allowsNostr?: boolean;
  nostrPubkey?: string;
}

export interface LNURLPayResponse {
  pr: string; // bolt11 invoice
  routes?: string[];
  successAction?: {
    tag: string;
    message?: string;
    url?: string;
  };
}

/**
 * Convert Lightning address (user@domain.com) to LNURL
 */
export function lightningAddressToLNURL(lightningAddress: string): string {
  const [username, domain] = lightningAddress.split('@');
  if (!username || !domain) {
    throw new Error('Invalid Lightning address format');
  }
  
  const url = `https://${domain}/.well-known/lnurlp/${username}`;
  return url;
}

/**
 * Fetch Lightning address info from the LNURL endpoint
 */
export async function fetchLightningAddressInfo(lightningAddress: string): Promise<LightningAddressInfo> {
  const lnurlEndpoint = lightningAddressToLNURL(lightningAddress);
  
  const response = await fetch(lnurlEndpoint);
  if (!response.ok) {
    throw new Error(`Failed to fetch Lightning address info: ${response.statusText}`);
  }
  
  const data = await response.json();
  if (data.status === 'ERROR') {
    throw new Error(`Lightning address error: ${data.reason}`);
  }
  
  return data;
}

/**
 * Generate an invoice from a Lightning address
 */
export async function generateInvoiceFromLightningAddress(
  lightningAddress: string,
  amountMsats: number,
  comment?: string
): Promise<string> {
  try {
    // Step 1: Get Lightning address info
    const addressInfo = await fetchLightningAddressInfo(lightningAddress);
    
    // Step 2: Validate amount
    if (amountMsats < addressInfo.minSendable || amountMsats > addressInfo.maxSendable) {
      throw new Error(`Amount ${amountMsats} msats is outside allowed range ${addressInfo.minSendable}-${addressInfo.maxSendable} msats`);
    }
    
    // Step 3: Request invoice
    const callbackUrl = new URL(addressInfo.callback);
    callbackUrl.searchParams.set('amount', amountMsats.toString());
    if (comment) {
      callbackUrl.searchParams.set('comment', comment);
    }
    
    const invoiceResponse = await fetch(callbackUrl.toString());
    if (!invoiceResponse.ok) {
      throw new Error(`Failed to generate invoice: ${invoiceResponse.statusText}`);
    }
    
    const invoiceData: LNURLPayResponse = await invoiceResponse.json();
    if (!invoiceData.pr) {
      throw new Error('No invoice received from Lightning address');
    }
    
    return invoiceData.pr;
  } catch (error) {
    console.error('Error generating invoice from Lightning address:', error);
    throw error;
  }
}

/**
 * Check if a Lightning address is valid format
 */
export function isValidLightningAddress(address: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(address);
}

/**
 * Generate invoice for fundraiser using their Lightning address or LNURL
 */
export async function generateFundraiserInvoice(
  campaign: { lightningAddress?: string; lnurl?: string; title: string },
  amountMsats: number,
  ticketCount: number
): Promise<string> {
  const comment = `${ticketCount} ticket${ticketCount > 1 ? 's' : ''} for ${campaign.title}`;
  
  if (campaign.lightningAddress) {
    if (!isValidLightningAddress(campaign.lightningAddress)) {
      throw new Error('Invalid Lightning address format');
    }
    return generateInvoiceFromLightningAddress(campaign.lightningAddress, amountMsats, comment);
  }
  
  if (campaign.lnurl) {
    // For direct LNURL, we need to implement similar logic but with the provided URL
    // This is a simplified version - in practice you'd want full LNURL validation
    throw new Error('Direct LNURL support not implemented yet - please use Lightning address');
  }
  
  throw new Error('No Lightning payment method configured for this fundraiser');
}