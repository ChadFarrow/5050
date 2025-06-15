import { nip19 } from 'nostr-tools';
import type { Campaign } from '@/hooks/useCampaigns';

/**
 * Creates a properly formatted campaign URL using naddr encoding
 */
export function createCampaignUrl(campaign: Campaign, useProductionUrl = false): string {
  try {
    const naddr = nip19.naddrEncode({
      kind: 31950,
      pubkey: campaign.pubkey,
      identifier: campaign.dTag,
    });
    const baseUrl = useProductionUrl ? 'https://5050-xi.vercel.app' : window.location.origin;
    return `${baseUrl}/${naddr}`;
  } catch (error) {
    console.error('Failed to encode naddr:', error);
    // Fallback to raw format (supported by router)
    const baseUrl = useProductionUrl ? 'https://www.5050pods.com' : window.location.origin;
    return `${baseUrl}/campaign/${campaign.pubkey}/${campaign.dTag}`;
  }
}

/**
 * Creates a campaign URL using raw pubkey and dTag (for cases where Campaign object isn't available)
 */
export function createCampaignUrlFromParts(pubkey: string, dTag: string, useProductionUrl = false): string {
  try {
    const naddr = nip19.naddrEncode({
      kind: 31950,
      pubkey,
      identifier: dTag,
    });
    const baseUrl = useProductionUrl ? 'https://www.5050pods.com' : window.location.origin;
    return `${baseUrl}/${naddr}`;
  } catch (error) {
    console.error('Failed to encode naddr:', error);
    // Fallback to raw format (supported by router)
    const baseUrl = useProductionUrl ? 'https://www.5050pods.com' : window.location.origin;
    return `${baseUrl}/campaign/${pubkey}/${dTag}`;
  }
}