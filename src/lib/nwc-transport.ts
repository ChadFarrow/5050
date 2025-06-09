import { nip04, getPublicKey } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import type { 
  NWCConnection, 
  NWCResponse, 
  NWCMethod, 
  MCPServerConfig, 
  MCPRequest 
} from './nwc-types';
import { hexToBytes, getErrorMessage } from './nwc-utils';

export class NWCTransport {
  private connection: NWCConnection;
  private clientSecret: Uint8Array;
  private clientPubkey: string;
  private mcpConfig?: MCPServerConfig;

  constructor(connection: NWCConnection, mcpConfig?: MCPServerConfig) {
    this.connection = connection;
    this.clientSecret = hexToBytes(connection.secret);
    this.clientPubkey = getPublicKey(this.clientSecret);
    this.mcpConfig = mcpConfig;
  }

  async sendRequest(request: { method: string; params: Record<string, unknown> }): Promise<NWCResponse> {
    // Try MCP server first if configured
    if (this.mcpConfig?.enabled) {
      try {
        return await this.sendMCPRequest({
          method: request.method,
          params: request.params
        });
      } catch (mcpError) {
        console.log('MCP request failed, falling back to direct NWC:', mcpError);
        // Fall through to direct NWC implementation
      }
    }

    return this.sendDirectRequest(request);
  }

  private async sendMCPRequest(request: MCPRequest): Promise<NWCResponse> {
    if (!this.mcpConfig?.serverUrl) {
      throw new Error('MCP server URL not configured');
    }

    // Try Alby hosted MCP first (REST API)
    if (this.mcpConfig.serverUrl.includes('mcp.getalby.com')) {
      return this.sendAlbyMCPRequest(request);
    }

    // Try local MCP server (JSON-RPC over HTTP)
    return this.sendLocalMCPRequest(request);
  }

  private async sendAlbyMCPRequest(request: MCPRequest): Promise<NWCResponse> {
    const serverUrl = this.mcpConfig!.serverUrl;
    if (!serverUrl) {
      throw new Error('MCP server URL not configured');
    }

    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.mcpConfig!.apiKey && { 'Authorization': `Bearer ${this.mcpConfig!.apiKey}` }),
        'X-NWC-Connection': this.connection.walletPubkey,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: request.id || Date.now().toString(),
        method: 'nwc.' + request.method,
        params: {
          connectionString: `nostr+walletconnect://${this.connection.walletPubkey}?relay=${encodeURIComponent(this.connection.relayUrl)}&secret=${this.connection.secret}`,
          ...request.params
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Alby MCP server error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Alby MCP error: ${data.error.message || 'Unknown error'}`);
    }

    return {
      result_type: request.method as NWCMethod,
      result: data.result
    };
  }

  private async sendLocalMCPRequest(request: MCPRequest): Promise<NWCResponse> {
    // For local MCP server, use the tools/nwc resource approach
    const serverUrl = this.mcpConfig!.serverUrl;
    if (!serverUrl) {
      throw new Error('MCP server URL not configured');
    }

    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.mcpConfig!.apiKey && { 'Authorization': `Bearer ${this.mcpConfig!.apiKey}` }),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: request.id || Date.now().toString(),
        method: 'tools/call',
        params: {
          name: 'nwc',
          arguments: {
            method: request.method,
            ...request.params
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Local MCP server error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Local MCP error: ${data.error.message || 'Unknown error'}`);
    }

    // Parse the MCP tools response
    const toolResult = data.result?.content?.[0]?.text;
    if (!toolResult) {
      throw new Error('Invalid MCP response format');
    }

    try {
      const nwcResult = JSON.parse(toolResult);
      return {
        result_type: request.method as NWCMethod,
        result: nwcResult
      };
    } catch (parseError) {
      throw new Error(`Failed to parse MCP tool result: ${parseError}`);
    }
  }

  private async sendDirectRequest(request: { method: string; params: Record<string, unknown> }): Promise<NWCResponse> {
    if (!window.nostr?.signEvent) {
      throw new Error('Nostr extension not found. Please install a Nostr extension like Alby or nos2x.');
    }

    // Encrypt the request
    const encryptedContent = await nip04.encrypt(
      this.connection.secret,
      this.connection.walletPubkey,
      JSON.stringify(request)
    );

    // Create the request event
    const event: Omit<NostrEvent, 'id' | 'sig'> = {
      kind: 23194, // NIP-47 request
      pubkey: this.clientPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', this.connection.walletPubkey]],
      content: encryptedContent,
    };

    // Sign the event
    const signedEvent = await window.nostr.signEvent(event);

    // Create WebSocket connection and handle response
    return this.handleWebSocketRequest(signedEvent);
  }

  private async handleWebSocketRequest(signedEvent: NostrEvent): Promise<NWCResponse> {
    const ws = new WebSocket(this.connection.relayUrl);
    const subscriptionId = `nwc-${Date.now()}`;

    return new Promise<NWCResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('NWC request timed out'));
      }, 30000);

      ws.onopen = () => {
        // Subscribe to response events
        ws.send(JSON.stringify([
          'REQ',
          subscriptionId,
          {
            kinds: [23195], // NIP-47 response
            authors: [this.connection.walletPubkey],
            '#p': [this.clientPubkey],
            since: Math.floor(Date.now() / 1000),
          }
        ]));

        // Send the request event
        ws.send(JSON.stringify(['EVENT', signedEvent]));
      };

      ws.onmessage = async (message) => {
        try {
          const data = JSON.parse(message.data);
          
          if (data[0] === 'EOSE' && data[1] === subscriptionId) {
            return; // Subscription confirmed
          }

          if (data[0] === 'EVENT' && data[1] === subscriptionId) {
            const responseEvent = data[2];
            
            if (responseEvent.kind !== 23195 || responseEvent.pubkey !== this.connection.walletPubkey) {
              return; // Invalid response
            }

            // Decrypt the response
            const decryptedContent = await nip04.decrypt(
              this.connection.secret,
              this.connection.walletPubkey,
              responseEvent.content
            );

            const response = JSON.parse(decryptedContent) as NWCResponse;
            
            if (response.error) {
              const errorMessage = getErrorMessage(response.error);
              reject(new Error(errorMessage));
              return;
            }

            clearTimeout(timeout);
            ws.close();
            resolve(response);
          }
        } catch (error) {
          reject(error);
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('NWC WebSocket error'));
      };

      ws.onclose = () => {
        clearTimeout(timeout);
      };
    });
  }
}