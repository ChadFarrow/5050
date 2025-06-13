import { useParams, Navigate } from "react-router-dom";
import { nip19 } from "nostr-tools";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFundraiser } from "@/hooks/useCampaigns";
import { useCampaignStats } from "@/hooks/useCampaignStats";
import { CampaignHeader } from "@/components/campaign/CampaignHeader";
import { WinnerDisplay } from "@/components/campaign/WinnerDisplay";
import { DrawWinnerCard } from "@/components/campaign/DrawWinnerCard";
import { ParticipantsList } from "@/components/campaign/ParticipantsList";
import { CampaignSidebar } from "@/components/campaign/CampaignSidebar";
import { CampaignSkeleton } from "@/components/campaign/CampaignSkeleton";
import { TestModeToggle } from "@/components/TestModeToggle";
import { AddLightningAddress } from "@/components/AddLightningAddress";

export default function Campaign() {
  const { nip19: nip19Param } = useParams<{ nip19: string }>();

  // Parse the naddr to get pubkey and dTag
  let pubkey = '';
  let dTag = '';
  let isValid = false;

  if (nip19Param) {
    try {
      const decoded = nip19.decode(nip19Param);
      if (decoded.type === 'naddr' && decoded.data.kind === 31950) {
        pubkey = decoded.data.pubkey;
        dTag = decoded.data.identifier;
        isValid = true;
      }
    } catch {
      // Invalid nip19 - will show 404
    }
  }

  const { data: campaign, isLoading: campaignLoading, error } = useFundraiser(pubkey, dTag);
  const { data: stats } = useCampaignStats(pubkey, dTag);

  if (!nip19Param || !isValid) {
    return <Navigate to="/404" replace />;
  }

  if (campaignLoading) {
    return <CampaignSkeleton />;
  }

  if (error || !campaign) {
    return <Navigate to="/404" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-950">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Button variant="ghost" asChild>
            <a href="/" className="flex items-center">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Campaigns
            </a>
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <CampaignHeader campaign={campaign} stats={stats} />
            
            {stats?.result && (
              <WinnerDisplay result={stats.result} />
            )}
            
            {stats && (
              <DrawWinnerCard campaign={campaign} stats={stats} />
            )}
            
            <ParticipantsList purchases={stats?.purchases || []} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <TestModeToggle />
            <AddLightningAddress campaign={campaign} />
            <CampaignSidebar campaign={campaign} stats={stats} />
          </div>
        </div>
      </div>
    </div>
  );
}