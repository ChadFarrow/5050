import { useState } from 'react';
import { Send, Image, Paperclip } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useUploadFile } from '@/hooks/useUploadFile';
import { LoginArea } from '@/components/auth/LoginArea';

import type { NostrEvent } from '@nostrify/nostrify';

interface QuickNotePublisherProps {
  className?: string;
  placeholder?: string;
  onNotePublished?: (event: NostrEvent) => void;
}

export function QuickNotePublisher({ 
  className, 
  placeholder = "What's happening?",
  onNotePublished 
}: QuickNotePublisherProps) {
  const [content, setContent] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending: isPublishing } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const tags = await uploadFile(file);
        return tags[0][1]; // Get the URL from the first tag
      });

      const urls = await Promise.all(uploadPromises);
      setAttachedFiles(prev => [...prev, ...urls]);
      
      toast({
        title: 'Files Uploaded',
        description: `Successfully uploaded ${files.length} file(s).`,
      });
    } catch (error) {
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload files.',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to publish notes.',
        variant: 'destructive',
      });
      return;
    }

    if (!content.trim() && attachedFiles.length === 0) {
      toast({
        title: 'Empty Note',
        description: 'Please add some content or attach files.',
        variant: 'destructive',
      });
      return;
    }

    // Combine content with attached file URLs
    let finalContent = content;
    if (attachedFiles.length > 0) {
      const fileUrls = attachedFiles.join('\n');
      finalContent = content ? `${content}\n\n${fileUrls}` : fileUrls;
    }

    // Create imeta tags for attached files
    const imetaTags = attachedFiles.map(url => ['imeta', `url ${url}`]);

    publishEvent(
      {
        kind: 1,
        content: finalContent,
        tags: imetaTags,
      },
      {
        onSuccess: (event) => {
          toast({
            title: 'Note Published',
            description: 'Your note has been published successfully.',
          });
          setContent('');
          setAttachedFiles([]);
          onNotePublished?.(event);
        },
        onError: (error) => {
          toast({
            title: 'Publishing Failed',
            description: error instanceof Error ? error.message : 'Failed to publish note.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const isLoading = isPublishing || isUploading;

  if (!user) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Share a Note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-center">Log in to share your thoughts</p>
          <LoginArea className="max-w-60 mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Share a Note</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className="min-h-[100px] resize-none"
          disabled={isLoading}
        />

        {/* Attached Files */}
        {attachedFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Attached Files:</p>
            <div className="space-y-1">
              {attachedFiles.map((url, index) => (
                <div key={index} className="flex items-center justify-between bg-muted p-2 rounded text-sm">
                  <span className="truncate flex-1 mr-2">{url}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    disabled={isLoading}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {/* File Upload */}
            <label>
              <input
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.pdf,.txt,.md"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                asChild
              >
                <span>
                  <Paperclip className="h-4 w-4 mr-1" />
                  Attach
                </span>
              </Button>
            </label>

            {/* Image Upload */}
            <label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                asChild
              >
                <span>
                  <Image className="h-4 w-4 mr-1" />
                  Image
                </span>
              </Button>
            </label>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isLoading || (!content.trim() && attachedFiles.length === 0)}
            size="sm"
          >
            {isLoading ? (
              'Publishing...'
            ) : (
              <>
                <Send className="h-4 w-4 mr-1" />
                Publish
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          Character count: {content.length}
        </div>
      </CardContent>
    </Card>
  );
}