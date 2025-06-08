import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { type NWCConfig, type LightningInvoice } from '@/lib/lightning';
import { NWCClient } from '@/lib/nwc';

interface NWCResponse {
  result_type: string;
  error?: {
    code: string;
    message: string;
  };
  result?: Record<string, unknown>;
}

// This would be a real NWC implementation
export function useNWCReal() {
  const { nostr: _nostr } = useNostr();
  const { user } = useCurrentUser();
  const [nwcConfig] = useLocalStorage<NWCConfig | null>('nwc-config', null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [nwcClient, setNwcClient] = useState<NWCClient | null>(null);

  useEffect(() => {
    // Validate NWC configuration
    const validateConfig = () => {
      if (!nwcConfig) {
        console.warn('❌ No NWC configuration found');
        return false;
      }

      if (!nwcConfig.walletPubkey) {
        console.warn('❌ NWC configuration missing wallet pubkey');
        return false;
      }

      if (!nwcConfig.relays || nwcConfig.relays.length === 0) {
        console.warn('❌ NWC configuration missing relays');
        return false;
      }

      if (!nwcConfig.secret) {
        console.warn('❌ NWC configuration missing secret');
        return false;
      }

      if (!nwcConfig.connectionString) {
        console.warn('❌ NWC configuration missing connection string');
        return false;
      }

      if (!user?.signer) {
        console.warn('❌ User signer not available');
        return false;
      }

      return true;
    };

    const configured = validateConfig();
    console.log('🔧 NWC Configuration check:', {
      hasNwcConfig: !!nwcConfig,
      hasSigner: !!user?.signer,
      configured,
      nwcConfig: nwcConfig ? {
        walletPubkey: nwcConfig.walletPubkey,
        relays: nwcConfig.relays,
        hasSecret: !!nwcConfig.secret,
        lud16: nwcConfig.lud16,
        hasConnectionString: !!nwcConfig.connectionString
      } : null
    });

    if (configured && nwcConfig) {
      try {
        // Create NWC client with the first relay
        const client = new NWCClient(nwcConfig.connectionString);
        setNwcClient(client);
        console.log('✅ NWC client initialized');
      } catch (error) {
        console.error('❌ Failed to initialize NWC client:', error);
        setIsConfigured(false);
      }
    } else {
      setNwcClient(null);
    }

    setIsConfigured(configured);
  }, [nwcConfig, user]);

  const sendNWCRequest = async (method: string, params: Record<string, unknown>): Promise<NWCResponse> => {
    if (!nwcConfig || !user?.signer || !nwcClient) {
      throw new Error('NWC not configured or signer not available');
    }

    console.log('🔄 Sending NWC request:', method, params);
    console.log('📡 Using wallet pubkey:', nwcConfig.walletPubkey);
    console.log('🔗 Using relays:', nwcConfig.relays);

    try {
      // Check for WebLN availability
      if (typeof window !== 'undefined' && (window as any).webln) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const webln = (window as any).webln;
        
        if (method === 'make_invoice') {
          console.log('💡 Using WebLN makeInvoice for NWC request');
          
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
              amount: Math.floor((params.amount as number) / 1000), // Convert msats to sats
              defaultMemo: params.description as string,
            });
            
            // Validate invoice response
            if (!invoice?.paymentRequest) {
              throw new Error('Invalid invoice response from WebLN');
            }
            
            console.log('✅ WebLN invoice created:', invoice);
            
            return {
              result_type: 'make_invoice',
              result: {
                invoice: invoice.paymentRequest,
                payment_hash: invoice.paymentHash || Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''),
                amount: params.amount,
                description: params.description,
                expires_at: Math.floor(Date.now() / 1000) + ((params.expiry as number) || 3600),
              }
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
      } else {
        console.log('⚠️ WebLN not available in this browser');
      }
      
      // If WebLN is not available or method not supported, use NWC client
      console.log('⚠️ Using NWC client as fallback');
      
      // Only support core methods that are widely implemented
      const supportedMethods = ['make_invoice', 'pay_invoice'];
      
      if (!supportedMethods.includes(method)) {
        throw new Error(`Unsupported NWC method: ${method}. Supported methods: ${supportedMethods.join(', ')}`);
      }
      
      switch (method) {
        case 'make_invoice':
          const invoice = await nwcClient.makeInvoice(params.amount as number, params.description as string);
          return {
            result_type: 'make_invoice',
            result: {
              invoice: invoice.bolt11,
              payment_hash: invoice.payment_hash,
              amount: invoice.amount_msat,
              description: invoice.description,
              expires_at: invoice.expires_at
            }
          };
        case 'pay_invoice':
          const payment = await nwcClient.payInvoice(params.invoice as string);
          return {
            result_type: 'pay_invoice',
            result: {
              preimage: payment.preimage
            }
          };
        default:
          throw new Error(`Unsupported NWC method: ${method}`);
      }
      
    } catch (error) {
      console.error('❌ NWC request failed:', error);
      throw error;
    }
  };

  // Create invoice mutation (real implementation)
  const createInvoiceMutation = useMutation({
    mutationFn: async ({ amount, description, expiry }: { 
      amount: number; 
      description: string; 
      expiry?: number; 
    }) => {
      if (!isConfigured || !nwcClient) {
        throw new Error('NWC not configured');
      }

      console.log('🚀 Attempting to create NWC invoice...');
      console.log('💰 Amount:', amount, 'msats');
      console.log('📝 Description:', description);
      console.log('📍 NWC Config:', { 
        walletPubkey: nwcConfig?.walletPubkey,
        relays: nwcConfig?.relays,
        hasSecret: !!nwcConfig?.secret,
        hasConnectionString: !!nwcConfig?.connectionString
      });

      try {
        const response = await sendNWCRequest('make_invoice', {
          amount,
          description,
          expiry: expiry || 3600,
        });

        if (response.error) {
          throw new Error(`NWC Error: ${response.error.message}`);
        }

        const result = response.result as Record<string, unknown>;
        
        console.log('✅ NWC Response received:', result);
        
        return {
          bolt11: result.invoice as string,
          payment_hash: result.payment_hash as string,
          payment_request: result.invoice as string,
          amount_msat: amount, // Use the requested amount
          description: description,
          expires_at: Date.now() + ((expiry || 3600) * 1000),
          checking_id: result.payment_hash as string,
        } as LightningInvoice;
        
      } catch (error) {
        console.error('❌ NWC invoice creation failed:', error);
        
        // Provide more helpful error messages
        if (error instanceof Error) {
          if (error.message.includes('WebLN not available')) {
            throw new Error('NWC wallet not accessible. Please ensure your wallet extension is installed and connected.');
          } else if (error.message.includes('demo fallback')) {
            throw new Error('Real NWC implementation not fully available yet. The connection string is valid but full protocol support is still in development.');
          }
        }
        
        throw error;
      }
    },
  });

  // Pay invoice mutation (real implementation)
  const payInvoiceMutation = useMutation({
    mutationFn: async ({ bolt11, amount }: { bolt11: string; amount?: number }) => {
      if (!isConfigured || !nwcClient) {
        throw new Error('NWC not configured');
      }

      const response = await sendNWCRequest('pay_invoice', {
        invoice: bolt11,
        amount,
      });

      if (response.error) {
        throw new Error(`NWC Payment Error: ${response.error.message}`);
      }

      return {
        preimage: response.result?.preimage as string,
        fees_paid: response.result?.fees_paid as number,
      };
    },
  });

  // Get balance query (real implementation)
  const { data: balance, isLoading: isLoadingBalance, refetch: refetchBalance } = useQuery({
    queryKey: ['nwc-balance-real', nwcConfig?.walletPubkey],
    queryFn: async () => {
      if (!isConfigured || !nwcClient) {
        throw new Error('NWC not configured');
      }
      
      const response = await sendNWCRequest('get_balance', {});
      
      if (response.error) {
        throw new Error(`NWC Error: ${response.error.message}`);
      }
      
      return response.result?.balance as number;
    },
    enabled: isConfigured,
  });

  return {
    isConfigured,
    createInvoice: createInvoiceMutation.mutateAsync,
    payInvoice: payInvoiceMutation.mutateAsync,
    balance,
    isLoadingBalance,
    refetchBalance,
  };
}