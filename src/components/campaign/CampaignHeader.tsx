import { Calendar, Target, Ticket, Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatSats } from "@/lib/utils";
import type { Campaign } from "@/hooks/useCampaigns";
import type { CampaignStats } from "@/hooks/useCampaignStats";

interface CampaignHeaderProps {
  campaign: Campaign;
  stats?: CampaignStats;
}

export function CampaignHeader({ campaign, stats }: CampaignHeaderProps) {
  const totalRaised = stats?.totalRaised || 0;
  const progress = campaign.target > 0 ? (totalRaised / campaign.target) * 100 : 0;
  const endDate = new Date(campaign.endDate * 1000);
  const isExpired = Date.now() > campaign.endDate * 1000;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{campaign.title}</h1>
            <p className="text-muted-foreground">{campaign.podcast}</p>
          </div>
          <Badge variant={isExpired ? "destructive" : "default"}>
            {isExpired ? "Ended" : "Active"}
          </Badge>
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
                {progress.toFixed(1)}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatSats(totalRaised)} raised</span>
              <span>{formatSats(campaign.target)} goal</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center space-y-1">
              <Target className="h-5 w-5 mx-auto text-muted-foreground" />
              <div className="text-lg font-semibold">{formatSats(campaign.target)}</div>
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
    </Card>
  );
}