import { useState, useEffect } from 'react';
import { Copy, ExternalLink, CheckCircle, Clock, AlertCircle, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/useToast';
import { copyToClipboard, openInLightningWallet, detectLightningWallet, lightningService } from '@/lib/lightning';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { NWCConfig } from '@/lib/lightning';
import { formatSats } from '@/lib/utils';
import type { LightningInvoice, LightningPayment } from '@/lib/lightning';

interface LightningInvoiceProps {
  invoice: LightningInvoice;
  onPaymentConfirmed: (payment: LightningPayment) => void;
  onExpired: () => void;
  onCancel: () => void;
}

export function LightningInvoiceComponent({ 
  invoice, 
  onPaymentConfirmed, 
  onExpired, 
  onCancel 
}: LightningInvoiceProps) {
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'expired' | 'error'>('pending');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();
  const [nwcConfig] = useLocalStorage<NWCConfig | null>('nwc-config', null);

  const walletApp = detectLightningWallet();
  const _amountSats = Math.floor(invoice.amount_msat / 1000);
  
  // Determine if we're using NWC or traditional lightning service
  const isUsingNWC = !!nwcConfig;

  // Calculate time remaining
  useEffect(() => {
    const updateTimeRemaining = () => {
      const remaining = Math.max(0, invoice.expires_at - Date.now());
      setTimeRemaining(remaining);
      
      if (remaining === 0 && paymentStatus === 'pending') {
        setPaymentStatus('expired');
        onExpired();
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);
    
    return () => clearInterval(interval);
  }, [invoice.expires_at, paymentStatus, onExpired]);

  // Check payment status
  useEffect(() => {
    if (paymentStatus !== 'pending') return;

    const checkPayment = async () => {
      if (isChecking) return;
      
      setIsChecking(true);
      try {
        // For NWC, we would need to implement lookup_invoice
        // For now, we'll use the traditional service for payment checking
        // In a full implementation, this would use NWC's lookup_invoice method
        const payment = await lightningService.checkPayment(invoice.payment_hash);
        if (payment.paid) {
          setPaymentStatus('paid');
          onPaymentConfirmed(payment);
          toast({
            title: 'Payment Confirmed!',
            description: 'Your Lightning payment has been received',
          });
        }
      } catch (error) {
        console.warn('Error checking payment:', error);
        // For NWC, payment checking might not be available
        // In that case, we could listen for payment_received notifications
        if (isUsingNWC) {
          console.info('Payment checking not available with NWC, relying on notifications');
        }
      } finally {
        setIsChecking(false);
      }
    };

    // Check immediately
    checkPayment();

    // Then check every 3 seconds (only for non-NWC)
    if (!isUsingNWC) {
      const interval = setInterval(checkPayment, 3000);
      return () => clearInterval(interval);
    }
  }, [invoice.payment_hash, paymentStatus, isChecking, onPaymentConfirmed, toast, isUsingNWC]);

  const handleCopyInvoice = async () => {
    const success = await copyToClipboard(invoice.bolt11);
    if (success) {
      toast({
        title: 'Copied!',
        description: 'Lightning invoice copied to clipboard',
      });
    } else {
      toast({
        title: 'Copy Failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleOpenWallet = () => {
    const success = openInLightningWallet(invoice.bolt11);
    if (!success) {
      toast({
        title: 'No Wallet Found',
        description: 'Could not open Lightning wallet. Please copy the invoice manually.',
        variant: 'destructive',
      });
    }
  };

  const formatTimeRemaining = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    const totalTime = invoice.expires_at - (invoice.expires_at - 3600000); // Assuming 1 hour expiry
    const elapsed = totalTime - timeRemaining;
    return Math.min(100, Math.max(0, (elapsed / totalTime) * 100));
  };

  if (paymentStatus === 'paid') {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
            <CheckCircle className="h-5 w-5" />
            Payment Confirmed
          </CardTitle>
          <CardDescription>
            Your Lightning payment has been successfully received!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Amount:</span>
              <span className="font-medium">{formatSats(invoice.amount_msat)}</span>
            </div>
            <div className="flex justify-between">
              <span>Payment Hash:</span>
              <span className="font-mono text-xs">{invoice.payment_hash.slice(0, 16)}...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (paymentStatus === 'expired') {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="h-5 w-5" />
            Invoice Expired
          </CardTitle>
          <CardDescription>
            This Lightning invoice has expired. Please create a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onCancel} variant="outline" className="w-full">
            Create New Invoice
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Lightning Payment
          </span>
          <Badge variant="secondary">
            {formatTimeRemaining(timeRemaining)}
          </Badge>
        </CardTitle>
        <CardDescription>
          Pay {formatSats(invoice.amount_msat)} to complete your ticket purchase
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Payment Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Time Remaining</span>
            <span>{formatTimeRemaining(timeRemaining)}</span>
          </div>
          <Progress value={100 - getProgressPercentage()} className="h-2" />
        </div>

        {/* Invoice Details */}
        <div className="space-y-3 p-3 bg-muted rounded-lg">
          <div className="flex justify-between text-sm">
            <span>Amount:</span>
            <span className="font-medium">{formatSats(invoice.amount_msat)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Description:</span>
            <span className="font-medium">{invoice.description}</span>
          </div>
        </div>

        {/* QR Code would go here in a real implementation */}
        <div className="aspect-square bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="text-6xl mb-2">⚡</div>
            <p className="text-sm">QR Code</p>
            <p className="text-xs">Scan with Lightning wallet</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {walletApp && (
            <Button onClick={handleOpenWallet} className="w-full gap-2">
              <Smartphone className="h-4 w-4" />
              Open in {walletApp} Wallet
            </Button>
          )}
          
          <Button onClick={handleOpenWallet} variant="outline" className="w-full gap-2">
            <ExternalLink className="h-4 w-4" />
            Open in Lightning Wallet
          </Button>
          
          <Button onClick={handleCopyInvoice} variant="outline" className="w-full gap-2">
            <Copy className="h-4 w-4" />
            Copy Invoice
          </Button>
        </div>

        {/* Invoice String */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Lightning Invoice:</label>
          <div className="p-2 bg-muted rounded text-xs font-mono break-all">
            {invoice.bolt11}
          </div>
        </div>

        {/* Status */}
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            {isChecking ? (
              <span className="flex items-center gap-2">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Checking for payment...
              </span>
            ) : (
              'Waiting for payment confirmation...'
            )}
          </AlertDescription>
        </Alert>

        {/* Cancel Button */}
        <Button onClick={onCancel} variant="ghost" className="w-full">
          Cancel Payment
        </Button>
      </CardContent>
    </Card>
  );
}