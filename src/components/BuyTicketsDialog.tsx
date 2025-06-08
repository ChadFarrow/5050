import { useState } from "react";
import { Ticket, Loader2, Trophy, Calculator, Zap, AlertCircle } from "lucide-react";
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
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCampaignStats } from "@/hooks/useCampaignStats";
import { useToast } from "@/hooks/useToast";
import { formatSats } from "@/lib/utils";
import { lightningService, type LightningInvoice, type LightningPayment, type NWCConfig } from "@/lib/lightning";
import { useNWC } from "@/hooks/useNWC";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { LightningConfig } from "@/components/LightningConfig";
import { LightningInvoiceComponent } from "@/components/LightningInvoice";
import type { Fundraiser } from "@/hooks/useCampaigns";

interface BuyTicketsDialogProps {
  campaign: Fundraiser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyTicketsDialog({ campaign, open, onOpenChange }: BuyTicketsDialogProps) {
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const { data: stats } = useCampaignStats(campaign.pubkey, campaign.dTag);
  const { toast } = useToast();
  const [_nwcConfig] = useLocalStorage<NWCConfig | null>('nwc-config', null);
  const { isConfigured: isNWCConfigured, createInvoice: createNWCInvoice, isCreatingInvoice: isCreatingNWCInvoice } = useNWC();
  
  const [ticketCount, setTicketCount] = useState("1");
  const [message, setMessage] = useState("");
  const [currentStep, setCurrentStep] = useState<'form' | 'invoice' | 'success'>('form');
  const [currentInvoice, setCurrentInvoice] = useState<LightningInvoice | null>(null);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

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

  // Check if any lightning service is configured
  const isLightningConfigured = lightningService.isConfigured() || isNWCConfigured;

  const handleCreateInvoice = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to buy tickets",
        variant: "destructive",
      });
      return;
    }

    if (tickets <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid number of tickets",
        variant: "destructive",
      });
      return;
    }

    if (!isLightningConfigured) {
      toast({
        title: "Lightning Not Configured",
        description: "Please configure your Lightning service first",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreatingInvoice(true);

      const description = `${tickets} ticket${tickets > 1 ? 's' : ''} for ${campaign.title}`;
      
      let invoice: LightningInvoice;
      
      if (isNWCConfigured) {
        // Use NWC to create invoice
        invoice = await createNWCInvoice({
          amount: totalCost,
          description,
          expiry: 3600, // 1 hour
        });
      } else {
        // Use traditional lightning service
        invoice = await lightningService.createInvoice(totalCost, description);
      }
      
      setCurrentInvoice(invoice);
      setCurrentStep('invoice');

      toast({
        title: "Invoice Created",
        description: isNWCConfigured ? "NWC invoice generated successfully" : "Lightning invoice generated successfully",
      });
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast({
        title: "Invoice Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create Lightning invoice",
        variant: "destructive",
      });
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handlePaymentConfirmed = async (payment: LightningPayment) => {
    try {
      // Generate unique purchase ID
      const purchaseId = `purchase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create fundraiser coordinate
      const fundraiserCoordinate = `31950:${campaign.pubkey}:${campaign.dTag}`;

      // Build tags for ticket purchase event
      const tags: string[][] = [
        ["d", purchaseId],
        ["a", fundraiserCoordinate],
        ["amount", totalCost.toString()],
        ["tickets", tickets.toString()],
        ["bolt11", payment.bolt11],
        ["payment_hash", payment.payment_hash],
      ];

      // Add preimage if available (proof of payment)
      if (payment.preimage) {
        tags.push(["preimage", payment.preimage]);
      }

      publishEvent({
        kind: 31951,
        content: message.trim(),
        tags,
      });

      setCurrentStep('success');

      toast({
        title: "Tickets Purchased!",
        description: `Successfully bought ${tickets} ticket${tickets > 1 ? 's' : ''} for ${formatSats(totalCost)}`,
      });

      // Auto-close after success
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (error) {
      console.error("Error creating ticket purchase event:", error);
      toast({
        title: "Event Creation Failed",
        description: "Payment confirmed but failed to create ticket event. Please contact support.",
        variant: "destructive",
      });
    }
  };

  const handleInvoiceExpired = () => {
    setCurrentStep('form');
    setCurrentInvoice(null);
    toast({
      title: "Invoice Expired",
      description: "Please create a new invoice to continue",
      variant: "destructive",
    });
  };

  const handleCancelPayment = () => {
    setCurrentStep('form');
    setCurrentInvoice(null);
  };

  const handleClose = () => {
    if (!isPending && !isCreatingInvoice && currentStep !== 'invoice') {
      setTicketCount("1");
      setMessage("");
      setCurrentStep('form');
      setCurrentInvoice(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Ticket className="h-5 w-5 mr-2" />
            {currentStep === 'form' && 'Buy Tickets'}
            {currentStep === 'invoice' && 'Lightning Payment'}
            {currentStep === 'success' && 'Purchase Complete'}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 'form' && `Purchase raffle tickets for ${campaign.title}`}
            {currentStep === 'invoice' && 'Complete your payment to receive tickets'}
            {currentStep === 'success' && 'Your tickets have been purchased successfully!'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Lightning Configuration Check */}
          {currentStep === 'form' && !isLightningConfigured && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Lightning service not configured. Set up your Lightning service to generate real invoices.
                <div className="mt-2">
                  <LightningConfig onConfigured={() => {}} />
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* NWC Demo Warning */}
          {currentStep === 'form' && isNWCConfigured && (
            <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 dark:text-orange-200">
                <strong>Demo Mode:</strong> NWC is configured but will generate demo invoices for testing. 
                In production, this would create real Lightning invoices through your connected wallet.
              </AlertDescription>
            </Alert>
          )}

          {/* Form Step */}
          {currentStep === 'form' && (
            <>
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
                    disabled={isPending || isCreatingInvoice}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message (optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Good luck everyone!"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={isPending || isCreatingInvoice}
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
            </>
          )}

          {/* Invoice Step */}
          {currentStep === 'invoice' && currentInvoice && (
            <LightningInvoiceComponent
              invoice={currentInvoice}
              onPaymentConfirmed={handlePaymentConfirmed}
              onExpired={handleInvoiceExpired}
              onCancel={handleCancelPayment}
            />
          )}

          {/* Success Step */}
          {currentStep === 'success' && (
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <Trophy className="h-5 w-5" />
                  Tickets Purchased!
                </CardTitle>
                <CardDescription>
                  Your payment has been confirmed and tickets have been issued.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Tickets:</span>
                    <span className="font-medium">{tickets}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount Paid:</span>
                    <span className="font-medium">{formatSats(totalCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Win Chance:</span>
                    <span className="font-medium">{winChance.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Buttons */}
        {currentStep === 'form' && (
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={isPending || isCreatingInvoice}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateInvoice} 
              disabled={isPending || isCreatingInvoice || isCreatingNWCInvoice || tickets <= 0 || !isLightningConfigured}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {(isCreatingInvoice || isCreatingNWCInvoice) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Zap className="mr-2 h-4 w-4" />
              {(isCreatingInvoice || isCreatingNWCInvoice) ? "Creating Invoice..." : `Create Lightning Invoice`}
            </Button>
          </div>
        )}

        {currentStep === 'success' && (
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}