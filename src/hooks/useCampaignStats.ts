import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

export interface CampaignStats {
  totalRaised: number; // millisats from tickets
  totalDonations: number; // millisats from direct donations
  totalTickets: number;
  uniqueParticipants: number;
  purchases: TicketPurchase[];
  donations: Donation[];
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

export interface Donation {
  id: string;
  pubkey: string;
  amount: number; // millisats
  createdAt: number;
  paymentHash: string;
  bolt11: string;
  zapReceipt?: string;
  message?: string;
  isAnonymous?: boolean;
  event: NostrEvent;
}

function validateTicketPurchase(event: NostrEvent): boolean {
  if (event.kind !== 31951) {
    console.log('Invalid event kind:', event.kind, 'for event:', event.id);
    return false;
  }

  const tags = new Map(event.tags.map(([name, value]) => [name, value]));
  const requiredTags = ['d', 'a', 'amount', 'tickets', 'bolt11', 'payment_hash'];

  for (const tag of requiredTags) {
    if (!tags.has(tag) || !tags.get(tag)) {
      console.log(`Missing or empty tag '${tag}' in event:`, event.id, 'tags:', Object.fromEntries(tags));
      return false;
    }
  }

  // Validate numeric fields
  const amount = parseInt(tags.get('amount') || '0');
  const tickets = parseInt(tags.get('tickets') || '0');

  if (amount <= 0 || tickets <= 0) {
    console.log(`Invalid numeric values in event ${event.id}:`, { amount, tickets });
    return false;
  }

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

function validateDonation(event: NostrEvent): boolean {
  if (event.kind !== 31953) {
    return false;
  }

  const tags = new Map(event.tags.map(([name, value]) => [name, value]));
  const requiredTags = ['d', 'a', 'amount', 'bolt11', 'payment_hash'];

  for (const tag of requiredTags) {
    if (!tags.has(tag) || !tags.get(tag)) {
      return false;
    }
  }

  // Validate numeric fields
  const amount = parseInt(tags.get('amount') || '0');

  if (amount <= 0) {
    return false;
  }

  return true;
}

function eventToDonation(event: NostrEvent): Donation {
  const tags = new Map(event.tags.map(([name, value]) => [name, value]));

  return {
    id: event.id,
    pubkey: event.pubkey,
    amount: parseInt(tags.get('amount') || '0'),
    createdAt: event.created_at,
    paymentHash: tags.get('payment_hash') || '',
    bolt11: tags.get('bolt11') || '',
    zapReceipt: tags.get('zap_receipt'),
    message: event.content || undefined,
    isAnonymous: tags.get('anonymous') === 'true',
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

// Helper function to store donation to local storage as fallback
export function storePendingDonation(campaignPubkey: string, campaignDTag: string, donation: Donation) {
  const campaignCoordinate = `31950:${campaignPubkey}:${campaignDTag}`;
  const pendingDonationsKey = `pending-donations-${campaignCoordinate}`;
  
  try {
    const existingJson = localStorage.getItem(pendingDonationsKey) || '[]';
    const existingDonations = JSON.parse(existingJson) as Donation[];
    
    // Check if this donation already exists
    const exists = existingDonations.some(d => d.id === donation.id);
    if (!exists) {
      existingDonations.push(donation);
      localStorage.setItem(pendingDonationsKey, JSON.stringify(existingDonations));
      console.log(`💾 Stored pending donation ${donation.id} to local storage`);
    }
  } catch (error) {
    console.error('Failed to store pending donation:', error);
  }
}

// Helper function to store ticket purchase to local storage as fallback
export function storePendingPurchase(campaignPubkey: string, campaignDTag: string, purchase: TicketPurchase) {
  const campaignCoordinate = `31950:${campaignPubkey}:${campaignDTag}`;
  const pendingPurchasesKey = `pending-purchases-${campaignCoordinate}`;
  
  try {
    const existingJson = localStorage.getItem(pendingPurchasesKey) || '[]';
    const existingPurchases = JSON.parse(existingJson) as TicketPurchase[];
    
    // Check if this purchase already exists
    const exists = existingPurchases.some(p => p.id === purchase.id);
    if (!exists) {
      existingPurchases.push(purchase);
      localStorage.setItem(pendingPurchasesKey, JSON.stringify(existingPurchases));
      console.log(`💾 Stored pending purchase ${purchase.id} to local storage`);
    }
  } catch (error) {
    console.error('Failed to store pending purchase:', error);
  }
}

export function useCampaignStats(pubkey: string, dTag: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['fundraiser-stats', pubkey, dTag],
    queryFn: async (c) => {
      console.log(`🚀 useCampaignStats queryFn called for ${pubkey}:${dTag}`);
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
      
      // Query for ticket purchases for this campaign
      const campaignCoordinate = `31950:${pubkey}:${dTag}`;
      console.log(`🔍 Querying for campaign coordinate: ${campaignCoordinate}`);
      
      // Get any pending donations from local storage as a fallback
      const pendingDonationsKey = `pending-donations-${campaignCoordinate}`;
      const pendingDonationsJson = localStorage.getItem(pendingDonationsKey) || '[]';
      const pendingDonations = JSON.parse(pendingDonationsJson) as Donation[];
      
      // Get any pending purchases from local storage as a fallback
      const pendingPurchasesKey = `pending-purchases-${campaignCoordinate}`;
      const pendingPurchasesJson = localStorage.getItem(pendingPurchasesKey) || '[]';
      const pendingPurchases = JSON.parse(pendingPurchasesJson) as TicketPurchase[];
      
      // Clean up old pending items (older than 24 hours)
      const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 86400;
      const validPendingDonations = pendingDonations.filter(d => d.createdAt > twentyFourHoursAgo);
      if (validPendingDonations.length !== pendingDonations.length) {
        localStorage.setItem(pendingDonationsKey, JSON.stringify(validPendingDonations));
      }
      
      const validPendingPurchases = pendingPurchases.filter(p => p.createdAt > twentyFourHoursAgo);
      if (validPendingPurchases.length !== pendingPurchases.length) {
        localStorage.setItem(pendingPurchasesKey, JSON.stringify(validPendingPurchases));
      }
      
      console.log(`💾 Found ${validPendingDonations.length} pending donations and ${validPendingPurchases.length} pending purchases in local storage`);

      const [purchaseEvents, donationEvents, resultEvents] = await Promise.all([
        nostr.query(
          [{
            kinds: [31951], // Ticket purchases
            '#a': [campaignCoordinate],
            limit: 1000, // Should be enough for most campaigns
          }],
          { signal }
        ),
        nostr.query(
          [{
            kinds: [31953], // Direct donations
            '#a': [campaignCoordinate],
            limit: 1000, // Should be enough for most campaigns
          }],
          { signal }
        ),
        nostr.query(
          [{
            kinds: [31952], // Campaign results
            authors: [pubkey],
            '#d': [dTag],
            limit: 1,
          }],
          { signal }
        )
      ]);

      // Filter and transform purchase events
      const validPurchaseEvents = purchaseEvents.filter(validateTicketPurchase);
      const relayPurchases = validPurchaseEvents.map(eventToTicketPurchase);
      
      // Remove any pending purchases that now exist in relay results
      const relayPurchaseIds = new Set(relayPurchases.map(p => p.id));
      const stillPendingPurchases = validPendingPurchases.filter(p => !relayPurchaseIds.has(p.id));
      
      // Update local storage with remaining pending purchases
      if (stillPendingPurchases.length !== validPendingPurchases.length) {
        localStorage.setItem(pendingPurchasesKey, JSON.stringify(stillPendingPurchases));
        console.log(`💾 Updated local storage: ${stillPendingPurchases.length} purchases still pending`);
      }
      
      // Combine relay purchases with pending purchases
      const purchases = [...relayPurchases, ...stillPendingPurchases];
      console.log(`🎟️ Total purchases: ${purchases.length} (${relayPurchases.length} from relays + ${stillPendingPurchases.length} pending)`);

      // Filter and transform donation events
      console.log(`🔍 Raw donation events from relays:`, donationEvents.length);
      
      const validDonationEvents = donationEvents.filter(validateDonation);
      const relayDonations = validDonationEvents.map(eventToDonation);
      
      // Remove any pending donations that now exist in relay results
      const relayDonationIds = new Set(relayDonations.map(d => d.id));
      const stillPendingDonations = validPendingDonations.filter(d => !relayDonationIds.has(d.id));
      
      // Update local storage with remaining pending donations
      if (stillPendingDonations.length !== validPendingDonations.length) {
        localStorage.setItem(pendingDonationsKey, JSON.stringify(stillPendingDonations));
        console.log(`💾 Updated local storage: ${stillPendingDonations.length} still pending`);
      }
      
      // Combine relay donations with pending donations
      const donations = [...relayDonations, ...stillPendingDonations];
      console.log(`📊 Total donations: ${donations.length} (${relayDonations.length} from relays + ${stillPendingDonations.length} pending)`);

      console.log(`Campaign stats for ${pubkey}:${dTag}:`, {
        totalPurchaseEvents: purchaseEvents.length,
        validPurchaseEvents: validPurchaseEvents.length,
        invalidPurchaseEvents: purchaseEvents.length - validPurchaseEvents.length,
        relayPurchases: relayPurchases.length,
        pendingPurchases: stillPendingPurchases.length,
        totalDonationEvents: donationEvents.length,
        validDonationEvents: validDonationEvents.length,
        invalidDonationEvents: donationEvents.length - validDonationEvents.length,
        relayDonations: relayDonations.length,
        pendingDonations: stillPendingDonations.length,
        purchases: purchases.length,
        donations: donations.length,
        samplePurchases: purchases.slice(0, 2),
        sampleDonations: donations.slice(0, 2)
      });

      // Sort by creation date
      purchases.sort((a, b) => a.createdAt - b.createdAt);
      donations.sort((a, b) => a.createdAt - b.createdAt);

      // Calculate stats
      const totalRaised = purchases.reduce((sum, p) => sum + p.amount, 0);
      const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);
      const totalTickets = purchases.reduce((sum, p) => sum + p.tickets, 0);
      const allParticipants = new Set([
        ...purchases.map(p => p.pubkey),
        ...donations.map(d => d.pubkey)
      ]);
      const uniqueParticipants = allParticipants.size;

      console.log(`Calculated stats:`, {
        totalRaised,
        totalDonations,
        totalTickets,
        uniqueParticipants,
        recentPurchases: purchases.slice(-3).map(p => ({ tickets: p.tickets, amount: p.amount, createdAt: p.createdAt })),
        recentDonations: donations.slice(-3).map(d => ({ amount: d.amount, createdAt: d.createdAt }))
      });

      // Check for campaign result
      let result: CampaignResult | undefined;
      const resultEvent = resultEvents.find(validateCampaignResult);
      if (resultEvent) {
        result = eventToCampaignResult(resultEvent);
      }

      const stats: CampaignStats = {
        totalRaised,
        totalDonations,
        totalTickets,
        uniqueParticipants,
        purchases,
        donations,
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

export function useUserDonations(fundraiserPubkey: string, fundraiserDTag: string, userPubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['user-donations', fundraiserPubkey, fundraiserDTag, userPubkey],
    queryFn: async (c) => {
      if (!userPubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      const fundraiserCoordinate = `31950:${fundraiserPubkey}:${fundraiserDTag}`;
      
      const events = await nostr.query(
        [{
          kinds: [31953], // Donation events
          authors: [userPubkey],
          '#a': [fundraiserCoordinate],
          limit: 100,
        }],
        { signal }
      );

      const validEvents = events.filter(validateDonation);
      const donations = validEvents.map(eventToDonation);

      return donations.sort((a, _b) => a.createdAt - a.createdAt);
    },
    enabled: !!fundraiserPubkey && !!fundraiserDTag && !!userPubkey,
    staleTime: 15000,
  });
}