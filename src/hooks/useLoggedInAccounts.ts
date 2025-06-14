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

  const { data: currentUser } = useQuery({
    queryKey: ['current-user', logins[0]?.id],
    queryFn: async ({ signal }) => {
      const login = logins[0];
      if (!login) return undefined;

      const events = await nostr.query(
        [{ kinds: [0], authors: [login.pubkey] }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(1500)]) },
      );

      const event = events.find((e) => e.pubkey === login.pubkey);
      try {
        const metadata = n.json().pipe(n.metadata()).parse(event?.content);
        return { id: login.id, pubkey: login.pubkey, metadata, event };
      } catch {
        return { id: login.id, pubkey: login.pubkey, metadata: {}, event };
      }
    },
    retry: 3,
    enabled: !!logins[0],
  });

  return {
    currentUser,
    removeLogin,
  };
}