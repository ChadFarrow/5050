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
    console.log('NWC Transport: Sending request', { method: request.method, params: request.params, mcpEnabled: this.mcpConfig?.enabled });
    
    // Try MCP server first if configured
    if (this.mcpConfig?.enabled) {
      console.log('NWC Transport: Attempting MCP request');
      try {
        const result = await this.sendMCPRequest({
          method: request.method,
          params: request.params
        });
        console.log('NWC Transport: MCP request succeeded');
        return result;
      } catch (mcpError) {
        console.log('NWC Transport: MCP request failed, falling back to direct NWC:', mcpError);
        // Fall through to direct NWC implementation
      }
    }

    console.log('NWC Transport: Using direct NWC connection');
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

    console.log('Sending request to Alby MCP server:', serverUrl);
    const connectionString = `nostr+walletconnect://${this.connection.walletPubkey}?relay=${encodeURIComponent(this.connection.relayUrl)}&secret=${this.connection.secret}${this.connection.lud16 ? `&lud16=${this.connection.lud16}` : ''}`;
    
    const requestBody = {
      jsonrpc: '2.0',
      id: request.id || Date.now().toString(),
      method: 'nwc.' + request.method,
      params: {
        connectionString,
        ...request.params
      }
    };
    console.log('MCP request body:', requestBody);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.mcpConfig!.apiKey && { 'Authorization': `Bearer ${this.mcpConfig!.apiKey}` }),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return await this.handleAlbyMCPResponse(response, request);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Alby MCP server request timed out');
      }
      throw error;
    }
  }

  private async handleAlbyMCPResponse(response: Response, request: MCPRequest): Promise<NWCResponse> {
    console.log('Alby MCP server response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Alby MCP server error response:', errorText);
      throw new Error(`Alby MCP server error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Alby MCP server response data:', data);
    
    if (data.error) {
      console.error('Alby MCP error:', data.error);
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

    console.log('Sending request to local MCP server:', serverUrl);
    
    // Try different MCP server communication patterns
    const attempts = [
      // Attempt 1: Standard MCP tools/call format
      {
        method: 'tools/call',
        params: {
          name: 'nwc',
          arguments: {
            method: request.method,
            ...request.params
          }
        }
      },
      // Attempt 2: Direct method call format
      {
        method: request.method,
        params: request.params
      },
      // Attempt 3: NWC-specific method format
      {
        method: `nwc.${request.method}`,
        params: {
          connectionString: `nostr+walletconnect://${this.connection.walletPubkey}?relay=${encodeURIComponent(this.connection.relayUrl)}&secret=${this.connection.secret}${this.connection.lud16 ? `&lud16=${this.connection.lud16}` : ''}`,
          ...request.params
        }
      }
    ];

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      const requestBody = {
        jsonrpc: '2.0',
        id: request.id || Date.now().toString(),
        method: attempt.method,
        params: attempt.params
      };
      
      console.log(`Local MCP attempt ${i + 1}:`, requestBody);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(serverUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.mcpConfig!.apiKey && { 'Authorization': `Bearer ${this.mcpConfig!.apiKey}` }),
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log(`Local MCP attempt ${i + 1} response status:`, response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Local MCP attempt ${i + 1} error response:`, errorText);
          
          // If this is the last attempt, throw the error
          if (i === attempts.length - 1) {
            throw new Error(`Local MCP server error: ${response.status} ${response.statusText} - ${errorText}`);
          }
          continue; // Try next attempt
        }

        const data = await response.json();
        console.log(`Local MCP attempt ${i + 1} response data:`, data);
        
        if (data.error) {
          console.error(`Local MCP attempt ${i + 1} error:`, data.error);
          
          // If this is the last attempt, throw the error
          if (i === attempts.length - 1) {
            throw new Error(`Local MCP error: ${data.error.message || 'Unknown error'}`);
          }
          continue; // Try next attempt
        }

        // Handle different response formats
        let nwcResult;
        
        if (data.result?.content?.[0]?.text) {
          // MCP tools response format
          try {
            nwcResult = JSON.parse(data.result.content[0].text);
          } catch (parseError) {
            console.warn(`Failed to parse MCP tool result on attempt ${i + 1}:`, parseError);
            if (i === attempts.length - 1) {
              throw new Error(`Failed to parse MCP tool result: ${parseError}`);
            }
            continue;
          }
        } else if (data.result) {
          // Direct result format
          nwcResult = data.result;
        } else {
          console.warn(`Invalid MCP response format on attempt ${i + 1}`);
          if (i === attempts.length - 1) {
            throw new Error('Invalid MCP response format');
          }
          continue;
        }

        return {
          result_type: request.method as NWCMethod,
          result: nwcResult
        };

      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          console.error(`Local MCP attempt ${i + 1} timed out`);
          if (i === attempts.length - 1) {
            throw new Error('Local MCP server request timed out');
          }
          continue;
        }
        
        // If this is the last attempt, throw the error
        if (i === attempts.length - 1) {
          throw error;
        }
        
        console.warn(`Local MCP attempt ${i + 1} failed, trying next approach:`, error);
        continue;
      }
    }

    throw new Error('All MCP server communication attempts failed');
  }

  private async sendDirectRequest(request: { method: string; params: Record<string, unknown> }): Promise<NWCResponse> {
    console.log('Attempting direct NWC request, checking for Nostr extension...');
    
    if (typeof window === 'undefined') {
      throw new Error('Direct NWC requires a browser environment');
    }
    
    if (!window.nostr) {
      throw new Error('Nostr extension not found. Please install a Nostr extension like Alby or nos2x.');
    }
    
    if (!window.nostr.signEvent) {
      throw new Error('Nostr extension does not support signing. Please update your Nostr extension.');
    }
    
    console.log('Nostr extension found, proceeding with direct NWC request...');

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
    console.log('Connecting to relay:', this.connection.relayUrl);
    const ws = new WebSocket(this.connection.relayUrl);
    const subscriptionId = `nwc-${Date.now()}`;

    return new Promise<NWCResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('NWC request timed out after 15 seconds');
        ws.close();
        reject(new Error('NWC request timed out. Check your wallet is online and relay is accessible.'));
      }, 15000); // 15 second timeout

      ws.onopen = () => {
        console.log('WebSocket connected to relay');
        
        // Subscribe to response events
        const subscriptionMessage = [
          'REQ',
          subscriptionId,
          {
            kinds: [23195], // NIP-47 response
            authors: [this.connection.walletPubkey],
            '#p': [this.clientPubkey],
            since: Math.floor(Date.now() / 1000),
          }
        ];
        console.log('Sending subscription:', subscriptionMessage);
        ws.send(JSON.stringify(subscriptionMessage));

        // Send the request event
        const eventMessage = ['EVENT', signedEvent];
        console.log('Sending NWC request event:', eventMessage);
        ws.send(JSON.stringify(eventMessage));
      };

      ws.onmessage = async (message) => {
        try {
          const data = JSON.parse(message.data);
          console.log('Received relay message:', data);
          
          if (data[0] === 'EOSE' && data[1] === subscriptionId) {
            console.log('Subscription confirmed by relay');
            return; // Subscription confirmed
          }

          if (data[0] === 'EVENT' && data[1] === subscriptionId) {
            const responseEvent = data[2];
            console.log('Received response event:', responseEvent);
            
            if (responseEvent.kind !== 23195 || responseEvent.pubkey !== this.connection.walletPubkey) {
              console.log('Invalid response event, ignoring');
              return; // Invalid response
            }

            console.log('Decrypting NWC response...');
            // Decrypt the response
            const decryptedContent = await nip04.decrypt(
              this.connection.secret,
              this.connection.walletPubkey,
              responseEvent.content
            );
            console.log('Decrypted response:', decryptedContent);

            const response = JSON.parse(decryptedContent) as NWCResponse;
            
            if (response.error) {
              const errorMessage = getErrorMessage(response.error);
              console.log('NWC error response:', response.error);
              reject(new Error(errorMessage));
              return;
            }

            console.log('NWC request successful:', response);
            clearTimeout(timeout);
            ws.close();
            resolve(response);
          }
        } catch (error) {
          console.error('Error processing relay message:', error);
          reject(error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(timeout);
        reject(new Error('NWC WebSocket connection failed. Your wallet may be offline or the relay is unreachable. Try regenerating your NWC connection string.'));
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        clearTimeout(timeout);
        if (event.code !== 1000) { // 1000 is normal closure
          const reason = event.reason || 'Unknown reason';
          reject(new Error(`WebSocket closed unexpectedly (${event.code}): ${reason}. Your wallet may have gone offline.`));
        }
      };
    });
  }
}