import { useState } from 'react';
import { Copy, Check, ExternalLink, QrCode } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/useToast';
import { formatSats } from '@/lib/utils';
import type { LightningInvoice as LightningInvoiceType } from '@/lib/nwc';

interface LightningInvoiceProps {
  invoice: LightningInvoiceType;
  onPaymentComplete?: () => void;
}

export function LightningInvoice({ invoice, onPaymentComplete }: LightningInvoiceProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

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

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">Payment Hash</div>
            <div className="text-xs font-mono bg-muted p-2 rounded break-all">
              {invoice.payment_hash}
            </div>
          </div>

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

        <Button 
          className="w-full" 
          disabled={isExpired}
          onClick={onPaymentComplete}
        >
          <QrCode className="h-4 w-4 mr-2" />
          {isExpired ? "Invoice Expired" : "I've Paid This Invoice"}
        </Button>

        <div className="text-xs text-muted-foreground text-center">
          Scan with your Lightning wallet or copy the invoice above
        </div>
      </CardContent>
    </Card>
  );
}