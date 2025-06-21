import { useNostr } from '@nostrify/react';
import { useNostrLogin } from '@nostrify/react/login';
import { useQuery } from '@tanstack/react-query';
import { NSchema as n, NostrEvent, NostrMetadata } from '@nostrify/nostrify';

export interface Account {
  id: string;
  pubkey: string;
  event?: NostrEvent;
  metadata: NostrMetadata;
}

export function useLoggedInAccounts() {
  const { nostr } = useNostr();
  const { logins, removeLogin } = useNostrLogin();

  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['current-user', logins[0]?.id],
    queryFn: async ({ signal }) => {
      const login = logins[0];
      if (!login) return undefined;

      // Try multiple times with different timeouts to handle slow relays
      const timeouts = [3000, 5000, 8000];
      
      for (const timeout of timeouts) {
        try {
          const events = await nostr.query(
            [{ kinds: [0], authors: [login.pubkey] }],
            { signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]) },
          );

          const event = events.find((e) => e.pubkey === login.pubkey);
          
          if (event && event.content) {
            try {
              const metadata = n.json().pipe(n.metadata()).parse(event.content);
              return { id: login.id, pubkey: login.pubkey, metadata, event };
            } catch (error) {
              // If parsing fails, continue to next attempt or fallback
              continue;
            }
          }
        } catch (error) {
          // If this timeout fails, try the next one
          continue;
        }
      }

      // If all attempts fail, return with empty metadata
      return { id: login.id, pubkey: login.pubkey, metadata: {}, event: undefined };
    },
    retry: 2,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!logins[0],
  });

  return {
    currentUser,
    removeLogin,
    isLoading,
  };
}