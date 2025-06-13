import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Plus, Check } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToastUtils } from '@/lib/shared-utils';
import { isValidLightningAddress } from '@/lib/lightning-address';
import type { Campaign } from '@/hooks/useCampaigns';

interface AddLightningAddressProps {
  campaign: Campaign;
}

export function AddLightningAddress({ campaign }: AddLightningAddressProps) {
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const toast = useToastUtils();
  const [lightningAddress, setLightningAddress] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Only show if user is the campaign creator and campaign doesn't have Lightning address
  const isCreator = user?.pubkey === campaign.pubkey;
  const hasLightningAddress = !!(campaign.lightningAddress || campaign.lnurl);

  if (!isCreator) {
    return null;
  }

  const handleAddLightningAddress = async () => {
    if (!lightningAddress.trim()) {
      toast.error("Invalid Input", "Please enter a Lightning address");
      return;
    }

    if (!isValidLightningAddress(lightningAddress)) {
      toast.error("Invalid Format", "Please enter a valid Lightning address (e.g., user@domain.com)");
      return;
    }

    try {
      // Create updated fundraiser event with Lightning address
      const updatedTags = campaign.event.tags.slice(); // Copy existing tags
      
      // Remove any existing lightning_address tags
      const filteredTags = updatedTags.filter(tag => tag[0] !== 'lightning_address');
      
      // Add new lightning_address tag
      filteredTags.push(['lightning_address', lightningAddress.trim()]);

      publishEvent({
        kind: 31950,
        content: campaign.content,
        tags: filteredTags,
      }, {
        onSuccess: () => {
          toast.success("Lightning Address Added", `Added ${lightningAddress} to your fundraiser. Refresh the page to see changes.`);
          setLightningAddress('');
          setShowForm(false);
        },
        onError: (error) => {
          console.error('Failed to update fundraiser:', error);
          toast.error("Update Failed", "Failed to add Lightning address to fundraiser");
        }
      });
    } catch (error) {
      console.error('Error updating fundraiser:', error);
      toast.error("Update Failed", "Failed to add Lightning address");
    }
  };

  if (hasLightningAddress) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-green-600" />
            Lightning Address Configured
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <Check className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Your fundraiser is configured to receive payments at: <strong>{campaign.lightningAddress}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-green-700 dark:text-green-300">
            ✅ Ticket purchases will create invoices from your Lightning address. Payments go directly to you!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-orange-600" />
          Lightning Address Required
          <Badge variant="outline" className="text-orange-800 border-orange-300">
            Missing
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Add your Lightning address to enable proper fundraising. Without it, ticket buyers pay themselves (which fails).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!showForm ? (
          <Button 
            size="sm" 
            onClick={() => setShowForm(true)}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Lightning Address
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="lightning-address" className="text-xs">Lightning Address</Label>
              <Input
                id="lightning-address"
                type="email"
                placeholder="your-username@getalby.com"
                value={lightningAddress}
                onChange={(e) => setLightningAddress(e.target.value)}
                disabled={isPending}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={handleAddLightningAddress}
                disabled={isPending}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                {isPending ? "Adding..." : "Add Address"}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setLightningAddress('');
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get a Lightning address from: Alby, Strike, CashApp, or Wallet of Satoshi
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}