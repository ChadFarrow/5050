import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

export interface Fundraiser {
  id: string;
  pubkey: string;
  dTag: string;
  title: string;
  description: string;
  content: string;
  target: number; // millisats
  ticketPrice: number; // millisats
  endDate: number; // unix timestamp
  podcast: string;
  podcastUrl?: string;
  episode?: string;
  image?: string;
  isActive: boolean;
  createdAt: number;
  event: NostrEvent;
}

// Keep Campaign as an alias for backward compatibility
export type Campaign = Fundraiser;

function validateFundraiserEvent(event: NostrEvent): boolean {
  if (event.kind !== 31950) return false;

  const requiredTags = ['d', 'title', 'description', 'target', 'ticket_price', 'end_date', 'podcast'];
  const tags = new Map(event.tags.map(([name, value]) => [name, value]));

  for (const tag of requiredTags) {
    if (!tags.has(tag) || !tags.get(tag)) return false;
  }

  // Validate numeric fields
  const target = parseInt(tags.get('target') || '0');
  const ticketPrice = parseInt(tags.get('ticket_price') || '0');
  const endDate = parseInt(tags.get('end_date') || '0');

  if (target <= 0 || ticketPrice <= 0 || endDate <= 0) return false;

  return true;
}

function eventToFundraiser(event: NostrEvent): Fundraiser {
  const tags = new Map(event.tags.map(([name, value]) => [name, value]));
  const now = Math.floor(Date.now() / 1000);
  const endDate = parseInt(tags.get('end_date') || '0');

  return {
    id: event.id,
    pubkey: event.pubkey,
    dTag: tags.get('d') || '',
    title: tags.get('title') || '',
    description: tags.get('description') || '',
    content: event.content,
    target: parseInt(tags.get('target') || '0'),
    ticketPrice: parseInt(tags.get('ticket_price') || '0'),
    endDate,
    podcast: tags.get('podcast') || '',
    podcastUrl: tags.get('podcast_url'),
    episode: tags.get('episode'),
    image: tags.get('image'),
    isActive: endDate > now,
    createdAt: event.created_at,
    event,
  };
}

export function useFundraisers() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['fundraisers'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const events = await nostr.query(
        [{ kinds: [31950], limit: 50 }],
        { signal }
      );

      // Filter and transform events
      const validEvents = events.filter(validateFundraiserEvent);
      const fundraisers = validEvents.map(eventToFundraiser);

      // Sort by creation date, newest first
      return fundraisers.sort((a, b) => b.createdAt - a.createdAt);
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

export function useFundraiser(pubkey: string, dTag: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['fundraiser', pubkey, dTag],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      const events = await nostr.query(
        [{
          kinds: [31950],
          authors: [pubkey],
          '#d': [dTag],
          limit: 1,
        }],
        { signal }
      );

      const event = events[0];
      if (!event || !validateFundraiserEvent(event)) {
        return null;
      }

      return eventToFundraiser(event);
    },
    enabled: !!pubkey && !!dTag,
    staleTime: 30000,
  });
}

// Keep old function names for backward compatibility
export const useCampaigns = useFundraisers;
export const useCampaign = useFundraiser;