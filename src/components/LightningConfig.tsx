import { useState, useEffect, useCallback } from 'react';
import { Zap, Wallet, ExternalLink, AlertCircle, RefreshCw, Server, Settings2, Plug } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNWC } from '@/hooks/useNWC';
import { useBitcoinConnect } from '@/hooks/useBitcoinConnect';
import { useToast } from '@/hooks/useToast';

export function LightningConfig() {
  const { nwcConfig, isConfigured, isConnecting, connect, disconnect, getBalance, configureMCPServer } = useNWC();
  const bitcoinConnect = useBitcoinConnect();
  const [connectionString, setConnectionString] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mcpServerUrl, setMcpServerUrl] = useState('');
  const [mcpApiKey, setMcpApiKey] = useState('');
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


  const loadBalance = useCallback(async () => {
    if (!isConfigured) return;
    
    setIsLoadingBalance(true);
    try {
      // Set a shorter timeout for balance check since it's optional
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Balance check timed out')), 10000)
      );
      
      const balancePromise = getBalance();
      const walletBalance = await Promise.race([balancePromise, timeoutPromise]);
      setBalance(walletBalance as number);
    } catch (error) {
      console.log('Balance check failed (this is optional):', error);
      // Balance is optional - don't show as error, just mark as unavailable
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
      setMcpServerUrl(nwcConfig.mcpServer?.serverUrl || 'http://localhost:3000');
      setMcpApiKey(nwcConfig.mcpServer?.apiKey || '');
      
      // Auto-migrate existing configs that don't have MCP settings
      if (!nwcConfig.mcpServer?.serverUrl) {
        configureMCPServer({
          enabled: false, // Default to disabled due to CORS issues with hosted server
          serverUrl: 'http://localhost:3000',
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="h-5 w-5 mr-2" />
            Lightning Wallet Configuration
          </CardTitle>
          <CardDescription>
            Connect your Lightning wallet using Bitcoin Connect or Nostr Wallet Connect (NWC)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="bitcoin-connect" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bitcoin-connect" className="flex items-center space-x-2">
                <Plug className="h-4 w-4" />
                <span>Bitcoin Connect</span>
              </TabsTrigger>
              <TabsTrigger value="nwc" className="flex items-center space-x-2">
                <Wallet className="h-4 w-4" />
                <span>Manual NWC</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bitcoin-connect" className="space-y-4">
              {bitcoinConnect.isConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Wallet className="h-4 w-4 text-green-600" />
                      <span className="font-medium">Bitcoin Connect - Connected</span>
                      {bitcoinConnect.nodeInfo?.alias && (
                        <Badge variant="secondary">{bitcoinConnect.nodeInfo.alias}</Badge>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={bitcoinConnect.disconnect}>
                      Disconnect
                    </Button>
                  </div>

                  {bitcoinConnect.balance !== undefined && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">Balance:</span>
                        <span className="text-sm">{bitcoinConnect.balance.toLocaleString()} sats</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={bitcoinConnect.getBalance}
                        title="Refresh balance"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {bitcoinConnect.error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{bitcoinConnect.error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert>
                    <Plug className="h-4 w-4" />
                    <AlertDescription>
                      Bitcoin Connect provides a unified interface to connect with various Lightning wallets.
                      Click connect to choose from available wallet options.
                    </AlertDescription>
                  </Alert>

                  {/* Bitcoin Connect Web Component */}
                  <div className="space-y-4">
                    <div 
                      dangerouslySetInnerHTML={{
                        __html: '<bc-button class="w-full"></bc-button>'
                      }}
                    />
                    
                    <Button 
                      onClick={bitcoinConnect.connect} 
                      disabled={bitcoinConnect.isConnecting}
                      className="w-full"
                      variant="outline"
                    >
                      {bitcoinConnect.isConnecting ? "Connecting..." : "Or Connect with WebLN"}
                    </Button>
                  </div>

                  {bitcoinConnect.error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{bitcoinConnect.error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="nwc" className="space-y-4">
              {isConfigured ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Wallet className="h-4 w-4 text-green-600" />
                      <span className="font-medium">NWC Connected</span>
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
                          {isLoadingBalance ? "Loading..." : "Not available"}
                        </span>
                      )}
                      {balance === null && !isLoadingBalance && (
                        <span className="text-xs text-muted-foreground">(wallet doesn't support balance)</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadBalance}
                      disabled={isLoadingBalance}
                      title="Refresh balance (some wallets don't support this)"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  
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
                                placeholder="http://localhost:3000"
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
            </TabsContent>
          </Tabs>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">How to connect:</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <span>•</span>
                <span><strong>Bitcoin Connect:</strong> Easy one-click connection with multiple wallet options</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>•</span>
                <span><strong>Manual NWC:</strong> Advanced users can paste connection strings directly</span>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}