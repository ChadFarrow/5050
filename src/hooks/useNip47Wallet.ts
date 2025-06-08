import { useCallback, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';

interface Nip47Wallet {
  balance: number;
  connected: boolean;
  connect: () => Promise<void>;
  makeInvoice: (params: { amount: number; description: string }) => Promise<string>;
  payInvoice: (invoice: string) => Promise<{ preimage: string }>;
}

export function useNip47Wallet(): Nip47Wallet {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [balance, setBalance] = useState(0);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(async () => {
    if (!user) return;

    try {
      // Request wallet connection using NIP-47
      const response = await user.signer.nip47.request({
        method: 'get_balance',
        params: {},
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setBalance(response.result.balance);
      setConnected(true);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }, [user]);

  const makeInvoice = useCallback(async ({ amount, description }: { amount: number; description: string }) => {
    if (!user || !connected) {
      throw new Error('Wallet not connected');
    }

    try {
      const response = await user.signer.nip47.request({
        method: 'make_invoice',
        params: {
          amount,
          description,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.result.invoice;
    } catch (error) {
      console.error('Failed to create invoice:', error);
      throw error;
    }
  }, [user, connected]);

  const payInvoice = useCallback(async (invoice: string) => {
    if (!user || !connected) {
      throw new Error('Wallet not connected');
    }

    try {
      const response = await user.signer.nip47.request({
        method: 'pay_invoice',
        params: {
          invoice,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return {
        preimage: response.result.preimage,
      };
    } catch (error) {
      console.error('Failed to pay invoice:', error);
      throw error;
    }
  }, [user, connected]);

  return {
    balance,
    connected,
    connect,
    makeInvoice,
    payInvoice,
  };
} 