import { useState, useCallback, useEffect } from 'react';

// Import Bitcoin Connect store for proper disconnect functionality
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
    // Bitcoin Connect store
    bitcoinConnectStore?: unknown;
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

  // Check Bitcoin Connect store and WebLN availability
  useEffect(() => {
    const checkConnection = () => {
      // First check Bitcoin Connect store if available
      const store = window.bitcoinConnectStore as { getState?: () => { connected?: boolean; connecting?: boolean } } | undefined;
      if (store?.getState) {
        try {
          const bcState = store.getState();
          if (bcState.connected && window.webln?.enabled) {
            setState(prev => ({
              ...prev,
              isConnected: true,
              isConnecting: false,
            }));
            
            // Try to get initial info
            Promise.allSettled([
              window.webln?.getBalance?.(),
              window.webln?.getInfo?.(),
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
          } else {
            setState(prev => ({
              ...prev,
              isConnected: false,
              isConnecting: bcState.connecting || false,
            }));
          }
        } catch {
          // Fallback if store access fails
          if (window.webln?.enabled) {
            setState(prev => ({
              ...prev,
              isConnected: true,
              isConnecting: false,
            }));
          }
        }
      } else if (window.webln?.enabled) {
        // Fallback to direct WebLN check
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
        }));
      }
    };

    checkConnection();
    
    // Subscribe to Bitcoin Connect store changes if available
    let unsubscribe: (() => void) | undefined;
    const store = window.bitcoinConnectStore as { subscribe?: (fn: () => void) => () => void } | undefined;
    if (store?.subscribe) {
      try {
        unsubscribe = store.subscribe(checkConnection);
      } catch {
        // Ignore subscription errors
      }
    }
    
    // Fallback polling for WebLN changes
    const interval = setInterval(checkConnection, 1000);
    
    return () => {
      clearInterval(interval);
      if (unsubscribe) {
        unsubscribe();
      }
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
    // Use Bitcoin Connect's disconnect if available
    const store = window.bitcoinConnectStore as { disconnect?: () => void } | undefined;
    if (store?.disconnect) {
      try {
        store.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
    
    // Always update local state
    setState({
      isConnected: false,
      isConnecting: false,
      balance: undefined,
      nodeInfo: undefined,
      error: undefined,
    });
  }, []);

  const closeModal = useCallback(() => {
    const store = window.bitcoinConnectStore as { setModalOpen?: (open: boolean) => void } | undefined;
    if (store?.setModalOpen) {
      try {
        store.setModalOpen(false);
      } catch {
        // Ignore modal close errors
      }
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