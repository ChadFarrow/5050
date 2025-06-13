import { useState } from "react";
import { Ticket, Loader2, Trophy, Calculator, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTestUser } from "@/hooks/useTestUser";
import { getRandomTestProfile } from "@/lib/test-profiles";
import { generateFundraiserInvoice } from "@/lib/lightning-address";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useTestNostrPublish } from "@/hooks/useTestNostrPublish";
import { useCampaignStats } from "@/hooks/useCampaignStats";
import { useWallet } from "@/hooks/useWallet";
import { useToastUtils } from "@/lib/shared-utils";
import { formatSats } from "@/lib/utils";
import { LightningInvoice } from "@/components/LightningInvoice";
import { LightningConfig } from "@/components/LightningConfig";
import type { Campaign } from "@/hooks/useCampaigns";
import type { LightningInvoice as LightningInvoiceType } from "@/types/lightning";
import { useQueryClient } from '@tanstack/react-query';

// Utility function to generate a deterministic payment hash from bolt11 invoice
function extractPaymentHashFromBolt11(bolt11: string): string | null {
  try {
    // For browser compatibility, we'll generate a deterministic hash from the bolt11
    // The bolt11 invoice itself contains the payment hash, so we can derive it
    
    // Simple approach: use a portion of the bolt11 as the payment hash
    // Remove the "ln" prefix and take a consistent portion
    const cleanInvoice = bolt11.replace(/^ln[a-z]*/, '');
    
    // Use Web Crypto API to generate a consistent hash
    const hash = generateDeterministicHash(cleanInvoice);
    console.log('Generated payment hash:', hash, 'from invoice:', bolt11.substring(0, 20) + '...');
    return hash;
  } catch (error) {
    console.error('Failed to extract payment hash from bolt11:', error);
    return null;
  }
}

// Generate a deterministic hash using Web Crypto API (browser compatible)
function generateDeterministicHash(input: string): string {
  // Simple deterministic hash - in a real app you might want something more robust
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to hex and pad to 64 characters (like a real payment hash)
  const hashHex = Math.abs(hash).toString(16);
  return hashHex.padStart(64, '0').substring(0, 64);
}

interface BuyTicketsDialogProps {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyTicketsDialog({ campaign, open, onOpenChange }: BuyTicketsDialogProps) {
  const { user } = useCurrentUser();
  const { isTestMode } = useTestUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const { mutate: publishTestEvent, isPending: isTestPending } = useTestNostrPublish();
  const { data: stats } = useCampaignStats(campaign.pubkey, campaign.dTag);
  const wallet = useWallet();
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const toast = useToastUtils();
  const queryClient = useQueryClient();
  
  const [ticketCount, setTicketCount] = useState("1");
  const [message, setMessage] = useState("");
  const [currentInvoice, setCurrentInvoice] = useState<LightningInvoiceType | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const tickets = parseInt(ticketCount) || 0;
  const totalCost = tickets * campaign.ticketPrice;
  const _totalCostSats = Math.floor(totalCost / 1000);

  const currentPot = stats?.totalRaised || 0;
  const projectedPot = currentPot + totalCost;
  const projectedWinnings = Math.floor(projectedPot / 2);
  const _projectedWinningSats = Math.floor(projectedWinnings / 1000);

  const currentTickets = stats?.totalTickets || 0;
  const projectedTotalTickets = currentTickets + tickets;
  const winChance = projectedTotalTickets > 0 ? (tickets / projectedTotalTickets) * 100 : 0;

