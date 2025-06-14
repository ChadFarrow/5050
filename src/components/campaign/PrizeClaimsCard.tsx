import { useState } from "react";
import { Gift, Copy, Check, User, Clock, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePrizeClaims } from "@/hooks/usePrizeClaims";
import { useToastUtils } from "@/lib/shared-utils";
import { useAuthorDisplay } from "@/lib/shared-utils";
import { formatSats } from "@/lib/utils";
import { ConfirmPayoutButton } from "./ConfirmPayoutButton";
import type { Campaign } from "@/hooks/useCampaigns";
import type { CampaignResult } from "@/hooks/useCampaignStats";

interface PrizeClaimsCardProps {
  campaign: Campaign;
  result: CampaignResult;
}

export function PrizeClaimsCard({ campaign, result }: PrizeClaimsCardProps) {
  const { user } = useCurrentUser();
  const { data: claims, isLoading } = usePrizeClaims(campaign.pubkey, campaign.dTag);
  const toast = useToastUtils();
  const [copiedPayment, setCopiedPayment] = useState<string | null>(null);

  // Check if current user is the campaign creator
  const isCreator = user?.pubkey === campaign.pubkey;
  
  if (!isCreator || isLoading) {
    return null;
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPayment(id);
    toast.success("Copied!", "Payment information copied to clipboard");
    setTimeout(() => setCopiedPayment(null), 2000);
  };

  const openLightningAddress = (address: string) => {
    // Attempt to open with lightning: protocol, fallback to LNURL service
    const lightningUrl = `lightning:${address}`;
    window.open(lightningUrl, '_blank');
  };

  if (!claims || claims.length === 0) {
    return (
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950 dark:to-yellow-950">
        <CardHeader>
          <CardTitle className="flex items-center text-orange-800 dark:text-orange-200">
            <Gift className="h-5 w-5 mr-2" />
            Prize Claims
          </CardTitle>
          <CardDescription>
            When the winner claims their prize, their payment information will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              No prize claims yet. The winner will be notified automatically and can claim their prize by visiting this campaign page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-200 bg-gradient-to-r from-green-50 to-yellow-50 dark:from-green-950 dark:to-yellow-950">
      <CardHeader>
        <CardTitle className="flex items-center text-green-800 dark:text-green-200">
          <Gift className="h-5 w-5 mr-2" />
          Prize Claims ({claims.length})
        </CardTitle>
        <CardDescription>
          The winner has submitted their payment information. Send the prize amount to complete the payout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {claims.map((claim) => (
          <ClaimItem
            key={claim.id}
            claim={claim}
            result={result}
            onCopy={copyToClipboard}
            onOpenLightning={openLightningAddress}
            isCopied={copiedPayment === claim.id}
          />
        ))}
        
        <ConfirmPayoutButton 
          campaign={campaign} 
          result={result} 
          hasValidClaims={claims.length > 0} 
        />
      </CardContent>
    </Card>
  );
}

interface ClaimItemProps {
  claim: {
    id: string;
    pubkey: string;
    paymentMethod: "lnaddress" | "invoice";
    paymentInfo: string;
    message?: string;
    createdAt: number;
  };
  result: CampaignResult;
  onCopy: (text: string, id: string) => void;
  onOpenLightning: (address: string) => void;
  isCopied: boolean;
}

function ClaimItem({ claim, result, onCopy, onOpenLightning, isCopied }: ClaimItemProps) {
  const { displayName, profileImage } = useAuthorDisplay(claim.pubkey);
  const claimDate = new Date(claim.createdAt * 1000);
  
  return (
    <div className="p-4 border rounded-lg bg-background/50">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback>
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{displayName}</div>
            <div className="text-sm text-muted-foreground">
              Claimed {claimDate.toLocaleString()}
            </div>
          </div>
        </div>
        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          {claim.paymentMethod === "lnaddress" ? "Lightning Address" : "Lightning Invoice"}
        </Badge>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-sm font-medium text-muted-foreground mb-1">
            Prize Amount to Send:
          </div>
          <div className="text-lg font-semibold text-green-600">
            {formatSats(result.winnerAmount)}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-muted-foreground mb-1">
            Payment Information:
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
              {claim.paymentInfo}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onCopy(claim.paymentInfo, claim.id)}
            >
              {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            {claim.paymentMethod === "lnaddress" && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => onOpenLightning(claim.paymentInfo)}
                title="Open with Lightning wallet"
              >
                <Zap className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {claim.message && (
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Message from Winner:
            </div>
            <div className="p-2 bg-muted rounded text-sm italic">
              "{claim.message}"
            </div>
          </div>
        )}

        <Separator />

        <Alert>
          <Zap className="h-4 w-4" />
          <AlertDescription>
            {claim.paymentMethod === "lnaddress" 
              ? `Send ${formatSats(result.winnerAmount)} to the Lightning address above using your wallet or NWC connection.`
              : `Pay the Lightning invoice above for ${formatSats(result.winnerAmount)} using your wallet.`
            }
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}