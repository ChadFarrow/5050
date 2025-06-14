import { nip19 } from 'nostr-tools';
import type { Campaign } from '@/hooks/useCampaigns';

/**
 * Creates a properly formatted campaign URL using naddr encoding
 */
export function createCampaignUrl(campaign: Campaign): string {
  try {
    const naddr = nip19.naddrEncode({
      kind: 31950,
      pubkey: campaign.pubkey,
      identifier: campaign.dTag,
    });
    return `${window.location.origin}/${naddr}`;
  } catch (error) {
    console.error('Failed to encode naddr:', error);
    // Fallback to raw format (supported by router)
    return `${window.location.origin}/campaign/${campaign.pubkey}/${campaign.dTag}`;
  }
}

/**
 * Creates a campaign URL using raw pubkey and dTag (for cases where Campaign object isn't available)
 */
export function createCampaignUrlFromParts(pubkey: string, dTag: string): string {
  try {
    const naddr = nip19.naddrEncode({
      kind: 31950,
      pubkey,
      identifier: dTag,
    });
    return `${window.location.origin}/${naddr}`;
  } catch (error) {
    console.error('Failed to encode naddr:', error);
    // Fallback to raw format (supported by router)
    return `${window.location.origin}/campaign/${pubkey}/${dTag}`;
  }
}