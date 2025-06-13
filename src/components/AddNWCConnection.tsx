import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Plus, Check, Wallet } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useWallet } from '@/hooks/useWallet';
import { useToastUtils } from '@/lib/shared-utils';
import { isValidNWCConnection, detectWalletNWC } from '@/lib/nwc';
import type { Campaign } from '@/hooks/useCampaigns';

interface AddNWCConnectionProps {
  campaign: Campaign;
}

export function AddNWCConnection({ campaign }: AddNWCConnectionProps) {
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const wallet = useWallet();
  const toast = useToastUtils();
  const [nwcConnection, setNWCConnection] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  // Only show if user is the campaign creator and campaign doesn't have NWC connection
  const isCreator = user?.pubkey === campaign.pubkey;
  const hasNWCConnection = !!campaign.nwc;

  if (!isCreator) {
    return null;
  }

  const handleDetectWalletNWC = async () => {
    if (!wallet.isConnected) {
      toast.error("No Wallet Connected", "Please connect your wallet first to detect NWC connection");
      return;
    }

    setIsDetecting(true);
    try {
      const detectedNWC = await detectWalletNWC();
      if (detectedNWC) {
        setNWCConnection(detectedNWC);
        toast.success("NWC Detected", "Found NWC connection from your connected wallet!");
      } else {
        // Provide helpful guidance based on detected wallet
        if ((window as any).alby) {
          toast.error("Alby NWC Setup Required", "Please create an NWC connection in your Alby wallet: Settings → Developer → Nostr Wallet Connect → Create Connection");
        } else {
          toast.error("NWC Setup Required", "Please create an NWC connection in your wallet that supports Nostr Wallet Connect");
        }
      }
    } catch (error) {
      console.error('Failed to detect wallet NWC:', error);
      toast.error("Detection Failed", "Failed to detect NWC from your wallet. Please create an NWC connection manually.");
    } finally {
      setIsDetecting(false);
    }
  };

  const handleAddNWCConnection = async () => {
    if (!nwcConnection.trim()) {
      toast.error("Invalid Input", "Please enter an NWC connection string");
      return;
    }

    if (!isValidNWCConnection(nwcConnection)) {
      toast.error("Invalid Format", "Please enter a valid NWC connection string (e.g., nostr+walletconnect://...)");
      return;
    }

    try {
      // Create updated fundraiser event with NWC connection
      const updatedTags = campaign.event.tags.slice(); // Copy existing tags
      
      // Remove any existing nwc tags
      const filteredTags = updatedTags.filter(tag => tag[0] !== 'nwc');
      
      // Add new nwc tag
      filteredTags.push(['nwc', nwcConnection.trim()]);

      publishEvent({
        kind: 31950,
        content: campaign.content,
        tags: filteredTags,
      }, {
        onSuccess: () => {
          toast.success("NWC Connection Added", `Added NWC connection to your fundraiser. Refresh the page to see changes.`);
          setNWCConnection('');
          setShowForm(false);
        },
        onError: (error) => {
          console.error('Failed to update fundraiser:', error);
          toast.error("Update Failed", "Failed to add NWC connection to fundraiser");
        }
      });
    } catch (error) {
      console.error('Error updating fundraiser:', error);
      toast.error("Update Failed", "Failed to add NWC connection");
    }
  };

  if (hasNWCConnection) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-green-600" />
            NWC Connection Configured
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <Check className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Your fundraiser is configured with an NWC connection for receiving payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-green-700 dark:text-green-300">
            ✅ Ticket purchases will create invoices from your wallet via NWC. Payments go directly to you!
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
          NWC Connection Required
          <Badge variant="outline" className="text-orange-800 border-orange-300">
            Missing
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Add your NWC connection to enable proper fundraising. Without it, ticket buyers pay themselves (which fails).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!showForm ? (
          <div className="space-y-3">
            <Button 
              size="sm" 
              onClick={() => setShowForm(true)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add NWC Connection
            </Button>
            {wallet.isConnected && (window as any).alby && (
              <div className="text-xs p-2 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">💡 Alby Wallet Detected</p>
                <p className="text-blue-700 dark:text-blue-300">
                  Create an NWC connection: <span className="font-mono">Settings → Developer → Nostr Wallet Connect → Create Connection</span>
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="nwc-connection" className="text-xs">NWC Connection String</Label>
              <Input
                id="nwc-connection"
                type="text"
                placeholder="nostr+walletconnect://..."
                value={nwcConnection}
                onChange={(e) => setNWCConnection(e.target.value)}
                disabled={isPending || isDetecting}
                className="text-sm"
              />
            </div>
            
            {wallet.isConnected && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleDetectWalletNWC}
                disabled={isPending || isDetecting}
                className="w-full"
              >
                <Wallet className="h-4 w-4 mr-2" />
                {isDetecting ? "Checking..." : "Check Wallet for NWC"}
              </Button>
            )}
            
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={handleAddNWCConnection}
                disabled={isPending || isDetecting}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                {isPending ? "Adding..." : "Add Connection"}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setNWCConnection('');
                }}
                disabled={isPending || isDetecting}
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {wallet.isConnected 
                ? "Click 'Check Wallet for NWC' for setup instructions, or create an NWC connection in your wallet and paste it above"
                : "Create an NWC connection in your wallet that supports Nostr Wallet Connect and paste it above"
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}