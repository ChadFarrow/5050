import { useState } from "react";
import { CalendarIcon, ImageIcon, Loader2, Clock, Zap, Eye, EyeOff } from "lucide-react";
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
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { isValidNWCConnection } from "@/lib/nwc-relay";

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
  nwcConnection: "",
};

export function CreateCampaignDialog({ open, onOpenChange }: CreateFundraiserDialogProps) {
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const { toast } = useToast();
  const [form, setForm] = useState<FundraiserForm>(initialForm);
  const [showNWCConnection, setShowNWCConnection] = useState(false);

  const updateForm = (field: keyof FundraiserForm, value: string | Date | undefined | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
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
    if (!form.title.trim()) return "Title is required";
    if (!form.description.trim()) return "Description is required";
    if (!form.podcast.trim()) return "Podcast name is required";
    if (!form.target || parseInt(form.target) <= 0) return "Valid target amount is required";
    if (!form.ticketPrice || parseInt(form.ticketPrice) <= 0) return "Valid ticket price is required";
    
    if (form.useDuration) {
      if (!form.durationValue || parseInt(form.durationValue) <= 0) return "Valid duration is required";
    } else {
      if (!form.endDate) return "End date is required";
      if (form.endDate <= new Date()) return "End date must be in the future";
    }

    // Validate NWC connection if provided
    if (form.nwcConnection.trim() && !isValidNWCConnection(form.nwcConnection.trim())) {
      return "Invalid NWC (Nostr Wallet Connect) connection string";
    }
    
    return null;
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
      const targetSats = parseInt(form.target);
      const ticketPriceSats = parseInt(form.ticketPrice);
      const targetMillisats = targetSats * 1000;
      const ticketPriceMillisats = ticketPriceSats * 1000;
      
      // Convert end date to unix timestamp
      const endDate = form.useDuration ? getEndDateFromDuration() : form.endDate!;
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

      // Encrypt and store NWC connection if provided
      if (form.nwcConnection.trim()) {
        if (!user.signer.nip44) {
          toast({
            title: "Encryption Not Supported",
            description: "Your Nostr client doesn't support NIP-44 encryption needed for NWC storage.",
            variant: "destructive",
          });
          return;
        }

        try {
          const encryptedNWC = await user.signer.nip44.encrypt(user.pubkey, form.nwcConnection.trim());
          tags.push(["nwc", encryptedNWC]);
        } catch (error) {
          console.error("Failed to encrypt NWC connection:", error);
          toast({
            title: "Encryption Failed",
            description: "Failed to encrypt NWC connection. Please try again.",
            variant: "destructive",
          });
          return;
        }
      }

      publishEvent({
        kind: 31950,
        content: form.content.trim(),
        tags,
      });

      toast({
        title: "Fundraiser Created!",
        description: "Your fundraiser has been published to Nostr",
      });

      // Reset form and close dialog
      setForm(initialForm);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast({
        title: "Error",
        description: "Failed to create fundraiser. Please try again.",
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
              )}
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

          {/* Lightning Wallet Setup */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <h3 className="text-lg font-semibold">Lightning Wallet Setup</h3>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-3">
              <div className="flex items-start space-x-2">
                <Zap className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Enable Lightning Payments (Recommended)
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    Connect your Lightning wallet via NWC (Nostr Wallet Connect) to automatically receive payments 
                    from ticket sales. Without this, supporters cannot buy tickets with Lightning.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nwc-connection">NWC Connection String (optional)</Label>
              <div className="space-y-2">
                <div className="flex space-x-2">
                  <Input
                    id="nwc-connection"
                    type={showNWCConnection ? "text" : "password"}
                    placeholder="nostr+walletconnect://..."
                    value={form.nwcConnection}
                    onChange={(e) => updateForm("nwcConnection", e.target.value)}
                    disabled={isPending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowNWCConnection(!showNWCConnection)}
                    disabled={isPending}
                  >
                    {showNWCConnection ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Get this from your Lightning wallet's NWC settings (Alby, Zeus, etc.)</p>
                  <p>• This connection will be encrypted and stored securely</p>
                  <p>• Required for automatic Lightning invoice generation</p>
                </div>
                {form.nwcConnection.trim() && (
                  <div className="text-xs">
                    {isValidNWCConnection(form.nwcConnection.trim()) ? (
                      <span className="text-green-600 dark:text-green-400">✓ Valid NWC connection</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">✗ Invalid NWC connection format</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview */}
          {form.target && form.ticketPrice && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-semibold">Fundraiser Preview</h4>
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
            Create Fundraiser
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}