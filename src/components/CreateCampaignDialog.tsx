import { useState } from "react";
import { CalendarIcon, ImageIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CampaignForm {
  title: string;
  description: string;
  content: string;
  podcast: string;
  podcastUrl: string;
  episode: string;
  target: string;
  ticketPrice: string;
  endDate: Date | undefined;
  image: string;
}

const initialForm: CampaignForm = {
  title: "",
  description: "",
  content: "",
  podcast: "",
  podcastUrl: "",
  episode: "",
  target: "",
  ticketPrice: "",
  endDate: undefined,
  image: "",
};

export function CreateCampaignDialog({ open, onOpenChange }: CreateCampaignDialogProps) {
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const { toast } = useToast();
  const [form, setForm] = useState<CampaignForm>(initialForm);

  const updateForm = (field: keyof CampaignForm, value: string | Date | undefined) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): string | null => {
    if (!form.title.trim()) return "Title is required";
    if (!form.description.trim()) return "Description is required";
    if (!form.podcast.trim()) return "Podcast name is required";
    if (!form.target || parseInt(form.target) <= 0) return "Valid target amount is required";
    if (!form.ticketPrice || parseInt(form.ticketPrice) <= 0) return "Valid ticket price is required";
    if (!form.endDate) return "End date is required";
    if (form.endDate <= new Date()) return "End date must be in the future";
    
    return null;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a campaign",
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
      const dTag = `campaign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Convert amounts to millisats
      const targetSats = parseInt(form.target);
      const ticketPriceSats = parseInt(form.ticketPrice);
      const targetMillisats = targetSats * 1000;
      const ticketPriceMillisats = ticketPriceSats * 1000;
      
      // Convert end date to unix timestamp
      const endTimestamp = Math.floor(form.endDate!.getTime() / 1000);

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

      publishEvent({
        kind: 31950,
        content: form.content.trim(),
        tags,
      });

      toast({
        title: "Campaign Created!",
        description: "Your fundraiser campaign has been published to Nostr",
      });

      // Reset form and close dialog
      setForm(initialForm);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast({
        title: "Error",
        description: "Failed to create campaign. Please try again.",
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
          <DialogTitle>Create Fundraiser Campaign</DialogTitle>
          <DialogDescription>
            Set up a 50/50 raffle to raise funds for your podcast. Half goes to the winner, half supports your show.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Campaign Title *</Label>
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
                placeholder="Brief description for the campaign card"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Detailed Description</Label>
              <Textarea
                id="content"
                placeholder="Tell supporters more about your campaign and how the funds will be used..."
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

          {/* Campaign Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Campaign Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="target">Target Amount (sats) *</Label>
                <Input
                  id="target"
                  type="number"
                  placeholder="100000"
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

            <div className="space-y-2">
              <Label>End Date *</Label>
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
                    {form.endDate ? format(form.endDate, "PPP") : "Pick an end date"}
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

            <div className="space-y-2">
              <Label htmlFor="image">Campaign Image URL (optional)</Label>
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

          {/* Preview */}
          {form.target && form.ticketPrice && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-semibold">Campaign Preview</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Target: {parseInt(form.target || "0").toLocaleString()} sats</p>
                <p>Ticket Price: {parseInt(form.ticketPrice || "0").toLocaleString()} sats</p>
                <p>Max Tickets: {Math.floor(parseInt(form.target || "0") / parseInt(form.ticketPrice || "1"))}</p>
                <p>Potential Winner Prize: {Math.floor(parseInt(form.target || "0") / 2).toLocaleString()} sats</p>
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
            Create Campaign
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}