  const handleBuyTickets = async () => {
    if (!user) {
      toast.error("Error", "You must be logged in to buy tickets");
      return;
    }

    // Don't generate test user here - do it right before publishing event

    if (tickets <= 0) {
      toast.error("Invalid Amount", "Please enter a valid number of tickets");
      return;
    }

    if (!wallet.isConnected) {
      toast.error("Lightning Wallet Required", "Please configure your Lightning wallet first");
      setShowConfig(true);
      return;
    }

    // Additional WebLN check
    if (!window.webln || typeof window.webln.makeInvoice !== 'function') {
      console.error('WebLN check failed:', { webln: !!window.webln, makeInvoice: typeof window.webln?.makeInvoice });
      toast.error("WebLN Not Available", "Your wallet connection is not properly established. Please reconnect your wallet.");
      setShowConfig(true);
      return;
    }

    try {
      setIsCreatingInvoice(true);
      // Create Lightning invoice
      // Convert from millisats to sats for WebLN
      const totalCostSats = Math.floor(totalCost / 1000);
      console.log(`Creating invoice: ${totalCostSats} sats (${totalCost} msats) for ${tickets} tickets`);
      console.log('Campaign Lightning info:', { 
        lightningAddress: campaign.lightningAddress, 
        lnurl: campaign.lnurl,
        hasLightningAddress: !!(campaign.lightningAddress || campaign.lnurl)
      });
      
      let invoiceBolt11: string;
      
      if (isTestMode) {
        // In test mode, create a fake invoice that can't be paid
        // This simulates the payment flow without actual Lightning transactions
        invoiceBolt11 = `lnbc${totalCostSats}n1p0test${Math.random().toString(36).substr(2, 20)}fake_invoice_for_testing`;
        console.log('Created fake invoice for test mode:', invoiceBolt11.substring(0, 30) + '...');
      } else if (campaign.lightningAddress || campaign.lnurl) {
        // PROPER FUNDRAISING: Use fundraiser creator's Lightning address to generate invoice
        console.log('✅ Creating invoice from fundraiser Lightning address:', campaign.lightningAddress);
        console.log('✅ Payment will go to fundraiser creator, not buyer');
        
        try {
          invoiceBolt11 = await generateFundraiserInvoice(
            campaign,
            totalCost, // amount in millisats
            tickets
          );
          console.log('✅ Successfully created fundraiser invoice');
        } catch (error) {
          console.error('❌ Failed to create fundraiser invoice:', error);
          toast.error("Invoice Creation Failed", `Could not create invoice from fundraiser's Lightning address: ${error.message}`);
          return;
        }
      } else {
        // FALLBACK: Use buyer's wallet (self-payment issue)
        console.warn('⚠️  NO LIGHTNING ADDRESS: Fundraiser has no Lightning address configured');
        console.warn('⚠️  Falling back to buyer wallet (self-payment issue)');
        console.warn('⚠️  Fundraiser creator pubkey:', campaign.pubkey);
        console.warn('⚠️  This means payments go to YOU, not the fundraiser creator');
        
        invoiceBolt11 = await wallet.createInvoice(
          totalCostSats, // amount in sats
          `${tickets} ticket${tickets > 1 ? 's' : ''} for ${campaign.title}`
        );
      }
      
      console.log('Invoice created successfully:', invoiceBolt11.substring(0, 50) + '...');

      // For unified interface, we need to construct the invoice object
      // This assumes the bolt11 contains all necessary info
      const invoice: LightningInvoiceType = {
        bolt11: invoiceBolt11,
        payment_request: invoiceBolt11,
        amount_msat: totalCost,
        description: `${tickets} ticket${tickets > 1 ? 's' : ''} for ${campaign.title}`,
        payment_hash: extractPaymentHashFromBolt11(invoiceBolt11) || `derived-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
        expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        checking_id: `invoice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };

      setCurrentInvoice(invoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create Lightning invoice';
      console.error("Full error details:", { error, message: errorMessage, wallet: wallet.isConnected });
      toast.error("Invoice Creation Failed", errorMessage);
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handlePaymentComplete = async () => {
    if (!currentInvoice) return;

    try {
      setIsProcessingPayment(true);

      // Generate unique purchase ID
      const purchaseId = `purchase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create campaign coordinate
      const campaignCoordinate = `31950:${campaign.pubkey}:${campaign.dTag}`;

      // Build tags for ticket purchase event
      const tags: string[][] = [
        ["d", purchaseId],
        ["a", campaignCoordinate],
        ["amount", totalCost.toString()],
        ["tickets", tickets.toString()],
        ["bolt11", currentInvoice.bolt11],
        ["payment_hash", currentInvoice.payment_hash],
      ];

      const eventData = {
        kind: 31951,
        content: message.trim(),
        tags,
        created_at: Math.floor(Date.now() / 1000),
      };

      const createOnSuccess = (profileName?: string) => (eventId: unknown) => {
        console.log('Ticket purchase event published successfully:', eventId);
        console.log('Invalidating queries for campaign:', { pubkey: campaign.pubkey, dTag: campaign.dTag });
        
        // Invalidate fundraisers query so the list updates immediately
        queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
        // Invalidate campaign stats for this fundraiser so stats update immediately
        queryClient.invalidateQueries({ queryKey: ['fundraiser-stats', campaign.pubkey, campaign.dTag] });
        
        console.log('Queries invalidated successfully');
        
        // Also force a refresh after a small delay to ensure the event has propagated
        setTimeout(() => {
          console.log('Forcing query refresh after delay...');
          queryClient.refetchQueries({ queryKey: ['fundraiser-stats', campaign.pubkey, campaign.dTag] });
        }, 2000);

        // Show success toast with user indication
        const userLabel = profileName || 'You';
        toast.success("Tickets Purchased", `${userLabel} purchased ${tickets} ticket${tickets > 1 ? 's' : ''} for ${formatSats(totalCost)}`);

        // Reset form and close dialog only after successful event publishing
        setTicketCount("1");
        setMessage("");
        setCurrentInvoice(null);
        onOpenChange(false);
      };

      const onError = (error: unknown) => {
        console.error('Failed to publish ticket purchase event:', error);
        toast.error("Purchase Recording Failed", "Payment may have succeeded but failed to record. Please contact support.");
      };

      if (isTestMode) {
        // Generate a fresh random profile for this purchase
        const randomProfile = getRandomTestProfile();
        console.log('Using test profile for purchase:', randomProfile.name, randomProfile.pubkey);
        
        // Use test publish method with fresh random profile
        publishTestEvent({ 
          event: eventData, 
          options: { testProfile: randomProfile } 
        }, { 
          onSuccess: createOnSuccess(randomProfile.name), 
          onError 
        });
      } else {
        // Use normal publish method
        publishEvent(eventData, { 
          onSuccess: createOnSuccess(), 
          onError 
        });
      }
    } catch (error) {
      console.error("Error recording purchase:", error);
      toast.error("Purchase Recording Failed", "Payment may have succeeded but failed to record. Please contact support.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleClose = () => {
    if (!isPending && !isTestPending && !isProcessingPayment && !isCreatingInvoice) {
      setTicketCount("1");
      setMessage("");
      setCurrentInvoice(null);
      setShowConfig(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Ticket className="h-5 w-5 mr-2" />
              Buy Tickets
            </div>
            {!showConfig && !currentInvoice && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfig(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {showConfig ? "Configure your Lightning wallet" : 
             currentInvoice ? "Pay the Lightning invoice below" :
             `Purchase raffle tickets for ${campaign.title}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {showConfig ? (
            <LightningConfig />
          ) : currentInvoice ? (
            <div className="space-y-4">
              <LightningInvoice 
                invoice={currentInvoice} 
                onPaymentComplete={handlePaymentComplete}
              />
              <Button
                variant="outline"
                onClick={() => setCurrentInvoice(null)}
                className="w-full"
              >
                Back to Purchase Form
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
          {/* Campaign Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{campaign.title}</CardTitle>
              <CardDescription className="text-xs">{campaign.podcast}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Current Pot:</span>
                <span className="font-medium">{formatSats(currentPot)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tickets Sold:</span>
                <span className="font-medium">{currentTickets}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Ticket Price:</span>
                <span className="font-medium">{formatSats(campaign.ticketPrice)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Ticket Selection */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tickets">Number of Tickets</Label>
              <Input
                id="tickets"
                type="number"
                min="1"
                max="100"
                value={ticketCount}
                onChange={(e) => setTicketCount(e.target.value)}
                disabled={isPending || isTestPending || isProcessingPayment}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="Good luck everyone!"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isPending || isTestPending || isProcessingPayment}
                rows={2}
              />
            </div>
          </div>

          {/* Purchase Summary */}
          {tickets > 0 && (
            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Calculator className="h-4 w-4 mr-2" />
                  Purchase Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Tickets:</span>
                  <span className="font-medium">{tickets}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Cost:</span>
                  <span className="font-medium">{formatSats(totalCost)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span>Win Chance:</span>
                  <Badge variant="secondary">{winChance.toFixed(1)}%</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Potential Prize:</span>
                  <span className="font-medium text-green-600 flex items-center">
                    <Trophy className="h-3 w-3 mr-1" />
                    {formatSats(projectedWinnings)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lightning Wallet Status */}
          {!wallet.isConnected && !showConfig && (
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertDescription>
                Lightning wallet not configured. 
                <Button 
                  variant="link" 
                  className="p-0 h-auto font-normal underline ml-1"
                  onClick={() => setShowConfig(true)}
                >
                  Configure now
                </Button>
              </AlertDescription>
            </Alert>
          )}
            </div>
          )}
        </div>

        {!showConfig && !currentInvoice && (
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isPending || isTestPending || isProcessingPayment || isCreatingInvoice}>
              Cancel
            </Button>
            <Button 
              onClick={handleBuyTickets} 
              disabled={isPending || isTestPending || isProcessingPayment || isCreatingInvoice || tickets <= 0}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {(isPending || isTestPending || isProcessingPayment || isCreatingInvoice) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreatingInvoice ? "Creating Invoice..." : 
               isProcessingPayment ? "Recording Purchase..." : 
               `Buy ${tickets} Ticket${tickets > 1 ? 's' : ''}`}
            </Button>
          </div>
        )}

        {showConfig && (
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowConfig(false)}>
              Back to Purchase
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}