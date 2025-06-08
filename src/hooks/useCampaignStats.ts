import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

export interface CampaignStats {
  totalRaised: number; // millisats
  totalTickets: number;
  uniqueParticipants: number;
  purchases: TicketPurchase[];
  result?: CampaignResult;
}

export interface CampaignResult {
  id: string;
  pubkey: string;
  dTag: string;
  winnerPubkey: string;
  winningTicket: number;
  totalRaised: number; // millisats
  winnerAmount: number; // millisats
  creatorAmount: number; // millisats
  totalTickets: number;
  randomSeed?: string;
  winnerPayment?: string;
  message: string;
  createdAt: number;
  event: NostrEvent;
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

function validateCampaignResult(event: NostrEvent): boolean {
  if (event.kind !== 31952) return false;

  const tags = new Map(event.tags.map(([name, value]) => [name, value]));
  const requiredTags = ['d', 'a', 'winner', 'winning_ticket', 'total_raised', 'winner_amount', 'creator_amount', 'total_tickets'];

  for (const tag of requiredTags) {
    if (!tags.has(tag) || !tags.get(tag)) return false;
  }

  // Validate numeric fields
  const winningTicket = parseInt(tags.get('winning_ticket') || '0');
  const totalRaised = parseInt(tags.get('total_raised') || '0');
  const winnerAmount = parseInt(tags.get('winner_amount') || '0');
  const creatorAmount = parseInt(tags.get('creator_amount') || '0');
  const totalTickets = parseInt(tags.get('total_tickets') || '0');

  if (winningTicket <= 0 || totalRaised <= 0 || winnerAmount < 0 || creatorAmount < 0 || totalTickets <= 0) return false;

  return true;
}

function eventToCampaignResult(event: NostrEvent): CampaignResult {
  const tags = new Map(event.tags.map(([name, value]) => [name, value]));

  return {
    id: event.id,
    pubkey: event.pubkey,
    dTag: tags.get('d') || '',
    winnerPubkey: tags.get('winner') || '',
    winningTicket: parseInt(tags.get('winning_ticket') || '0'),
    totalRaised: parseInt(tags.get('total_raised') || '0'),
    winnerAmount: parseInt(tags.get('winner_amount') || '0'),
    creatorAmount: parseInt(tags.get('creator_amount') || '0'),
    totalTickets: parseInt(tags.get('total_tickets') || '0'),
    randomSeed: tags.get('random_seed'),
    winnerPayment: tags.get('winner_payment'),
    message: event.content,
    createdAt: event.created_at,
    event,
  };
}

export function useCampaignStats(pubkey: string, dTag: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['fundraiser-stats', pubkey, dTag],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      // Query for ticket purchases for this campaign
      const campaignCoordinate = `31950:${pubkey}:${dTag}`;
      
      const [purchaseEvents, resultEvents] = await Promise.all([
        nostr.query(
          [{
            kinds: [31951],
            '#a': [campaignCoordinate],
            limit: 1000, // Should be enough for most campaigns
          }],
          { signal }
        ),
        nostr.query(
          [{
            kinds: [31952],
            authors: [pubkey],
            '#d': [dTag],
            limit: 1,
          }],
          { signal }
        )
      ]);

      // Filter and transform purchase events
      const validPurchaseEvents = purchaseEvents.filter(validateTicketPurchase);
      const purchases = validPurchaseEvents.map(eventToTicketPurchase);

      // Sort by creation date
      purchases.sort((a, b) => a.createdAt - b.createdAt);

      // Calculate stats
      const totalRaised = purchases.reduce((sum, p) => sum + p.amount, 0);
      const totalTickets = purchases.reduce((sum, p) => sum + p.tickets, 0);
      const uniqueParticipants = new Set(purchases.map(p => p.pubkey)).size;

      // Check for campaign result
      let result: CampaignResult | undefined;
      const resultEvent = resultEvents.find(validateCampaignResult);
      if (resultEvent) {
        result = eventToCampaignResult(resultEvent);
      }

      const stats: CampaignStats = {
        totalRaised,
        totalTickets,
        uniqueParticipants,
        purchases,
        result,
      };

      return stats;
    },
    enabled: !!pubkey && !!dTag,
    staleTime: 15000, // 15 seconds
    refetchInterval: 30000, // 30 seconds
  });
}

export function useUserTickets(fundraiserPubkey: string, fundraiserDTag: string, userPubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['user-tickets', fundraiserPubkey, fundraiserDTag, userPubkey],
    queryFn: async (c) => {
      if (!userPubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      const fundraiserCoordinate = `31950:${fundraiserPubkey}:${fundraiserDTag}`;
      
      const events = await nostr.query(
        [{
          kinds: [31951],
          authors: [userPubkey],
          '#a': [fundraiserCoordinate],
          limit: 100,
        }],
        { signal }
      );

      const validEvents = events.filter(validateTicketPurchase);
      const purchases = validEvents.map(eventToTicketPurchase);

      return purchases.sort((a, _b) => a.createdAt - a.createdAt);
    },
    enabled: !!fundraiserPubkey && !!fundraiserDTag && !!userPubkey,
    staleTime: 15000,
  });
}