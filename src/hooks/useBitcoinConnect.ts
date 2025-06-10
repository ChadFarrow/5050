import { useState, useCallback, useEffect } from 'react';
import { 
  disconnect as bitcoinConnectDisconnect,
  closeModal as bitcoinConnectCloseModal,
  isConnected as bitcoinConnectIsConnected,
  requestProvider,
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
    console.log('Setting up Bitcoin Connect event listeners...');
    const unsubscribers: (() => void)[] = [];

    // Subscribe to connection events
    try {
      const unsubscribeConnected = onConnected((provider) => {
        console.log('🔥 onConnected callback triggered!');
        console.log('Provider received:', provider);
        console.log('Provider type:', typeof provider);
        console.log('Provider methods:', provider ? Object.keys(provider) : 'no provider');
        
        // Bitcoin Connect v3 fix: manually set window.webln
        if (provider) {
          window.webln = provider;
          console.log('✅ Set window.webln to provider');
        } else {
          console.error('❌ Provider is null/undefined');
        }
        
        console.log('WebLN availability after setting:', { 
          webln: !!window.webln, 
          makeInvoice: !!window.webln?.makeInvoice,
          sendPayment: !!window.webln?.sendPayment,
          getBalance: !!window.webln?.getBalance,
          getInfo: !!window.webln?.getInfo
        });
      
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        error: undefined,
      }));

      // Try to get initial wallet info if makeInvoice is available
      if (typeof window.webln?.makeInvoice === 'function') {
        Promise.allSettled([
          window.webln.getBalance?.(),
          window.webln.getInfo?.(),
        ]).then(([balanceResult, infoResult]) => {
          console.log('Initial wallet info results:', { balanceResult, infoResult });
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
        console.warn('WebLN makeInvoice not available after connection');
      }
    });
    console.log('✅ onConnected listener registered');
    unsubscribers.push(unsubscribeConnected);
    } catch (error) {
      console.error('❌ Failed to register onConnected listener:', error);
    }

    try {
      const unsubscribeDisconnected = onDisconnected(() => {
      console.log('Bitcoin Connect: Wallet disconnected');
      
      // Clear window.webln when disconnected
      if (window.webln) {
        delete window.webln;
      }
      
      setState({
        isConnected: false,
        isConnecting: false,
        balance: undefined,
        nodeInfo: undefined,
        error: undefined,
      });
    });
    console.log('✅ onDisconnected listener registered');
    unsubscribers.push(unsubscribeDisconnected);
    } catch (error) {
      console.error('❌ Failed to register onDisconnected listener:', error);
    }

    try {
      const unsubscribeConnecting = onConnecting(() => {
      console.log('Bitcoin Connect: Wallet connecting');
      setState(prev => ({
        ...prev,
        isConnecting: true,
        error: undefined,
      }));
    });
    console.log('✅ onConnecting listener registered');
    unsubscribers.push(unsubscribeConnecting);
    } catch (error) {
      console.error('❌ Failed to register onConnecting listener:', error);
    }

    // Check initial connection state
    const checkInitialState = () => {
      try {
        const isCurrentlyConnected = bitcoinConnectIsConnected();
        console.log('Bitcoin Connect initial state check:', {
          bitcoinConnectConnected: isCurrentlyConnected,
          webln: !!window.webln,
          weblnEnabled: typeof window.webln?.makeInvoice === 'function',
          makeInvoice: !!window.webln?.makeInvoice
        });
        
        // Only consider connected if both Bitcoin Connect says connected AND WebLN makeInvoice is available
        if (isCurrentlyConnected && typeof window.webln?.makeInvoice === 'function') {
          setState(prev => ({
            ...prev,
            isConnected: true,
            isConnecting: false,
          }));
        } else if (!isCurrentlyConnected) {
          // If Bitcoin Connect says not connected, clear state
          setState(prev => ({
            ...prev,
            isConnected: false,
            isConnecting: false,
          }));
        }
      } catch (error) {
        console.warn('Failed to check initial Bitcoin Connect state:', error);
      }
    };

    // Delay initial check to allow Bitcoin Connect to initialize
    setTimeout(checkInitialState, 100);
    
    // Also check periodically in case connection state changes
    const interval = setInterval(checkInitialState, 2000);
    
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      clearInterval(interval);
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
    }
    
    // Always clean up WebLN and state regardless of API call success
    if (window.webln) {
      delete window.webln;
    }
    
    setState({
      isConnected: false,
      isConnecting: false,
      balance: undefined,
      nodeInfo: undefined,
      error: undefined,
    });
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
    console.log('createInvoice called with:', { amount, memo, webln: !!window.webln, enabled: typeof window.webln?.makeInvoice === 'function' });
    
    let provider = window.webln;
    
    // If WebLN is not available, try to get it via requestProvider
    if (!provider || typeof provider.makeInvoice !== 'function') {
      console.log('WebLN not available, trying requestProvider...');
      try {
        provider = await requestProvider();
        console.log('✅ Got provider from requestProvider:', provider);
        
        // Set it on window for future use
        window.webln = provider;
      } catch (error) {
        console.error('❌ requestProvider failed:', error);
        throw new Error('Failed to connect to wallet. Please ensure your wallet is properly connected.');
      }
    }

    if (!provider) {
      console.error('No provider available after all attempts');
      throw new Error('WebLN not available. Please ensure your wallet is properly connected.');
    }

    if (typeof provider.makeInvoice !== 'function') {
      console.error('makeInvoice method not available');
      throw new Error('Your wallet does not support invoice creation.');
    }

    try {
      console.log('Calling makeInvoice with:', { amount, defaultMemo: memo });
      const invoice = await provider.makeInvoice({
        amount,
        defaultMemo: memo,
      });
      console.log('makeInvoice returned:', invoice);
      
      if (!invoice || !invoice.paymentRequest) {
        throw new Error('Invalid invoice response from wallet');
      }
      
      return invoice.paymentRequest;
    } catch (error) {
      console.error('makeInvoice error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create invoice');
    }
  }, []);

  const payInvoice = useCallback(async (invoice: string): Promise<void> => {
    if (typeof window.webln?.makeInvoice !== 'function') {
      throw new Error('WebLN wallet not connected');
    }

    try {
      await window.webln.sendPayment(invoice);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to pay invoice');
    }
  }, []);

  const getBalance = useCallback(async (): Promise<number> => {
    if (typeof window.webln?.makeInvoice !== 'function' || !window.webln.getBalance) {
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
    if (typeof window.webln?.makeInvoice !== 'function' || !window.webln.getInfo) {
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