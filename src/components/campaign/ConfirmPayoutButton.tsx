import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useToastUtils } from "@/lib/shared-utils";
import type { Campaign } from "@/hooks/useCampaigns";
import type { CampaignResult } from "@/hooks/useCampaignStats";
import { useQueryClient } from '@tanstack/react-query';

interface ConfirmPayoutButtonProps {
  campaign: Campaign;
  result: CampaignResult;
  hasValidClaims: boolean;
}

export function ConfirmPayoutButton({ campaign, result, hasValidClaims }: ConfirmPayoutButtonProps) {
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const toast = useToastUtils();
  const queryClient = useQueryClient();
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Check if current user is the campaign creator
  const isCreator = user?.pubkey === campaign.pubkey;
  
  // Check if payout is already confirmed
  const alreadyConfirmed = result.event.tags.some(tag => tag[0] === 'payout_confirmed');
  
  if (!isCreator || !hasValidClaims || alreadyConfirmed || isConfirmed) {
    return null;
  }

  const handleConfirmPayout = async () => {
    if (!user) return;

    // Create a new result event with payout confirmation
    const newTags = [
      ...result.event.tags,
      ["payout_confirmed", Math.floor(Date.now() / 1000).toString()],
      ["payout_note", "Prize payout completed by campaign creator"]
    ];

    const content = `${result.message}\n\n✅ Prize payout confirmed - this fundraiser is now complete.`;

    publishEvent({
      kind: 31952,
      content,
      tags: newTags,
    }, {
      onSuccess: (event) => {
        console.log('Payout confirmation published:', event.id);
        setIsConfirmed(true);
        
        // Invalidate queries to refresh the UI and campaign status
        queryClient.invalidateQueries({ queryKey: ['fundraiser-stats', campaign.pubkey, campaign.dTag] });
        queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
        
        toast.success(
          "Payout Confirmed!",
          "This fundraiser will now move to the completed tab."
        );
      },
      onError: (error) => {
        console.error('Failed to confirm payout:', error);
        toast.error("Failed to Confirm Payout", "Could not confirm the payout. Please try again.");
      }
    });
  };

  return (
    <div className="mt-4 pt-4 border-t">
      <p className="text-sm text-muted-foreground mb-3">
        After sending the prize payment, confirm completion to move this fundraiser to your completed tab:
      </p>
      <Button
        onClick={handleConfirmPayout}
        disabled={isPending}
        variant="outline"
        className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <Check className="mr-2 h-4 w-4" />
        {isPending ? "Confirming..." : "Confirm Payout Sent"}
      </Button>
    </div>
  );
}