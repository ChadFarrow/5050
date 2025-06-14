import { Trophy, Calendar, User, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatSats } from "@/lib/utils";
import { useAuthorDisplay } from "@/lib/shared-utils";
import type { CampaignResult } from "@/hooks/useCampaignStats";

interface WinnerDisplayProps {
  result: CampaignResult;
}

export function WinnerDisplay({ result }: WinnerDisplayProps) {
  const { displayName, profileImage } = useAuthorDisplay(result.winnerPubkey);
  const resultDate = new Date(result.createdAt * 1000);
  
  // Check if this was automatically drawn
  const isAutoDrawn = result.event.tags.some(tag => tag[0] === 'auto_drawn' && tag[1] === 'true');
  
  // Check if payout has been confirmed
  const payoutConfirmed = result.event.tags.some(tag => tag[0] === 'payout_confirmed');
  
  // Check if manually completed
  const manuallyCompleted = result.event.tags.some(tag => tag[0] === 'manual_completed');

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
            <div className="font-medium">{displayName}</div>
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
      </CardContent>
    </Card>
  );
}