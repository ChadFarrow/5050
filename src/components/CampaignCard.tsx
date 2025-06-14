import { useState } from "react";
import { Target, Ticket, Trophy, Clock, ExternalLink, Crown, Trash2, Heart } from "lucide-react";
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
import { DonateDialog } from "@/components/DonateDialog";
import { DeleteFundraiserDialog } from "@/components/DeleteFundraiserDialog";
import { genUserName } from "@/lib/genUserName";
import { formatSats, formatTimeRemaining } from "@/lib/utils";
import type { Fundraiser } from "@/hooks/useCampaigns";
import { nip19 } from 'nostr-tools';

interface FundraiserCardProps {
  fundraiser: Fundraiser;
}

export function CampaignCard({ fundraiser }: FundraiserCardProps) {
  const { user } = useCurrentUser();
  const author = useAuthor(fundraiser.pubkey);
  const { data: stats } = useCampaignStats(fundraiser.pubkey, fundraiser.dTag);
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [showDonateDialog, setShowDonateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const metadata = author.data?.metadata;
  const displayName = metadata?.name ?? genUserName(fundraiser.pubkey);
  const profileImage = metadata?.picture;

  const now = Math.floor(Date.now() / 1000);
  const timeRemaining = fundraiser.endDate - now;

  const totalRaised = stats?.totalRaised || 0;
  const totalDonations = stats?.totalDonations || 0;
  const totalTickets = stats?.totalTickets || 0;
  const combinedTotal = totalRaised + totalDonations;
  const progressPercent = fundraiser.target > 0 ? Math.min((combinedTotal / fundraiser.target) * 100, 100) : 0;

  const potentialWinnings = Math.floor(combinedTotal / 2);
  
  // Get winner information if fundraiser is complete
  const winner = stats?.result;
  const winnerAuthor = useAuthor(winner?.winnerPubkey || "");
  
  // Check if user can delete this fundraiser
  const isCreator = user?.pubkey === fundraiser.pubkey;
  const hasTickets = totalTickets > 0;
  const canDelete = isCreator && !hasTickets && fundraiser.isActive;

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
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Delete fundraiser"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
              {fundraiser.isActive ? (
                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Active
                </Badge>
              ) : winner ? (
                <>
                  <Badge variant="default" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    <Crown className="h-3 w-3 mr-1" />
                    Winner Drawn
                  </Badge>
                  {winner.event.tags.some(tag => tag[0] === 'payout_confirmed') && (
                    <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      ✅ Paid
                    </Badge>
                  )}
                  {winner.event.tags.some(tag => tag[0] === 'manual_completed') && !winner.event.tags.some(tag => tag[0] === 'payout_confirmed') && (
                    <Badge variant="default" className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                      ✅ Completed
                    </Badge>
                  )}
                </>
              ) : (
                <Badge variant="secondary">
                  Ended
                </Badge>
              )}
            </div>
          </div>

          <div>
            <CardTitle className="text-lg leading-tight mb-2">
              {(() => {
                const naddr = nip19.naddrEncode({
                  pubkey: fundraiser.pubkey,
                  kind: 31950,
                  identifier: fundraiser.dTag,
                });
                return (
                  <Link 
                    to={`/${naddr}`}
                    className="hover:text-purple-600 transition-colors"
                  >
                    {fundraiser.title}
                  </Link>
                );
              })()}
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
              <span className="font-medium">
                {fundraiser.target > 0 
                  ? `${formatSats(combinedTotal)} / ${formatSats(fundraiser.target)}`
                  : `${formatSats(combinedTotal)} raised`
                }
              </span>
            </div>
            {fundraiser.target > 0 && <Progress value={progressPercent} className="h-2" />}
            {totalDonations > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Tickets: {formatSats(totalRaised)}</span>
                <span>Prize Pool Donations: {formatSats(totalDonations)}</span>
              </div>
            )}
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
                <span className="truncate">
                  {fundraiser.manualDraw ? "Draw Type" : fundraiser.isActive ? "Time Left" : "Ended"}
                </span>
              </div>
              <p className="font-semibold truncate">
                {fundraiser.manualDraw ? "Manual Draw" : fundraiser.isActive ? formatTimeRemaining(timeRemaining) : "Complete"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            {fundraiser.isActive && user ? (
              <div className="space-y-2">
                <Button 
                  onClick={() => setShowBuyDialog(true)}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-sm"
                  size="sm"
                >
                  <Ticket className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Buy Tickets</span>
                  <span className="sm:hidden">Buy</span>
                </Button>
                <div className="flex gap-1">
                  <Button 
                    onClick={() => setShowDonateDialog(true)}
                    variant="outline"
                    className="flex-1 text-sm border-pink-200 text-pink-600 hover:bg-pink-50 hover:text-pink-700 hover:border-pink-300"
                    size="sm"
                  >
                    <Heart className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Donate to prize pool</span>
                    <span className="sm:hidden">Donate</span>
                  </Button>
                  {fundraiser.podcastUrl && (
                    <Button variant="outline" size="sm" asChild className="flex-shrink-0">
                      <a href={fundraiser.podcastUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ) : !user ? (
              <div className="space-y-2">
                <Button variant="outline" className="w-full text-sm" size="sm" disabled>
                  <span className="hidden sm:inline">Login to Buy Tickets</span>
                  <span className="sm:hidden">Login to Buy</span>
                </Button>
                <div className="flex gap-1">
                  <Button variant="outline" className="flex-1 text-sm" size="sm" disabled>
                    <span className="hidden sm:inline">Login to Donate</span>
                    <span className="sm:hidden">Login</span>
                  </Button>
                  {fundraiser.podcastUrl && (
                    <Button variant="outline" size="sm" asChild className="flex-shrink-0">
                      <a href={fundraiser.podcastUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Button variant="outline" className="w-full text-sm" size="sm" disabled>
                  <span className="hidden sm:inline">Fundraiser Ended</span>
                  <span className="sm:hidden">Ended</span>
                </Button>
                <div className="flex gap-1">
                  <Button variant="outline" className="flex-1 text-sm" size="sm" disabled>
                    <span className="hidden sm:inline">Fundraiser Ended</span>
                    <span className="sm:hidden">Ended</span>
                  </Button>
                  {fundraiser.podcastUrl && (
                    <Button variant="outline" size="sm" asChild className="flex-shrink-0">
                      <a href={fundraiser.podcastUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
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

      <DonateDialog 
        campaign={fundraiser}
        open={showDonateDialog}
        onOpenChange={setShowDonateDialog}
      />
      
      <DeleteFundraiserDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        fundraiser={fundraiser}
        hasTickets={hasTickets}
      />
    </>
  );
}