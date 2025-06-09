import { useState, useCallback, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { NWCClient, isValidNWCConnection } from '@/lib/nwc';
import { useToastUtils } from '@/lib/shared-utils';
import type { LightningInvoice, NWCConnection } from '@/lib/nwc';

export interface NWCConfig {
  connectionString: string;
  enabled: boolean;
  alias?: string;
  mcpServer?: {
    enabled: boolean;
    serverUrl?: string;
    apiKey?: string;
  };
}

export type { LightningInvoice, NWCConnection };

export function useNWC() {
  const [nwcConfig, setNwcConfig] = useLocalStorage<NWCConfig | null>('nwc-config', null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const toast = useToastUtils();

  // Create NWC client instance when config is available
  const nwcClient = useMemo(() => {
    if (!nwcConfig?.enabled || !nwcConfig.connectionString) {
      return null;
    }
    
    try {
      return new NWCClient(nwcConfig.connectionString, nwcConfig.mcpServer);
    } catch (error) {
      console.error('Failed to create NWC client:', error);
      return null;
    }
  }, [nwcConfig]);

  const connect = useCallback(async (connectionString: string) => {
    setIsConnecting(true);
    try {
      console.log('Starting NWC connection process...');
      
      // Validate the connection string
      if (!isValidNWCConnection(connectionString)) {
        throw new Error('Invalid NWC connection string format');
      }
      console.log('Connection string validation passed');

      // Test the connection by creating a client and getting wallet info
      const testClient = new NWCClient(connectionString);
      const connection = testClient.connectionInfo;
      console.log('NWC client created, connection info:', connection);
      
      // Try to get wallet info to verify the connection works
      // Note: Some wallets only support specific methods (like make_invoice)
      try {
        // Start with getInfo which is more likely to work
        console.log('Testing connection with getInfo...');
        const info = await testClient.getInfo();
        console.log('Connection test: getInfo succeeded', info);
      } catch (infoError) {
        console.log('Connection test: getInfo failed, trying balance...', infoError);
        try {
          // Fallback to balance check
          const balance = await testClient.getBalance();
          console.log('Connection test: getBalance succeeded', balance);
        } catch (balanceError) {
          // If both fail, try a small invoice creation
          console.log('Connection test: getBalance failed, trying invoice...', balanceError);
          try {
            const invoice = await testClient.makeInvoice(1000, 'Connection test');
            console.log('Connection test: makeInvoice succeeded', invoice);
          } catch (invoiceError) {
            console.log('Connection test: All methods failed', invoiceError);
            // Don't fail completely - some wallets work but have limited permissions
            console.warn('All connection tests failed, but proceeding with connection. Balance may not be available.');
          }
        }
      }
      
      const config: NWCConfig = {
        connectionString,
        enabled: true,
        alias: `Wallet ${connection.walletPubkey.slice(0, 8)}...`,
        mcpServer: {
          enabled: false, // Disable hosted MCP due to CORS issues, use local MCP server instead
          serverUrl: 'http://localhost:3000',
          apiKey: undefined,
        },
      };

      setNwcConfig(config);
      toast.lightning.connected();
      return true;
    } catch (error) {
      console.error('NWC connection failed:', error);
      toast.error("Connection Failed", error instanceof Error ? error.message : "Failed to connect to wallet");
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [setNwcConfig, toast]);

  const disconnect = useCallback(() => {
    setNwcConfig(null);
    toast.lightning.disconnected();
  }, [setNwcConfig, toast]);

  const createInvoice = useCallback(async (amount: number, description: string): Promise<LightningInvoice> => {
    if (!nwcClient) {
      throw new Error('NWC not configured');
    }

    setIsCreatingInvoice(true);
    try {
      const invoice = await nwcClient.makeInvoice(amount, description);
      toast.lightning.invoiceCreated(amount);
      return invoice;
    } catch (error) {
      console.error('Failed to create invoice:', error);
      toast.error("Invoice Creation Failed", error instanceof Error ? error.message : "Failed to create invoice");
      throw error;
    } finally {
      setIsCreatingInvoice(false);
    }
  }, [nwcClient, toast]);

  const isConfigured = Boolean(nwcConfig?.enabled && nwcConfig.connectionString);

  // MCP Server Configuration
  const configureMCPServer = useCallback((mcpConfig: { enabled: boolean; serverUrl?: string; apiKey?: string }) => {
    if (!nwcConfig) {
      toast.error("Configuration Error", "NWC must be configured before setting up MCP server");
      return;
    }

    const updatedConfig: NWCConfig = { ...nwcConfig, mcpServer: mcpConfig };
    setNwcConfig(updatedConfig);
    
    toast.success(
      mcpConfig.enabled ? "MCP Server Enabled" : "MCP Server Disabled",
      mcpConfig.enabled ? 
        "NWC requests will use MCP server when available" : 
        "NWC requests will use direct connection"
    );
  }, [nwcConfig, setNwcConfig, toast]);

  // Additional methods for wallet operations
  const payInvoice = useCallback(async (paymentRequest: string) => {
    if (!nwcClient) {
      throw new Error('NWC not configured');
    }

    try {
      const result = await nwcClient.payInvoice(paymentRequest);
      toast.lightning.paymentSent();
      return result;
    } catch (error) {
      console.error('Failed to pay invoice:', error);
      toast.lightning.paymentFailed(error instanceof Error ? error.message : undefined);
      throw error;
    }
  }, [nwcClient, toast]);

  const getBalance = useCallback(async () => {
    if (!nwcClient) {
      throw new Error('NWC not configured');
    }

    try {
      return await nwcClient.getBalance();
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw error;
    }
  }, [nwcClient]);

  return {
    nwcConfig: nwcConfig || { connectionString: '', enabled: false },
    isConfigured,
    isConnecting,
    isCreatingInvoice,
    connect,
    disconnect,
    createInvoice,
    payInvoice,
    getBalance,
    configureMCPServer,
    nwcClient,
  };
}