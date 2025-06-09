import { useState, useEffect, useCallback } from 'react';
import { Zap, Wallet, ExternalLink, Copy, Check, AlertCircle, RefreshCw, Server, Settings2 } from 'lucide-react';
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
  const { nwcConfig, isConfigured, isConnecting, connect, disconnect, getBalance, configureMCPServer } = useNWC();
  const [connectionString, setConnectionString] = useState('');
  const [copied, setCopied] = useState(false);
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
      setMcpServerUrl(nwcConfig.mcpServer?.serverUrl || '');
      setMcpApiKey(nwcConfig.mcpServer?.apiKey || '');
    } else {
      setBalance(null);
      setMcpServerUrl('');
      setMcpApiKey('');
    }
  }, [isConfigured, loadBalance, nwcConfig]);

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
              <h5 className="font-medium text-sm">Optional: MCP Server Setup</h5>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>For enhanced performance, you can run the Alby NWC MCP server:</p>
                <div className="bg-muted p-2 rounded font-mono text-xs">
                  npx @getalby/nwc-mcp-server
                </div>
                <p>Then enable MCP in Advanced Settings with server URL: http://localhost:3000</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}