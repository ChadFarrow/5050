import { User, MessageCircle, Ticket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatSats } from "@/lib/utils";
import { useAuthorDisplay } from "@/lib/shared-utils";
import type { TicketPurchase } from "@/hooks/useCampaignStats";

interface ParticipantsListProps {
  purchases: TicketPurchase[];
}

export function ParticipantsList({ purchases }: ParticipantsListProps) {
  if (purchases.length === 0) {
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
            No participants yet. Be the first to buy tickets!
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
          <Badge variant="secondary">{purchases.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {purchases.map((purchase) => (
          <ParticipantItem key={purchase.id} purchase={purchase} />
        ))}
      </CardContent>
    </Card>
  );
}

function ParticipantItem({ purchase }: { purchase: TicketPurchase }) {
  const { displayName, profileImage } = useAuthorDisplay(purchase.pubkey);
  const purchaseDate = new Date(purchase.createdAt * 1000);

  return (
    <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card">
      <Avatar className="h-10 w-10">
        <AvatarImage src={profileImage} alt={displayName} />
        <AvatarFallback>
          <User className="h-5 w-5" />
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-medium">{displayName}</div>
          <div className="text-xs text-muted-foreground">
            {purchaseDate.toLocaleDateString()}
          </div>
        </div>
        
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center text-muted-foreground">
            <Ticket className="h-4 w-4 mr-1" />
            {purchase.tickets} ticket{purchase.tickets > 1 ? 's' : ''}
          </div>
          <div className="text-muted-foreground">
            {formatSats(purchase.amount)}
          </div>
        </div>
        
        {purchase.message && (
          <div className="flex items-start space-x-2 mt-2">
            <MessageCircle className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground italic">
              "{purchase.message}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}