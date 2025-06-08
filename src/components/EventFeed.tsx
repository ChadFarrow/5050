import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Calendar, MessageSquare, FileText, User, Hash, Globe } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNostr } from '@/hooks/useNostr';
import { useAuthor } from '@/hooks/useAuthor';
import { NoteContent } from '@/components/NoteContent';
import { RelaySelector } from '@/components/RelaySelector';
import { genUserName } from '@/lib/genUserName';

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

interface EventFeedProps {
  className?: string;
  kinds?: number[];
  limit?: number;
  authors?: string[];
  since?: number;
  until?: number;
}

// Event kind labels and icons
const EVENT_KIND_INFO: Record<number, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  0: { label: 'Profile', icon: User, color: 'bg-blue-500' },
  1: { label: 'Note', icon: MessageSquare, color: 'bg-green-500' },
  3: { label: 'Contacts', icon: User, color: 'bg-purple-500' },
  30023: { label: 'Article', icon: FileText, color: 'bg-orange-500' },
  31922: { label: 'Calendar (Date)', icon: Calendar, color: 'bg-red-500' },
  31923: { label: 'Calendar (Time)', icon: Calendar, color: 'bg-red-600' },
  40: { label: 'Channel', icon: Hash, color: 'bg-indigo-500' },
  41: { label: 'Channel Meta', icon: Hash, color: 'bg-indigo-600' },
  42: { label: 'Channel Msg', icon: MessageSquare, color: 'bg-indigo-700' },
};

function EventCard({ event }: { event: NostrEvent }) {
  const author = useAuthor(event.pubkey);
  const metadata = author.data?.metadata;
  const kindInfo = EVENT_KIND_INFO[event.kind] || { 
    label: `Kind ${event.kind}`, 
    icon: Globe, 
    color: 'bg-gray-500' 
  };
  const Icon = kindInfo.icon;

  const displayName = metadata?.name || genUserName(event.pubkey);
  const profileImage = metadata?.picture;

  // Format content based on event kind
  const formatContent = (event: NostrEvent) => {
    if (event.kind === 0) {
      try {
        const profile = JSON.parse(event.content);
        return (
          <div className="space-y-2">
            <div><strong>Name:</strong> {profile.name || 'Not set'}</div>
            <div><strong>About:</strong> {profile.about || 'Not set'}</div>
            <div><strong>Website:</strong> {profile.website || 'Not set'}</div>
            <div><strong>NIP-05:</strong> {profile.nip05 || 'Not set'}</div>
          </div>
        );
      } catch {
        return <div className="text-muted-foreground">Invalid profile data</div>;
      }
    }

    if ([40, 41].includes(event.kind)) {
      try {
        const channelData = JSON.parse(event.content);
        return (
          <div className="space-y-2">
            <div><strong>Name:</strong> {channelData.name || 'Unnamed Channel'}</div>
            <div><strong>About:</strong> {channelData.about || 'No description'}</div>
          </div>
        );
      } catch {
        return <div className="text-muted-foreground">Invalid channel data</div>;
      }
    }

    // For text content (notes, articles, messages)
    if ([1, 30023, 42].includes(event.kind)) {
      return <NoteContent event={event} className="text-sm" />;
    }

    return <div className="text-muted-foreground">Content not displayable</div>;
  };

  // Extract relevant tags for display
  const getRelevantTags = (event: NostrEvent) => {
    const tags = event.tags || [];
    const relevantTags: { name: string; value: string }[] = [];

    tags.forEach(([name, value]) => {
      if (name === 'd' && value) {
        relevantTags.push({ name: 'ID', value });
      } else if (name === 'title' && value) {
        relevantTags.push({ name: 'Title', value });
      } else if (name === 'summary' && value) {
        relevantTags.push({ name: 'Summary', value });
      } else if (name === 'start' && value) {
        relevantTags.push({ name: 'Start', value });
      } else if (name === 'end' && value) {
        relevantTags.push({ name: 'End', value });
      } else if (name === 't' && value) {
        relevantTags.push({ name: 'Tag', value });
      }
    });

    return relevantTags.slice(0, 5); // Limit to 5 tags for display
  };

  const relevantTags = getRelevantTags(event);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold truncate">{displayName}</p>
                <Badge variant="outline" className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${kindInfo.color}`} />
                  <Icon className="h-3 w-3" />
                  {kindInfo.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(event.created_at * 1000), { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Event Content */}
          <div className="whitespace-pre-wrap break-words">
            {formatContent(event)}
          </div>

          {/* Relevant Tags */}
          {relevantTags.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Tags:</p>
              <div className="flex flex-wrap gap-1">
                {relevantTags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag.name}: {tag.value}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Event ID */}
          <div className="text-xs text-muted-foreground font-mono">
            ID: {event.id.slice(0, 16)}...
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EventFeedSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function EventFeed({ 
  className, 
  kinds = [0, 1, 3, 30023, 31922, 31923, 40, 41, 42], 
  limit = 20,
  authors,
  since,
  until 
}: EventFeedProps) {
  const { nostr } = useNostr();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: events, isLoading, error, refetch } = useQuery({
    queryKey: ['event-feed', kinds, limit, authors, since, until, refreshKey],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
      
      const filter: NostrFilter = {
        kinds,
        limit,
      };

      if (authors) filter.authors = authors;
      if (since) filter.since = since;
      if (until) filter.until = until;

      const events = await nostr.query([filter], { signal });
      
      // Sort by created_at descending (newest first)
      return events.sort((a, b) => b.created_at - a.created_at);
    },
    staleTime: 30000, // 30 seconds
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  if (error) {
    return (
      <div className={className}>
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-6">
              <p className="text-muted-foreground">
                Failed to load events. Try another relay?
              </p>
              <RelaySelector className="w-full" />
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={className}>
        <EventFeedSkeleton />
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className={className}>
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-6">
              <p className="text-muted-foreground">
                No events found. Try another relay?
              </p>
              <RelaySelector className="w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Event Feed</h2>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <div className="space-y-4">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}