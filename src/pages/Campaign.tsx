import { useParams } from "react-router-dom";
import { ArrowLeft, Trophy, Users, Clock, Target, Ticket, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCampaign } from "@/hooks/useCampaigns";
import { useCampaignStats, useUserTickets } from "@/hooks/useCampaignStats";
import { useAuthor } from "@/hooks/useAuthor";
import { BuyTicketsDialog } from "@/components/BuyTicketsDialog";
import { genUserName } from "@/lib/genUserName";
import { formatSats, formatTimeRemaining } from "@/lib/utils";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function Campaign() {
  const { pubkey, dTag } = useParams<{ pubkey: string; dTag: string }>();
  const { user } = useCurrentUser();
  const [showBuyDialog, setShowBuyDialog] = useState(false);

  const { data: campaign, isLoading: campaignLoading } = useCampaign(pubkey || "", dTag || "");
  const { data: stats, isLoading: statsLoading } = useCampaignStats(pubkey || "", dTag || "");
  const { data: userTickets } = useUserTickets(pubkey || "", dTag || "", user?.pubkey);
  const author = useAuthor(campaign?.pubkey || "");

  if (campaignLoading) {
    return <CampaignSkeleton />;
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-2xl font-bold mb-4">Campaign Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The campaign you're looking for doesn't exist or couldn't be loaded.
            </p>
            <Button asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Campaigns
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const metadata = author.data?.metadata;
  const displayName = metadata?.name ?? genUserName(campaign.pubkey);
  const profileImage = metadata?.picture;

  const now = Math.floor(Date.now() / 1000);
  const timeRemaining = campaign.endDate - now;

  const totalRaised = stats?.totalRaised || 0;
  const totalTickets = stats?.totalTickets || 0;
  const progressPercent = campaign.target > 0 ? Math.min((totalRaised / campaign.target) * 100, 100) : 0;

  const potentialWinnings = Math.floor(totalRaised / 2);
  const creatorShare = totalRaised - potentialWinnings;

  const userTicketCount = userTickets?.reduce((sum, purchase) => sum + purchase.tickets, 0) || 0;
  const userWinChance = totalTickets > 0 ? (userTicketCount / totalTickets) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Campaigns
              </Link>
            </Button>

            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profileImage} alt={displayName} />
                  <AvatarFallback className="text-lg">{displayName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-3xl font-bold mb-2">{campaign.title}</h1>
                  <p className="text-lg text-muted-foreground">{campaign.podcast}</p>
                  <p className="text-sm text-muted-foreground">by {displayName}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {campaign.isActive ? (
                  <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">Ended</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Campaign Image */}
              {campaign.image && (
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  <img 
                    src={campaign.image} 
                    alt={campaign.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Description */}
              <Card>
                <CardHeader>
                  <CardTitle>About This Campaign</CardTitle>
                  <CardDescription>{campaign.description}</CardDescription>
                </CardHeader>
                {campaign.content && (
                  <CardContent>
                    <div className="whitespace-pre-wrap text-sm">
                      {campaign.content}
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* User's Tickets */}
              {user && userTickets && userTickets.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Ticket className="h-5 w-5 mr-2" />
                      Your Tickets
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Tickets Owned</p>
                        <p className="text-2xl font-bold">{userTicketCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Win Chance</p>
                        <p className="text-2xl font-bold text-green-600">{userWinChance.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {userTickets.map((purchase, index) => (
                        <div key={purchase.id} className="flex justify-between items-center text-sm p-2 bg-muted rounded">
                          <span>Purchase #{index + 1}</span>
                          <span>{purchase.tickets} tickets - {formatSats(purchase.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Campaign Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Trophy className="h-5 w-5 mr-2" />
                    Campaign Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{formatSats(totalRaised)} / {formatSats(campaign.target)}</span>
                    </div>
                    <Progress value={progressPercent} className="h-3" />
                  </div>

                  <Separator />

                  {/* Stats Grid */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Potential Prize</span>
                      <span className="font-semibold text-green-600">{formatSats(potentialWinnings)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Creator Share</span>
                      <span className="font-semibold">{formatSats(creatorShare)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Tickets Sold</span>
                      <span className="font-semibold">{totalTickets}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Participants</span>
                      <span className="font-semibold">{stats?.uniqueParticipants || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Ticket Price</span>
                      <span className="font-semibold">{formatSats(campaign.ticketPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        {campaign.isActive ? "Time Remaining" : "Ended"}
                      </span>
                      <span className="font-semibold">
                        {campaign.isActive ? formatTimeRemaining(timeRemaining) : "Complete"}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* Action Button */}
                  {campaign.isActive && user ? (
                    <Button 
                      onClick={() => setShowBuyDialog(true)}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      <Ticket className="h-4 w-4 mr-2" />
                      Buy Tickets
                    </Button>
                  ) : !user ? (
                    <Button variant="outline" className="w-full" disabled>
                      Login to Buy Tickets
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      Campaign Ended
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Campaign Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {campaign.episode && (
                    <div>
                      <span className="text-muted-foreground">Episode:</span>
                      <p className="font-medium">{campaign.episode}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <p className="font-medium">
                      {new Date(campaign.createdAt * 1000).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ends:</span>
                    <p className="font-medium">
                      {new Date(campaign.endDate * 1000).toLocaleDateString()}
                    </p>
                  </div>
                  {campaign.podcastUrl && (
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <a href={campaign.podcastUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Visit Podcast
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <BuyTicketsDialog 
        campaign={campaign}
        open={showBuyDialog}
        onOpenChange={setShowBuyDialog}
      />
    </div>
  );
}

function CampaignSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-10 w-32 mb-8" />
          
          <div className="flex items-start space-x-4 mb-8">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="aspect-video w-full" />
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                  </div>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}