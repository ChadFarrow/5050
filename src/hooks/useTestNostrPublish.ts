import { useNostr } from "@nostrify/react";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { finalizeEvent, type Event, type EventTemplate } from "nostr-tools";
import type { TestProfile } from "@/lib/test-profiles";
import type { NostrEvent } from "@nostrify/nostrify";

interface PublishWithUserOptions {
  testProfile?: TestProfile;
  realUser?: { signer: { signEvent: (event: EventTemplate) => Promise<Event> } };
}

/**
 * Publish hook that can work with either real users or test profiles
 */
export function useTestNostrPublish(): UseMutationResult<NostrEvent, Error, { 
  event: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>, 
  options: PublishWithUserOptions 
}> {
  const { nostr } = useNostr();

  return useMutation({
    mutationFn: async ({ event: eventTemplate, options }: { 
      event: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>, 
      options: PublishWithUserOptions 
    }) => {
      const { testProfile, realUser } = options;
      
      if (!testProfile && !realUser) {
        throw new Error("Either testProfile or realUser must be provided");
      }

      const tags = eventTemplate.tags ?? [];

      // Add the client tag if it doesn't exist
      if (!tags.some((tag) => tag[0] === "client")) {
        tags.push(["client", location.hostname]);
      }

      let signedEvent: Event;

      if (testProfile) {
        // Use test profile to sign the event
        const unsignedEvent: EventTemplate = {
          kind: eventTemplate.kind,
          content: eventTemplate.content ?? "",
          tags,
          created_at: eventTemplate.created_at ?? Math.floor(Date.now() / 1000),
        };

        signedEvent = finalizeEvent(unsignedEvent, testProfile.secretKey);
      } else if (realUser?.signer) {
        // Use real user's signer
        signedEvent = await realUser.signer.signEvent({
          kind: eventTemplate.kind,
          content: eventTemplate.content ?? "",
          tags,
          created_at: eventTemplate.created_at ?? Math.floor(Date.now() / 1000),
        });
      } else {
        throw new Error("No valid signer available");
      }

      // Convert to NostrEvent format expected by nostr client
      const nostrEvent: NostrEvent = {
        id: signedEvent.id,
        pubkey: signedEvent.pubkey,
        created_at: signedEvent.created_at,
        kind: signedEvent.kind,
        tags: signedEvent.tags,
        content: signedEvent.content,
        sig: signedEvent.sig,
      };

      await nostr.event(nostrEvent, { signal: AbortSignal.timeout(5000) });
      return nostrEvent;
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (data) => {
      console.log("Event published successfully:", data);
    },
  });
}