/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface NWCMCPConfig {
  serverPath?: string;
  connectionString: string;
}

export interface MCPNWCResponse {
  result?: {
    preimage?: string;
    payment_hash?: string;
    invoice?: string;
    amount?: number;
    fees_paid?: number;
    description?: string;
    created_at?: number;
    expires_at?: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export class NWCMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private config: NWCMCPConfig;

  constructor(config: NWCMCPConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // For browser environments, we'll use a different approach
      // since we can't directly spawn child processes
      if (typeof window !== 'undefined') {
        console.log('Browser environment detected - MCP server integration requires backend service');
        throw new Error('MCP NWC server requires server-side integration');
      }

      // In a Node.js environment, we would do:
      /*
      const serverPath = this.config.serverPath || 'npx @getalby/nwc-mcp-server';
      
      this.transport = new StdioClientTransport({
        command: serverPath,
        args: [],
        env: {
          ...process.env,
          NWC_CONNECTION_STRING: this.config.connectionString,
        },
      });

      this.client = new Client(
        {
          name: 'nwc-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      await this.client.connect(this.transport);
      console.log('Connected to NWC MCP server');
      */
      
      throw new Error('MCP NWC server integration requires server-side implementation');
    } catch (error) {
      console.error('Failed to initialize NWC MCP client:', error);
      throw error;
    }
  }

  async makeInvoice(params: {
    amount: number;
    description?: string;
    expiry?: number;
  }): Promise<MCPNWCResponse> {
    if (!this.client) {
      throw new Error('NWC MCP client not initialized');
    }

    try {
      const result = await this.client.callTool({
        name: 'make_invoice',
        arguments: {
          amount: params.amount,
          description: params.description || '',
          expiry: params.expiry || 3600,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content = result.content as any[];
      return {
        result: content && content[0]?.type === 'text' 
          ? JSON.parse(content[0].text) 
          : undefined,
      };
    } catch (error) {
      return {
        error: {
          code: 'INTERNAL',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async payInvoice(params: {
    invoice: string;
    amount?: number;
  }): Promise<MCPNWCResponse> {
    if (!this.client) {
      throw new Error('NWC MCP client not initialized');
    }

    try {
      const result = await this.client.callTool({
        name: 'pay_invoice',
        arguments: {
          invoice: params.invoice,
          amount: params.amount,
        },
      });

      const content = result.content as any[];
      return {
        result: content && content[0]?.type === 'text' 
          ? JSON.parse(content[0].text) 
          : undefined,
      };
    } catch (error) {
      return {
        error: {
          code: 'PAYMENT_FAILED',
          message: error instanceof Error ? error.message : 'Payment failed',
        },
      };
    }
  }

  async getBalance(): Promise<MCPNWCResponse> {
    if (!this.client) {
      throw new Error('NWC MCP client not initialized');
    }

    try {
      const result = await this.client.callTool({
        name: 'get_balance',
        arguments: {},
      });

      const content = result.content as any[];
      return {
        result: content && content[0]?.type === 'text' 
          ? JSON.parse(content[0].text) 
          : undefined,
      };
    } catch (error) {
      return {
        error: {
          code: 'INTERNAL',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getInfo(): Promise<MCPNWCResponse> {
    if (!this.client) {
      throw new Error('NWC MCP client not initialized');
    }

    try {
      const result = await this.client.callTool({
        name: 'get_info',
        arguments: {},
      });

      const content = result.content as any[];
      return {
        result: content && content[0]?.type === 'text' 
          ? JSON.parse(content[0].text) 
          : undefined,
      };
    } catch (error) {
      return {
        error: {
          code: 'INTERNAL',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }
    } catch (error) {
      console.error('Error disconnecting NWC MCP client:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const info = await this.getInfo();
      return !info.error;
    } catch {
      return false;
    }
  }
}

// Browser-compatible NWC implementation using WebSocket proxy
export class BrowserNWCClient {
  private config: NWCMCPConfig;
  private wsUrl: string;

  constructor(config: NWCMCPConfig & { wsUrl?: string }) {
    this.config = config;
    // Default to a local WebSocket proxy that communicates with the MCP server
    this.wsUrl = config.wsUrl || 'ws://localhost:8080/nwc';
  }

  async initialize(): Promise<void> {
    // This connects to a WebSocket proxy that communicates with the NWC MCP server on the backend
    console.log('Browser NWC client initialized with proxy URL:', this.wsUrl);
  }

  async makeInvoice(params: {
    amount: number;
    description?: string;
    expiry?: number;
  }): Promise<MCPNWCResponse> {
    try {
      const response = await fetch('/api/nwc/make_invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connection_string: this.config.connectionString,
          ...params,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      return {
        error: {
          code: 'INTERNAL',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async payInvoice(params: {
    invoice: string;
    amount?: number;
  }): Promise<MCPNWCResponse> {
    try {
      const response = await fetch('/api/nwc/pay_invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connection_string: this.config.connectionString,
          ...params,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      return {
        error: {
          code: 'PAYMENT_FAILED',
          message: error instanceof Error ? error.message : 'Payment failed',
        },
      };
    }
  }

  async getBalance(): Promise<MCPNWCResponse> {
    try {
      const response = await fetch('/api/nwc/get_balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connection_string: this.config.connectionString,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      return {
        error: {
          code: 'INTERNAL',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getInfo(): Promise<MCPNWCResponse> {
    try {
      const response = await fetch('/api/nwc/get_info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connection_string: this.config.connectionString,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      return {
        error: {
          code: 'INTERNAL',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async disconnect(): Promise<void> {
    // Nothing to disconnect for HTTP-based client
  }

  async testConnection(): Promise<boolean> {
    try {
      const info = await this.getInfo();
      return !info.error;
    } catch {
      return false;
    }
  }
}

// Factory function to create the appropriate client based on environment
export function createNWCClient(config: NWCMCPConfig & { wsUrl?: string }): NWCMCPClient | BrowserNWCClient {
  if (typeof window !== 'undefined') {
    return new BrowserNWCClient(config);
  } else {
    return new NWCMCPClient(config);
  }
}

// Utility function to validate NWC connection string
export function isValidNWCConnection(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    return (
      url.protocol === 'nostr+walletconnect:' &&
      url.hostname.length === 64 &&
      url.searchParams.has('relay') &&
      url.searchParams.has('secret')
    );
  } catch {
    return false;
  }
}