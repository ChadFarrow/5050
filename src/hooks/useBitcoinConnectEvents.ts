import { useEffect, useState } from 'react';

/**
 * Hook that listens for Bitcoin Connect events and forces component re-renders
 * to ensure UI stays in sync with wallet connection state
 */
export function useBitcoinConnectEvents() {
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    const forceUpdate = () => {
      console.log('🔄 Bitcoin Connect event detected, forcing UI update');
      setLastUpdate(Date.now());
    };

    // Listen for Bitcoin Connect events on the window
    const events = [
      'bc:connected',
      'bc:disconnected', 
      'bc:connecting',
      'webln:enabled',
      'webln:disabled'
    ];

    events.forEach(event => {
      window.addEventListener(event, forceUpdate);
    });

    // Also listen for storage changes (Bitcoin Connect uses localStorage)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('bc:')) {
        console.log('🔄 Bitcoin Connect storage change detected:', e.key);
        forceUpdate();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Listen for WebLN changes
    const checkWebLNChanges = () => {
      const hasWebLN = !!window.webln;
      const hasInvoice = typeof window.webln?.makeInvoice === 'function';
      
      // Store previous state to detect changes
      const windowWithState = window as unknown as { __weblnState?: { hasWebLN: boolean; hasInvoice: boolean } };
      const prevState = windowWithState.__weblnState;
      const currentState = { hasWebLN, hasInvoice };
      
      if (!prevState || 
          prevState.hasWebLN !== currentState.hasWebLN || 
          prevState.hasInvoice !== currentState.hasInvoice) {
        console.log('🔄 WebLN state change detected:', { prev: prevState, current: currentState });
        windowWithState.__weblnState = currentState;
        forceUpdate();
      }
    };

    // Check WebLN state changes more frequently initially
    const quickInterval = setInterval(checkWebLNChanges, 200);
    const slowInterval = setTimeout(() => {
      clearInterval(quickInterval);
      const interval = setInterval(checkWebLNChanges, 1000);
      return () => clearInterval(interval);
    }, 5000);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, forceUpdate);
      });
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(quickInterval);
      clearTimeout(slowInterval);
    };
  }, []);

  return lastUpdate;
}