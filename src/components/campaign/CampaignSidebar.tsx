import { useState } from "react";
import { ShoppingCart, User, Trophy, TestTube } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BuyTicketsDialog } from "@/components/BuyTicketsDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserTickets } from "@/hooks/useCampaignStats";
import { useTestNostrPublish } from "@/hooks/useTestNostrPublish";
import { useAuthorDisplay } from "@/lib/shared-utils";
import { formatSats } from "@/lib/utils";
import { useQueryClient } from '@tanstack/react-query';
import { getTestProfiles } from "@/lib/test-profiles";
import type { Campaign } from "@/hooks/useCampaigns";
import type { CampaignStats } from "@/hooks/useCampaignStats";

interface CampaignSidebarProps {
  campaign: Campaign;
  stats?: CampaignStats;
}

// Generate a fake payment hash
function generateFakePaymentHash(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// Generate a fake bolt11 invoice
function generateFakeBolt11(amount: number): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = 'lnbc' + amount + 'n1p';
  for (let i = 0; i < 100; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function CampaignSidebar({ campaign, stats }: CampaignSidebarProps) {
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [isGeneratingTestTickets, setIsGeneratingTestTickets] = useState(false);
  const { user } = useCurrentUser();
  const { mutate: publishTestEvent } = useTestNostrPublish();
  const queryClient = useQueryClient();
  const { displayName: creatorName, profileImage: creatorImage } = useAuthorDisplay(campaign.pubkey);
  
  const { data: userTickets } = useUserTickets(
    campaign.pubkey, 
    campaign.dTag, 
    user?.pubkey
  );

  const userTicketCount = userTickets?.reduce((sum, purchase) => sum + purchase.tickets, 0) || 0;
  const userSpent = userTickets?.reduce((sum, purchase) => sum + purchase.amount, 0) || 0;
  
  const totalTickets = stats?.totalTickets || 0;
  const winChance = totalTickets > 0 ? (userTicketCount / totalTickets) * 100 : 0;

  const isExpired = Date.now() > campaign.endDate * 1000;
  const hasWinner = !!stats?.result;
  const isCreator = user?.pubkey === campaign.pubkey;

  const generateTestTickets = async () => {
    if (!user || !isCreator) return;

    setIsGeneratingTestTickets(true);
    
    try {
      // Get all test profiles to use for ticket purchases
      const testProfiles = getTestProfiles(10);
      
      // Generate 10 test ticket purchases from different test users
      const testMessages = [
        "Good luck everyone! 🍀",
        "Hope I win! 🤞",
        "Supporting the podcast! 🎧",
        "Let's go! 🚀",
        "Love this show!",
        "Value4value in action!",
        "Supporting the show!",
        "Hope this helps the podcast!",
        "Great episode!",
        "Keep up the good work!"
      ];

      // Create campaign coordinate
      const campaignCoordinate = `31950:${campaign.pubkey}:${campaign.dTag}`;

      for (let i = 0; i < 10; i++) {
        const testProfile = testProfiles[i];
        const ticketCount = Math.floor(Math.random() * 3) + 1; // 1-3 tickets
        const totalCost = ticketCount * campaign.ticketPrice;
        const paymentHash = generateFakePaymentHash();
        const bolt11 = generateFakeBolt11(Math.floor(totalCost / 1000)); // Convert to sats for bolt11
        
        // Generate unique purchase ID
        const purchaseId = `test-purchase-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;

        // Build tags for ticket purchase event
        const tags: string[][] = [
          ["d", purchaseId],
          ["a", campaignCoordinate],
          ["amount", totalCost.toString()],
          ["tickets", ticketCount.toString()],
          ["bolt11", bolt11],
          ["payment_hash", paymentHash],
          ["test_ticket", "true"], // Mark as test ticket
        ];

        const eventData = {
          kind: 31951,
          content: testMessages[i],
          tags,
          created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 3600), // Random time in last hour
        };

        // Use the test publish method with the specific test profile
        publishTestEvent({ 
          event: eventData, 
          options: { testProfile } 
        }, {
          onSuccess: (eventId) => {
            console.log(`Test ticket ${i + 1}/10 published by ${testProfile.name}:`, eventId);
            
            if (i === 9) { // Last ticket
              // Invalidate queries to refresh the UI
              setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['fundraiser-stats', campaign.pubkey, campaign.dTag] });
                queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
                console.log('✅ All 10 test tickets created successfully!');
              }, 1000);
            }
          },
          onError: (error) => {
            console.error(`Failed to create test ticket ${i + 1} for ${testProfile.name}:`, error);
          }
        });

        // Small delay between purchases to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 200));
      }

    } catch (error) {
      console.error('Error generating test tickets:', error);
    } finally {
      setIsGeneratingTestTickets(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Creator Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Creator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarImage src={creatorImage} alt={creatorName} />
                <AvatarFallback>
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{creatorName}</div>
                <div className="text-sm text-muted-foreground">
                  {campaign.podcast}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User's Participation */}
        {user && userTicketCount > 0 && (
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="h-5 w-5 mr-2" />
                Your Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold">{userTicketCount}</div>
                  <div className="text-xs text-muted-foreground">Tickets</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">{winChance.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Win Chance</div>
                </div>
              </div>
              
              <div className="text-center text-sm text-muted-foreground">
                Spent: {formatSats(userSpent)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Buy Tickets */}
        {!isExpired && !hasWinner && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button 
                onClick={() => setShowBuyDialog(true)}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                size="lg"
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                Buy Tickets
              </Button>
              
              {/* Test Button - Only show for campaign creator */}
              {isCreator && import.meta.env.DEV && (
                <Button 
                  onClick={generateTestTickets}
                  disabled={isGeneratingTestTickets}
                  variant="outline"
                  className="w-full border-orange-200 text-orange-600 hover:bg-orange-50"
                  size="sm"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {isGeneratingTestTickets ? "Generating..." : "Add 10 Test Tickets"}
                </Button>
              )}
              
              <div className="text-center text-sm text-muted-foreground">
                {formatSats(campaign.ticketPrice)} per ticket
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaign Details */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ticket Price:</span>
              <span className="font-medium">{formatSats(campaign.ticketPrice)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Raised:</span>
              <span className="font-medium">{formatSats(stats?.totalRaised || 0)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-muted-foreground">End Date:</span>
              <span className="font-medium">
                {new Date(campaign.endDate * 1000).toLocaleDateString()}
              </span>
            </div>
            
            {campaign.episode && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Episode:</span>
                <span className="font-medium">{campaign.episode}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <BuyTicketsDialog
        campaign={campaign}
        open={showBuyDialog}
        onOpenChange={setShowBuyDialog}
      />
    </>
  );
}