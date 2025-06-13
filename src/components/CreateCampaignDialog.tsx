import { useState } from "react";
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

interface CreateFundraiserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function CreateCampaignDialog({ open, onOpenChange }: CreateFundraiserDialogProps) {
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const wallet = useWallet();
  const [form, setForm] = useState<FundraiserForm>(initialForm);

  const updateForm = (field: keyof FundraiserForm, value: string | Date | undefined | boolean) => {
    try {
      console.log('Updating form field:', field, 'with value type:', typeof value);
      setForm(prev => ({ ...prev, [field]: value }));
    } catch (error) {
      console.error('Error updating form field:', field, error);
      // Don't let form updates crash the app
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
      // Generate unique identifier
      const dTag = `fundraiser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
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
        onSuccess: (eventId) => {
          console.log('Fundraiser created:', eventId);
          toast({
            title: "Success",
            description: "Fundraiser created successfully",
          });
          queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
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
      setForm(initialForm);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Fundraiser</DialogTitle>
          <DialogDescription>
            Set up a 50/50 raffle to raise funds for your podcast. Half goes to the winner, half supports your show.
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
                  placeholder="https://example.com/image.jpg"
                  value={form.image}
                  onChange={(e) => updateForm("image", e.target.value)}
                  disabled={isPending}
                />
                <Button variant="outline" size="icon" disabled={isPending}>
                  <ImageIcon className="h-4 w-4" />
                </Button>
              </div>
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
            Create Fundraiser
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}