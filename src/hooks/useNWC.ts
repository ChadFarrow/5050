import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAppContext } from '@/hooks/useAppContext';
import { type NWCConfig, type LightningInvoice } from '@/lib/lightning';

// Note: These interfaces would be used in a full NWC implementation
interface _NWCRequest {
  method: string;
  params: Record<string, unknown>;
}

interface _NWCResponse {
  result_type: string;
  error?: {
    code: string;
    message: string;
  };
  result?: Record<string, unknown>;
}

export function useNWC() {
  const { nostr: _nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const [nwcConfig] = useLocalStorage<NWCConfig | null>('nwc-config', null);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    setIsConfigured(!!nwcConfig && !!user?.signer);
  }, [nwcConfig, user]);

  // Check if we're in demo mode or real mode
  const isDemoMode = config.nwcDemoMode;

  // Query wallet info (demo version)
  const { data: walletInfo, isLoading: isLoadingInfo } = useQuery({
    queryKey: ['nwc-info', nwcConfig?.walletPubkey],
    queryFn: async () => {
      if (!isConfigured) {
        throw new Error('NWC not configured');
      }
      
      // Return demo wallet info
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        alias: 'Demo NWC Wallet',
        pubkey: nwcConfig?.walletPubkey,
        network: 'mainnet',
        methods: ['make_invoice', 'pay_invoice', 'get_balance', 'get_info'],
      };
    },
    enabled: isConfigured,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Query wallet balance (demo version)
  const { data: balance, isLoading: isLoadingBalance, refetch: refetchBalance } = useQuery({
    queryKey: ['nwc-balance', nwcConfig?.walletPubkey],
    queryFn: async () => {
      if (!isConfigured) {
        throw new Error('NWC not configured');
      }
      
      // Return demo balance
      await new Promise(resolve => setTimeout(resolve, 300));
      return 1000000; // 1000 sats in msats
    },
    enabled: isConfigured,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async ({ amount, description, expiry }: { 
      amount: number; 
      description: string; 
      expiry?: number; 
    }) => {
      // For demo purposes, create a mock invoice when NWC is configured
      // In production, this would use the actual NWC protocol
      if (!isConfigured) {
        throw new Error('NWC not configured');
      }

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

      if (isDemoMode) {
        console.warn('🚨 NWC Demo Mode: This is a mock invoice for demonstration purposes only!');
        console.log('To use real NWC invoices, set nwcDemoMode to false in App.tsx and implement the full NIP-47 protocol.');
      }

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      return mockInvoice;
    },
    onSuccess: () => {
      // Refetch balance after creating invoice
      refetchBalance();
    },
  });

  // Pay invoice mutation (demo version)
  const payInvoiceMutation = useMutation({
    mutationFn: async ({ _bolt11, _amount }: { _bolt11: string; _amount?: number }) => {
      if (!isConfigured) {
        throw new Error('NWC not configured');
      }

      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      return {
        preimage: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''),
        fees_paid: 1000, // 1 sat fee
      };
    },
    onSuccess: () => {
      // Refetch balance after payment
      refetchBalance();
    },
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