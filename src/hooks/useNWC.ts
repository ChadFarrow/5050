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
      // Validate the connection string
      if (!isValidNWCConnection(connectionString)) {
        throw new Error('Invalid NWC connection string format');
      }

      // Test the connection by creating a client and getting wallet info
      const testClient = new NWCClient(connectionString);
      const connection = testClient.connectionInfo;
      
      // Try to get wallet info to verify the connection works
      try {
        // This will test the connection and get capabilities
        await testClient.getBalance();
      } catch (error) {
        // If balance fails, that's okay - wallet might not support it
        // The connection validation during client creation is sufficient
        console.log('Balance check failed (this is okay):', error);
      }
      
      const config: NWCConfig = {
        connectionString,
        enabled: true,
        alias: `Wallet ${connection.walletPubkey.slice(0, 8)}...`,
        mcpServer: {
          enabled: false, // Start with MCP disabled by default
          serverUrl: undefined,
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