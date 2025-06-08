import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';

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

export function HomePage() {
  const { nostr } = useNostr();

  // Fetch all fundraisers
  const { data: fundraisers = [] } = useQuery({
    queryKey: ['fundraisers'],
    queryFn: async () => {
      const events = await nostr.query([
        { kinds: [30050], limit: 20 }
      ]);
      return events.map(event => JSON.parse(event.content) as Fundraiser);
    },
  });

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">50/50 Fundraisers</h1>
        <Button asChild>
          <Link to="/create">Create Fundraiser</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {fundraisers.map((fundraiser) => {
          const organizer = useAuthor(fundraiser.organizer);
          const progress = (fundraiser.raised / fundraiser.goal) * 100;

          return (
            <Link key={fundraiser.id} to={`/fundraiser/${fundraiser.id}`}>
              <Card className="h-full hover:border-primary transition-colors">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{fundraiser.title}</CardTitle>
                  <CardDescription>
                    by {organizer.data?.metadata?.name || genUserName(fundraiser.organizer)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {fundraiser.description}
                    </p>
                    
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

                    <div className="text-sm text-muted-foreground">
                      Supporting: {fundraiser.cause}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {fundraisers.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              No active fundraisers found
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 