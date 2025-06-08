import { useQuery } from '@tanstack/react-query';
import { TrendingUp, MessageSquare, Users, Calendar } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNostr } from '@/hooks/useNostr';

import type { NostrFilter } from '@nostrify/nostrify';

interface EventStatsProps {
  className?: string;
  pubkey?: string; // If provided, shows stats for specific user
}

export function EventStats({ className, pubkey }: EventStatsProps) {
  const { nostr } = useNostr();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['event-stats', pubkey],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      
      const baseFilter: NostrFilter = { limit: 1000 };
      if (pubkey) {
        baseFilter.authors = [pubkey];
      }

      // Get different types of events
      const [notes, profiles, articles, calendarEvents] = await Promise.all([
        nostr.query([{ ...baseFilter, kinds: [1] }], { signal }),
        nostr.query([{ ...baseFilter, kinds: [0] }], { signal }),
        nostr.query([{ ...baseFilter, kinds: [30023] }], { signal }),
        nostr.query([{ ...baseFilter, kinds: [31922, 31923] }], { signal }),
      ]);

      // Calculate unique authors if not filtering by pubkey
      const uniqueAuthors = pubkey ? 1 : new Set([
        ...notes.map(e => e.pubkey),
        ...profiles.map(e => e.pubkey),
        ...articles.map(e => e.pubkey),
        ...calendarEvents.map(e => e.pubkey),
      ]).size;

      return {
        totalEvents: notes.length + profiles.length + articles.length + calendarEvents.length,
        notes: notes.length,
        profiles: profiles.length,
        articles: articles.length,
        calendarEvents: calendarEvents.length,
        uniqueAuthors,
      };
    },
    staleTime: 60000, // 1 minute
  });

  if (isLoading) {
    return (
      <div className={className}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-16" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const statCards = [
    {
      title: 'Total Events',
      value: stats.totalEvents,
      description: 'All published events',
      icon: TrendingUp,
      color: 'text-blue-600',
    },
    {
      title: 'Text Notes',
      value: stats.notes,
      description: 'Short text posts',
      icon: MessageSquare,
      color: 'text-green-600',
    },
    {
      title: pubkey ? 'Profile Updates' : 'Active Users',
      value: pubkey ? stats.profiles : stats.uniqueAuthors,
      description: pubkey ? 'Profile metadata updates' : 'Unique authors',
      icon: Users,
      color: 'text-purple-600',
    },
    {
      title: 'Articles & Events',
      value: stats.articles + stats.calendarEvents,
      description: 'Long-form content',
      icon: Calendar,
      color: 'text-orange-600',
    },
  ];

  return (
    <div className={className}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}