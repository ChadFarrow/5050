import { useState, useEffect } from "react";
import { Heart, Loader2, ExternalLink, Copy, Check, Zap } from "lucide-react";
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/useToast";
import { useWallet } from "@/hooks/useWallet";
import { formatSats } from "@/lib/utils";

const CREATOR_LIGHTNING_ADDRESS = "chadf@getalby.com";

interface DonateToCreatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DonateToCreatorDialog({ open, onOpenChange }: DonateToCreatorDialogProps) {
  const [donationAmount, setDonationAmount] = useState("");
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [lightningInvoice, setLightningInvoice] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isPayingWithWallet, setIsPayingWithWallet] = useState(false);
  const { toast } = useToast();
  const wallet = useWallet();
  
  const donationSats = parseInt(donationAmount) || 0;
  const donationMsats = donationSats * 1000;

  // Generate QR code when invoice is created
  useEffect(() => {
    const generateQRCode = async () => {
      if (!lightningInvoice) {
        setQrCodeDataUrl('');
        return;
      }
      
      try {
        const dataUrl = await QRCode.toDataURL(lightningInvoice, {
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
  }, [lightningInvoice]);

  const handleCreateInvoice = async () => {
    if (donationSats <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid donation amount",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreatingInvoice(true);
      
      // Step 1: Get LNURL-pay info from Lightning address
      const lnurlResponse = await fetch(`https://getalby.com/.well-known/lnurlp/chadf`);
      if (!lnurlResponse.ok) {
        throw new Error("Failed to fetch Lightning address info");
      }
      
      const lnurlData = await lnurlResponse.json();
      
      // Check if amount is within allowed range
      const amountMsat = donationSats * 1000;
      if (amountMsat < lnurlData.minSendable || amountMsat > lnurlData.maxSendable) {
        throw new Error(`Amount must be between ${Math.floor(lnurlData.minSendable / 1000)} and ${Math.floor(lnurlData.maxSendable / 1000)} sats`);
      }
      
      // Step 2: Request invoice from callback URL
      const callbackUrl = new URL(lnurlData.callback);
      callbackUrl.searchParams.set('amount', amountMsat.toString());
      callbackUrl.searchParams.set('comment', `Tip for PodRaffle creator via app interface`);
      
      const invoiceResponse = await fetch(callbackUrl.toString());
      
      if (!invoiceResponse.ok) {
        throw new Error("Failed to create Lightning invoice");
      }
      
      const invoiceData = await invoiceResponse.json();
      
      if (invoiceData.status === "ERROR") {
        throw new Error(invoiceData.reason || "Failed to create invoice");
      }
      
      if (invoiceData.pr) {
        setLightningInvoice(invoiceData.pr);
        toast({
          title: "Invoice Created",
          description: "Lightning invoice created successfully!",
        });
      } else {
        throw new Error("No payment request returned");
      }
      
    } catch (error) {
      console.error("Error creating Lightning invoice:", error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create Lightning invoice';
      toast({
        title: "Invoice Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleCopyInvoice = async () => {
    if (!lightningInvoice) return;
    
    try {
      await navigator.clipboard.writeText(lightningInvoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "Lightning invoice copied to clipboard",
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

  const handlePayWithWallet = async () => {
    if (!lightningInvoice) return;
    
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
      await wallet.payInvoice(lightningInvoice);
      
      toast({
        title: "Payment Sent",
        description: "Your Lightning payment has been sent successfully",
      });
      
      // Close dialog after successful payment
      handleClose();
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

  const handleOpenWallet = () => {
    if (!lightningInvoice) return;
    
    // Try to open the invoice in a Lightning wallet
    const lightningUrl = `lightning:${lightningInvoice}`;
    window.open(lightningUrl, '_blank');
  };

  const handleClose = () => {
    if (!isCreatingInvoice && !isPayingWithWallet) {
      setDonationAmount("");
      setLightningInvoice(null);
      setQrCodeDataUrl('');
      setCopied(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Heart className="h-5 w-5 mr-2 text-red-500" />
            Support App Creator
          </DialogTitle>
          <DialogDescription>
            {lightningInvoice ? "Pay the Lightning invoice below" : "Support the development of PodRaffle"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {lightningInvoice ? (
            <div className="space-y-4">
              {/* Invoice Display */}
              <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-center">
                    {formatSats(donationMsats)}
                  </CardTitle>
                  <CardDescription className="text-center">
                    Lightning invoice for {CREATOR_LIGHTNING_ADDRESS}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* QR Code */}
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
                  
                  <div className="text-xs font-mono bg-muted p-3 rounded break-all max-h-32 overflow-y-auto border">
                    {lightningInvoice}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyInvoice}
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
                  
                  {/* Pay with Wallet Button */}
                  {wallet.isConnected && (
                    <Button 
                      className="w-full" 
                      disabled={isPayingWithWallet}
                      onClick={handlePayWithWallet}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      {isPayingWithWallet ? "Paying..." : "Pay Invoice"}
                    </Button>
                  )}
                  
                  <Alert>
                    <AlertDescription className="text-sm">
                      Scan this invoice with your Lightning wallet or copy it to pay. 
                      Thank you for supporting the development of PodRaffle!
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
              
              <Button
                variant="outline"
                onClick={() => setLightningInvoice(null)}
                className="w-full"
              >
                Create New Invoice
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* App Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">PodRaffle App Creator</CardTitle>
                  <CardDescription className="text-xs">{CREATOR_LIGHTNING_ADDRESS}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Support the creator of PodRaffle - a decentralized fundraising platform for podcasters.
                    Your support helps maintain and improve the app for the entire community.
                  </p>
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="text-muted-foreground">Follow on Nostr:</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto text-purple-600 hover:text-purple-700"
                      asChild
                    >
                      <a
                        href="https://nosta.me/npub177fz5zkm87jdmf0we2nz7mm7uc2e7l64uzqrv6rvdrsg8qkrg7yqx0aaq7"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        @chadf
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Donation Amount */}
              <div className="space-y-2">
                <Label htmlFor="creator-amount">Tip Amount (sats)</Label>
                <Input
                  id="creator-amount"
                  type="number"
                  min="1"
                  placeholder="1000"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  disabled={isCreatingInvoice}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum: 1 sat
                </p>
              </div>

              {/* Donation Summary */}
              {donationSats > 0 && (
                <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Tip Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Amount:</span>
                      <span className="font-medium">{formatSats(donationMsats)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>🚀 Your support helps improve PodRaffle for everyone!</p>
                      <p>⚡ Instant payment via Lightning Network</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {!lightningInvoice && (
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isCreatingInvoice}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateInvoice} 
              disabled={isCreatingInvoice || donationSats <= 0}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isCreatingInvoice && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreatingInvoice ? "Creating Invoice..." : `Create Invoice for ${donationSats > 0 ? formatSats(donationMsats) : '...'}`}
            </Button>
          </div>
        )}

        {lightningInvoice && (
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}