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
      createInvoice: async (amount: number, description: string): Promise<LightningInvoice> => {
        console.log('🔄 Creating invoice:', { amount, description });
        console.log('📡 NWC State:', {
          hasConfig: !!nwcConfig,
          hasWalletPubkey: !!nwcConfig?.walletPubkey,
          hasRelays: !!nwcConfig?.relays?.length,
          hasSecret: !!nwcConfig?.secret,
          hasConnectionString: !!nwcConfig?.connectionString,
          isDemoMode,
        });

        try {
          // Check for WebLN availability first
          if (typeof window !== 'undefined' && (window as any).webln) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const webln = (window as any).webln;
            
            console.log('💡 WebLN detected, attempting to use it');
            
            try {
              // Check if WebLN is already enabled
              if (webln.enabled) {
                console.log('✅ WebLN is already enabled');
              } else {
                console.log('🔑 Requesting WebLN permission...');
                try {
                  // Request WebLN permission
                  await webln.enable();
                  console.log('✅ WebLN permission granted');
                } catch (enableError) {
                  console.error('❌ WebLN permission denied:', enableError);
                  throw new Error('WebLN permission was denied. Please check your wallet extension and try again.');
                }
              }
              
              // Double check WebLN state
              if (!webln.enabled) {
                console.error('❌ WebLN is still not enabled after enable attempt');
                throw new Error('WebLN is not enabled. Please check your wallet extension and make sure it\'s properly connected.');
              }
              
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const invoice = await webln.makeInvoice({
                amount: Math.floor(amount / 1000), // Convert msats to sats
                defaultMemo: description,
              });
              
              // Validate invoice response
              if (!invoice?.paymentRequest) {
                throw new Error('Invalid invoice response from WebLN');
              }
              
              console.log('✅ WebLN invoice created:', invoice);
              return {
                bolt11: invoice.paymentRequest,
                payment_hash: invoice.paymentHash || Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''),
                payment_request: invoice.paymentRequest,
                amount_msat: amount,
                description: description,
                expires_at: Date.now() + (3600 * 1000),
                checking_id: invoice.paymentHash || Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''),
              };
              
            } catch (weblnError) {
              console.error('❌ WebLN error:', weblnError);
              if (weblnError instanceof Error) {
                if (weblnError.message.includes('enable request was rejected')) {
                  throw new Error('WebLN permission was denied. Please check your wallet extension and try again.');
                } else if (weblnError.message.includes('not enabled')) {
                  throw new Error('WebLN is not enabled. Please check your wallet extension and make sure it\'s properly connected.');
                }
              }
              throw new Error(`WebLN error: ${weblnError instanceof Error ? weblnError.message : 'Unknown WebLN error'}`);
            }
          }
          
          // If WebLN is not available, try NWC
          if (!isDemoMode && nwcConfig?.walletPubkey && nwcConfig?.relays?.length && nwcConfig?.secret && nwcConfig?.connectionString) {
            console.log('💡 Using real NWC implementation');
            try {
              const result = await realNWC.createInvoice({
                amount,
                description,
                expiry: 3600,
              });
              
              console.log('✅ Real NWC invoice created');
              return result;
            } catch (error) {
              console.error('❌ Real NWC invoice creation failed:', error);
              throw error;
            }
          }
          
          // If both WebLN and NWC fail, create a demo invoice
          console.log('⚠️ Creating demo invoice (no valid configuration)');
          const demoInvoice = `lnbc${amount}n1nwc_demo_${Date.now()}`;
          console.log('✅ Demo invoice created:', demoInvoice);
          
          return {
            bolt11: demoInvoice,
            payment_hash: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''),
            payment_request: demoInvoice,
            amount_msat: amount,
            description: `[DEMO - No NWC Config] ${description}`,
            expires_at: Date.now() + (3600 * 1000),
            checking_id: 'demo_noconfig_' + Date.now(),
          };
          
        } catch (error) {
          console.error('❌ Invoice creation failed:', error);
          throw error;
        }
      },
    };
  }

  // If we reach here, we're in demo mode - return demo implementation
  return {
    ...realNWC,
    // Override specific methods for demo behavior
    createInvoice: async (amount: number, description: string): Promise<LightningInvoice> => {
      console.warn('🚨 NWC Demo Mode: No valid NWC configuration found');
      console.log('To use real NWC invoices, please configure a NWC wallet in the settings');
      
      toast({
        title: 'Demo Mode',
        description: 'To create real invoices:\n1. Install a WebLN wallet (like Alby)\n2. Configure it in settings\n3. Approve the connection',
        variant: 'default',
      });
      
      // Create a demo invoice that clearly indicates it's for demonstration
      const demoInvoice = `lnbc${amount}n1demo_noconfig_${Date.now()}`;
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        bolt11: demoInvoice,
        payment_hash: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''),
        payment_request: demoInvoice,
        amount_msat: amount,
        description: `[DEMO - No NWC Config] ${description}`,
        expires_at: Date.now() + (3600 * 1000),
        checking_id: 'demo_noconfig_' + Date.now(),
      };
    },
  };
}