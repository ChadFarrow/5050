import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { type NWCConfig, type LightningInvoice } from '@/lib/lightning';
import { nip04, getPublicKey } from 'nostr-tools';

interface NWCRequest {
  method: string;
  params: Record<string, unknown>;
}

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
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [nwcConfig] = useLocalStorage<NWCConfig | null>('nwc-config', null);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    setIsConfigured(!!nwcConfig && !!user?.signer);
  }, [nwcConfig, user]);

  // Convert hex string to Uint8Array
  const hexToBytes = (hex: string): Uint8Array => {
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

    const request: NWCRequest = {
      method,
      params,
    };

    // Convert secret hex to private key bytes
    const secretKey = hexToBytes(nwcConfig.secret);
    const clientPubkey = getPublicKey(secretKey);

    // Encrypt the request content using NIP-04
    const encryptedContent = await nip04.encrypt(
      nwcConfig.secret,
      nwcConfig.walletPubkey,
      JSON.stringify(request)
    );

    // Create the request event
    const requestEvent = {
      kind: 23194,
      content: encryptedContent,
      tags: [
        ['p', nwcConfig.walletPubkey],
      ],
      created_at: Math.floor(Date.now() / 1000),
      pubkey: clientPubkey,
    };

    // Sign the event with user's signer
    const signedEvent = await user.signer.signEvent(requestEvent);

    // Use the existing nostr client to publish and wait for response
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('NWC request timeout'));
      }, 30000); // 30 second timeout

      const executeRequest = async () => {
        try {
          // Subscribe to responses before publishing the request
          const responseFilter = {
            kinds: [23195],
            authors: [nwcConfig.walletPubkey],
            '#p': [clientPubkey],
            since: Math.floor(Date.now() / 1000) - 60,
          };

          // Listen for the response
          const events = await nostr.query([responseFilter], { 
            signal: AbortSignal.timeout(30000) 
          });

          // Publish the request event
          await nostr.event(signedEvent);

          // Check if we already got a response in the initial query
          for (const event of events) {
            try {
              const decryptedContent = await nip04.decrypt(
                nwcConfig.secret,
                nwcConfig.walletPubkey,
                event.content
              );
              
              const response = JSON.parse(decryptedContent) as NWCResponse;
              clearTimeout(timeoutId);
              resolve(response);
              return;
            } catch (error) {
              console.warn('Failed to decrypt response event:', error);
            }
          }

          // If no immediate response, wait for new events
          // This is a simplified approach - a full implementation would use proper subscriptions
          setTimeout(async () => {
            try {
              const newEvents = await nostr.query([{
                ...responseFilter,
                since: Math.floor(Date.now() / 1000),
              }], { signal: AbortSignal.timeout(25000) });

              for (const event of newEvents) {
                try {
                  const decryptedContent = await nip04.decrypt(
                    nwcConfig.secret,
                    nwcConfig.walletPubkey,
                    event.content
                  );
                  
                  const response = JSON.parse(decryptedContent) as NWCResponse;
                  clearTimeout(timeoutId);
                  resolve(response);
                  return;
                } catch (error) {
                  console.warn('Failed to decrypt response event:', error);
                }
              }
              
              reject(new Error('No response received from NWC wallet'));
            } catch (error) {
              clearTimeout(timeoutId);
              reject(error);
            }
          }, 2000); // Wait 2 seconds before checking for responses

        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      };

      executeRequest();
    });
  };

  // Create invoice mutation (real implementation)
  const createInvoiceMutation = useMutation({
    mutationFn: async ({ amount, description, expiry }: { 
      amount: number; 
      description: string; 
      expiry?: number; 
    }) => {
      if (!isConfigured) {
        throw new Error('NWC not configured');
      }

      const response = await sendNWCRequest('make_invoice', {
        amount,
        description,
        expiry: expiry || 3600,
      });

      if (response.error) {
        throw new Error(`NWC Error: ${response.error.message}`);
      }

      const result = response.result as Record<string, unknown>;
      return {
        bolt11: result.invoice as string,
        payment_hash: result.payment_hash as string,
        payment_request: result.invoice as string,
        amount_msat: result.amount as number,
        description: (result.description as string) || description,
        expires_at: (result.expires_at as number) * 1000, // Convert to milliseconds
        checking_id: result.payment_hash as string,
      } as LightningInvoice;
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