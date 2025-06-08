import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { nanoid } from 'nanoid';

export function CreateFundraiserPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [cause, setCause] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      const fundraiserId = nanoid();
      const fundraiser = {
        id: fundraiserId,
        title,
        description,
        goal: parseInt(goal),
        raised: 0,
        organizer: user.pubkey,
        cause,
        createdAt: Math.floor(Date.now() / 1000),
      };

      await useNostrPublish().mutate({
        kind: 30050,
        content: JSON.stringify(fundraiser),
        tags: [
          ['d', fundraiserId],
        ],
      });

      navigate(`/fundraiser/${fundraiserId}`);
    } catch (error) {
      console.error('Failed to create fundraiser:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Please connect your wallet to create a fundraiser
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create a 50/50 Fundraiser</CardTitle>
          <CardDescription>
            Create a new fundraiser and split the proceeds 50/50 with your chosen cause
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title
              </label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter fundraiser title"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your fundraiser"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="goal" className="text-sm font-medium">
                Fundraising Goal (sats)
              </label>
              <Input
                id="goal"
                type="number"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Enter amount in sats"
                required
                min="1000"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="cause" className="text-sm font-medium">
                Cause
              </label>
              <Input
                id="cause"
                value={cause}
                onChange={(e) => setCause(e.target.value)}
                placeholder="Enter the cause or organization"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Fundraiser'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 