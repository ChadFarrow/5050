import { Trophy, Calendar, User, Hash, Zap, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatSats } from "@/lib/utils";
import { useAuthorDisplay, createNostrProfileUrl, useToastUtils } from "@/lib/shared-utils";
import { usePrizeClaims } from "@/hooks/usePrizeClaims";
import type { CampaignResult } from "@/hooks/useCampaignStats";

interface WinnerDisplayProps {
  result: CampaignResult;
  campaignPubkey: string;
  campaignDTag: string;
}

export function WinnerDisplay({ result, campaignPubkey, campaignDTag }: WinnerDisplayProps) {
  const { displayName, profileImage } = useAuthorDisplay(result.winnerPubkey);
  const { data: prizeClaims, isLoading, error } = usePrizeClaims(campaignPubkey, campaignDTag);
  const toast = useToastUtils();
  const resultDate = new Date(result.createdAt * 1000);
  
  // Check if this was automatically drawn
  const isAutoDrawn = result.event.tags.some(tag => tag[0] === 'auto_drawn' && tag[1] === 'true');
  
  // Check if payout has been confirmed
  const payoutConfirmed = result.event.tags.some(tag => tag[0] === 'payout_confirmed');
  
  // Check if manually completed
  const manuallyCompleted = result.event.tags.some(tag => tag[0] === 'manual_completed');
  
  // Find the winner's prize claim
  const winnerClaim = prizeClaims?.find(claim => 
    claim.pubkey === result.winnerPubkey && 
    claim.resultEventId === result.id
  );


  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!", "Payment information copied to clipboard");
  };

  return (
    <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950 border-yellow-200 dark:border-yellow-800">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-yellow-800 dark:text-yellow-200">
          <div className="flex items-center">
            <Trophy className="h-5 w-5 mr-2" />
            Winner Announced!
          </div>
          <div className="flex gap-2">
            {isAutoDrawn && (
              <div className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                Auto-drawn
              </div>
            )}
            {payoutConfirmed && (
              <div className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                ✅ Paid
              </div>
            )}
            {manuallyCompleted && !payoutConfirmed && (
              <div className="text-xs bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 px-2 py-1 rounded">
                ✅ Completed
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={profileImage} alt={displayName} />
            <AvatarFallback>
              <User className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <a 
              href={createNostrProfileUrl(result.winnerPubkey)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-purple-600 transition-colors"
            >
              {displayName}
            </a>
            <div className="text-sm text-muted-foreground">
              Won {formatSats(result.winnerAmount)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center text-muted-foreground">
              <Hash className="h-4 w-4 mr-1" />
              Winning Ticket
            </div>
            <div className="font-medium">#{result.winningTicket}</div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center text-muted-foreground">
              <Calendar className="h-4 w-4 mr-1" />
              Announced
            </div>
            <div className="font-medium">{resultDate.toLocaleDateString()}</div>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <div className="flex justify-between text-sm">
            <span>Total Raised:</span>
            <span className="font-medium">{formatSats(result.totalRaised)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Winner's Prize:</span>
            <span className="font-medium text-green-600">{formatSats(result.winnerAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Creator's Share:</span>
            <span className="font-medium">{formatSats(result.creatorAmount)}</span>
          </div>
        </div>

        {result.message && (
          <div className="mt-4 p-3 bg-background/50 rounded-lg">
            <p className="text-sm italic">"{result.message}"</p>
          </div>
        )}

        {isLoading && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-sm text-muted-foreground">Checking for payment information...</span>
            </div>
          </div>
        )}

        {!isLoading && winnerClaim && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <Zap className="h-4 w-4 mr-2 text-blue-600" />
                <span className="font-medium text-blue-800 dark:text-blue-200">
                  Payment Information Submitted
                </span>
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                {winnerClaim.paymentMethod === "lnaddress" ? "Lightning Address" : "Lightning Invoice"}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-sm bg-white dark:bg-gray-900 p-2 rounded border break-all">
                  {winnerClaim.paymentInfo}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(winnerClaim.paymentInfo)}
                  className="flex-shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              
              {winnerClaim.message && (
                <div className="text-sm text-muted-foreground italic">
                  Message: "{winnerClaim.message}"
                </div>
              )}
            </div>
          </div>
        )}

        {!isLoading && !winnerClaim && prizeClaims && prizeClaims.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              Prize claims found but none match this winner. Debug info: {prizeClaims.length} claims total.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}