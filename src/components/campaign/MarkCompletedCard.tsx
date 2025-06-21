import { useState } from "react";
import { CheckSquare, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useToastUtils } from "@/lib/shared-utils";
import { formatSats } from "@/lib/utils";
import type { Fundraiser } from "@/hooks/useCampaigns";
import type { FundraiserResult } from "@/hooks/useCampaignStats";
import { useQueryClient } from '@tanstack/react-query';

interface MarkCompletedCardProps {
  campaign: Fundraiser;
  result?: FundraiserResult;
  hasTicketSales: boolean;
}

export function MarkCompletedCard({ campaign, result, hasTicketSales }: MarkCompletedCardProps) {
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const toast = useToastUtils();
  const queryClient = useQueryClient();
  const [confirmChecked, setConfirmChecked] = useState(false);

  // Check if current user is the fundraiser creator
  const isCreator = user?.pubkey === campaign.pubkey;
  
  // Check if already marked as completed
  const isAlreadyCompleted = result?.event.tags.some(tag => tag[0] === 'manual_completed');
  
  // Only show for creators on active fundraisers, or fundraisers with winners but no payout confirmation
  if (!isCreator || isAlreadyCompleted || (!campaign.isActive && !result)) {
    return null;
  }

  const handleMarkCompleted = async () => {
    if (!user || !confirmChecked) return;

    // If there's a winner, update the result event with completion flag
    if (result) {
      const newTags = [
        ...result.event.tags,
        ["manual_completed", Math.floor(Date.now() / 1000).toString()],
        ["completion_note", "Manually marked as completed by fundraiser creator"]
      ];

      const content = `${result.message}\n\n✅ Fundraiser manually marked as completed by creator.`;

      publishEvent({
        kind: 31952,
        content,
        tags: newTags,
      }, {
        onSuccess: (event) => {
          console.log('Manual completion published:', event.id);
          
          // Invalidate queries to refresh the UI and campaign status
          queryClient.invalidateQueries({ queryKey: ['fundraiser-stats', campaign.pubkey, campaign.dTag] });
          queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
          
          toast.success(
            "Fundraiser Marked Complete!",
            "This fundraiser will now appear in the completed tab."
          );
        },
        onError: (error) => {
          console.error('Failed to mark as completed:', error);
          toast.error("Failed to Mark Complete", "Could not mark the fundraiser as completed. Please try again.");
        }
      });
    } else {
      // No winner yet, create a completion event without winner info
      const tags: string[][] = [
        ["d", campaign.dTag],
        ["a", `31950:${campaign.pubkey}:${campaign.dTag}`],
        ["manual_completed", Math.floor(Date.now() / 1000).toString()],
        ["completion_note", "Fundraiser manually closed by creator without winner selection"]
      ];

      const content = hasTicketSales 
        ? `Fundraiser "${campaign.title}" has been manually closed by the creator. No winner was selected.`
        : `Fundraiser "${campaign.title}" has been manually closed by the creator. No tickets were sold.`;

      publishEvent({
        kind: 31952,
        content,
        tags,
      }, {
        onSuccess: (event) => {
          console.log('Manual completion event published:', event.id);
          
          // Invalidate queries to refresh the UI and campaign status
          queryClient.invalidateQueries({ queryKey: ['fundraiser-stats', campaign.pubkey, campaign.dTag] });
          queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
          
          toast.success(
            "Fundraiser Marked Complete!",
            "This fundraiser will now appear in the completed tab."
          );
        },
        onError: (error) => {
          console.error('Failed to publish completion event:', error);
          toast.error("Failed to Mark Complete", "Could not mark the fundraiser as completed. Please try again.");
        }
      });
    }
  };

  return (
    <Card className="border-gray-200 bg-gray-50 dark:bg-gray-950">
      <CardHeader>
        <CardTitle className="flex items-center text-gray-800 dark:text-gray-200">
          <CheckSquare className="h-5 w-5 mr-2" />
          Manual Fundraiser Completion
        </CardTitle>
        <CardDescription>
          {result 
            ? "Mark this fundraiser as complete to move it to the completed tab."
            : "Close this fundraiser and move it to the completed tab without selecting a winner."
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
            <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Winner Information</h4>
            <div className="text-sm text-yellow-700 dark:text-yellow-300">
              <p>Winning Ticket: #{result.winningTicket}</p>
              <p>Prize Amount: {formatSats(result.winnerAmount)}</p>
              <p>Use this option if you've handled the payout outside the platform.</p>
            </div>
          </div>
        )}

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>⚠️ WARNING:</strong> This action will permanently end the fundraiser{result ? "" : " without selecting a winner"}. 
            {result 
              ? " Only use this if you've already sent the prize payment manually outside the platform."
              : " This will close the fundraiser and no winner will be drawn - participants will not receive prizes."
            }
          </AlertDescription>
        </Alert>

        <div className="flex items-center space-x-2">
          <Checkbox 
            id="confirm-completion" 
            checked={confirmChecked}
            onCheckedChange={(checked) => setConfirmChecked(checked === true)}
          />
          <label 
            htmlFor="confirm-completion" 
            className="text-sm cursor-pointer font-medium text-red-600 dark:text-red-400"
          >
            I understand this will permanently end the fundraiser
            {result ? " (I have already paid the prize separately)" : " without selecting a winner"}
          </label>
        </div>

        <Button
          onClick={handleMarkCompleted}
          disabled={isPending || !confirmChecked}
          variant="outline"
          className="w-full border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <CheckSquare className="mr-2 h-4 w-4" />
          {isPending ? "Marking Complete..." : "Mark Fundraiser as Completed"}
        </Button>
      </CardContent>
    </Card>
  );
}