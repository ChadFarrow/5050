import { useNWC } from './useNWC';
import { useBitcoinConnect, type BitcoinConnectState } from './useBitcoinConnect';

export type WalletProvider = 'bitcoin-connect' | 'nwc';

export interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  provider?: WalletProvider;
  balance?: number;
  nodeInfo?: {
    alias?: string;
    pubkey?: string;
  };
  error?: string;
}

export interface WalletActions {
  createInvoice: (amount: number, memo?: string) => Promise<string>;
  payInvoice: (invoice: string) => Promise<void>;
  getBalance: () => Promise<number>;
  getInfo: () => Promise<{ alias?: string; pubkey?: string }>;
}

export function useWallet(): WalletState & WalletActions {
  const nwc = useNWC();
  const bitcoinConnect = useBitcoinConnect();

  // Determine which provider is active
  const getActiveProvider = (): { provider: WalletProvider; state: BitcoinConnectState; actions: WalletActions } | null => {
    if (bitcoinConnect.isConnected) {
      return {
        provider: 'bitcoin-connect',
        state: bitcoinConnect,
        actions: bitcoinConnect,
      };
    }
    
    if (nwc.isConfigured) {
      return {
        provider: 'nwc',
        state: {
          isConnected: nwc.isConfigured,
          isConnecting: nwc.isConnecting,
          balance: undefined, // NWC balance is handled separately in LightningConfig
          nodeInfo: { alias: nwc.nwcConfig.alias },
          error: undefined,
        },
        actions: {
          createInvoice: async (amount: number, memo?: string) => {
            if (!nwc.nwcClient) {
              throw new Error('NWC client not available');
            }
            const invoice = await nwc.nwcClient.makeInvoice(amount, memo || '');
            return invoice.bolt11;
          },
          payInvoice: async (invoice: string) => {
            if (!nwc.nwcClient) {
              throw new Error('NWC client not available');
            }
            await nwc.nwcClient.payInvoice(invoice);
          },
          getBalance: nwc.getBalance,
          getInfo: async () => {
            if (!nwc.nwcClient) {
              throw new Error('NWC client not available');
            }
            const info = await nwc.nwcClient.getInfo();
            return {
              alias: info.alias || undefined,
              pubkey: info.pubkey || undefined,
            };
          },
        },
      };
    }

    return null;
  };

  const activeProvider = getActiveProvider();

  if (!activeProvider) {
    return {
      isConnected: false,
      isConnecting: bitcoinConnect.isConnecting || nwc.isConnecting,
      createInvoice: async () => {
        throw new Error('No wallet connected');
      },
      payInvoice: async () => {
        throw new Error('No wallet connected');
      },
      getBalance: async () => {
        throw new Error('No wallet connected');
      },
      getInfo: async () => {
        throw new Error('No wallet connected');
      },
    };
  }

  return {
    isConnected: activeProvider.state.isConnected,
    isConnecting: activeProvider.state.isConnecting,
    provider: activeProvider.provider,
    balance: activeProvider.state.balance,
    nodeInfo: activeProvider.state.nodeInfo,
    error: activeProvider.state.error,
    createInvoice: activeProvider.actions.createInvoice,
    payInvoice: activeProvider.actions.payInvoice,
    getBalance: activeProvider.actions.getBalance,
    getInfo: activeProvider.actions.getInfo,
  };
}