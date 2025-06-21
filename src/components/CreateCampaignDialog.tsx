import { useState, useEffect } from "react";
import { CalendarIcon, ImageIcon, Loader2, Clock, Zap } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/hooks/useWallet';
import { announceFundraiserCreated } from '@/lib/nostr-bot-serverless';
import { useAuthorDisplay } from '@/lib/shared-utils';

interface CreateFundraiserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editCampaign?: {
    title: string;
    description: string;
    content: string;
    podcast: string;
    podcastUrl?: string;
    episode?: string;
    target?: number;
    ticketPrice: number;
    endDate?: number;
    image?: string;
    manualDraw: boolean;
    nwc?: string;
    dTag: string;
  };
}

interface FundraiserForm {
  title: string;
  description: string;
  content: string;
  podcast: string;
  podcastUrl: string;
  episode: string;
  target: string;
  ticketPrice: string;
  endDate: Date | undefined;
  useDuration: boolean;
  durationValue: string;
  durationUnit: string;
  image: string;
  manualWinnerDraw: boolean;
  nwcConnection: string;
}

const initialForm: FundraiserForm = {
  title: "",
  description: "",
  content: "",
  podcast: "",
  podcastUrl: "",
  episode: "",
  target: "",
  ticketPrice: "",
  endDate: undefined,
  useDuration: false,
  durationValue: "1",
  durationUnit: "hours",
  image: "",
  manualWinnerDraw: false,
  nwcConnection: "",
};

