import { useState } from "react";
import { Calendar, Target, Ticket, Users, Trash2, Edit } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SplitProgress } from "@/components/ui/split-progress";
import { Button } from "@/components/ui/button";
import { formatSats } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { DeleteFundraiserDialog } from "@/components/DeleteFundraiserDialog";
import { CreateFundraiserDialog } from "@/components/CreateCampaignDialog";
import type { Fundraiser } from "@/hooks/useCampaigns";
import type { FundraiserStats } from "@/hooks/useCampaignStats";

interface CampaignHeaderProps {
  campaign: Fundraiser;
  stats?: FundraiserStats;
}

export function CampaignHeader({ campaign, stats }: CampaignHeaderProps) {
  const { user } = useCurrentUser();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  const totalRaised = stats?.totalRaised || 0;
  const totalDonations = stats?.totalDonations || 0;
  const combinedTotal = totalRaised + totalDonations;
  
  // Calculate progress values for different scenarios
  let progress: number;
  let ticketProgress: number = 0;
  let donationProgress: number = 0;
  let showSplitProgress: boolean = false;
  
  if (campaign.target > 0) {
    // Fundraiser with goal
    const totalProgressPercent = Math.min((combinedTotal / campaign.target) * 100, 100);
    const ticketProgressPercent = Math.min((totalRaised / campaign.target) * 100, 100);
    const donationProgressPercent = Math.min((totalDonations / campaign.target) * 100, 100);
    
    if (totalDonations > 0 && totalRaised > 0) {
      // Show split progress when both tickets and donations exist
      showSplitProgress = true;
      ticketProgress = ticketProgressPercent;
      donationProgress = donationProgressPercent;
      progress = totalProgressPercent;
    } else {
      // Single progress bar
      progress = totalProgressPercent;
    }
  } else {
    // Open-ended fundraiser
    if (totalDonations > 0 && totalRaised > 0) {
      // Show split progress when both tickets and donations exist
      showSplitProgress = true;
      ticketProgress = (totalRaised / combinedTotal) * 100;
      donationProgress = (totalDonations / combinedTotal) * 100;
      progress = 100; // Always 100% for open-ended with activity
    } else if (totalDonations > 0 && combinedTotal > 0) {
      // Only donations - show ticket percentage (will be 0)
      progress = (totalRaised / combinedTotal) * 100;
    } else {
      // Show 100% if there's any activity, 0% if none
      progress = combinedTotal > 0 ? 100 : 0;
    }
  }
  const endDate = new Date(campaign.endDate * 1000);
  const isExpired = Date.now() > campaign.endDate * 1000;
  const hasTickets = (stats?.totalTickets || 0) > 0;
  const isCreator = user?.pubkey === campaign.pubkey;
  const canDelete = isCreator && !hasTickets && campaign.isActive;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{campaign.title}</h1>
            <p className="text-muted-foreground">{campaign.podcast}</p>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditDialog(true)}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
            <Badge variant={isExpired ? "destructive" : "default"}>
              {isExpired ? "Ended" : "Active"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {campaign.image && (
          <img 
            src={campaign.image} 
            alt={campaign.title}
            className="w-full h-48 object-cover rounded-lg"
          />
        )}
        
        <p className="text-sm">{campaign.description}</p>
        
        {campaign.content && (
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap">{campaign.content}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {campaign.target > 0 
                  ? `${progress.toFixed(1)}%`
                  : totalDonations > 0 && combinedTotal > 0
                    ? `${progress.toFixed(1)}% tickets`
                    : combinedTotal > 0 
                      ? 'Active'
                      : 'Open-ended'
                }
              </span>
            </div>
            
            {/* Progress Bar - Split or Single */}
            {showSplitProgress ? (
              <SplitProgress 
                ticketValue={ticketProgress}
                donationValue={donationProgress}
                totalValue={progress}
                className="h-2"
              />
            ) : (
              <Progress value={progress} className="h-2" />
            )}
            
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {showSplitProgress
                  ? `${formatSats(totalRaised)} tickets`
                  : totalDonations > 0 && campaign.target === 0
                    ? `${formatSats(totalRaised)} tickets`
                    : `${formatSats(combinedTotal)} raised`
                }
              </span>
              <span>
                {showSplitProgress
                  ? `${formatSats(totalDonations)} donations`
                  : campaign.target > 0 
                    ? `${formatSats(campaign.target)} goal`
                    : totalDonations > 0 
                      ? `${formatSats(totalDonations)} donations`
                      : 'No target'
                }
              </span>
            </div>
            
            {/* Legend for split progress */}
            {showSplitProgress && (
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span>Tickets</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span>Donations</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center space-y-1">
              <Target className="h-5 w-5 mx-auto text-muted-foreground" />
              <div className="text-lg font-semibold">{campaign.target > 0 ? formatSats(campaign.target) : 'Open'}</div>
              <div className="text-xs text-muted-foreground">Target</div>
            </div>
            
            <div className="text-center space-y-1">
              <Ticket className="h-5 w-5 mx-auto text-muted-foreground" />
              <div className="text-lg font-semibold">{stats?.totalTickets || 0}</div>
              <div className="text-xs text-muted-foreground">Tickets</div>
            </div>
            
            <div className="text-center space-y-1">
              <Users className="h-5 w-5 mx-auto text-muted-foreground" />
              <div className="text-lg font-semibold">{stats?.uniqueParticipants || 0}</div>
              <div className="text-xs text-muted-foreground">Participants</div>
            </div>
            
            <div className="text-center space-y-1">
              <Calendar className="h-5 w-5 mx-auto text-muted-foreground" />
              <div className="text-lg font-semibold">{endDate.toLocaleDateString()}</div>
              <div className="text-xs text-muted-foreground">End Date</div>
            </div>
          </div>
        </div>
      </CardContent>
      
      <DeleteFundraiserDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        fundraiser={campaign}
        hasTickets={hasTickets}
      />

      <CreateFundraiserDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        editCampaign={{
          title: campaign.title,
          description: campaign.description,
          content: campaign.content,
          podcast: campaign.podcast,
          podcastUrl: campaign.podcastUrl,
          episode: campaign.episode,
          target: campaign.target,
          ticketPrice: campaign.ticketPrice,
          endDate: campaign.endDate,
          image: campaign.image,
          manualDraw: campaign.manualDraw,
          nwc: campaign.nwc,
          dTag: campaign.dTag,
        }}
      />
    </Card>
  );
}

