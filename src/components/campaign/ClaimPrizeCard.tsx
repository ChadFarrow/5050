import { useState } from "react";
import { Trophy, Zap, Copy, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useToastUtils } from "@/lib/shared-utils";
import { formatSats } from "@/lib/utils";
import type { Campaign } from "@/hooks/useCampaigns";
import type { CampaignResult } from "@/hooks/useCampaignStats";
import { useQueryClient } from '@tanstack/react-query';

interface ClaimPrizeCardProps {
  campaign: Campaign;
  result: CampaignResult;
}

export function ClaimPrizeCard({ campaign, result }: ClaimPrizeCardProps) {
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const toast = useToastUtils();
  const queryClient = useQueryClient();
  
  const [paymentMethod, setPaymentMethod] = useState<"lnaddress" | "invoice">("lnaddress");
  const [paymentInfo, setPaymentInfo] = useState("");
  const [message, setMessage] = useState("");
  const [hasClaimed, setHasClaimed] = useState(false);

  // Check if current user is the winner
  const isWinner = user?.pubkey === result.winnerPubkey;
  
  if (!isWinner || hasClaimed) {
    return null;
  }

  const handleClaimPrize = async () => {
    if (!user || !paymentInfo.trim()) {
      toast.error("Missing Information", "Please enter your payment information.");
      return;
    }

    // Validate Lightning address format
    if (paymentMethod === "lnaddress" && !paymentInfo.includes("@")) {
      toast.error("Invalid Format", "Please enter a valid Lightning address (e.g., user@domain.com)");
      return;
    }

    // Validate Lightning invoice format
    if (paymentMethod === "invoice" && !paymentInfo.toLowerCase().startsWith("ln")) {
      toast.error("Invalid Format", "Please enter a valid Lightning invoice (starts with 'ln')");
      return;
    }

    const claimTags: string[][] = [
      ["d", `${campaign.dTag}-claim`],
      ["a", `31950:${campaign.pubkey}:${campaign.dTag}`],
      ["result_event", result.event.id],
      ["payment_method", paymentMethod],
      ["payment_info", paymentInfo.trim()],
    ];

    if (message.trim()) {
      claimTags.push(["message", message.trim()]);
    }

    publishEvent({
      kind: 31954,
      content: message.trim() || `Claiming my prize of ${formatSats(result.winnerAmount)} from the ${campaign.title} raffle!`,
      tags: claimTags,
    }, {
      onSuccess: (event) => {
        console.log('Prize claim submitted successfully:', event.id);
        setHasClaimed(true);
        
        toast.success(
          "Prize Claim Submitted!",
          "The campaign creator has been notified and will send your winnings soon."
        );
        
        // Invalidate queries to refresh any claim-related data
        queryClient.invalidateQueries({ queryKey: ['fundraiser-stats', campaign.pubkey, campaign.dTag] });
      },
      onError: (error) => {
        console.error('Failed to submit prize claim:', error);
        toast.error("Failed to Submit Claim", "Could not submit your prize claim. Please try again.");
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!", "Campaign link copied to clipboard");
  };

  const campaignUrl = `${window.location.origin}/campaign/${campaign.pubkey}/${campaign.dTag}`;

  return (
    <Card className="border-green-200 bg-gradient-to-r from-green-50 to-yellow-50 dark:from-green-950 dark:to-yellow-950">
      <CardHeader>
        <CardTitle className="flex items-center text-green-800 dark:text-green-200">
          <Trophy className="h-5 w-5 mr-2" />
          🎉 Congratulations! You Won!
        </CardTitle>
        <CardDescription>
          You won {formatSats(result.winnerAmount)} in the "{campaign.title}" raffle! 
          Submit your payment information below to claim your prize.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Your Winning Ticket</div>
            <div className="font-semibold text-lg">#{result.winningTicket}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Prize Amount</div>
            <div className="font-semibold text-lg text-green-600">{formatSats(result.winnerAmount)}</div>
          </div>
        </div>

        <Alert>
          <Trophy className="h-4 w-4" />
          <AlertDescription>
            To claim your prize, choose your preferred payment method and enter your payment information. 
            The campaign creator will be notified and send your winnings directly.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <Label className="text-base font-medium">Choose Payment Method</Label>
          <RadioGroup
            value={paymentMethod}
            onValueChange={(value) => setPaymentMethod(value as "lnaddress" | "invoice")}
            className="grid grid-cols-2 gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="lnaddress" id="lnaddress" />
              <Label htmlFor="lnaddress" className="cursor-pointer">
                Lightning Address
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="invoice" id="invoice" />
              <Label htmlFor="invoice" className="cursor-pointer">
                Lightning Invoice
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment">
            {paymentMethod === "lnaddress" ? "Lightning Address" : "Lightning Invoice"}
          </Label>
          <div className="flex gap-2">
            <Input
              id="payment"
              placeholder={
                paymentMethod === "lnaddress" 
                  ? "user@getalby.com" 
                  : "lnbc250u1p..."
              }
              value={paymentInfo}
              onChange={(e) => setPaymentInfo(e.target.value)}
              className="flex-1"
            />
            {paymentMethod === "lnaddress" && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open("https://getalby.com", "_blank")}
                title="Get a Lightning address"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {paymentMethod === "lnaddress" 
              ? "Enter your Lightning address (e.g., user@getalby.com). Don't have one? Click the link button to get one free."
              : "Generate a Lightning invoice for the exact amount and paste it here."
            }
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Message (Optional)</Label>
          <Textarea
            id="message"
            placeholder="Thank you for the amazing raffle!"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleClaimPrize}
            disabled={isPending || !paymentInfo.trim()}
            className="flex-1 bg-gradient-to-r from-green-600 to-yellow-600 hover:from-green-700 hover:to-yellow-700"
            size="lg"
          >
            <Zap className="mr-2 h-5 w-5" />
            {isPending ? "Submitting Claim..." : "Claim My Prize"}
          </Button>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-2">Share your win:</p>
          <div className="flex items-center gap-2">
            <Input
              value={campaignUrl}
              readOnly
              className="text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(campaignUrl)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}