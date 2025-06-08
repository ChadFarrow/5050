import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EventPublisher } from '@/components/EventPublisher';
import { QuickNotePublisher } from '@/components/QuickNotePublisher';
import { EventFeed } from '@/components/EventFeed';
import { EventStats } from '@/components/EventStats';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function Publish() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { user } = useCurrentUser();

  const handleEventPublished = () => {
    // Refresh the feed when a new event is published
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Publish to Nostr</h1>
          <p className="text-muted-foreground">
            Share your thoughts, create events, and interact with the Nostr network
          </p>
        </div>

        {/* Publishing Interface */}
        <Tabs defaultValue="quick" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick">Quick Note</TabsTrigger>
            <TabsTrigger value="advanced">Advanced Events</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Note Publisher</CardTitle>
                <CardDescription>
                  Share a quick text note with optional file attachments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QuickNotePublisher onNotePublished={handleEventPublished} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Event Publisher</CardTitle>
                <CardDescription>
                  Create and publish various types of Nostr events including profiles, articles, calendar events, and more
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <EventPublisher onEventPublished={handleEventPublished} />
              </CardContent>
            </Card>

            {/* Event Type Information */}
            <Card>
              <CardHeader>
                <CardTitle>Supported Event Types</CardTitle>
                <CardDescription>
                  Learn about the different types of events you can publish
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Basic Events</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li><strong>Text Note (1):</strong> Short text posts and status updates</li>
                      <li><strong>Profile Metadata (0):</strong> Update your profile information</li>
                      <li><strong>Contact List (3):</strong> Your follow list</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Advanced Events</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li><strong>Long-form Article (30023):</strong> Blog posts and articles</li>
                      <li><strong>Calendar Events (31922/31923):</strong> Date and time-based events</li>
                      <li><strong>Channels (40/41/42):</strong> Create and manage chat channels</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Event Statistics */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">
            {user ? 'Your Publishing Stats' : 'Network Activity'}
          </h2>
          <EventStats pubkey={user?.pubkey} />
        </div>

        {/* Recent Events Feed */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Recent Events</h2>
          <EventFeed 
            key={refreshKey}
            className="w-full"
            limit={10}
            authors={user ? [user.pubkey] : undefined}
          />
        </div>
      </div>
    </div>
  );
}