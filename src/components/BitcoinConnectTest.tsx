import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export function BitcoinConnectTest() {
  const [webComponentsRegistered, setWebComponentsRegistered] = useState(false);
  const [bitcoinConnectLoaded, setBitcoinConnectLoaded] = useState(false);
  const [weblnAvailable, setWeblnAvailable] = useState(false);

  useEffect(() => {
    const checkStatus = () => {
      setWebComponentsRegistered(!!customElements.get('bc-button') && !!customElements.get('bc-modal'));
      setBitcoinConnectLoaded(typeof window.BitcoinConnect !== 'undefined');
      setWeblnAvailable(!!window.webln);
    };

    // Check immediately
    checkStatus();

    // Check periodically
    const interval = setInterval(checkStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleTestConnection = async () => {
    try {
      console.log('Testing Bitcoin Connect connection...');
      
      // Try to get provider
      const { requestProvider } = await import('@getalby/bitcoin-connect');
      const provider = await requestProvider();
      
      console.log('Provider received:', provider);
      
      if (provider && typeof provider.makeInvoice === 'function') {
        console.log('✅ Provider has makeInvoice method');
        
        // Test creating a small invoice
        const invoice = await provider.makeInvoice({
          amount: 1,
          defaultMemo: 'Bitcoin Connect Test'
        });
        
        console.log('✅ Test invoice created:', invoice);
      }
    } catch (error) {
      console.error('❌ Bitcoin Connect test failed:', error);
    }
  };

  const handleTestAlbyDirect = async () => {
    try {
      console.log('Testing direct Alby connection...');
      
      // Check if WebLN is available
      if (!window.webln) {
        console.log('❌ WebLN not available');
        alert('WebLN not available. Make sure Alby extension is installed and enabled.');
        return;
      }

      console.log('✅ WebLN detected, attempting to enable...');
      
      // Enable WebLN
      await window.webln.enable();
      console.log('✅ WebLN enabled successfully');
      
      // Test getting info
      if (window.webln.getInfo) {
        const info = await window.webln.getInfo();
        console.log('✅ Wallet info:', info);
      }
      
      // Test creating invoice
      if (window.webln.makeInvoice) {
        const invoice = await window.webln.makeInvoice({
          amount: 1,
          defaultMemo: 'Direct Alby Test'
        });
        console.log('✅ Direct invoice created:', invoice);
        alert('Success! Alby connection working. Check console for details.');
      }
    } catch (error) {
      console.error('❌ Direct Alby test failed:', error);
      alert(`Alby connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bitcoin Connect Diagnostics</CardTitle>
          <CardDescription>
            Debug information for Bitcoin Connect integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status indicators */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Web Components Registered</span>
              <div className="flex items-center space-x-2">
                {webComponentsRegistered ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <Badge variant={webComponentsRegistered ? "default" : "destructive"}>
                  {webComponentsRegistered ? "Yes" : "No"}
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Bitcoin Connect Loaded</span>
              <div className="flex items-center space-x-2">
                {bitcoinConnectLoaded ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <Badge variant={bitcoinConnectLoaded ? "default" : "destructive"}>
                  {bitcoinConnectLoaded ? "Yes" : "No"}
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">WebLN Available</span>
              <div className="flex items-center space-x-2">
                {weblnAvailable ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
                <Badge variant={weblnAvailable ? "default" : "secondary"}>
                  {weblnAvailable ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Detailed debug info */}
          <div className="space-y-2 text-xs text-muted-foreground p-3 bg-muted rounded">
            <div><strong>Custom Elements:</strong></div>
            <div>• bc-button: {String(!!customElements.get('bc-button'))}</div>
            <div>• bc-modal: {String(!!customElements.get('bc-modal'))}</div>
            <div><strong>Global Objects:</strong></div>
            <div>• window.webln: {String(!!window.webln)}</div>
            <div>• window.BitcoinConnect: {String(typeof window.BitcoinConnect !== 'undefined')}</div>
            <div><strong>WebLN Methods:</strong></div>
            <div>• makeInvoice: {String(!!window.webln?.makeInvoice)}</div>
            <div>• sendPayment: {String(!!window.webln?.sendPayment)}</div>
            <div>• enable: {String(!!window.webln?.enable)}</div>
            <div><strong>Alby Extension Detection:</strong></div>
            <div>• window.alby: {String(!!(window as unknown as { alby?: unknown }).alby)}</div>
            <div>• navigator.userAgent includes Alby: {String(navigator.userAgent.includes('Alby'))}</div>
            <div>• document.documentElement.dataset.alby: {String(!!(document.documentElement as unknown as { dataset?: { alby?: unknown } }).dataset?.alby)}</div>
          </div>

          {/* Test buttons */}
          <div className="space-y-3">
            <Button onClick={handleTestConnection} className="w-full">
              Test Bitcoin Connect Connection
            </Button>
            
            <Button onClick={handleTestAlbyDirect} className="w-full" variant="outline">
              Test Direct Alby Connection
            </Button>

            {/* Bitcoin Connect Button */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Bitcoin Connect Button:</div>
              <div 
                dangerouslySetInnerHTML={{
                  __html: '<bc-button class="w-full">Test Bitcoin Connect</bc-button>'
                }}
              />
            </div>
          </div>

          {/* Troubleshooting tips */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div><strong>If browser extension option is missing:</strong></div>
                <div className="text-sm space-y-1">
                  <div>1. Make sure you have a WebLN extension installed (like Alby)</div>
                  <div>2. Check that the extension is enabled and unlocked</div>
                  <div>3. Try refreshing the page after installing/enabling the extension</div>
                  <div>4. Check browser console for any errors</div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}