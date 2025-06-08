import { useState } from "react";
import { Target, Ticket, Trophy, Clock, ExternalLink, Crown } from "lucide-react";
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
import type { Fundraiser } from "@/hooks/useCampaigns";

interface FundraiserCardProps {
  fundraiser: Fundraiser;
}

export function CampaignCard({ fundraiser }: FundraiserCardProps) {
  const { user } = useCurrentUser();
  const author = useAuthor(fundraiser.pubkey);
  const { data: stats } = useCampaignStats(fundraiser.pubkey, fundraiser.dTag);
  const [showBuyDialog, setShowBuyDialog] = useState(false);

  const metadata = author.data?.metadata;
  const displayName = metadata?.name ?? genUserName(fundraiser.pubkey);
  const profileImage = metadata?.picture;

  const now = Math.floor(Date.now() / 1000);
  const timeRemaining = fundraiser.endDate - now;

  const totalRaised = stats?.totalRaised || 0;
  const totalTickets = stats?.totalTickets || 0;
  const progressPercent = fundraiser.target > 0 ? Math.min((totalRaised / fundraiser.target) * 100, 100) : 0;

  const potentialWinnings = Math.floor(totalRaised / 2);
  
  // Get winner information if fundraiser is complete
  const winner = stats?.result;
  const winnerAuthor = useAuthor(winner?.winnerPubkey || "");

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
                <p className="text-xs text-muted-foreground truncate">{fundraiser.podcast}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {fundraiser.isActive ? (
                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Active
                </Badge>
              ) : winner ? (
                <Badge variant="default" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  <Crown className="h-3 w-3 mr-1" />
                  Winner Drawn
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
                to={`/fundraiser/${fundraiser.pubkey}/${fundraiser.dTag}`}
                className="hover:text-purple-600 transition-colors"
              >
                {fundraiser.title}
              </Link>
            </CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              {fundraiser.description}
            </CardDescription>
          </div>

          {fundraiser.image && (
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              <img 
                src={fundraiser.image} 
                alt={fundraiser.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Winner Display */}
          {winner && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center space-x-2 mb-2">
                <Crown className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-800 dark:text-purple-200">Winner</span>
              </div>
              <div className="flex items-center space-x-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={winnerAuthor.data?.metadata?.picture} />
                  <AvatarFallback className="text-xs">
                    {(winnerAuthor.data?.metadata?.name ?? genUserName(winner.winnerPubkey))[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {winnerAuthor.data?.metadata?.name ?? genUserName(winner.winnerPubkey)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ticket #{winner.winningTicket} • Won {formatSats(winner.winnerAmount)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{formatSats(totalRaised)} / {formatSats(fundraiser.target)}</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
            <div className="space-y-1">
              <div className="flex items-center text-muted-foreground">
                <Trophy className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="truncate">Potential Win</span>
              </div>
              <p className="font-semibold text-green-600 truncate">{formatSats(potentialWinnings)}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center text-muted-foreground">
                <Ticket className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="truncate">Tickets Sold</span>
              </div>
              <p className="font-semibold">{totalTickets}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center text-muted-foreground">
                <Target className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="truncate">Ticket Price</span>
              </div>
              <p className="font-semibold truncate">{formatSats(fundraiser.ticketPrice)}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center text-muted-foreground">
                <Clock className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="truncate">{fundraiser.isActive ? "Time Left" : "Ended"}</span>
              </div>
              <p className="font-semibold truncate">
                {fundraiser.isActive ? formatTimeRemaining(timeRemaining) : "Complete"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {fundraiser.isActive && user ? (
              <Button 
                onClick={() => setShowBuyDialog(true)}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-sm"
                size="sm"
              >
                <Ticket className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Buy Tickets</span>
                <span className="sm:hidden">Buy</span>
              </Button>
            ) : !user ? (
              <Button variant="outline" className="flex-1 text-sm" size="sm" disabled>
                <span className="hidden sm:inline">Login to Buy Tickets</span>
                <span className="sm:hidden">Login to Buy</span>
              </Button>
            ) : (
              <Button variant="outline" className="flex-1 text-sm" size="sm" disabled>
                <span className="hidden sm:inline">Fundraiser Ended</span>
                <span className="sm:hidden">Ended</span>
              </Button>
            )}
            
            {fundraiser.podcastUrl && (
              <Button variant="outline" size="sm" asChild className="flex-shrink-0">
                <a href={fundraiser.podcastUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>

          {/* Additional Info */}
          {fundraiser.episode && (
            <div className="text-xs text-muted-foreground border-t pt-3">
              Episode: {fundraiser.episode}
            </div>
          )}
        </CardContent>
      </Card>

      <BuyTicketsDialog 
        campaign={fundraiser}
        open={showBuyDialog}
        onOpenChange={setShowBuyDialog}
      />
    </>
  );
}