import { User, MessageCircle, Ticket, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatSats } from "@/lib/utils";
import { useAuthorDisplay } from "@/lib/shared-utils";
import type { TicketPurchase, Donation } from "@/hooks/useCampaignStats";

// Combined type for participants (both purchases and donations)
export interface Participant {
  id: string;
  pubkey: string;
  amount: number; // millisats
  createdAt: number;
  message?: string;
  type: 'purchase' | 'donation';
  tickets?: number; // Only for purchases
  isAnonymous?: boolean; // Only for donations
}

interface ParticipantsListProps {
  purchases: TicketPurchase[];
  donations: Donation[];
}

export function ParticipantsList({ purchases, donations }: ParticipantsListProps) {
  console.log('🔍 ParticipantsList received:', { 
    purchases: purchases.length, 
    donations: donations.length,
    purchasesSample: purchases.slice(0, 2),
    donationsSample: donations.slice(0, 2)
  });

  // Convert purchases and donations to unified participant format
  const participants: Participant[] = [
    ...purchases.map((purchase): Participant => ({
      id: purchase.id,
      pubkey: purchase.pubkey,
      amount: purchase.amount,
      createdAt: purchase.createdAt,
      message: purchase.message,
      type: 'purchase',
      tickets: purchase.tickets,
    })),
    ...donations.map((donation): Participant => ({
      id: donation.id,
      pubkey: donation.pubkey,
      amount: donation.amount,
      createdAt: donation.createdAt,
      message: donation.message,
      type: 'donation',
      isAnonymous: donation.isAnonymous,
    })),
  ].sort((a, b) => a.createdAt - b.createdAt); // Sort by creation time
  
  if (participants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Participants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No participants yet. Be the first to buy tickets or make a donation!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Participants
          </div>
          <Badge variant="secondary">{participants.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {participants.map((participant) => (
          <ParticipantItem key={participant.id} participant={participant} />
        ))}
      </CardContent>
    </Card>
  );
}

function ParticipantItem({ participant }: { participant: Participant }) {
  const shouldShowIdentity = !participant.isAnonymous;
  const { displayName, profileImage } = useAuthorDisplay(shouldShowIdentity ? participant.pubkey : '');
  const participantDate = new Date(participant.createdAt * 1000);
  
  const finalDisplayName = shouldShowIdentity ? displayName : 'Anonymous Donor';
  const finalProfileImage = shouldShowIdentity ? profileImage : undefined;

  return (
    <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card">
      <Avatar className="h-10 w-10">
        <AvatarImage src={finalProfileImage} alt={finalDisplayName} />
        <AvatarFallback>
          <User className="h-5 w-5" />
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-medium">{finalDisplayName}</div>
          <div className="text-xs text-muted-foreground">
            {participantDate.toLocaleDateString()}
          </div>
        </div>
        
        <div className="flex items-center space-x-4 text-sm">
          {participant.type === 'purchase' ? (
            <div className="flex items-center text-muted-foreground">
              <Ticket className="h-4 w-4 mr-1" />
              {participant.tickets} ticket{(participant.tickets || 0) > 1 ? 's' : ''}
            </div>
          ) : (
            <div className="flex items-center text-pink-600">
              <Heart className="h-4 w-4 mr-1" />
              Prize Pool Donation
            </div>
          )}
          <div className="text-muted-foreground">
            {formatSats(participant.amount)}
          </div>
        </div>
        
        {participant.message && (
          <div className="flex items-start space-x-2 mt-2">
            <MessageCircle className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground italic">
              "{participant.message}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}