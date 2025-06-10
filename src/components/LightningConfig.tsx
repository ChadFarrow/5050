import React from 'react';
import { Zap, Wallet, ExternalLink, AlertCircle, RefreshCw, Plug } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBitcoinConnect } from '@/hooks/useBitcoinConnect';
import { useToast } from '@/hooks/useToast';

export function LightningConfig() {
  const bitcoinConnect = useBitcoinConnect();
  const { toast } = useToast();

  const handleRefreshBalance = async () => {
    try {
      await bitcoinConnect.getBalance();
      toast({
        title: "Balance Updated",
        description: "Wallet balance has been refreshed",
      });
    } catch {
      toast({
        title: "Balance Error",
        description: "Could not refresh balance",
        variant: "destructive",
      });
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
            Connect your Lightning wallet using Bitcoin Connect
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
                    onClick={handleRefreshBalance}
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

          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Supported Wallets:</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <span>•</span>
                <span><strong>Bitcoin Connect:</strong> Easy one-click connection with multiple wallet options</span>
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