import { Bug, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import type { Campaign } from "@/hooks/useCampaigns";
import type { CampaignStats } from "@/hooks/useCampaignStats";

interface CampaignDebugInfoProps {
  campaign: Campaign;
  stats: CampaignStats | undefined;
}

export function CampaignDebugInfo({ campaign, stats }: CampaignDebugInfoProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900">
            <CardTitle className="flex items-center justify-between text-blue-800 dark:text-blue-200">
              <div className="flex items-center">
                <Bug className="h-5 w-5 mr-2" />
                Campaign Debug Info
              </div>
              {isOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </CardTitle>
            <CardDescription>
              Development debugging information for this campaign
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 text-blue-800 dark:text-blue-200">Campaign Status</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Active: <Badge variant={campaign.isActive ? "default" : "secondary"}>{campaign.isActive ? "Yes" : "No"}</Badge></div>
                <div>Manual Draw: <Badge variant={campaign.manualDraw ? "default" : "secondary"}>{campaign.manualDraw ? "Yes" : "No"}</Badge></div>
                <div>End Date: {new Date(campaign.endDate * 1000).toLocaleString()}</div>
                <div>Now: {new Date().toLocaleString()}</div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-blue-800 dark:text-blue-200">Campaign Data</h4>
              <div className="text-sm space-y-1">
                <div>ID: <code className="bg-muted px-1 rounded text-xs">{campaign.id}</code></div>
                <div>Pubkey: <code className="bg-muted px-1 rounded text-xs">{campaign.pubkey}</code></div>
                <div>dTag: <code className="bg-muted px-1 rounded text-xs">{campaign.dTag}</code></div>
              </div>
            </div>

            {stats && (
              <div>
                <h4 className="font-semibold mb-2 text-blue-800 dark:text-blue-200">Campaign Stats</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Total Tickets: {stats.totalTickets}</div>
                  <div>Total Raised: {stats.totalRaised} msats</div>
                  <div>Purchases: {stats.purchases?.length || 0}</div>
                  <div>Donations: {stats.donations?.length || 0}</div>
                  <div>Has Winner: <Badge variant={stats.result ? "default" : "secondary"}>{stats.result ? "Yes" : "No"}</Badge></div>
                </div>
                
                {stats.result && (
                  <div className="mt-3">
                    <h5 className="font-medium mb-1 text-blue-700 dark:text-blue-300">Winner Details</h5>
                    <div className="text-sm space-y-1">
                      <div>Winner Pubkey: <code className="bg-muted px-1 rounded text-xs">{stats.result.winnerPubkey}</code></div>
                      <div>Winning Ticket: #{stats.result.winningTicket}</div>
                      <div>Winner Amount: {stats.result.winnerAmount} msats</div>
                      <div>Event ID: <code className="bg-muted px-1 rounded text-xs">{stats.result.id}</code></div>
                      <div>Created: {new Date(stats.result.createdAt * 1000).toLocaleString()}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!stats && (
              <div>
                <h4 className="font-semibold mb-2 text-red-600">No Stats Data</h4>
                <p className="text-sm text-red-500">Campaign stats could not be loaded. This might indicate an issue with relay connectivity or event structure.</p>
              </div>
            )}

            <div>
              <h4 className="font-semibold mb-2 text-blue-800 dark:text-blue-200">Raw Event Data</h4>
              <details className="text-xs">
                <summary className="cursor-pointer text-blue-600 hover:text-blue-800">Click to view raw campaign event</summary>
                <pre className="mt-2 p-2 bg-muted rounded overflow-auto text-xs">
                  {JSON.stringify(campaign.event, null, 2)}
                </pre>
              </details>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}