import { useQuery } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import type { NostrEvent } from "@nostrify/nostrify";

export interface PrizeClaim {
  id: string;
  pubkey: string;
  claimId: string;
  fundraiserCoordinate: string;
  resultEventId: string;
  paymentMethod: "lnaddress" | "invoice";
  paymentInfo: string;
  message?: string;
  createdAt: number;
  event: NostrEvent;
}

export function usePrizeClaims(campaignPubkey: string, campaignDTag: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['prize-claims', campaignPubkey, campaignDTag],
    queryFn: async (): Promise<PrizeClaim[]> => {
      if (!campaignPubkey || !campaignDTag) {
        return [];
      }

      const fundraiserCoordinate = `31950:${campaignPubkey}:${campaignDTag}`;

      // Query for Kind 31954 events (prize claims) that reference this campaign
      const eventsIterable = await nostr.req([
        {
          kinds: [31954],
          "#a": [fundraiserCoordinate],
        },
      ]);
      
      const events: NostrEvent[] = [];
      for await (const msg of eventsIterable) {
        if (msg[0] === 'EVENT') {
          events.push(msg[2]);
        }
      }

      const claims: PrizeClaim[] = [];

      for (const event of events) {
        try {
          // Extract required tags
          const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
          const aTag = event.tags.find(tag => tag[0] === 'a')?.[1];
          const resultEventId = event.tags.find(tag => tag[0] === 'result_event')?.[1];
          const paymentMethod = event.tags.find(tag => tag[0] === 'payment_method')?.[1] as "lnaddress" | "invoice";
          const paymentInfo = event.tags.find(tag => tag[0] === 'payment_info')?.[1];
          const message = event.tags.find(tag => tag[0] === 'message')?.[1];

          // Validate required fields
          if (!dTag || !aTag || !resultEventId || !paymentMethod || !paymentInfo) {
            console.warn('Invalid prize claim event - missing required tags:', event.id);
            continue;
          }

          // Validate payment method
          if (paymentMethod !== "lnaddress" && paymentMethod !== "invoice") {
            console.warn('Invalid payment method in prize claim:', paymentMethod);
            continue;
          }

          // Validate payment info format
          if (paymentMethod === "lnaddress" && !paymentInfo.includes("@")) {
            console.warn('Invalid Lightning address format:', paymentInfo);
            continue;
          }

          if (paymentMethod === "invoice" && !paymentInfo.toLowerCase().startsWith("ln")) {
            console.warn('Invalid Lightning invoice format:', paymentInfo);
            continue;
          }

          claims.push({
            id: event.id,
            pubkey: event.pubkey,
            claimId: dTag,
            fundraiserCoordinate: aTag,
            resultEventId,
            paymentMethod,
            paymentInfo,
            message,
            createdAt: event.created_at,
            event,
          });
        } catch (error) {
          console.error('Error parsing prize claim event:', event.id, error);
        }
      }

      // Sort by creation time (newest first)
      return claims.sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: !!campaignPubkey && !!campaignDTag,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
}