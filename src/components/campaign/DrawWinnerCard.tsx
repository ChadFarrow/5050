import { useState } from "react";
import { Trophy, Dice6, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useToastUtils } from "@/lib/shared-utils";
import { formatSats } from "@/lib/utils";
import type { Campaign } from "@/hooks/useCampaigns";
import type { CampaignStats, TicketPurchase } from "@/hooks/useCampaignStats";
import { useQueryClient } from '@tanstack/react-query';

interface DrawWinnerCardProps {
  campaign: Campaign;
  stats: CampaignStats;
}

interface TicketAssignment {
  purchaseIndex: number;
  purchase: TicketPurchase;
  startTicket: number;
  endTicket: number;
}

// Generate cryptographically secure random number
function generateSecureRandomSeed(): string {
  const array = new Uint32Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, num => num.toString(16).padStart(8, '0')).join('');
}

// Generate deterministic random number from seed
function seededRandom(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Normalize to 0-1 range and scale to min-max
  const normalized = Math.abs(hash) / 2147483647;
  return Math.floor(normalized * (max - min + 1)) + min;
}

export function DrawWinnerCard({ campaign, stats }: DrawWinnerCardProps) {
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const toast = useToastUtils();
  const queryClient = useQueryClient();
  const [isDrawing, setIsDrawing] = useState(false);

  // Check if user is the campaign creator
  const isCreator = user?.pubkey === campaign.pubkey;
  
  // For manual draws, we show the button regardless of end date
  
  // Check if winner has already been drawn
  const hasWinner = !!stats.result;
  
  // Should show draw winner card?
  // For manual draws: show if creator, has tickets, no winner yet (regardless of end date)
  // For auto draws: show only if expired (but this shouldn't happen since auto-draws are automatic)
  const shouldShow = isCreator && !hasWinner && stats.totalTickets > 0 && campaign.manualDraw;

  if (!shouldShow) {
    return null;
  }

  const handleDrawWinner = async () => {
    if (!user || stats.totalTickets === 0) return;

    setIsDrawing(true);
    
    try {
      // Create ticket assignments array
      const ticketAssignments: TicketAssignment[] = [];
      let currentTicket = 1;
      
      stats.purchases.forEach((purchase, index) => {
        const startTicket = currentTicket;
        const endTicket = currentTicket + purchase.tickets - 1;
        
        ticketAssignments.push({
          purchaseIndex: index,
          purchase,
          startTicket,
          endTicket,
        });
        
        currentTicket = endTicket + 1;
      });

      // Generate secure random seed
      const randomSeed = generateSecureRandomSeed();
      
      // Select winning ticket number
      const winningTicketNumber = seededRandom(randomSeed, 1, stats.totalTickets);
      
      // Find the winner
      const winnerAssignment = ticketAssignments.find(
        assignment => winningTicketNumber >= assignment.startTicket && winningTicketNumber <= assignment.endTicket
      );

      if (!winnerAssignment) {
        throw new Error('Failed to determine winner');
      }

      // Calculate amounts (50/50 split)
      const totalRaised = stats.totalRaised;
      const winnerAmount = Math.floor(totalRaised / 2);
      const creatorAmount = totalRaised - winnerAmount;

      // Create campaign coordinate
      const campaignCoordinate = `31950:${campaign.pubkey}:${campaign.dTag}`;

      // Build tags for result event
      const tags: string[][] = [
        ["d", campaign.dTag],
        ["a", campaignCoordinate],
        ["winner", winnerAssignment.purchase.pubkey],
        ["winning_ticket", winningTicketNumber.toString()],
        ["total_raised", totalRaised.toString()],
        ["winner_amount", winnerAmount.toString()],
        ["creator_amount", creatorAmount.toString()],
        ["total_tickets", stats.totalTickets.toString()],
        ["random_seed", randomSeed],
      ];

      const content = `🎉 Congratulations to the winner! Out of ${stats.totalTickets} tickets sold, ticket #${winningTicketNumber} was drawn. The winner receives ${formatSats(winnerAmount)} and ${formatSats(creatorAmount)} goes to support ${campaign.podcast}. Thank you to everyone who participated!`;

      publishEvent({
        kind: 31952,
        content,
        tags,
      }, {
        onSuccess: (eventId) => {
          console.log('Winner selection event published successfully:', eventId);
          
          // Invalidate queries to refresh the UI
          queryClient.invalidateQueries({ queryKey: ['fundraiser-stats', campaign.pubkey, campaign.dTag] });
          queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
          
          toast.success(
            "Winner Drawn!",
            `Ticket #${winningTicketNumber} won ${formatSats(winnerAmount)}!`
          );
        },
        onError: (error) => {
          console.error('Failed to publish winner selection event:', error);
          toast.error("Failed to Draw Winner", "Could not publish the winner selection. Please try again.");
        }
      });

    } catch (error) {
      console.error("Error drawing winner:", error);
      toast.error("Error", "Failed to draw winner. Please try again.");
    } finally {
      setIsDrawing(false);
    }
  };

  return (
    <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950">
      <CardHeader>
        <CardTitle className="flex items-center text-yellow-800 dark:text-yellow-200">
          <Trophy className="h-5 w-5 mr-2" />
          Ready for Live Winner Draw
        </CardTitle>
        <CardDescription>
          This fundraiser is set for manual winner selection. Draw a random winner from {stats.totalTickets} tickets whenever you're ready (perfect for live shows).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Total Raised</div>
            <div className="font-semibold text-lg">{formatSats(stats.totalRaised)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Tickets Sold</div>
            <div className="font-semibold text-lg">{stats.totalTickets}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Winner Gets</div>
            <div className="font-semibold text-green-600">
              {formatSats(Math.floor(stats.totalRaised / 2))}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">You Get</div>
            <div className="font-semibold text-blue-600">
              {formatSats(stats.totalRaised - Math.floor(stats.totalRaised / 2))}
            </div>
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This action cannot be undone. The winner will be selected using cryptographically secure randomness.
          </AlertDescription>
        </Alert>

        <Button
          onClick={handleDrawWinner}
          disabled={isPending || isDrawing}
          className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700"
          size="lg"
        >
          {(isPending || isDrawing) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Dice6 className="mr-2 h-5 w-5" />
          {isPending || isDrawing ? "Drawing Winner..." : "Draw Random Winner"}
        </Button>
      </CardContent>
    </Card>
  );
}