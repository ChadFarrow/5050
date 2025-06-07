import { useState } from "react";
import { Calendar, Target, Ticket, Trophy, Clock, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCampaignStats } from "@/hooks/useCampaignStats";
import { BuyTicketsDialog } from "@/components/BuyTicketsDialog";
import { genUserName } from "@/lib/genUserName";
import { formatSats, formatTimeRemaining } from "@/lib/utils";
import type { Campaign } from "@/hooks/useCampaigns";

interface CampaignCardProps {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const { user } = useCurrentUser();
  const author = useAuthor(campaign.pubkey);
  const { data: stats } = useCampaignStats(campaign.pubkey, campaign.dTag);
  const [showBuyDialog, setShowBuyDialog] = useState(false);

  const metadata = author.data?.metadata;
  const displayName = metadata?.name ?? genUserName(campaign.pubkey);
  const profileImage = metadata?.picture;

  const now = Math.floor(Date.now() / 1000);
  const timeRemaining = campaign.endDate - now;
  const isExpired = timeRemaining <= 0;

  const totalRaised = stats?.totalRaised || 0;
  const totalTickets = stats?.totalTickets || 0;
  const progressPercent = campaign.target > 0 ? Math.min((totalRaised / campaign.target) * 100, 100) : 0;

  const potentialWinnings = Math.floor(totalRaised / 2);
  const creatorShare = totalRaised - potentialWinnings;

  return (
    <>
      <Card className="group hover:shadow-lg transition-all duration-200 border-2 hover:border-purple-200 dark:hover:border-purple-800">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profileImage} alt={displayName} />
                <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{campaign.podcast}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {campaign.isActive ? (
                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">
                  Ended
                </Badge>
              )}
            </div>
          </div>

          <div>
            <CardTitle className="text-lg leading-tight mb-2">
              <Link 
                to={`/campaign/${campaign.pubkey}/${campaign.dTag}`}
                className="hover:text-purple-600 transition-colors"
              >
                {campaign.title}
              </Link>
            </CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              {campaign.description}
            </CardDescription>
          </div>

          {campaign.image && (
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              <img 
                src={campaign.image} 
                alt={campaign.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{formatSats(totalRaised)} / {formatSats(campaign.target)}</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="flex items-center text-muted-foreground">
                <Trophy className="h-4 w-4 mr-1" />
                Potential Win
              </div>
              <p className="font-semibold text-green-600">{formatSats(potentialWinnings)}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center text-muted-foreground">
                <Ticket className="h-4 w-4 mr-1" />
                Tickets Sold
              </div>
              <p className="font-semibold">{totalTickets}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center text-muted-foreground">
                <Target className="h-4 w-4 mr-1" />
                Ticket Price
              </div>
              <p className="font-semibold">{formatSats(campaign.ticketPrice)}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center text-muted-foreground">
                <Clock className="h-4 w-4 mr-1" />
                {campaign.isActive ? "Time Left" : "Ended"}
              </div>
              <p className="font-semibold">
                {campaign.isActive ? formatTimeRemaining(timeRemaining) : "Complete"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {campaign.isActive && user ? (
              <Button 
                onClick={() => setShowBuyDialog(true)}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Ticket className="h-4 w-4 mr-2" />
                Buy Tickets
              </Button>
            ) : !user ? (
              <Button variant="outline" className="flex-1" disabled>
                Login to Buy Tickets
              </Button>
            ) : (
              <Button variant="outline" className="flex-1" disabled>
                Campaign Ended
              </Button>
            )}
            
            {campaign.podcastUrl && (
              <Button variant="outline" size="icon" asChild>
                <a href={campaign.podcastUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>

          {/* Additional Info */}
          {campaign.episode && (
            <div className="text-xs text-muted-foreground border-t pt-3">
              Episode: {campaign.episode}
            </div>
          )}
        </CardContent>
      </Card>

      <BuyTicketsDialog 
        campaign={campaign}
        open={showBuyDialog}
        onOpenChange={setShowBuyDialog}
      />
    </>
  );
}