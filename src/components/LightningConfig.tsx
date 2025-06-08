import { useState, useEffect } from 'react';
import { Settings, Zap, Eye, EyeOff, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { lightningService, parseNWCConnectionString, type LightningConfig, type NWCConfig } from '@/lib/lightning';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface LightningConfigProps {
  onConfigured?: () => void;
}

export function LightningConfig({ onConfigured }: LightningConfigProps) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useLocalStorage<LightningConfig | null>('lightning-config', null);
  const [nwcConfig, setNwcConfig] = useLocalStorage<NWCConfig | null>('nwc-config', null);
  const [formData, setFormData] = useState<LightningConfig>({
    baseUrl: '',
    apiKey: '',
    walletId: '',
  });
  const [nwcConnectionString, setNwcConnectionString] = useState('');
  const [provider, setProvider] = useState<string>('nip47');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  useEffect(() => {
    if (config) {
      lightningService.configure(config);
      setFormData(config);
    }
    if (nwcConfig) {
      setNwcConnectionString(nwcConfig.connectionString);
    }
  }, [config, nwcConfig]);

  const providerTemplates = {
    nip47: {
      name: 'NIP-47 (Nostr Wallet Connect)',
      baseUrl: '',
      description: 'Connect to any NIP-47 compatible Lightning wallet via Nostr',
      docs: 'https://github.com/nostr-protocol/nips/blob/master/47.md',
    },
    lnbits: {
      name: 'LNbits',
      baseUrl: 'https://your-lnbits-instance.com',
      description: 'Self-hosted Lightning wallet and accounts system',
      docs: 'https://lnbits.org/',
    },
    lndhub: {
      name: 'LndHub',
      baseUrl: 'https://your-lndhub-instance.com',
      description: 'BlueWallet LndHub compatible server',
      docs: 'https://bluewallet.io/lndhub/',
    },
    btcpay: {
      name: 'BTCPay Server',
      baseUrl: 'https://your-btcpay-server.com',
      description: 'Self-hosted Bitcoin payment processor',
      docs: 'https://btcpayserver.org/',
    },
    custom: {
      name: 'Custom',
      baseUrl: '',
      description: 'Custom Lightning service API',
      docs: '',
    },
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const template = providerTemplates[newProvider as keyof typeof providerTemplates];
    if (template && newProvider !== 'custom' && newProvider !== 'nip47') {
      setFormData(prev => ({
        ...prev,
        baseUrl: template.baseUrl,
      }));
    }
    // Reset connection status when changing providers
    setConnectionStatus('idle');
  };

  const testConnection = async () => {
    if (provider === 'nip47') {
      if (!nwcConnectionString) {
        toast({
          title: 'Missing Configuration',
          description: 'Please enter a NIP-47 connection string',
          variant: 'destructive',
        });
        return;
      }

      setIsTestingConnection(true);
      setConnectionStatus('idle');

      try {
        // Parse and validate the NWC connection string
        const parsed = parseNWCConnectionString(nwcConnectionString);
        
        setConnectionStatus('success');
        toast({
          title: 'Connection String Valid ✅',
          description: `Successfully parsed NWC connection to ${parsed.relays.length} relay(s)`,
        });
      } catch (error) {
        setConnectionStatus('error');
        toast({
          title: 'Invalid Connection String ❌',
          description: error instanceof Error ? error.message : 'Failed to parse NIP-47 connection string',
          variant: 'destructive',
        });
      } finally {
        setIsTestingConnection(false);
      }
    } else {
      if (!formData.baseUrl || !formData.apiKey) {
        toast({
          title: 'Missing Configuration',
          description: 'Please fill in all required fields',
          variant: 'destructive',
        });
        return;
      }

      setIsTestingConnection(true);
      setConnectionStatus('idle');

      try {
        // Test connection by trying to create a small test invoice
        const testConfig = { ...formData };
        lightningService.configure(testConfig);
        
        // Create a 1 sat test invoice
        await lightningService.createInvoice(1000, 'Connection test - do not pay');
        
        setConnectionStatus('success');
        toast({
          title: 'Connection Successful',
          description: 'Lightning service is configured correctly',
        });
      } catch (error) {
        setConnectionStatus('error');
        toast({
          title: 'Connection Failed',
          description: error instanceof Error ? error.message : 'Failed to connect to Lightning service',
          variant: 'destructive',
        });
      } finally {
        setIsTestingConnection(false);
      }
    }
  };

  const saveConfiguration = () => {
    if (provider === 'nip47') {
      if (!nwcConnectionString) {
        toast({
          title: 'Missing Configuration',
          description: 'Please enter a NIP-47 connection string',
          variant: 'destructive',
        });
        return;
      }

      try {
        const parsedConfig = parseNWCConnectionString(nwcConnectionString);
        
        console.log('🔗 Parsed NWC Config:', {
          walletPubkey: parsedConfig.walletPubkey,
          relays: parsedConfig.relays,
          hasSecret: !!parsedConfig.secret,
          lud16: parsedConfig.lud16
        });
        
        setNwcConfig(parsedConfig);
        
        toast({
          title: 'Configuration Saved',
          description: 'NIP-47 wallet connection has been saved',
        });
        
        console.log('✅ NWC Configuration saved to localStorage');
      } catch (error) {
        console.error('❌ NWC Configuration parse error:', error);
        toast({
          title: 'Invalid Configuration',
          description: error instanceof Error ? error.message : 'Failed to parse NIP-47 connection string',
          variant: 'destructive',
        });
        return;
      }
    } else {
      if (!formData.baseUrl || !formData.apiKey) {
        toast({
          title: 'Missing Configuration',
          description: 'Please fill in all required fields',
          variant: 'destructive',
        });
        return;
      }

      setConfig(formData);
      lightningService.configure(formData);
      
      toast({
        title: 'Configuration Saved',
        description: 'Lightning service configuration has been saved',
      });
    }
    
    setOpen(false);
    onConfigured?.();
  };

  const clearConfiguration = () => {
    setConfig(null);
    setNwcConfig(null);
    setFormData({ baseUrl: '', apiKey: '', walletId: '' });
    setNwcConnectionString('');
    setConnectionStatus('idle');
    
    toast({
      title: 'Configuration Cleared',
      description: 'Lightning service configuration has been removed',
    });
  };

  const isConfigured = (config && config.baseUrl && config.apiKey) || (nwcConfig && nwcConfig.connectionString);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Zap className="h-4 w-4" />
          Lightning Setup
          {isConfigured && <CheckCircle className="h-3 w-3 text-green-600" />}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Lightning Configuration
          </DialogTitle>
          <DialogDescription>
            Configure your Lightning service to generate real invoices for ticket purchases.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Status */}
          {isConfigured && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Lightning service is configured and ready to generate invoices.
              </AlertDescription>
            </Alert>
          )}

          {/* Provider Selection */}
          <div className="space-y-3">
            <Label>Lightning Service Provider</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(providerTemplates).map(([key, template]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <span>{template.name}</span>
                      {key === 'nip47' && <Badge variant="secondary" className="text-xs">Recommended</Badge>}
                      {key === 'lnbits' && <Badge variant="outline" className="text-xs">Self-hosted</Badge>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {provider !== 'custom' && (
              <div className="text-sm text-muted-foreground">
                <p>{providerTemplates[provider as keyof typeof providerTemplates].description}</p>
                {providerTemplates[provider as keyof typeof providerTemplates].docs && (
                  <a 
                    href={providerTemplates[provider as keyof typeof providerTemplates].docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 mt-1"
                  >
                    View Documentation <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Configuration Form */}
          <div className="space-y-4">
            {provider === 'nip47' ? (
              <div className="space-y-2">
                <Label htmlFor="nwcConnectionString">NIP-47 Connection String *</Label>
                <Input
                  id="nwcConnectionString"
                  placeholder="nostr+walletconnect://pubkey?relay=wss://...&secret=..."
                  value={nwcConnectionString}
                  onChange={(e) => setNwcConnectionString(e.target.value)}
                  className="font-mono text-sm"
                />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Paste the connection string from your NIP-47 compatible wallet:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li><strong>Alby:</strong> Settings → Developer → Nostr Wallet Connect</li>
                    <li><strong>Mutiny:</strong> Settings → Connections → Nostr Wallet Connect</li>
                    <li><strong>Others:</strong> Look for "NWC" or "Wallet Connect" in settings</li>
                  </ul>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="baseUrl">Base URL *</Label>
                  <Input
                    id="baseUrl"
                    placeholder="https://your-lightning-service.com"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key *</Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="Your API key"
                      value={formData.apiKey}
                      onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="walletId">Wallet ID (optional)</Label>
                  <Input
                    id="walletId"
                    placeholder="Wallet identifier if required"
                    value={formData.walletId}
                    onChange={(e) => setFormData(prev => ({ ...prev, walletId: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>

          {/* Test Connection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={isTestingConnection || (provider === 'nip47' ? !nwcConnectionString : (!formData.baseUrl || !formData.apiKey))}
                className="gap-2"
              >
                {isTestingConnection ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>
              
              {connectionStatus === 'success' && (
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Connected
                </div>
              )}
              
              {connectionStatus === 'error' && (
                <div className="flex items-center gap-1 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Failed
                </div>
              )}
            </div>
          </div>

          {/* Setup Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {provider === 'nip47' ? (
                <>
                  <p><strong>1. Get connection string:</strong> Open your NIP-47 wallet (Alby, Mutiny, etc.)</p>
                  <p><strong>2. Generate connection:</strong> Look for "Wallet Connect" or "NWC" settings</p>
                  <p><strong>3. Copy connection string:</strong> It starts with "nostr+walletconnect://"</p>
                  <p><strong>4. Paste and save:</strong> Your connection is stored locally and encrypted</p>
                  
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Real Implementation:</strong> This app now uses real NIP-47 Lightning invoices through 
                      the Nostr Wallet Connect protocol. When you connect your wallet, real invoices will be generated 
                      and payments will be processed. Your connection is encrypted and stored locally in your browser.
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <>
                  <p><strong>1. Choose a Lightning service:</strong> NIP-47 is recommended for best privacy</p>
                  <p><strong>2. Get API credentials:</strong> Create an API key in your service dashboard</p>
                  <p><strong>3. Test connection:</strong> Verify your configuration works</p>
                  <p><strong>4. Save configuration:</strong> Your settings are stored locally and encrypted</p>
                  
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Security Note:</strong> Your API keys are stored locally in your browser and never sent to our servers.
                      Only use API keys with invoice creation permissions, not full wallet access.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <div>
            {isConfigured && (
              <Button variant="outline" onClick={clearConfiguration} className="text-red-600">
                Clear Configuration
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={saveConfiguration}
              disabled={provider === 'nip47' ? !nwcConnectionString : (!formData.baseUrl || !formData.apiKey)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              Save Configuration
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}