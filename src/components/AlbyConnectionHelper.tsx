import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export function AlbyConnectionHelper() {
  const [albyDetected, setAlbyDetected] = useState(false);
  const [weblnAvailable, setWeblnAvailable] = useState(false);
  const [albyEnabled, setAlbyEnabled] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkAlbyStatus = () => {
    // Check for Alby extension presence
    const hasAlby = !!(window as unknown as { alby?: unknown }).alby || 
                   !!(document.documentElement as unknown as { dataset?: { alby?: unknown } }).dataset?.alby ||
                   navigator.userAgent.includes('Alby');
    
    // Check for WebLN
    const hasWebLN = !!window.webln;
    
    // Check if WebLN is enabled (has methods)
    const weblnEnabled = hasWebLN && typeof window.webln?.enable === 'function';

    setAlbyDetected(hasAlby);
    setWeblnAvailable(hasWebLN);
    setAlbyEnabled(weblnEnabled);

    console.log('Alby status check:', {
      albyDetected: hasAlby,
      weblnAvailable: hasWebLN,
      weblnEnabled,
      windowAlby: !!(window as unknown as { alby?: unknown }).alby,
      datasetAlby: !!(document.documentElement as unknown as { dataset?: { alby?: unknown } }).dataset?.alby,
      userAgent: navigator.userAgent.includes('Alby'),
    });
  };

  useEffect(() => {
    checkAlbyStatus();
    
    // Check periodically
    const interval = setInterval(checkAlbyStatus, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const handleEnableAlby = async () => {
    setChecking(true);
    try {
      if (!window.webln) {
        throw new Error('Alby extension not detected. Please install and enable it first.');
      }

      console.log('Enabling Alby...');
      await window.webln.enable();
      console.log('Alby enabled successfully');
      
      checkAlbyStatus();
      
      // Test basic functionality
      if (window.webln.getInfo) {
        const info = await window.webln.getInfo();
        console.log('Alby wallet info:', info);
      }
      
      alert('Alby connected successfully!');
    } catch (error) {
      console.error('Failed to enable Alby:', error);
      alert(`Failed to connect to Alby: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setChecking(false);
    }
  };

  const handleRefreshCheck = () => {
    setChecking(true);
    setTimeout(() => {
      checkAlbyStatus();
      setChecking(false);
    }, 1000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Alby Extension Status
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshCheck}
            disabled={checking}
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          Check and connect your Alby Lightning wallet extension
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status indicators */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Alby Extension Detected</span>
            <div className="flex items-center space-x-2">
              {albyDetected ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <Badge variant={albyDetected ? "default" : "destructive"}>
                {albyDetected ? "Yes" : "No"}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">WebLN Available</span>
            <div className="flex items-center space-x-2">
              {weblnAvailable ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <Badge variant={weblnAvailable ? "default" : "destructive"}>
                {weblnAvailable ? "Yes" : "No"}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Alby Enabled</span>
            <div className="flex items-center space-x-2">
              {albyEnabled ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              )}
              <Badge variant={albyEnabled ? "default" : "secondary"}>
                {albyEnabled ? "Yes" : "No"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {!albyDetected && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div>Alby extension not detected. Please:</div>
                  <div className="space-y-1 text-sm">
                    <div>1. Install the Alby browser extension</div>
                    <div>2. Create or import a wallet</div>
                    <div>3. Unlock the extension</div>
                    <div>4. Refresh this page</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://getalby.com', '_blank')}
                    className="mt-2"
                  >
                    Get Alby Extension <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {albyDetected && !albyEnabled && (
            <Button onClick={handleEnableAlby} disabled={checking} className="w-full">
              {checking ? "Connecting..." : "Connect to Alby"}
            </Button>
          )}

          {albyEnabled && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Alby is connected and ready to use! You can now use Bitcoin Connect to manage your Lightning wallet.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Troubleshooting */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-2 text-sm">Troubleshooting:</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>• Make sure Alby extension is installed and enabled</div>
            <div>• Ensure you're logged into your Alby wallet</div>
            <div>• Try refreshing the page after installing Alby</div>
            <div>• Check that the extension has permission on this site</div>
            <div>• Disable other WebLN extensions to avoid conflicts</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}