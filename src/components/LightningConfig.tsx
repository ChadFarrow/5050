import React from 'react';
import { Zap, Wallet, ExternalLink, AlertCircle, RefreshCw, Plug, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/hooks/useToast';

export function LightningConfig() {
  const wallet = useWallet();
  const { toast } = useToast();

  const handleRefreshBalance = async () => {
    try {
      await wallet.getBalance();
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
          {wallet.isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wallet className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Lightning Wallet Connected</span>
                  {wallet.nodeInfo?.alias && (
                    <Badge variant="secondary">{wallet.nodeInfo.alias}</Badge>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={wallet.disconnect}>
                  Disconnect
                </Button>
              </div>

              {wallet.balance !== undefined && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Balance:</span>
                    <span className="text-sm">{wallet.balance.toLocaleString()} sats</span>
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

              {wallet.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{wallet.error}</AlertDescription>
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
                    __html: '<bc-button class="w-full">Connect Lightning Wallet</bc-button>'
                  }}
                />
                
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={() => {
                      // Fallback WebLN connection
                      if (window.webln) {
                        window.webln.enable();
                      }
                    }} 
                    disabled={wallet.isConnecting}
                    className="flex-1"
                    variant="outline"
                  >
                    {wallet.isConnecting ? "Connecting..." : "Or Connect with WebLN"}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      console.log('Manual close modal button clicked');
                      wallet.closeModal();
                    }}
                    title="Close wallet modal"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {wallet.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{wallet.error}</AlertDescription>
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