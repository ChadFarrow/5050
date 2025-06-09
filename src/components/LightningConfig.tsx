import { useState, useEffect, useCallback } from 'react';
import { Zap, Wallet, ExternalLink, Copy, Check, AlertCircle, RefreshCw, Server, Settings2, Bug, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { useNWC } from '@/hooks/useNWC';
import { useToast } from '@/hooks/useToast';

export function LightningConfig() {
  const { nwcConfig, isConfigured, isConnecting, connect, disconnect, getBalance, configureMCPServer, nwcClient } = useNWC();
  const [connectionString, setConnectionString] = useState('');
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mcpServerUrl, setMcpServerUrl] = useState('');
  const [mcpApiKey, setMcpApiKey] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<{
    connectionValid: boolean;
    relayConnected: boolean;
    balanceAvailable: boolean;
    invoiceCapable: boolean;
    mcpServerReachable: boolean;
  } | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    if (!connectionString.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid NWC connection string",
        variant: "destructive",
      });
      return;
    }

    await connect(connectionString.trim());
    setConnectionString('');
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "Connection string copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const loadBalance = useCallback(async () => {
    if (!isConfigured) return;
    
    setIsLoadingBalance(true);
    try {
      const walletBalance = await getBalance();
      setBalance(walletBalance);
    } catch (error) {
      console.error('Failed to load balance:', error);
      // Don't show error toast for balance - it's optional
      setBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [isConfigured, getBalance]);

  // Load balance when wallet is configured
  useEffect(() => {
    if (isConfigured) {
      loadBalance();
      // Initialize MCP settings from config
      setMcpServerUrl(nwcConfig.mcpServer?.serverUrl || 'https://mcp.getalby.com/mcp');
      setMcpApiKey(nwcConfig.mcpServer?.apiKey || '');
      
      // Auto-migrate existing configs that don't have MCP settings
      if (!nwcConfig.mcpServer?.serverUrl) {
        configureMCPServer({
          enabled: true,
          serverUrl: 'https://mcp.getalby.com/mcp',
          apiKey: undefined,
        });
      }
    } else {
      setBalance(null);
      setMcpServerUrl('');
      setMcpApiKey('');
    }
  }, [isConfigured, loadBalance, nwcConfig, configureMCPServer]);

  const handleMCPToggle = (enabled: boolean) => {
    configureMCPServer({
      enabled,
      serverUrl: enabled ? mcpServerUrl || undefined : undefined,
      apiKey: enabled ? mcpApiKey || undefined : undefined,
    });
  };

  const handleMCPUpdate = () => {
    if (!nwcConfig.mcpServer?.enabled) return;

    configureMCPServer({
      enabled: true,
      serverUrl: mcpServerUrl || undefined,
      apiKey: mcpApiKey || undefined,
    });

    toast({
      title: "MCP Settings Updated",
      description: "MCP server configuration has been updated",
    });
  };

  const runDiagnostics = async () => {
    if (!nwcClient) {
      toast({
        title: "No Connection",
        description: "Please connect a wallet first",
        variant: "destructive",
      });
      return;
    }

    setIsRunningDiagnostics(true);
    const results = {
      connectionValid: false,
      relayConnected: false,
      balanceAvailable: false,
      invoiceCapable: false,
      mcpServerReachable: false,
    };

    try {
      // Test 1: Connection validity
      console.log('Testing connection validity...');
      const connectionInfo = nwcClient.connectionInfo;
      results.connectionValid = Boolean(connectionInfo.walletPubkey && connectionInfo.relayUrl);

      // Test 2: Relay connection (try to get info first)
      console.log('Testing relay connection...');
      try {
        // Start with getInfo which is less likely to fail due to permissions
        const info = await nwcClient.getInfo();
        console.log('Wallet info:', info);
        results.relayConnected = true;
        
        // If getInfo works, try balance
        try {
          const balance = await nwcClient.getBalance();
          console.log('Balance:', balance);
          results.balanceAvailable = true;
        } catch (balanceError) {
          console.log('Balance check failed (permissions?):', balanceError);
          results.balanceAvailable = false;
        }
      } catch (infoError) {
        console.log('Info check failed, trying fallback tests...', infoError);
        // If getInfo fails, try balance as fallback
        try {
          await nwcClient.getBalance();
          results.relayConnected = true;
          results.balanceAvailable = true;
        } catch {
          console.log('Balance also failed, trying invoice test...');
          // Last resort: try to create a test invoice
          try {
            await nwcClient.makeInvoice(1000, 'Connection test'); // 1 sat test
            results.relayConnected = true;
            results.invoiceCapable = true;
          } catch (invoiceError) {
            console.log('All connection tests failed:', invoiceError);
            results.relayConnected = false;
          }
        }
      }

      // Test 3: Invoice capability (if not already tested)
      if (results.relayConnected && !results.invoiceCapable) {
        console.log('Testing invoice capability...');
        try {
          await nwcClient.makeInvoice(1000, 'Test invoice creation');
          results.invoiceCapable = true;
        } catch (error) {
          console.log('Invoice capability test failed:', error);
          results.invoiceCapable = false;
        }
      }

      // Test 4: MCP Server reachability (if enabled)
      if (nwcConfig.mcpServer?.enabled && mcpServerUrl) {
        console.log('Testing MCP server...');
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          let serverReachable = false;
          
          if (mcpServerUrl.includes('mcp.getalby.com')) {
            // Test Alby hosted MCP server
            try {
              const response = await fetch(mcpServerUrl, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 'health-check',
                  method: 'nwc.get_info',
                  params: { connectionString: 'test' }
                })
              });
              // Even if request fails, if we get a response, server is reachable
              serverReachable = response.status !== 0;
              console.log('Alby MCP server response status:', response.status);
            } catch (error) {
              console.log('Alby MCP server test failed:', error);
              serverReachable = false;
            }
          } else {
            // Test local MCP server - try multiple endpoints
            const endpoints = ['/health', '/status', '/ping', '/', '/rpc'];
            
            for (const endpoint of endpoints) {
              try {
                const response = await fetch(mcpServerUrl + endpoint, { 
                  method: 'GET',
                  signal: controller.signal
                });
                if (response.ok || response.status === 404 || response.status === 405) {
                  serverReachable = true;
                  console.log(`Local MCP server reachable at ${mcpServerUrl + endpoint} (status: ${response.status})`);
                  break;
                }
              } catch {
                // Continue to next endpoint
                continue;
              }
            }
            
            // If GET requests failed, try a JSON-RPC POST request
            if (!serverReachable) {
              try {
                const response = await fetch(mcpServerUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  signal: controller.signal,
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'health-check',
                    method: 'tools/list',
                    params: {}
                  })
                });
                serverReachable = response.status !== 0;
                console.log('Local MCP server JSON-RPC response status:', response.status);
              } catch (error) {
                console.log('Local MCP server JSON-RPC test failed:', error);
              }
            }
          }
          
          clearTimeout(timeoutId);
          results.mcpServerReachable = serverReachable;
        } catch (error) {
          console.log('MCP server test failed:', error);
          results.mcpServerReachable = false;
        }
      } else {
        results.mcpServerReachable = !nwcConfig.mcpServer?.enabled; // True if MCP is disabled
      }

    } catch (error) {
      console.error('Diagnostics failed:', error);
      toast({
        title: "Diagnostics Failed",
        description: "Unable to run connection diagnostics",
        variant: "destructive",
      });
    } finally {
      setDiagnostics(results);
      setIsRunningDiagnostics(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="h-5 w-5 mr-2" />
            Lightning Wallet Configuration
          </CardTitle>
          <CardDescription>
            Connect your Lightning wallet using Nostr Wallet Connect (NWC) to enable payments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isConfigured ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wallet className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Connected</span>
                  <Badge variant="secondary">{nwcConfig.alias}</Badge>
                </div>
                <Button variant="outline" size="sm" onClick={disconnect}>
                  Disconnect
                </Button>
              </div>

              {/* Wallet Balance */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Balance:</span>
                  {balance !== null ? (
                    <span className="text-sm">{balance.toLocaleString()} sats</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {isLoadingBalance ? "Loading..." : "Unknown"}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadBalance}
                  disabled={isLoadingBalance}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Connection String</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    value={`${nwcConfig.connectionString.slice(0, 50)}...`}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(nwcConfig.connectionString)}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Diagnostics Section */}
              <Collapsible open={showDiagnostics} onOpenChange={setShowDiagnostics}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <div className="flex items-center">
                      <Bug className="h-4 w-4 mr-2" />
                      Connection Diagnostics
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={runDiagnostics}
                      disabled={isRunningDiagnostics}
                      className="w-full"
                    >
                      {isRunningDiagnostics ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Running Diagnostics...
                        </>
                      ) : (
                        <>
                          <Bug className="h-4 w-4 mr-2" />
                          Run Connection Test
                        </>
                      )}
                    </Button>

                    {diagnostics && (
                      <div className="space-y-2 p-3 bg-muted rounded-lg">
                        <div className="text-sm font-medium mb-2">Test Results:</div>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span>Connection String Valid</span>
                            {diagnostics.connectionValid ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Relay Connection</span>
                            {diagnostics.relayConnected ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Balance Available</span>
                            {diagnostics.balanceAvailable ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Invoice Creation</span>
                            {diagnostics.invoiceCapable ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                          {nwcConfig.mcpServer?.enabled && (
                            <div className="flex items-center justify-between">
                              <span>MCP Server</span>
                              {diagnostics.mcpServerReachable ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                          )}
                        </div>

                        {(!diagnostics.connectionValid || !diagnostics.relayConnected || !diagnostics.invoiceCapable || (nwcConfig.mcpServer?.enabled && !diagnostics.mcpServerReachable)) && (
                          <Alert className="mt-3">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              <div className="space-y-1">
                                {!diagnostics.connectionValid && (
                                  <div>❌ Connection string format is invalid. Make sure it starts with "nostr+walletconnect://"</div>
                                )}
                                {!diagnostics.relayConnected && (
                                  <div>❌ Cannot connect to NWC relay. Try: 1) Check wallet is online 2) Regenerate connection string 3) Check relay in wallet settings</div>
                                )}
                                {!diagnostics.invoiceCapable && (
                                  <div>❌ Wallet cannot create invoices. Enable "make_invoice" permission in your wallet's NWC settings</div>
                                )}
                                {nwcConfig.mcpServer?.enabled && !diagnostics.mcpServerReachable && (
                                  <div>❌ MCP server unreachable. Try disabling MCP in Advanced Settings or check server URL</div>
                                )}
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* MCP Server Configuration */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <div className="flex items-center">
                      <Settings2 className="h-4 w-4 mr-2" />
                      Advanced Settings
                    </div>
                    <Badge variant={nwcConfig.mcpServer?.enabled ? "default" : "secondary"}>
                      {nwcConfig.mcpServer?.enabled ? "MCP Enabled" : "MCP Disabled"}
                    </Badge>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <Separator />
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Server className="h-4 w-4" />
                          <Label className="text-sm font-medium">MCP Server</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Use Alby NWC MCP server for enhanced performance
                        </p>
                      </div>
                      <Switch
                        checked={nwcConfig.mcpServer?.enabled || false}
                        onCheckedChange={handleMCPToggle}
                      />
                    </div>

                    {nwcConfig.mcpServer?.enabled && (
                      <div className="space-y-3 pl-6 border-l-2 border-muted">
                        <div className="space-y-2">
                          <Label htmlFor="mcp-server-url">Server URL</Label>
                          <Input
                            id="mcp-server-url"
                            placeholder="https://mcp.getalby.com/mcp"
                            value={mcpServerUrl}
                            onChange={(e) => setMcpServerUrl(e.target.value)}
                            className="text-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="mcp-api-key">API Key (optional)</Label>
                          <Input
                            id="mcp-api-key"
                            type="password"
                            placeholder="Enter API key if required"
                            value={mcpApiKey}
                            onChange={(e) => setMcpApiKey(e.target.value)}
                            className="text-sm"
                          />
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleMCPUpdate}
                          className="w-full"
                        >
                          Update MCP Settings
                        </Button>

                        <Alert>
                          <Server className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            The MCP server acts as a bridge between this app and your NWC wallet, 
                            potentially improving performance and reliability.
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No Lightning wallet connected. Connect a wallet to enable Lightning payments.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="connection-string">NWC Connection String</Label>
                <Input
                  id="connection-string"
                  placeholder="nostr+walletconnect://..."
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <Button 
                onClick={handleConnect} 
                disabled={isConnecting || !connectionString.trim()}
                className="w-full"
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">How to get NWC connection string:</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <span>1.</span>
                <span>Open a compatible Lightning wallet (Alby, Mutiny, etc.)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>2.</span>
                <span>Look for "Nostr Wallet Connect" or "NWC" settings</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>3.</span>
                <span>Generate a connection string and paste it above</span>
              </div>
            </div>
            
            <div className="mt-4 space-y-2">
              <h5 className="font-medium text-sm">Recommended Wallets:</h5>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://getalby.com', '_blank')}
                  className="text-xs"
                >
                  Alby <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://mutinywallet.com', '_blank')}
                  className="text-xs"
                >
                  Mutiny <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <h5 className="font-medium text-sm">MCP Server (Enabled by Default)</h5>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>This app uses Alby's hosted MCP server (https://mcp.getalby.com/mcp) for enhanced performance and reliability.</p>
                
                <div className="mt-3 space-y-2">
                  <p className="font-medium">To use a local MCP server instead:</p>
                  
                  <div className="space-y-1">
                    <p>1. Add this to your Claude Desktop config:</p>
                    <div className="bg-muted p-2 rounded font-mono text-xs relative">
{`{
  "mcpServers": {
    "nwc": {
      "command": "npx",
      "args": ["-y", "@getalby/nwc-mcp-server"],
      "env": {
        "NWC_CONNECTION_STRING": "${isConfigured ? nwcConfig.connectionString : 'YOUR_NWC_CONNECTION_STRING_HERE'}"
      }
    }
  }
}`}
                      {isConfigured && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                          onClick={() => handleCopy(`{
  "mcpServers": {
    "nwc": {
      "command": "npx",
      "args": ["-y", "@getalby/nwc-mcp-server"],
      "env": {
        "NWC_CONNECTION_STRING": "${nwcConfig.connectionString}"
      }
    }
  }
}`)}
                        >
                          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p>2. Or run manually:</p>
                    <div className="bg-muted p-2 rounded font-mono text-xs relative">
                      NWC_CONNECTION_STRING="{isConfigured ? nwcConfig.connectionString : 'your_connection_string'}" npx @getalby/nwc-mcp-server
                      {isConfigured && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                          onClick={() => handleCopy(`NWC_CONNECTION_STRING="${nwcConfig.connectionString}" npx @getalby/nwc-mcp-server`)}
                        >
                          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  </div>

                  <p>3. Then change the server URL in Advanced Settings to: http://localhost:3000</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}