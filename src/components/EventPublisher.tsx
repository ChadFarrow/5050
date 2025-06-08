import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusCircle, Send, FileText, MessageSquare, Calendar, Hash, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { LoginArea } from '@/components/auth/LoginArea';

import type { NostrEvent } from '@nostrify/nostrify';

// Event kind definitions with descriptions
const EVENT_KINDS = [
  { value: 1, label: 'Text Note', description: 'Short text note or status update', icon: MessageSquare },
  { value: 0, label: 'Profile Metadata', description: 'Update your profile information', icon: User },
  { value: 3, label: 'Contact List', description: 'Your follow list', icon: User },
  { value: 30023, label: 'Long-form Article', description: 'Blog post or article', icon: FileText },
  { value: 31922, label: 'Calendar Event (Date)', description: 'Date-based calendar event', icon: Calendar },
  { value: 31923, label: 'Calendar Event (Time)', description: 'Time-based calendar event', icon: Calendar },
  { value: 40, label: 'Channel Creation', description: 'Create a new chat channel', icon: Hash },
  { value: 41, label: 'Channel Metadata', description: 'Update channel information', icon: Hash },
  { value: 42, label: 'Channel Message', description: 'Message in a channel', icon: MessageSquare },
] as const;

// Form schema for event publishing
const eventSchema = z.object({
  kind: z.number(),
  content: z.string(),
  tags: z.string().optional(),
  created_at: z.number().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

interface EventPublisherProps {
  className?: string;
  defaultKind?: number;
  onEventPublished?: (event: NostrEvent) => void;
}

export function EventPublisher({ className, defaultKind = 1, onEventPublished }: EventPublisherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedKind, setSelectedKind] = useState(defaultKind);
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      kind: defaultKind,
      content: '',
      tags: '',
    },
  });

  const selectedEventType = EVENT_KINDS.find(k => k.value === selectedKind);

  const handleSubmit = (data: EventFormData) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to publish events.',
        variant: 'destructive',
      });
      return;
    }

    // Parse tags from string format
    let parsedTags: string[][] = [];
    if (data.tags) {
      try {
        // Support both JSON array format and simple comma-separated format
        if (data.tags.trim().startsWith('[')) {
          parsedTags = JSON.parse(data.tags);
        } else {
          // Simple format: "tag1,tag2,tag3" becomes [["t", "tag1"], ["t", "tag2"], ["t", "tag3"]]
          parsedTags = data.tags.split(',').map(tag => ['t', tag.trim()]).filter(([, value]) => value);
        }
      } catch {
        toast({
          title: 'Invalid Tags Format',
          description: 'Tags should be in JSON format like [["t", "tag1"], ["p", "pubkey"]] or comma-separated like "tag1,tag2"',
          variant: 'destructive',
        });
        return;
      }
    }

    // Add special handling for different event kinds
    if (selectedKind === 30023) {
      // Long-form article needs a "d" tag for identifier
      const dTag = parsedTags.find(([name]) => name === 'd');
      if (!dTag) {
        const identifier = Date.now().toString();
        parsedTags.push(['d', identifier]);
      }
    }

    publishEvent(
      {
        kind: selectedKind,
        content: data.content,
        tags: parsedTags,
        created_at: data.created_at || Math.floor(Date.now() / 1000),
      },
      {
        onSuccess: (event) => {
          toast({
            title: 'Event Published',
            description: `Successfully published ${selectedEventType?.label || 'event'}.`,
          });
          setIsOpen(false);
          form.reset();
          onEventPublished?.(event);
        },
        onError: (error) => {
          toast({
            title: 'Publishing Failed',
            description: error instanceof Error ? error.message : 'Failed to publish event.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const getPlaceholderContent = () => {
    switch (selectedKind) {
      case 0:
        return '{"name":"Your Name","about":"About you","picture":"https://...","nip05":"you@domain.com"}';
      case 1:
        return 'What\'s on your mind?';
      case 30023:
        return 'Write your article content here...';
      case 31922:
        return 'Calendar event description';
      case 31923:
        return 'Calendar event description';
      case 40:
        return '{"name":"Channel Name","about":"Channel description","picture":"https://..."}';
      case 41:
        return '{"name":"Updated Channel Name","about":"Updated description"}';
      case 42:
        return 'Your message in the channel';
      default:
        return 'Event content...';
    }
  };

  const getTagsPlaceholder = () => {
    switch (selectedKind) {
      case 30023:
        return '[["d","article-identifier"],["title","Article Title"],["summary","Brief summary"],["t","tag1"],["t","tag2"]]';
      case 31922:
        return '[["d","event-id"],["title","Event Title"],["start","2024-12-25"],["end","2024-12-26"]]';
      case 31923:
        return '[["d","event-id"],["title","Event Title"],["start","1703520000"],["end","1703523600"]]';
      case 40:
        return '[]';
      case 41:
        return '[["e","channel-event-id","","root"]]';
      case 42:
        return '[["e","channel-event-id","","root"],["p","pubkey"]]';
      default:
        return '[["t","tag1"],["t","tag2"]] or tag1,tag2,tag3';
    }
  };

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="py-6">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Log in to publish Nostr events</p>
            <LoginArea className="max-w-60 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className={className}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Publish Event
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish Nostr Event</DialogTitle>
          <DialogDescription>
            Create and publish events to the Nostr network. Choose an event type and fill in the details.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Event Kind Selection */}
            <div className="space-y-3">
              <FormLabel>Event Type</FormLabel>
              <Select value={selectedKind.toString()} onValueChange={(value) => setSelectedKind(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_KINDS.map((kind) => {
                    const Icon = kind.icon;
                    return (
                      <SelectItem key={kind.value} value={kind.value.toString()}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <div className="flex flex-col">
                            <span className="font-medium">{kind.label}</span>
                            <span className="text-xs text-muted-foreground">{kind.description}</span>
                          </div>
                          <Badge variant="outline" className="ml-auto">
                            {kind.value}
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedEventType && (
                <p className="text-sm text-muted-foreground">
                  {selectedEventType.description}
                </p>
              )}
            </div>

            <Separator />

            {/* Content Field */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={getPlaceholderContent()}
                      className="min-h-[120px] resize-y"
                    />
                  </FormControl>
                  <FormDescription>
                    {selectedKind === 0 && 'Profile metadata should be valid JSON'}
                    {selectedKind === 1 && 'Your text note content'}
                    {selectedKind === 30023 && 'Article content (supports markdown)'}
                    {[40, 41].includes(selectedKind) && 'Channel metadata should be valid JSON'}
                    {selectedKind === 42 && 'Your message content'}
                    {[31922, 31923].includes(selectedKind) && 'Event description and details'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tags Field */}
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={getTagsPlaceholder()}
                      className="min-h-[80px] resize-y font-mono text-sm"
                    />
                  </FormControl>
                  <FormDescription>
                    Tags as JSON array format: [["tag_name", "value"]] or simple comma-separated: tag1,tag2
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Timestamp Field */}
            <FormField
              control={form.control}
              name="created_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timestamp (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      placeholder={Math.floor(Date.now() / 1000).toString()}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormDescription>
                    Unix timestamp. Leave empty to use current time.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>Publishing...</>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Publish Event
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}