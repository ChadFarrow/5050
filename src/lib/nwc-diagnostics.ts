import type { NWCConnection } from './nwc-types';

export interface DiagnosticResult {
  test: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface DiagnosticSuite {
  connectionValid: DiagnosticResult;
  relayReachable: DiagnosticResult;
  mcpServerReachable: DiagnosticResult;
  directNWCTest: DiagnosticResult;
  mcpNWCTest: DiagnosticResult;
}

export class NWCDiagnostics {
  constructor(
    private connection: NWCConnection,
    private mcpServerUrl?: string
  ) {}

  async runFullDiagnostics(): Promise<DiagnosticSuite> {
    console.log('🔍 Starting NWC diagnostics...');
    
    const results: DiagnosticSuite = {
      connectionValid: await this.testConnectionValidity(),
      relayReachable: await this.testRelayConnection(),
      mcpServerReachable: await this.testMCPServerConnection(),
      directNWCTest: await this.testDirectNWC(),
      mcpNWCTest: await this.testMCPNWC(),
    };

    console.log('✅ Diagnostics complete:', results);
    return results;
  }

  private async testConnectionValidity(): Promise<DiagnosticResult> {
    const start = Date.now();
    try {
      const isValid = Boolean(
        this.connection.walletPubkey &&
        this.connection.relayUrl &&
        this.connection.secret &&
        this.connection.walletPubkey.length === 64 &&
        this.connection.secret.length === 64
      );

      return {
        test: 'Connection String Validity',
        success: isValid,
        duration: Date.now() - start,
        details: {
          walletPubkey: this.connection.walletPubkey?.slice(0, 8) + '...',
          relayUrl: this.connection.relayUrl,
          hasSecret: Boolean(this.connection.secret),
          secretLength: this.connection.secret?.length,
        },
        error: isValid ? undefined : 'Invalid connection string format'
      };
    } catch (error) {
      return {
        test: 'Connection String Validity',
        success: false,
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testRelayConnection(): Promise<DiagnosticResult> {
    const start = Date.now();
    return new Promise<DiagnosticResult>((resolve) => {
      try {
        const ws = new WebSocket(this.connection.relayUrl);
        const timeout = setTimeout(() => {
          ws.close();
          resolve({
            test: 'Relay WebSocket Connection',
            success: false,
            duration: Date.now() - start,
            error: 'Connection timeout after 5 seconds'
          });
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve({
            test: 'Relay WebSocket Connection',
            success: true,
            duration: Date.now() - start,
            details: {
              relayUrl: this.connection.relayUrl,
              readyState: ws.readyState
            }
          });
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          resolve({
            test: 'Relay WebSocket Connection',
            success: false,
            duration: Date.now() - start,
            error: 'WebSocket connection failed',
            details: { error }
          });
        };

        ws.onclose = (event) => {
          clearTimeout(timeout);
          if (event.code !== 1000) {
            resolve({
              test: 'Relay WebSocket Connection',
              success: false,
              duration: Date.now() - start,
              error: `WebSocket closed unexpectedly (${event.code}): ${event.reason}`,
              details: { code: event.code, reason: event.reason }
            });
          }
        };
      } catch (error) {
        resolve({
          test: 'Relay WebSocket Connection',
          success: false,
          duration: Date.now() - start,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }

  private async testMCPServerConnection(): Promise<DiagnosticResult> {
    const start = Date.now();
    
    if (!this.mcpServerUrl) {
      return {
        test: 'MCP Server Connection',
        success: true, // Not configured, so not a failure
        duration: Date.now() - start,
        details: { configured: false }
      };
    }

    try {
      // Try multiple approaches to test MCP server
      const endpoints = ['/', '/health', '/status', '/ping'];
      let serverReachable = false;
      let lastError: string | undefined;
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(this.mcpServerUrl + endpoint, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
          });
          
          if (response.ok || response.status === 404 || response.status === 405) {
            serverReachable = true;
            break;
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error';
          continue;
        }
      }

      // If GET requests failed, try a JSON-RPC POST
      if (!serverReachable) {
        try {
          const response = await fetch(this.mcpServerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(3000),
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'health-check',
              method: 'tools/list',
              params: {}
            })
          });
          serverReachable = response.status !== 0;
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      return {
        test: 'MCP Server Connection',
        success: serverReachable,
        duration: Date.now() - start,
        details: {
          serverUrl: this.mcpServerUrl,
          configured: true
        },
        error: serverReachable ? undefined : lastError || 'Server not reachable'
      };
    } catch (error) {
      return {
        test: 'MCP Server Connection',
        success: false,
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testDirectNWC(): Promise<DiagnosticResult> {
    const start = Date.now();
    try {
      // Import NWC client dynamically to avoid circular dependencies
      const { NWCClient } = await import('./nwc-client');
      const client = new NWCClient(
        `nostr+walletconnect://${this.connection.walletPubkey}?relay=${encodeURIComponent(this.connection.relayUrl)}&secret=${this.connection.secret}${this.connection.lud16 ? `&lud16=${this.connection.lud16}` : ''}`,
        { enabled: false } // Disable MCP for direct test
      );

      // Try a simple getInfo call first
      try {
        const info = await client.getInfo();
        return {
          test: 'Direct NWC (getInfo)',
          success: true,
          duration: Date.now() - start,
          details: { method: 'getInfo', info }
        };
      } catch {
        // If getInfo fails, try makeInvoice
        const invoice = await client.makeInvoice(1000, 'Diagnostic test invoice');
        return {
          test: 'Direct NWC (makeInvoice)',
          success: true,
          duration: Date.now() - start,
          details: { method: 'makeInvoice', invoice }
        };
      }
    } catch (error) {
      return {
        test: 'Direct NWC',
        success: false,
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testMCPNWC(): Promise<DiagnosticResult> {
    const start = Date.now();
    
    if (!this.mcpServerUrl) {
      return {
        test: 'MCP NWC',
        success: true, // Not configured, so not a failure
        duration: Date.now() - start,
        details: { configured: false }
      };
    }

    try {
      // Import NWC client dynamically
      const { NWCClient } = await import('./nwc-client');
      const client = new NWCClient(
        `nostr+walletconnect://${this.connection.walletPubkey}?relay=${encodeURIComponent(this.connection.relayUrl)}&secret=${this.connection.secret}${this.connection.lud16 ? `&lud16=${this.connection.lud16}` : ''}`,
        { enabled: true, serverUrl: this.mcpServerUrl }
      );

      // Try a simple getInfo call first
      try {
        const info = await client.getInfo();
        return {
          test: 'MCP NWC (getInfo)',
          success: true,
          duration: Date.now() - start,
          details: { method: 'getInfo', info, mcpServerUrl: this.mcpServerUrl }
        };
      } catch {
        // If getInfo fails, try makeInvoice
        const invoice = await client.makeInvoice(1000, 'MCP diagnostic test invoice');
        return {
          test: 'MCP NWC (makeInvoice)',
          success: true,
          duration: Date.now() - start,
          details: { method: 'makeInvoice', invoice, mcpServerUrl: this.mcpServerUrl }
        };
      }
    } catch (error) {
      return {
        test: 'MCP NWC',
        success: false,
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: { mcpServerUrl: this.mcpServerUrl }
      };
    }
  }

  static generateReport(results: DiagnosticSuite): string {
    const lines: string[] = [
      '# NWC Diagnostics Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      ''
    ];

    Object.entries(results).forEach(([_key, result]) => {
      const status = result.success ? '✅' : '❌';
      lines.push(`## ${status} ${result.test}`);
      lines.push(`**Duration:** ${result.duration}ms`);
      
      if (result.error) {
        lines.push(`**Error:** ${result.error}`);
      }
      
      if (result.details) {
        lines.push('**Details:**');
        Object.entries(result.details).forEach(([k, v]) => {
          lines.push(`- ${k}: ${JSON.stringify(v)}`);
        });
      }
      
      lines.push('');
    });

    // Add recommendations
    lines.push('## Recommendations');
    lines.push('');

    if (!results.connectionValid.success) {
      lines.push('- ❌ **Fix connection string:** Ensure your NWC connection string is properly formatted');
    }

    if (!results.relayReachable.success) {
      lines.push('- ❌ **Check relay:** Your wallet relay is not reachable. Check if your wallet is online');
    }

    if (!results.directNWCTest.success && results.mcpNWCTest.success) {
      lines.push('- ✅ **Use MCP server:** Direct NWC fails but MCP works. Keep MCP enabled');
    }

    if (results.directNWCTest.success && !results.mcpNWCTest.success) {
      lines.push('- ✅ **Use direct NWC:** MCP fails but direct NWC works. Disable MCP in settings');
    }

    if (!results.directNWCTest.success && !results.mcpNWCTest.success) {
      lines.push('- ❌ **Check wallet permissions:** Ensure "make_invoice" permission is enabled in your wallet');
      lines.push('- ❌ **Regenerate connection string:** Try creating a new NWC connection in your wallet');
    }

    if (!results.mcpServerReachable.success && results.mcpServerReachable.details?.configured) {
      lines.push('- ❌ **Start MCP server:** Run the MCP server using one of the provided commands');
    }

    return lines.join('\n');
  }
}