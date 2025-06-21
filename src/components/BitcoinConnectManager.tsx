import { useEffect, useRef } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBitcoinConnect } from '@/hooks/useBitcoinConnect';

/**
 * Manages Bitcoin Connect storage to prevent wallet connections from persisting
 * when no Nostr user is logged in.
 */
export function BitcoinConnectManager() {
  const { user } = useCurrentUser();
  const { disconnect, refreshState } = useBitcoinConnect();
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

    // If user just logged in (previous was null, current is not), trigger wallet detection
    if (previousUserId === null && currentUserId !== null) {
      console.log('User just logged in, triggering wallet detection and Bitcoin Connect re-initialization...');
      
      // Try to reinitialize Bitcoin Connect after login
      const reinitializeBitcoinConnect = async () => {
        try {
          // Re-initialize Bitcoin Connect with fresh config
          const { init } = await import('@getalby/bitcoin-connect');
          
          const config = {
            appName: 'PodRaffle',
            showBalance: true,
            connectors: [
              'extension',     // Browser extensions (Alby, etc.)
              'nwc',           // Nostr Wallet Connect
              'lndhub',        // LndHub wallets
              'lnd',           // LND node
              'eclair',        // Eclair node
              'phoenixd',      // Phoenix daemon
              'cashu',         // Cashu mints
            ],
            showExtensionConnector: true,
          };
          
          console.log('Re-initializing Bitcoin Connect after login...');
          init(config);
          
          // Check if extension is available immediately
          console.log('Extension check after init:', {
            webln: !!window.webln,
            alby: !!window.alby,
            nostr: !!window.nostr
          });
          
          // Try to trigger extension detection manually
          if (window.webln) {
            console.log('Found window.webln, trying to enable...');
            try {
              await window.webln.enable();
              console.log('Successfully enabled WebLN extension');
            } catch (error) {
              console.log('WebLN enable failed:', error);
            }
          } else if (window.alby) {
            console.log('Found window.alby, trying to enable...');
            try {
              const result = await window.alby.enable();
              console.log('Alby enable result:', result);
              console.log('Successfully enabled Alby extension');
              
              // Check if Alby set window.webln after enable
              setTimeout(() => {
                if (window.webln) {
                  console.log('✅ Alby set window.webln after enable');
                  refreshState();
                } else {
                  console.log('❌ Alby did not set window.webln after enable');
                  
                  // Debug what's available on window.alby
                  console.log('Available Alby methods:', window.alby ? Object.keys(window.alby) : 'none');
                  console.log('Alby makeInvoice available:', !!window.alby?.makeInvoice);
                  console.log('Alby sendPayment available:', !!window.alby?.sendPayment);
                  
                  // Try to manually set it from alby.webln
                  if (window.alby?.webln) {
                    console.log('🔧 Manually setting window.webln from window.alby.webln');
                    window.webln = window.alby.webln;
                    
                    // Verify it worked
                    console.log('After manual setting - webln available:', !!window.webln?.makeInvoice);
                    if (window.webln?.makeInvoice) {
                      console.log('✅ Successfully set up WebLN from Alby!');
                      refreshState();
                    } else {
                      console.log('❌ Still no makeInvoice after manual setting');
                    }
                  } else {
                    console.log('❌ No window.alby.webln available');
                  }
                }
              }, 200);
              
            } catch (error) {
              console.log('Alby enable failed:', error);
            }
          }
          
          // Give it a moment to initialize, then refresh state
          setTimeout(() => {
            console.log('Refreshing wallet state after re-initialization...');
            console.log('Final extension state:', {
              webln: !!window.webln,
              makeInvoice: !!window.webln?.makeInvoice,
              alby: !!window.alby
            });
            refreshState();
          }, 1000);
          
        } catch (error) {
          console.error('Bitcoin Connect re-initialization error:', error);
          // Fallback to just refreshing state
          setTimeout(() => refreshState(), 1000);
        }
      };
      
      reinitializeBitcoinConnect();
    }

    // Update the ref for next comparison
    previousUserRef.current = currentUserId;
  }, [user, disconnect, refreshState]);

  // This component doesn't render anything, it just manages storage cleanup
  return null;
}