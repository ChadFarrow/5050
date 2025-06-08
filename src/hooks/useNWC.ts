import { useAppContext } from '@/hooks/useAppContext';
import { type LightningInvoice } from '@/lib/lightning';
import { useNWCReal } from './useNWCReal';



export function useNWC() {
  const { config } = useAppContext();
  const realNWC = useNWCReal(); 

  // Check if we're in demo mode or real mode
  const isDemoMode = config.nwcDemoMode;
  
  // Always call the real NWC hook (follows rules of hooks)
  // Return it directly when not in demo mode
  if (!isDemoMode) {
    // When not in demo mode, if real NWC fails, we'll fallback to demo invoices with a warning
    return {
      ...realNWC,
      createInvoice: async ({ amount, description, expiry }: { 
        amount: number; 
        description: string; 
        expiry?: number; 
      }) => {
        try {
          return await realNWC.createInvoice({ amount, description, expiry });
        } catch (error) {
          console.warn('Real NWC failed, creating demo invoice:', error);
          
          // Create a demo invoice with clear labeling
          const mockInvoice: LightningInvoice = {
            bolt11: `lnbc${Math.floor(amount / 1000)}n1demo_fallback_${Date.now()}`,
            payment_hash: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''),
            payment_request: `lnbc${Math.floor(amount / 1000)}n1demo_fallback_${Date.now()}`,
            amount_msat: amount,
            description: `[DEMO FALLBACK] ${description}`,
            expires_at: Date.now() + ((expiry || 3600) * 1000),
            checking_id: 'demo_fallback_' + Date.now(),
          };

          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 500));

          return mockInvoice;
        }
      },
    };
  }

  // If we reach here, we're in demo mode - return demo implementation
  return {
    ...realNWC,
    // Override specific methods for demo behavior
    createInvoice: async ({ amount, description, expiry }: { 
      amount: number; 
      description: string; 
      expiry?: number; 
    }) => {
      // Create a demo invoice that clearly indicates it's for demonstration
      const mockInvoice: LightningInvoice = {
        bolt11: `lnbc${Math.floor(amount / 1000)}n1demo_invoice_${Date.now()}`,
        payment_hash: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''),
        payment_request: `lnbc${Math.floor(amount / 1000)}n1demo_invoice_${Date.now()}`,
        amount_msat: amount,
        description: `[DEMO] ${description}`,
        expires_at: Date.now() + ((expiry || 3600) * 1000),
        checking_id: 'demo_' + Date.now(),
      };

      console.warn('🚨 NWC Demo Mode: This is a mock invoice for demonstration purposes only!');
      console.log('To use real NWC invoices, configure a real NWC wallet or Lightning service');

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      return mockInvoice;
    },
  };
}