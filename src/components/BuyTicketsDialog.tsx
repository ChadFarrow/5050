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
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useNWC } from "@/hooks/useNWC";
import { formatSats } from "@/lib/utils";
import type { Fundraiser } from "@/hooks/useCampaigns";
import type { LightningInvoice as LightningInvoiceType } from "@/lib/lightning";
import { LightningInvoiceComponent } from "@/components/LightningInvoice";
import { LightningConfig } from "@/components/LightningConfig";
import { lightningService } from "@/lib/lightning";

import type { NWCConfig } from "@/lib/lightning";

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
  const nwcHook = useNWC();
  const { createInvoice: createNWCInvoice, nwcConfig } = nwcHook;
  
  // Check if NWC is configured (has a connection string)
  const isNWCConfigured = nwcConfig.connectionString && nwcConfig.enabled;
  
  const [ticketCount, setTicketCount] = useState("1");
  const [message, setMessage] = useState("");
  const [currentStep, setCurrentStep] = useState<'form' | 'invoice' | 'success'>('form');
  const [currentInvoice, setCurrentInvoice] = useState<LightningInvoiceType | null>(null);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [paymentHash, setPaymentHash] = useState<string | null>(null);

  const tickets = parseInt(ticketCount) || 0;
  const totalCost = tickets * campaign.ticketPrice;
  const _totalCostSats = Math.floor(totalCost / 1000);

  const currentPot = stats?.totalRaised || 0;
  const projectedPot = currentPot + totalCost;
  const projectedWinnings = Math.floor(projectedPot / 2);

  const currentTickets = stats?.totalTickets || 0;
  const projectedTotalTickets = currentTickets + tickets;
  const winChance = projectedTotalTickets > 0 ? (tickets / projectedTotalTickets) * 100 : 0;

  // Check if any lightning service is configured (or allow demo fallback)
  const isLightningConfigured = lightningService.isConfigured() || isNWCConfigured || true; // Allow demo fallback

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
      let invoice: LightningInvoiceType;
      let error: Error | null = null;

      // Try NWC first if configured
      if (isNWCConfigured && createNWCInvoice) {
        try {
          console.log('🔄 Attempting NWC invoice creation...');
          invoice = await createNWCInvoice(totalCost, description);
          console.log('✅ NWC invoice created successfully');
        } catch (nwcError) {
          error = nwcError instanceof Error ? nwcError : new Error('Unknown NWC error');
          console.warn('⚠️ NWC invoice creation failed:', error);
          
          // Check if we have a regular Lightning service configured
          if (lightningService.isConfigured()) {
            try {
              console.log('🔄 Falling back to Lightning service...');
              invoice = await lightningService.createInvoice(totalCost, description, 3600);
              console.log('✅ Lightning service invoice created successfully');
            } catch (lightningError) {
              error = lightningError instanceof Error ? lightningError : new Error('Unknown Lightning service error');
              console.warn('⚠️ Lightning service failed:', error);
              throw error; // Re-throw to trigger demo fallback
            }
          } else {
            throw error; // Re-throw to trigger demo fallback
          }
        }
      } else if (lightningService.isConfigured()) {
        try {
          console.log('🔄 Using Lightning service...');
          invoice = await lightningService.createInvoice(totalCost, description, 3600);
          console.log('✅ Lightning service invoice created successfully');
        } catch (lightningError) {
          error = lightningError instanceof Error ? lightningError : new Error('Unknown Lightning service error');
          console.warn('⚠️ Lightning service failed:', error);
          throw error; // Re-throw to trigger demo fallback
        }
      } else {
        // No services configured - create a demo invoice with clear warning
        console.warn('⚠️ No Lightning services configured, creating demo invoice');
        invoice = {
          bolt11: `lnbc${Math.floor(totalCost / 1000)}n1demo_noconfig_${Date.now()}`,
          payment_hash: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''),
          payment_request: `lnbc${Math.floor(totalCost / 1000)}n1demo_noconfig_${Date.now()}`,
          amount_msat: totalCost,
          description: `[DEMO - NO SERVICE CONFIGURED] ${description}`,
          expires_at: Date.now() + (3600 * 1000),
          checking_id: 'demo_noconfig_' + Date.now(),
        };
        
        // Show a warning to the user
        toast({
          title: "Demo Invoice Created",
          description: "No Lightning service configured. Using demo invoice. Configure a Lightning service for real payments.",
          variant: "destructive",
        });
      }

      if (!invoice.bolt11 || !invoice.payment_hash) {
        throw new Error("Invalid invoice received: missing required fields");
      }

      setCurrentInvoice(invoice);
      setPaymentHash(invoice.payment_hash);
      setCurrentStep('invoice');
      setIsCreatingInvoice(false);

      toast({
        title: "Invoice Created",
        description: "Lightning invoice generated. Please complete payment.",
      });

    } catch (error) {
      console.error("❌ Error creating Lightning invoice:", error);
      
      // Create a demo invoice as final fallback
      const demoInvoice: LightningInvoiceType = {
        bolt11: `lnbc${Math.floor(totalCost / 1000)}n1demo_fallback_${Date.now()}`,
        payment_hash: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''),
        payment_request: `lnbc${Math.floor(totalCost / 1000)}n1demo_fallback_${Date.now()}`,
        amount_msat: totalCost,
        description: `[DEMO FALLBACK] ${tickets} ticket${tickets > 1 ? 's' : ''} for ${campaign.title}`,
        expires_at: Date.now() + (3600 * 1000),
        checking_id: 'demo_fallback_' + Date.now(),
      };

      setCurrentInvoice(demoInvoice);
      setPaymentHash(demoInvoice.payment_hash);
      setCurrentStep('invoice');
      setIsCreatingInvoice(false);

      toast({
        title: "Demo Invoice Created",
        description: error instanceof Error ? error.message : "Failed to create real invoice. Using demo invoice.",
        variant: "destructive",
      });
    }
  };

  const handlePaymentConfirmed = async () => {
    if (!currentInvoice || !paymentHash) {
      toast({
        title: "Error",
        description: "Missing payment information",
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate unique purchase ID
      const purchaseId = `purchase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create fundraiser coordinate
      const campaignCoordinate = `31950:${campaign.pubkey}:${campaign.dTag}`;

      // Build tags for ticket purchase event
      const tags: string[][] = [
        ["d", purchaseId],
        ["a", campaignCoordinate],
        ["amount", totalCost.toString()],
        ["tickets", tickets.toString()],
        ["bolt11", currentInvoice.bolt11],
        ["payment_hash", paymentHash],
      ];

      // Add optional message if provided
      if (message.trim()) {
        tags.push(["message", message.trim()]);
      }

      // Publish the ticket purchase event
      publishEvent({
        kind: 31951,
        content: message.trim() || `Purchased ${tickets} ticket${tickets > 1 ? 's' : ''} for ${campaign.title}`,
        tags,
      });

      setCurrentStep('success');
      setCurrentInvoice(null);
      setPaymentHash(null);
      
      toast({
        title: "Tickets Purchased!",
        description: `Successfully bought ${tickets} ticket${tickets > 1 ? 's' : ''} for ${formatSats(totalCost)}`,
      });

    } catch (error) {
      console.error("Error publishing ticket purchase:", error);
      toast({
        title: "Publication Failed",
        description: "Payment confirmed but failed to publish ticket purchase. Contact support.",
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
      setPaymentHash(null);
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
          {/* Lightning Service Status */}
          {currentStep === 'form' && (
            <>
              {/* Real Lightning Service Ready */}
              {(lightningService.isConfigured() || isNWCConfigured) && (
                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                  <AlertCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    <strong>Lightning Ready:</strong> {isNWCConfigured ? 'NWC wallet connected' : 'Lightning service configured'} and ready to create real invoices.
                  </AlertDescription>
                </Alert>
              )}
              
              {/* No Service Configured - Demo Mode Warning */}
              {!lightningService.isConfigured() && !isNWCConfigured && (
                <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800 dark:text-orange-200">
                    <strong>Demo Mode:</strong> No Lightning service configured. Demo invoices will be created for testing.
                    <div className="mt-2">
                      <LightningConfig onConfigured={() => {}} />
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </>
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
              disabled={isPending || isCreatingInvoice || tickets <= 0}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {isCreatingInvoice && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Zap className="mr-2 h-4 w-4" />
              {isCreatingInvoice ? "Creating Invoice..." : `Create Lightning Invoice`}
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