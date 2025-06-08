import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useAuthor } from '@/hooks/useAuthor';
import { useNip47Wallet } from '@/hooks/useNip47Wallet';
import { genUserName } from '@/lib/genUserName';
import { toast } from 'sonner';

interface Fundraiser {
  id: string;
  title: string;
  description: string;
  goal: number;
  raised: number;
  organizer: string;
  cause: string;
  createdAt: number;
}

export function FundraiserPage() {
  const { id } = useParams<{ id: string }>();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { connected, connect, makeInvoice } = useNip47Wallet();
  const [amount, setAmount] = useState<number>(1000); // Default 1000 sats
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch fundraiser details
  const { data: fundraiser } = useQuery({
    queryKey: ['fundraiser', id],
    queryFn: async () => {
      const events = await nostr.query([
        { kinds: [30050], '#d': [id || ''], limit: 1 }
      ]);
      if (events.length === 0) return null;
      return JSON.parse(events[0].content) as Fundraiser;
    },
  });

  const organizer = useAuthor(fundraiser?.organizer || '');
  const progress = fundraiser ? (fundraiser.raised / fundraiser.goal) * 100 : 0;

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Wallet connected successfully');
    } catch (error) {
      toast.error('Failed to connect wallet');
      console.error(error);
    }
  };

  const handleDonate = async () => {
    if (!user || !fundraiser) return;
    
    setIsProcessing(true);
    try {
      if (!connected) {
        await connect();
      }

      // Create a payment request
      const invoice = await makeInvoice({
        amount,
        description: `Donation to ${fundraiser.title}`,
      });

      // Publish the donation event
      await useNostrPublish().mutate({
        kind: 30051,
        content: JSON.stringify({
          fundraiserId: id,
          amount,
          invoice,
        }),
        tags: [
          ['e', id || ''],
          ['p', fundraiser.organizer],
        ],
      });

      toast.success('Donation event published successfully');
    } catch (error) {
      toast.error('Failed to process donation');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!fundraiser) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Fundraiser not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>{fundraiser.title}</CardTitle>
          <CardDescription>
            Organized by {organizer.data?.metadata?.name || genUserName(fundraiser.organizer)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <p className="text-muted-foreground">{fundraiser.description}</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progress.toFixed(1)}%</span>
              </div>
              <Progress value={progress} />
              <div className="flex justify-between text-sm">
                <span>{fundraiser.raised} sats raised</span>
                <span>Goal: {fundraiser.goal} sats</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  onClick={() => setAmount(1000)}
                  className={amount === 1000 ? 'border-primary' : ''}
                >
                  1,000 sats
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAmount(5000)}
                  className={amount === 5000 ? 'border-primary' : ''}
                >
                  5,000 sats
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAmount(10000)}
                  className={amount === 10000 ? 'border-primary' : ''}
                >
                  10,000 sats
                </Button>
              </div>

              {!user ? (
                <Button className="w-full" onClick={handleConnect}>
                  Connect Wallet
                </Button>
              ) : !connected ? (
                <Button className="w-full" onClick={handleConnect}>
                  Connect Lightning Wallet
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleDonate}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'Donate Now'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 