import { useBitcoinConnect } from './useBitcoinConnect';
import { useBitcoinConnectEvents } from './useBitcoinConnectEvents';

export type WalletProvider = 'bitcoin-connect';

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
  disconnect: () => void;
  closeModal: () => void;
  refreshState: () => void;
}

export function useWallet(): WalletState & WalletActions {
  const bitcoinConnect = useBitcoinConnect();
  
  // Listen for Bitcoin Connect events to force re-renders
  useBitcoinConnectEvents();

  if (!bitcoinConnect.isConnected) {
    return {
      isConnected: false,
      isConnecting: bitcoinConnect.isConnecting,
      error: bitcoinConnect.error,
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
      disconnect: () => {
        // No-op when not connected
      },
      closeModal: () => {
        // Close modal even when not connected
        bitcoinConnect.closeModal();
      },
      refreshState: () => {
        // Refresh state even when not connected
        bitcoinConnect.refreshState();
      },
    };
  }

  return {
    isConnected: bitcoinConnect.isConnected,
    isConnecting: bitcoinConnect.isConnecting,
    provider: 'bitcoin-connect',
    balance: bitcoinConnect.balance,
    nodeInfo: bitcoinConnect.nodeInfo,
    error: bitcoinConnect.error,
    createInvoice: bitcoinConnect.createInvoice,
    payInvoice: bitcoinConnect.payInvoice,
    getBalance: bitcoinConnect.getBalance,
    getInfo: bitcoinConnect.getInfo,
    disconnect: bitcoinConnect.disconnect,
    closeModal: bitcoinConnect.closeModal,
    refreshState: bitcoinConnect.refreshState,
  };
}