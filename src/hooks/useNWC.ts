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

    console.log('Creating invoice:', { amount, description });
    console.log('NWC Client config:', { 
      mcpEnabled: nwcConfig?.mcpServer?.enabled, 
      mcpUrl: nwcConfig?.mcpServer?.serverUrl 
    });
    
    setIsCreatingInvoice(true);
    try {
      // First, let's test if MCP server is reachable
      if (nwcConfig?.mcpServer?.enabled && nwcConfig.mcpServer.serverUrl) {
        console.log('Testing MCP server connectivity...');
        try {
          const testResponse = await fetch(nwcConfig.mcpServer.serverUrl, { 
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          });
          console.log('MCP server test response:', testResponse.status);
        } catch (mcpTestError) {
          console.error('MCP server is not reachable:', mcpTestError);
          // Don't fail here, let the actual request handle it
        }
      }
      
      // Add timeout to invoice creation with more detailed logging
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          console.error('Invoice creation timed out after 15 seconds');
          reject(new Error('Invoice creation timed out after 15 seconds. Check your wallet is online and MCP server is running. Try disabling MCP in Advanced Settings to use direct connection.'));
        }, 15000);
        return timeoutId;
      });
      
      console.log('Starting invoice creation...');
      const invoicePromise = nwcClient.makeInvoice(amount, description);
      const invoice = await Promise.race([invoicePromise, timeoutPromise]);
      
      console.log('Invoice created successfully:', invoice);
      toast.lightning.invoiceCreated(amount);
      return invoice;
    } catch (error) {
      console.error('Failed to create invoice:', error);
      
      // Provide more specific error messages
      const errorMessage = error instanceof Error ? error.message : "Failed to create invoice";
      
      if (errorMessage.includes('timed out')) {
        toast.error(
          "Invoice Creation Timeout", 
          `Your wallet may be offline or not responding. Try: 1) Disable MCP in Advanced Settings 2) Regenerate your NWC connection string 3) Check relay connection using the test tools`
        );
      } else if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('permission')) {
        toast.error("Permission Denied", "Enable 'make_invoice' permission in your wallet's NWC settings");
      } else if (errorMessage.includes('WebSocket') || errorMessage.includes('relay')) {
        toast.error(
          "Connection Failed", 
          "Cannot reach your wallet's relay. Check your wallet is online or try a different NWC connection string."
        );
      } else if (errorMessage.includes('MCP')) {
        toast.error(
          "MCP Server Error", 
          "MCP server issue. Try disabling MCP in Advanced Settings to use direct connection."
        );
      } else {
        toast.error("Invoice Creation Failed", errorMessage);
      }
      
      throw error;
    } finally {
      setIsCreatingInvoice(false);
    }
  }, [nwcClient, nwcConfig?.mcpServer?.enabled, nwcConfig?.mcpServer?.serverUrl, toast]);

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