export function CreateFundraiserDialog({ open, onOpenChange, editCampaign }: CreateFundraiserDialogProps) {
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const wallet = useWallet();
  
  // Initialize form with edit data if provided
  const getInitialForm = (): FundraiserForm => {
    if (editCampaign) {
      return {
        title: editCampaign.title,
        description: editCampaign.description,
        content: editCampaign.content,
        podcast: editCampaign.podcast,
        podcastUrl: editCampaign.podcastUrl || "",
        episode: editCampaign.episode || "",
        target: editCampaign.target ? editCampaign.target.toString() : "",
        ticketPrice: editCampaign.ticketPrice.toString(),
        endDate: editCampaign.endDate ? new Date(editCampaign.endDate * 1000) : undefined,
        useDuration: false, // Default to date mode for editing
        durationValue: "1",
        durationUnit: "hours",
        image: editCampaign.image || "",
        manualWinnerDraw: editCampaign.manualDraw,
        nwcConnection: editCampaign.nwc || "",
      };
    }
    return initialForm;
  };
  
  const [form, setForm] = useState<FundraiserForm>(getInitialForm);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const { displayName: creatorDisplayName } = useAuthorDisplay(user?.pubkey ?? '');

  // Reset form when editCampaign changes
  useEffect(() => {
    setForm(getInitialForm());
  }, [editCampaign]);

  const updateForm = (field: keyof FundraiserForm, value: string | Date | undefined | boolean) => {
    try {
      console.log('Updating form field:', field, 'with value type:', typeof value);
      setForm(prev => ({ ...prev, [field]: value }));
    } catch (error) {
      console.error('Error updating form field:', field, error);
      // Don't let form updates crash the app
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file (PNG, JPG, GIF, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploadingImage(true);
      
      // Convert to data URL for immediate preview and storage
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        updateForm("image", dataUrl);
        toast({
          title: "Image Uploaded",
          description: "Image has been added to your fundraiser",
        });
        setIsUploadingImage(false);
      };
      
      reader.onerror = () => {
        toast({
          title: "Upload Failed",
          description: "Failed to read the image file",
          variant: "destructive",
        });
        setIsUploadingImage(false);
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Image upload error:', error);
      toast({
        title: "Upload Failed",
        description: "An error occurred while uploading the image",
        variant: "destructive",
      });
      setIsUploadingImage(false);
    }
  };

  // Calculate duration in seconds
  const getDurationInSeconds = (): number => {
    const value = parseInt(form.durationValue);
    
    switch (form.durationUnit) {
      case "minutes":
        return value * 60;
      case "hours":
        return value * 60 * 60;
      case "days":
        return value * 24 * 60 * 60;
      case "weeks":
        return value * 7 * 24 * 60 * 60;
      default:
        return 60 * 60; // Default to 1 hour
    }
  };

  // Calculate end date from duration
  const getEndDateFromDuration = (): Date => {
    const now = new Date();
    const durationMs = getDurationInSeconds() * 1000;
    return new Date(now.getTime() + durationMs);
  };

  const validateForm = (): string | null => {
    try {
      if (!form.title.trim()) return "Title is required";
      if (!form.description.trim()) return "Description is required";
      if (!form.podcast.trim()) return "Podcast name is required";
      // Target amount is now optional - only validate if provided
      if (form.target && parseInt(form.target) <= 0) return "Goal amount must be greater than 0 if specified";
      if (!form.ticketPrice || parseInt(form.ticketPrice) <= 0) return "Valid ticket price is required";
      
      // Basic NWC validation during form submission only
      if (form.nwcConnection && form.nwcConnection.trim().length > 0) {
        const nwc = form.nwcConnection.trim();
        if (!nwc.startsWith('nostr+walletconnect://')) {
          return "NWC connection must start with nostr+walletconnect://";
        }
        if (nwc.length < 50) {
          return "NWC connection appears incomplete";
        }
      }
      
      if (form.useDuration) {
        if (!form.durationValue || parseInt(form.durationValue) <= 0) return "Valid duration is required";
      } else if (!form.manualWinnerDraw) {
        // Only require end date for automatic winner selection
        if (!form.endDate) return "End date is required for automatic winner selection";
        if (form.endDate <= new Date()) return "End date must be in the future";
      }
      
      return null;
    } catch (error) {
      console.error('Form validation error:', error);
      return "Validation error occurred. Please refresh the page and try again.";
    }
  };

  const handleSubmit = async () => {
    // For new fundraisers, show confirmation dialog first
    if (!editCampaign) {
      setShowConfirmDialog(true);
      return;
    }
    
    // For edits, proceed directly
    await performSubmit();
  };

  const performSubmit = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a fundraiser",
        variant: "destructive",
      });
      return;
    }

    if (!wallet.isConnected) {
      toast({
        title: "Error",
        description: "You must connect your Lightning wallet to create a fundraiser",
        variant: "destructive",
      });
      return;
    }

    const error = validateForm();
    if (error) {
      toast({
        title: "Validation Error",
        description: error,
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate unique identifier (or reuse existing for edits)
      const dTag = editCampaign ? editCampaign.dTag : `fundraiser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Convert amounts to millisats
      const targetSats = form.target ? parseInt(form.target) : 0; // Default to 0 if no goal set
      const ticketPriceSats = parseInt(form.ticketPrice);
      const targetMillisats = targetSats * 1000;
      const ticketPriceMillisats = ticketPriceSats * 1000;
      
      // Convert end date to unix timestamp
      let endDate: Date;
      if (form.useDuration) {
        endDate = getEndDateFromDuration();
      } else if (form.endDate) {
        endDate = form.endDate;
      } else if (form.manualWinnerDraw) {
        // For manual draws without end date, set to far future so they stay active until winner is drawn
        endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
      } else {
        throw new Error('End date is required for automatic winner selection');
      }
      const endTimestamp = Math.floor(endDate.getTime() / 1000);

      // Build tags
      const tags: string[][] = [
        ["d", dTag],
        ["title", form.title.trim()],
        ["description", form.description.trim()],
        ["target", targetMillisats.toString()],
        ["ticket_price", ticketPriceMillisats.toString()],
        ["end_date", endTimestamp.toString()],
        ["podcast", form.podcast.trim()],
      ];

      // Add optional tags
      if (form.podcastUrl.trim()) {
        tags.push(["podcast_url", form.podcastUrl.trim()]);
      }
      if (form.episode.trim()) {
        tags.push(["episode", form.episode.trim()]);
      }
      if (form.image.trim()) {
        console.log('🖼️ Adding image tag to fundraiser:', form.image.trim());
        tags.push(["image", form.image.trim()]);
      }
      
      // Add duration tag if using duration mode
      if (form.useDuration) {
        const durationInSeconds = getDurationInSeconds();
        tags.push(["duration", durationInSeconds.toString()]);
      }

      // Add manual winner draw flag
      if (form.manualWinnerDraw) {
        tags.push(["manual_draw", "true"]);
      }

      // Add NWC connection if provided
      if (form.nwcConnection.trim()) {
        tags.push(["nwc", form.nwcConnection.trim()]);
      }

      publishEvent({
        kind: 31950,
        content: form.content.trim(),
        tags,
      }, {
        onSuccess: async (eventId) => {
          console.log('Fundraiser created:', eventId);
          console.log('📋 About to show toast and invalidate queries...');
          toast({
            title: "Success",
            description: editCampaign ? "Fundraiser updated successfully" : "Fundraiser created successfully",
          });
          queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
          console.log('📋 Toast shown and queries invalidated. Starting bot announcement...');
          
          // Announce new fundraiser on Nostr (bot posting) - only for new fundraisers
          if (!editCampaign) {
            console.log('🤖 Starting bot announcement process...');
            try {
              // Get creator name from user metadata or fallback
              const creatorName = creatorDisplayName || 
                                  form.podcast.trim() || 
                                  'Podcaster';
              
              await announceFundraiserCreated({
                title: form.title.trim(),
                creator: creatorName,
                amount: form.target ? parseInt(form.target, 10) : undefined,
                endDate: endTimestamp,
                ticketPrice: Math.floor(ticketPriceMillisats / 1000), // Convert to sats
                description: form.content.trim(),
                url: window.location.origin,
              });
              console.log('Bot announcement posted for new fundraiser');
            } catch (error) {
              console.warn('Failed to post bot announcement:', error);
              // Don't fail the whole process if bot posting fails
            }
          }
          
          // Close both dialogs
          setShowConfirmDialog(false);
          onOpenChange(false);
        },
        onError: (error) => {
          console.error('Failed to create fundraiser:', error);
          toast({
            title: "Error",
            description: "Failed to create fundraiser",
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      console.error('Error creating fundraiser:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create fundraiser",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (!isPending) {
      setForm(getInitialForm());
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCampaign ? 'Edit Fundraiser' : 'Create Fundraiser'}</DialogTitle>
            <DialogDescription>
              {editCampaign 
                ? 'Update your fundraiser details. Changes will be published as a new version.'
                : 'Set up a 50/50 raffle to raise funds for your podcast. Half goes to the winner, half supports your show.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Fundraiser Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Weekly Show Fundraiser"
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Short Description *</Label>
              <Input
                id="description"
                placeholder="Brief description for the fundraiser card"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Detailed Description</Label>
              <Textarea
                id="content"
                placeholder="Tell supporters more about your fundraiser and how the funds will be used..."
                value={form.content}
                onChange={(e) => updateForm("content", e.target.value)}
                disabled={isPending}
                rows={3}
              />
            </div>
          </div>

          {/* Podcast Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Podcast Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="podcast">Podcast Name *</Label>
                <Input
                  id="podcast"
                  placeholder="Your podcast name"
                  value={form.podcast}
                  onChange={(e) => updateForm("podcast", e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="episode">Episode (optional)</Label>
                <Input
                  id="episode"
                  placeholder="e.g., Episode 42"
                  value={form.episode}
                  onChange={(e) => updateForm("episode", e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="podcastUrl">Podcast URL (optional)</Label>
              <Input
                id="podcastUrl"
                placeholder="https://yourpodcast.com"
                value={form.podcastUrl}
                onChange={(e) => updateForm("podcastUrl", e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Fundraiser Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Fundraiser Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target">Goal Amount (sats) - Optional</Label>
                <Input
                  id="target"
                  type="number"
                  placeholder="e.g. 100000 (leave blank for no goal)"
                  value={form.target}
                  onChange={(e) => updateForm("target", e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticketPrice">Ticket Price (sats) *</Label>
                <Input
                  id="ticketPrice"
                  type="number"
                  placeholder="1000"
                  value={form.ticketPrice}
                  onChange={(e) => updateForm("ticketPrice", e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="use-duration"
                  checked={form.useDuration}
                  onCheckedChange={(checked) => updateForm("useDuration", checked)}
                  disabled={isPending}
                />
                <Label htmlFor="use-duration">Use duration instead of end date</Label>
              </div>

              {form.useDuration ? (
                <div className="space-y-2">
                  <Label>Fundraiser Duration *</Label>
                  <div className="flex space-x-2">
                    <Input
                      type="number"
                      placeholder="1"
                      value={form.durationValue}
                      onChange={(e) => updateForm("durationValue", e.target.value)}
                      disabled={isPending}
                      min="1"
                      className="flex-1"
                    />
                    <Select
                      value={form.durationUnit}
                      onValueChange={(value) => updateForm("durationUnit", value)}
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                        <SelectItem value="weeks">Weeks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.durationValue && parseInt(form.durationValue) > 0 && (
                    <p className="text-sm text-muted-foreground">
                      <Clock className="inline h-3 w-3 mr-1" />
                      Fundraiser will end: {format(getEndDateFromDuration(), "PPP 'at' p")}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>End Date {form.manualWinnerDraw ? "(optional for manual draws)" : "*"}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !form.endDate && "text-muted-foreground"
                        )}
                        disabled={isPending}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.endDate ? format(form.endDate, "PPP") : form.manualWinnerDraw ? "Pick end date (optional)" : "Pick an end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={form.endDate}
                        onSelect={(date) => updateForm("endDate", date)}
                        disabled={(date) => date <= new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="manual-draw"
                  checked={form.manualWinnerDraw}
                  onCheckedChange={(checked) => updateForm("manualWinnerDraw", checked)}
                  disabled={isPending}
                />
                <Label htmlFor="manual-draw">Manual winner selection (for live shows)</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {form.manualWinnerDraw 
                  ? "You'll manually draw the winner during your show. Automatic selection is disabled."
                  : "Winner will be automatically selected when the fundraiser ends."
                }
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Fundraiser Image URL (optional)</Label>
              <div className="flex space-x-2">
                <Input
                  id="image"
                  placeholder="https://example.com/image.jpg or upload a file"
                  value={form.image}
                  onChange={(e) => updateForm("image", e.target.value)}
                  disabled={isPending || isUploadingImage}
                />
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isPending || isUploadingImage}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title="Upload image file"
                  />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    disabled={isPending || isUploadingImage}
                    type="button"
                  >
                    {isUploadingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              {form.image && (
                <div className="mt-2">
                  <img 
                    src={form.image} 
                    alt="Fundraiser preview" 
                    className="w-32 h-24 object-cover rounded border"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* NWC Payment Setup */}
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-orange-600" />
                Payment Setup
              </CardTitle>
              <CardDescription className="text-xs">
                Configure how you'll receive payments from ticket sales. Without this, buyers will pay themselves (which fails).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="nwcConnection" className="text-xs">NWC Connection String</Label>
                <Input
                  id="nwcConnection"
                  type="text"
                  placeholder="nostr+walletconnect://..."
                  value={form.nwcConnection || ""}
                  onChange={(e) => {
                    const value = e.target.value || "";
                    console.log('📝 NWC onChange, length:', value.length);
                    setForm(prev => ({
                      ...prev,
                      nwcConnection: value
                    }));
                  }}
                  disabled={isPending}
                  className="text-sm"
                />
              </div>
              
              {form.nwcConnection && form.nwcConnection.length > 50 && (
                <div className="text-xs text-green-600 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Connection string detected ({form.nwcConnection.length} characters)
                </div>
              )}
              
              {!form.nwcConnection && (
                <Alert>
                  <Zap className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>⚠️ Payment Setup Required:</strong> Without an NWC connection, ticket buyers will try to pay themselves, which typically fails.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  Create a new NWC connection for this fundraiser:
                </p>
                {'alby' in window && (
                  <div className="bg-blue-50 dark:bg-blue-950 p-2 rounded border">
                    <p className="font-medium text-blue-800 dark:text-blue-200">📝 Alby Hub Setup:</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      1. Open Alby Hub → Settings → Developer<br/>
                      2. Click "Nostr Wallet Connect"<br/>
                      3. Click "Create Connection"<br/>
                      4. Copy the connection string and paste above
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {form.ticketPrice && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-semibold">Fundraiser Preview</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                {form.target ? (
                  <>
                    <p>Goal: {parseInt(form.target).toLocaleString()} sats</p>
                    <p>Ticket Price: {parseInt(form.ticketPrice || "0").toLocaleString()} sats</p>
                    <p>Max Tickets to Goal: {Math.floor(parseInt(form.target) / parseInt(form.ticketPrice || "1"))}</p>
                    <p>Potential Winner Prize at Goal: {Math.floor(parseInt(form.target) / 2).toLocaleString()} sats</p>
                  </>
                ) : (
                  <>
                    <p>Goal: No specific goal set</p>
                    <p>Ticket Price: {parseInt(form.ticketPrice || "0").toLocaleString()} sats</p>
                    <p>Winner gets 50% of total raised</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editCampaign ? 'Update Fundraiser' : 'Create Fundraiser'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

      {/* Confirmation Dialog for New Fundraisers */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ready to Create Fundraiser?</DialogTitle>
            <DialogDescription>
              Before creating your fundraiser, please understand the editing limitations:
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 text-sm py-4">
            <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800">
              <p className="font-medium text-green-800 dark:text-green-200 mb-2">✅ You CAN edit (only before tickets are sold):</p>
              <ul className="text-green-700 dark:text-green-300 space-y-1 text-xs">
                <li>• Title, descriptions, and podcast info</li>
                <li>• Images and episode details</li>
                <li>• Target amount and ticket price</li>
                <li>• End date and settings</li>
              </ul>
            </div>

            <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg border border-red-200 dark:border-red-800">
              <p className="font-medium text-red-800 dark:text-red-200 mb-2">❌ You CANNOT edit (after tickets are sold):</p>
              <ul className="text-red-700 dark:text-red-300 space-y-1 text-xs">
                <li>• Any fundraiser details</li>
                <li>• Changes could affect fairness</li>
                <li>• Only deletion is allowed (if possible)</li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">💡 Pro Tip:</p>
              <p className="text-blue-700 dark:text-blue-300 text-xs">Double-check all details before publishing. Once people buy tickets, changes aren't allowed to maintain trust and fairness.</p>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Review Details
            </Button>
            <Button 
              onClick={performSubmit}
              disabled={isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Fundraiser
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Backward compatibility alias
export const CreateCampaignDialog = CreateFundraiserDialog;