import { useAppContext } from '@/hooks/useAppContext';
import { type LightningInvoice } from '@/lib/lightning';
import { useNWCReal } from './useNWCReal';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { type NWCConfig } from '@/lib/lightning';
import { useToast } from '@/hooks/useToast';

export function useNWC() {
  const { config } = useAppContext();
  const realNWC = useNWCReal();
  const [nwcConfig] = useLocalStorage<NWCConfig | null>('nwc-config', null);
  const { toast } = useToast();

  // Check if we have a valid NWC configuration
  const hasValidConfig = nwcConfig && 
    nwcConfig.walletPubkey && 
    nwcConfig.relays && 
    nwcConfig.relays.length > 0 && 
    nwcConfig.secret &&
    nwcConfig.connectionString; // Make sure we have the connection string

  // Check if we're in demo mode or real mode
  const isDemoMode = !hasValidConfig; // Only use demo mode if we don't have a valid config
  
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
        console.log('📝 Using NWC config:', {
          walletPubkey: nwcConfig?.walletPubkey,
          relays: nwcConfig?.relays,
          hasSecret: !!nwcConfig?.secret,
          hasConnectionString: !!nwcConfig?.connectionString
        });
        
        try {
          // Check for WebLN availability first
          if (typeof window !== 'undefined' && (window as any).webln) {
            console.log('💡 WebLN is available in this browser');
            toast({
              title: 'Connecting to Wallet',
              description: 'Please approve the connection request in your wallet extension',
              variant: 'default',
            });
          }
          
          // Try the real NWC implementation first
          const result = await realNWC.createInvoice({ amount, description, expiry });
          console.log('✅ Real NWC succeeded:', result);
          return result;
        } catch (error) {
          console.error('❌ Real NWC failed:', error);
          
          // Handle WebLN errors with user-friendly messages
          if (error instanceof Error) {
            if (error.message.includes('WebLN connection') || error.message.includes('WebLN is not enabled')) {
              toast({
                title: 'Wallet Connection Required',
                description: '1. Make sure your wallet is unlocked\n2. Look for a popup from your wallet\n3. Click "Approve" or "Connect"\n4. Try again',
                variant: 'destructive',
              });
            } else {
              toast({
                title: 'Invoice Creation Failed',
                description: error.message,
                variant: 'destructive',
              });
            }
          }
          
          throw error; // Let the error propagate up
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
      console.warn('🚨 NWC Demo Mode: No valid NWC configuration found');
      console.log('To use real NWC invoices, please configure a NWC wallet in the settings');
      
      toast({
        title: 'Demo Mode',
        description: 'To create real invoices:\n1. Install a WebLN wallet (like Alby)\n2. Configure it in settings\n3. Approve the connection',
        variant: 'default',
      });
      
      // Create a demo invoice that clearly indicates it's for demonstration
      const mockInvoice: LightningInvoice = {
        bolt11: `lnbc${Math.floor(amount / 1000)}n1demo_noconfig_${Date.now()}`,
        payment_hash: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''),
        payment_request: `lnbc${Math.floor(amount / 1000)}n1demo_noconfig_${Date.now()}`,
        amount_msat: amount,
        description: `[DEMO - No NWC Config] ${description}`,
        expires_at: Date.now() + ((expiry || 3600) * 1000),
        checking_id: 'demo_noconfig_' + Date.now(),
      };

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      return mockInvoice;
    },
  };
}