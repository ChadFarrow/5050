import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

export interface CampaignStats {
  totalRaised: number; // millisats
  totalTickets: number;
  uniqueParticipants: number;
  purchases: TicketPurchase[];
}

export interface TicketPurchase {
  id: string;
  pubkey: string;
  amount: number; // millisats
  tickets: number;
  createdAt: number;
  paymentHash: string;
  bolt11: string;
  zapReceipt?: string;
  message?: string;
  event: NostrEvent;
}

function validateTicketPurchase(event: NostrEvent): boolean {
  if (event.kind !== 31951) return false;

  const tags = new Map(event.tags.map(([name, value]) => [name, value]));
  const requiredTags = ['d', 'a', 'amount', 'tickets', 'bolt11', 'payment_hash'];

  for (const tag of requiredTags) {
    if (!tags.has(tag) || !tags.get(tag)) return false;
  }

  // Validate numeric fields
  const amount = parseInt(tags.get('amount') || '0');
  const tickets = parseInt(tags.get('tickets') || '0');

  if (amount <= 0 || tickets <= 0) return false;

  return true;
}

function eventToTicketPurchase(event: NostrEvent): TicketPurchase {
  const tags = new Map(event.tags.map(([name, value]) => [name, value]));

  return {
    id: event.id,
    pubkey: event.pubkey,
    amount: parseInt(tags.get('amount') || '0'),
    tickets: parseInt(tags.get('tickets') || '0'),
    createdAt: event.created_at,
    paymentHash: tags.get('payment_hash') || '',
    bolt11: tags.get('bolt11') || '',
    zapReceipt: tags.get('zap_receipt'),
    message: event.content || undefined,
    event,
  };
}

export function useCampaignStats(pubkey: string, dTag: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['campaign-stats', pubkey, dTag],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Query for ticket purchases for this campaign
      const campaignCoordinate = `31950:${pubkey}:${dTag}`;
      
      const events = await nostr.query(
        [{
          kinds: [31951],
          '#a': [campaignCoordinate],
          limit: 1000, // Should be enough for most campaigns
        }],
        { signal }
      );

      // Filter and transform events
      const validEvents = events.filter(validateTicketPurchase);
      const purchases = validEvents.map(eventToTicketPurchase);

      // Sort by creation date
      purchases.sort((a, b) => a.createdAt - b.createdAt);

      // Calculate stats
      const totalRaised = purchases.reduce((sum, p) => sum + p.amount, 0);
      const totalTickets = purchases.reduce((sum, p) => sum + p.tickets, 0);
      const uniqueParticipants = new Set(purchases.map(p => p.pubkey)).size;

      const stats: CampaignStats = {
        totalRaised,
        totalTickets,
        uniqueParticipants,
        purchases,
      };

      return stats;
    },
    enabled: !!pubkey && !!dTag,
    staleTime: 15000, // 15 seconds
    refetchInterval: 30000, // 30 seconds
  });
}

export function useUserTickets(campaignPubkey: string, campaignDTag: string, userPubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['user-tickets', campaignPubkey, campaignDTag, userPubkey],
    queryFn: async (c) => {
      if (!userPubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      const campaignCoordinate = `31950:${campaignPubkey}:${campaignDTag}`;
      
      const events = await nostr.query(
        [{
          kinds: [31951],
          authors: [userPubkey],
          '#a': [campaignCoordinate],
          limit: 100,
        }],
        { signal }
      );

      const validEvents = events.filter(validateTicketPurchase);
      const purchases = validEvents.map(eventToTicketPurchase);

      return purchases.sort((a, _b) => a.createdAt - a.createdAt);
    },
    enabled: !!campaignPubkey && !!campaignDTag && !!userPubkey,
    staleTime: 15000,
  });
}