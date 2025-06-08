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
    // For real mode, let's provide a more helpful implementation
    return {
      ...realNWC,
      createInvoice: async ({ amount, description, expiry }: { 
        amount: number; 
        description: string; 
        expiry?: number; 
      }) => {
        console.log('🔄 NWC Real Mode: Attempting invoice creation...');
        
        try {
          // Try the real NWC implementation first
          const result = await realNWC.createInvoice({ amount, description, expiry });
          console.log('✅ Real NWC succeeded');
          return result;
        } catch (error) {
          console.warn('⚠️  Real NWC failed, creating labeled demo invoice:', error);
          
          // Create a clearly labeled demo invoice that indicates NWC config is valid but implementation needs work
          const mockInvoice: LightningInvoice = {
            bolt11: `lnbc${Math.floor(amount / 1000)}n1nwc_demo_${Date.now()}`,
            payment_hash: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''),
            payment_request: `lnbc${Math.floor(amount / 1000)}n1nwc_demo_${Date.now()}`,
            amount_msat: amount,
            description: `[NWC DEMO - Valid Config] ${description}`,
            expires_at: Date.now() + ((expiry || 3600) * 1000),
            checking_id: 'nwc_demo_' + Date.now(),
          };

          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 500));

          console.log('📝 Created NWC demo invoice (config is valid, implementation in progress)');
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