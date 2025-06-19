import { useEffect, useRef } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBitcoinConnect } from '@/hooks/useBitcoinConnect';

/**
 * Manages Bitcoin Connect storage to prevent wallet connections from persisting
 * when no Nostr user is logged in.
 */
export function BitcoinConnectManager() {
  const { user } = useCurrentUser();
  const { disconnect } = useBitcoinConnect();
  const previousUserRef = useRef<string | null>(null);

  useEffect(() => {
    const currentUserId = user?.pubkey || null;
    const previousUserId = previousUserRef.current;

    // If user changed (including logout), force disconnect wallet
    if (previousUserId !== null && previousUserId !== currentUserId) {
      console.log('User changed, forcing wallet disconnect:', { 
        previous: previousUserId, 
        current: currentUserId 
      });
      disconnect();
    }

    // If no user is logged in, clear Bitcoin Connect storage to prevent auto-connection
    if (!user) {
      // Clear ALL Bitcoin Connect configuration to prevent auto-wallet restoration
      localStorage.removeItem('bc:config');
      localStorage.removeItem('bc:currency');
      localStorage.removeItem('bc:onpaid');
      
      // Also clear any WebLN reference
      if (window.webln) {
        delete window.webln;
      }
      
      console.log('Cleared Bitcoin Connect storage - no user logged in');
    }

    // Update the ref for next comparison
    previousUserRef.current = currentUserId;
  }, [user, disconnect]);

  // This component doesn't render anything, it just manages storage cleanup
  return null;
}