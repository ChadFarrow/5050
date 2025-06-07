import { useState } from "react";
import { Ticket, Loader2, Trophy, Calculator } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCampaignStats } from "@/hooks/useCampaignStats";
import { useToast } from "@/hooks/useToast";
import { formatSats } from "@/lib/utils";
import type { Campaign } from "@/hooks/useCampaigns";

interface BuyTicketsDialogProps {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyTicketsDialog({ campaign, open, onOpenChange }: BuyTicketsDialogProps) {
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const { data: stats } = useCampaignStats(campaign.pubkey, campaign.dTag);
  const { toast } = useToast();
  
  const [ticketCount, setTicketCount] = useState("1");
  const [message, setMessage] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const tickets = parseInt(ticketCount) || 0;
  const totalCost = tickets * campaign.ticketPrice;
  const totalCostSats = Math.floor(totalCost / 1000);

  const currentPot = stats?.totalRaised || 0;
  const projectedPot = currentPot + totalCost;
  const projectedWinnings = Math.floor(projectedPot / 2);
  const _projectedWinningSats = Math.floor(projectedWinnings / 1000);

  const currentTickets = stats?.totalTickets || 0;
  const projectedTotalTickets = currentTickets + tickets;
  const winChance = projectedTotalTickets > 0 ? (tickets / projectedTotalTickets) * 100 : 0;

  const handleBuyTickets = async () => {
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

    try {
      setIsProcessingPayment(true);

      // TODO: In a real implementation, this would:
      // 1. Generate a Lightning invoice for the total cost
      // 2. Present it to the user for payment
      // 3. Wait for payment confirmation
      // 4. Create the ticket purchase event with payment proof

      // For this demo, we'll simulate the process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate mock payment data
      const paymentHash = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const bolt11 = `lnbc${totalCostSats}u1p...mock_invoice_${Date.now()}`;
      
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
        ["bolt11", bolt11],
        ["payment_hash", paymentHash],
      ];

      publishEvent({
        kind: 31951,
        content: message.trim(),
        tags,
      });

      toast({
        title: "Tickets Purchased!",
        description: `Successfully bought ${tickets} ticket${tickets > 1 ? 's' : ''} for ${formatSats(totalCost)}`,
      });

      // Reset form and close dialog
      setTicketCount("1");
      setMessage("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error buying tickets:", error);
      toast({
        title: "Purchase Failed",
        description: "Failed to purchase tickets. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleClose = () => {
    if (!isPending && !isProcessingPayment) {
      setTicketCount("1");
      setMessage("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Ticket className="h-5 w-5 mr-2" />
            Buy Tickets
          </DialogTitle>
          <DialogDescription>
            Purchase raffle tickets for {campaign.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
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
                disabled={isPending || isProcessingPayment}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="Good luck everyone!"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isPending || isProcessingPayment}
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
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isPending || isProcessingPayment}>
            Cancel
          </Button>
          <Button 
            onClick={handleBuyTickets} 
            disabled={isPending || isProcessingPayment || tickets <= 0}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {(isPending || isProcessingPayment) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isProcessingPayment ? "Processing Payment..." : `Buy ${tickets} Ticket${tickets > 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}