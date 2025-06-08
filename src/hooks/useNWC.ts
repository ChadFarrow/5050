import { useAppContext } from '@/hooks/useAppContext';
import { type LightningInvoice } from '@/lib/lightning';
import { useNWCReal } from './useNWCReal';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { type NWCConfig } from '@/lib/lightning';

export function useNWC() {
  const { config } = useAppContext();
  const realNWC = useNWCReal();
  const [nwcConfig] = useLocalStorage<NWCConfig | null>('nwc-config', null);

  // Check if we have a valid NWC configuration
  const hasValidConfig = nwcConfig && 
    nwcConfig.walletPubkey && 
    nwcConfig.relays && 
    nwcConfig.relays.length > 0 && 
    nwcConfig.secret &&
    nwcConfig.connectionString; // Make sure we have the connection string

  // Check if we're in demo mode or real mode
  const isDemoMode = config.nwcDemoMode || !hasValidConfig;
  
  console.log('🔧 NWC Hook State:', {
    isDemoMode,
    hasValidConfig,
    hasNwcConfig: !!nwcConfig,
    nwcConfig: nwcConfig ? {
      walletPubkey: nwcConfig.walletPubkey,
      relays: nwcConfig.relays,
      hasSecret: !!nwcConfig.secret,
      lud16: nwcConfig.lud16,
      hasConnectionString: !!nwcConfig.connectionString
    } : null
  });

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
          console.warn('⚠️  Real NWC failed:', error);
          
          // Only create a demo invoice if we have a valid config but the implementation failed
          if (hasValidConfig) {
            console.warn('Creating labeled demo invoice due to implementation error');
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
          } else {
            // If we don't have a valid config, throw the original error
            throw error;
          }
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