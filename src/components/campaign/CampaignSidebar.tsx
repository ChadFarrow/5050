import { useState } from "react";
import { ShoppingCart, User, Trophy, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BuyTicketsDialog } from "@/components/BuyTicketsDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserTickets } from "@/hooks/useCampaignStats";
import { useAuthorDisplay } from "@/lib/shared-utils";
import { formatSats } from "@/lib/utils";
import { useQueryClient } from '@tanstack/react-query';
import type { Campaign } from "@/hooks/useCampaigns";
import type { CampaignStats } from "@/hooks/useCampaignStats";

interface CampaignSidebarProps {
  campaign: Campaign;
  stats?: CampaignStats;
}

export function CampaignSidebar({ campaign, stats }: CampaignSidebarProps) {
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useCurrentUser();
  const { displayName: creatorName, profileImage: creatorImage } = useAuthorDisplay(campaign.pubkey);
  const queryClient = useQueryClient();
  
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      console.log('🔄 Manually refreshing campaign stats...');
      await queryClient.refetchQueries({ queryKey: ['fundraiser-stats', campaign.pubkey, campaign.dTag] });
      console.log('✅ Manual refresh completed');
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
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
              
              
              <div className="text-center text-sm text-muted-foreground">
                {formatSats(campaign.ticketPrice)} per ticket
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaign Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Details
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
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