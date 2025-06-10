import { useState, useCallback, useEffect } from 'react';
import { 
  disconnect as bitcoinConnectDisconnect,
  closeModal as bitcoinConnectCloseModal,
  isConnected as bitcoinConnectIsConnected,
  onConnected,
  onDisconnected,
  onConnecting
} from '@getalby/bitcoin-connect';

// WebLN interface
declare global {
  interface Window {
    webln?: {
      enabled?: boolean;
      enable(): Promise<void>;
      makeInvoice(args: { amount: number; defaultMemo?: string }): Promise<{ paymentRequest: string }>;
      sendPayment(paymentRequest: string): Promise<{ preimage: string }>;
      getBalance?(): Promise<{ balance: number }>;
      getInfo?(): Promise<{ node?: { alias?: string; pubkey?: string } }>;
    };
  }
}

export interface BitcoinConnectState {
  isConnected: boolean;
  isConnecting: boolean;
  balance?: number;
  nodeInfo?: {
    alias?: string;
    pubkey?: string;
  };
  error?: string;
}

export interface BitcoinConnectActions {
  connect: () => Promise<void>;
  disconnect: () => void;
  createInvoice: (amount: number, memo?: string) => Promise<string>;
  payInvoice: (invoice: string) => Promise<void>;
  getBalance: () => Promise<number>;
  getInfo: () => Promise<{ alias?: string; pubkey?: string }>;
  closeModal: () => void;
}

export function useBitcoinConnect(): BitcoinConnectState & BitcoinConnectActions {
  const [state, setState] = useState<BitcoinConnectState>({
    isConnected: false,
    isConnecting: false,
  });

  // Set up Bitcoin Connect event listeners
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Subscribe to connection events
    const unsubscribeConnected = onConnected((provider) => {
      console.log('Bitcoin Connect: Wallet connected', provider);
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        error: undefined,
      }));

      // Try to get initial wallet info
      if (window.webln?.enabled) {
        Promise.allSettled([
          window.webln.getBalance?.(),
          window.webln.getInfo?.(),
        ]).then(([balanceResult, infoResult]) => {
          setState(prev => ({
            ...prev,
            balance: balanceResult.status === 'fulfilled' && balanceResult.value ? balanceResult.value.balance : undefined,
            nodeInfo: infoResult.status === 'fulfilled' && infoResult.value ? {
              alias: infoResult.value.node?.alias,
              pubkey: infoResult.value.node?.pubkey,
            } : undefined,
          }));
        });
      }
    });
    unsubscribers.push(unsubscribeConnected);

    const unsubscribeDisconnected = onDisconnected(() => {
      console.log('Bitcoin Connect: Wallet disconnected');
      setState({
        isConnected: false,
        isConnecting: false,
        balance: undefined,
        nodeInfo: undefined,
        error: undefined,
      });
    });
    unsubscribers.push(unsubscribeDisconnected);

    const unsubscribeConnecting = onConnecting(() => {
      console.log('Bitcoin Connect: Wallet connecting');
      setState(prev => ({
        ...prev,
        isConnecting: true,
        error: undefined,
      }));
    });
    unsubscribers.push(unsubscribeConnecting);

    // Check initial connection state
    const checkInitialState = () => {
      try {
        const isCurrentlyConnected = bitcoinConnectIsConnected();
        console.log('Bitcoin Connect initial state:', isCurrentlyConnected);
        
        if (isCurrentlyConnected || window.webln?.enabled) {
          setState(prev => ({
            ...prev,
            isConnected: true,
            isConnecting: false,
          }));
        }
      } catch (error) {
        console.warn('Failed to check initial Bitcoin Connect state:', error);
      }
    };

    // Delay initial check to allow Bitcoin Connect to initialize
    setTimeout(checkInitialState, 100);

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  const connect = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isConnecting: true, error: undefined }));
      
      if (!window.webln) {
        throw new Error('WebLN not available. Please use a compatible wallet or install a WebLN extension.');
      }

      await window.webln.enable();
      
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Failed to connect wallet',
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    console.log('Disconnecting wallet...');
    
    try {
      // First close any open modal
      bitcoinConnectCloseModal();
      
      // Then disconnect
      bitcoinConnectDisconnect();
      
      console.log('Successfully called Bitcoin Connect disconnect and closeModal');
    } catch (error) {
      console.error('Bitcoin Connect disconnect failed:', error);
      
      // Force state update even if API call failed
      setState({
        isConnected: false,
        isConnecting: false,
        balance: undefined,
        nodeInfo: undefined,
        error: undefined,
      });
    }
  }, []);

  const closeModal = useCallback(() => {
    console.log('Closing Bitcoin Connect modal...');
    
    try {
      bitcoinConnectCloseModal();
      console.log('Successfully called Bitcoin Connect closeModal');
    } catch (error) {
      console.error('Bitcoin Connect closeModal failed:', error);
    }
  }, []);

  const createInvoice = useCallback(async (amount: number, memo?: string): Promise<string> => {
    if (!window.webln?.enabled) {
      throw new Error('WebLN wallet not connected');
    }

    try {
      const invoice = await window.webln.makeInvoice({
        amount,
        defaultMemo: memo,
      });
      return invoice.paymentRequest;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to create invoice');
    }
  }, []);

  const payInvoice = useCallback(async (invoice: string): Promise<void> => {
    if (!window.webln?.enabled) {
      throw new Error('WebLN wallet not connected');
    }

    try {
      await window.webln.sendPayment(invoice);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to pay invoice');
    }
  }, []);

  const getBalance = useCallback(async (): Promise<number> => {
    if (!window.webln?.enabled || !window.webln.getBalance) {
      throw new Error('Balance not available');
    }

    try {
      const balance = await window.webln.getBalance();
      setState(prev => ({ ...prev, balance: balance.balance }));
      return balance.balance;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to get balance');
    }
  }, []);

  const getInfo = useCallback(async (): Promise<{ alias?: string; pubkey?: string }> => {
    if (!window.webln?.enabled || !window.webln.getInfo) {
      throw new Error('Node info not available');
    }

    try {
      const info = await window.webln.getInfo();
      const nodeInfo = {
        alias: info.node?.alias,
        pubkey: info.node?.pubkey,
      };
      setState(prev => ({ ...prev, nodeInfo }));
      return nodeInfo;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to get node info');
    }
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    createInvoice,
    payInvoice,
    getBalance,
    getInfo,
    closeModal,
  };
}