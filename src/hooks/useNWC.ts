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
    return realNWC;
  }

  // If we reach here, we're in demo mode - but we still need to return the same hook structure
  // For demo mode, we'll just return the real NWC hook but with demo data
  return {
    ...realNWC,
    // Override specific methods for demo behavior if needed
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
      console.log('To use real NWC invoices, set nwcDemoMode to false in App.tsx');

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      return mockInvoice;
    },
  };
}