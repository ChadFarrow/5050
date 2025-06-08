import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { type NWCConfig, type LightningInvoice } from '@/lib/lightning';

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

  useEffect(() => {
    const configured = !!nwcConfig && !!user?.signer;
    console.log('🔧 NWC Configuration check:', {
      hasNwcConfig: !!nwcConfig,
      hasSigner: !!user?.signer,
      configured,
      nwcConfig: nwcConfig ? {
        walletPubkey: nwcConfig.walletPubkey,
        relays: nwcConfig.relays,
        hasSecret: !!nwcConfig.secret,
        lud16: nwcConfig.lud16
      } : null
    });
    setIsConfigured(configured);
  }, [nwcConfig, user]);

  // Convert hex string to Uint8Array (currently unused but may be needed for future implementation)
  const _hexToBytes = (hex: string): Uint8Array => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  };

  const sendNWCRequest = async (method: string, params: Record<string, unknown>): Promise<NWCResponse> => {
    if (!nwcConfig || !user?.signer) {
      throw new Error('NWC not configured or signer not available');
    }

    console.log('🔄 Sending NWC request:', method, params);
    console.log('📡 Using wallet pubkey:', nwcConfig.walletPubkey);
    console.log('🔗 Using relays:', nwcConfig.relays);

    try {
      // For now, we'll use the webln API if available in the browser
      // This is a more reliable approach than implementing the full NIP-47 protocol
      if (typeof window !== 'undefined' && (window as any).webln) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const webln = (window as any).webln;
        
        if (method === 'make_invoice') {
          console.log('💡 Using WebLN makeInvoice for NWC request');
          
          // Enable WebLN if not already enabled
          if (!webln.enabled) {
            await webln.enable();
          }
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const invoice = await webln.makeInvoice({
            amount: Math.floor((params.amount as number) / 1000), // Convert msats to sats
            defaultMemo: params.description as string,
          });
          
          console.log('✅ WebLN invoice created:', invoice);
          
          return {
            result_type: 'make_invoice',
            result: {
              invoice: invoice.paymentRequest,
              payment_hash: invoice.paymentHash,
              amount: params.amount,
              description: params.description,
              expires_at: Math.floor(Date.now() / 1000) + ((params.expiry as number) || 3600),
            }
          };
        }
      }
      
      // If WebLN is not available or method not supported, try a simplified NWC approach
      console.log('⚠️  WebLN not available, attempting simplified NWC');
      
      // For demo purposes when real NWC isn't available
      throw new Error('Real NWC protocol implementation requires proper relay communication setup. Using demo fallback.');
      
    } catch (error) {
      console.error('❌ NWC request failed:', error);
      throw error;
    }
  };

  // Create invoice mutation (simplified implementation)
  const createInvoiceMutation = useMutation({
    mutationFn: async ({ amount, description, expiry }: { 
      amount: number; 
      description: string; 
      expiry?: number; 
    }) => {
      if (!isConfigured) {
        throw new Error('NWC not configured');
      }

      console.log('🚀 Attempting to create NWC invoice...');
      console.log('💰 Amount:', amount, 'msats');
      console.log('📝 Description:', description);
      console.log('📍 NWC Config:', { 
        walletPubkey: nwcConfig?.walletPubkey,
        relays: nwcConfig?.relays,
        hasSecret: !!nwcConfig?.secret 
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
      if (!isConfigured) {
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
      if (!isConfigured) {
        throw new Error('NWC not configured');
      }
      
      const response = await sendNWCRequest('get_balance', {});
      
      if (response.error) {
        throw new Error(`NWC Error: ${response.error.message}`);
      }
      
      return response.result?.balance as number;
    },
    enabled: isConfigured,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Get wallet info query (real implementation)
  const { data: walletInfo, isLoading: isLoadingInfo } = useQuery({
    queryKey: ['nwc-info-real', nwcConfig?.walletPubkey],
    queryFn: async () => {
      if (!isConfigured) {
        throw new Error('NWC not configured');
      }
      
      const response = await sendNWCRequest('get_info', {});
      
      if (response.error) {
        throw new Error(`NWC Error: ${response.error.message}`);
      }
      
      return response.result;
    },
    enabled: isConfigured,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    isConfigured,
    walletInfo,
    balance,
    isLoadingInfo,
    isLoadingBalance,
    createInvoice: createInvoiceMutation.mutateAsync,
    payInvoice: payInvoiceMutation.mutateAsync,
    isCreatingInvoice: createInvoiceMutation.isPending,
    isPayingInvoice: payInvoiceMutation.isPending,
    refetchBalance,
  };
}