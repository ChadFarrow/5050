import { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink, QrCode, Zap } from 'lucide-react';
import QRCode from 'qrcode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/useToast';
import { useWallet } from '@/hooks/useWallet';
import { formatSats } from '@/lib/utils';
import type { LightningInvoice as LightningInvoiceType } from '@/types/lightning';

interface LightningInvoiceProps {
  invoice: LightningInvoiceType;
  onPaymentComplete?: () => void;
}

export function LightningInvoice({ invoice, onPaymentComplete }: LightningInvoiceProps) {
  const [copied, setCopied] = useState(false);
  const [isPayingWithWallet, setIsPayingWithWallet] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const { toast } = useToast();
  const wallet = useWallet();
  
  // Check if this is a proper fundraiser invoice (starts with lnbc)
  const isFundraiserInvoice = invoice.bolt11.startsWith('lnbc');

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(invoice.bolt11, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        setQrCodeDataUrl(dataUrl);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      }
    };

    generateQRCode();
  }, [invoice.bolt11]);

  // Show payment prompt after 10 seconds to encourage users to confirm payment
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPaymentPrompt(true);
    }, 10000); // 10 seconds

    return () => clearTimeout(timer);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invoice.bolt11);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "Invoice copied to clipboard",
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

  const handleOpenWallet = () => {
    // Try to open the invoice in a Lightning wallet
    const lightningUrl = `lightning:${invoice.bolt11}`;
    window.open(lightningUrl, '_blank');
  };

  const handlePayWithWallet = async () => {
    if (!wallet.isConnected) {
      toast({
        title: "No Wallet Connected",
        description: "Please connect a wallet first to pay this invoice",
        variant: "destructive",
      });
      return;
    }

    setIsPayingWithWallet(true);
    try {
      await wallet.payInvoice(invoice.bolt11);
      
      toast({
        title: "Payment Sent",
        description: "Your Lightning payment has been sent successfully",
      });
      
      if (onPaymentComplete) {
        onPaymentComplete();
      }
    } catch (error) {
      console.error('Payment failed:', error);
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Failed to send payment",
        variant: "destructive",
      });
    } finally {
      setIsPayingWithWallet(false);
    }
  };

  const amountSats = Math.floor(invoice.amount_msat / 1000);
  const expiresAt = new Date(invoice.expires_at * 1000);
  const isExpired = Date.now() > invoice.expires_at * 1000;
  

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Lightning Invoice</span>
          <Badge variant={isExpired ? "destructive" : "secondary"}>
            {isExpired ? "Expired" : "Active"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {invoice.description || "Lightning payment request"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center space-y-2">
          <div className="text-3xl font-bold">
            {formatSats(invoice.amount_msat)}
          </div>
          <div className="text-sm text-muted-foreground">
            {amountSats.toLocaleString()} sats
          </div>
        </div>

        <Separator />

        {qrCodeDataUrl && (
          <div className="flex flex-col items-center space-y-2">
            <div className="text-sm font-medium">Scan with Lightning Wallet</div>
            <div className="bg-white p-4 rounded-lg border">
              <img 
                src={qrCodeDataUrl} 
                alt="Lightning Invoice QR Code" 
                className="w-48 h-48"
              />
            </div>
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">Expires</div>
            <div className="text-sm text-muted-foreground">
              {expiresAt.toLocaleString()}
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-1">
          <div className="text-sm font-medium">Invoice</div>
          <div className="text-xs font-mono bg-muted p-2 rounded break-all max-h-20 overflow-y-auto">
            {invoice.bolt11}
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="flex-1"
          >
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenWallet}
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Wallet
          </Button>
        </div>

        {isFundraiserInvoice ? (
          <div className="text-sm text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-200 p-3 rounded mb-3">
            ✅ <strong>Fundraiser Payment:</strong> This invoice was created by the fundraiser creator via NWC. Your payment will go directly to them!
          </div>
        ) : (
          <div className="text-sm text-yellow-700 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-200 p-3 rounded mb-3">
            ⚠️ <strong>Self-Payment Warning:</strong> This invoice is created with your wallet. When you pay it, you're paying yourself (which may fail). 
            Fundraiser creator should add an NWC connection to their campaign.
          </div>
        )}
        
        {wallet.isConnected && (
          <Button 
            className="w-full" 
            disabled={isExpired || isPayingWithWallet}
            onClick={handlePayWithWallet}
          >
            <Zap className="h-4 w-4 mr-2" />
            {isPayingWithWallet ? "Paying..." : isExpired ? "Invoice Expired" : "Pay with Bitcoin Connect"}
          </Button>
        )}

        <Button 
          variant={showPaymentPrompt ? "default" : "outline"}
          className={`w-full ${showPaymentPrompt ? "bg-green-600 hover:bg-green-700 text-white animate-pulse" : ""}`}
          disabled={isExpired}
          onClick={() => {
            console.log('💰 "I\'ve paid this invoice" button clicked');
            if (onPaymentComplete) {
              console.log('✅ Calling onPaymentComplete callback');
              onPaymentComplete();
            } else {
              console.log('❌ No onPaymentComplete callback provided');
            }
          }}
        >
          <QrCode className="h-4 w-4 mr-2" />
          {isExpired ? "Invoice Expired" : showPaymentPrompt ? "✓ I've Paid This Invoice" : "I've Paid This Invoice"}
        </Button>

        {showPaymentPrompt && !isExpired && (
          <div className="text-sm text-center text-green-600 font-medium">
            Did you complete the payment? Click the button above to confirm.
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center">
          Scan the QR code above with your Lightning wallet or copy the invoice
        </div>
      </CardContent>
    </Card>
  );
}