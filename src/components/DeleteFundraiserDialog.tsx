import { useState } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { useQueryClient } from '@tanstack/react-query';
import type { Campaign } from '@/hooks/useCampaigns';

interface DeleteFundraiserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fundraiser: Campaign;
  hasTickets: boolean;
}

export function DeleteFundraiserDialog({ 
  open, 
  onOpenChange, 
  fundraiser, 
  hasTickets 
}: DeleteFundraiserDialogProps) {
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  // Only allow deletion if user is the creator and no tickets have been sold
  const canDelete = user?.pubkey === fundraiser.pubkey && !hasTickets && fundraiser.isActive;

  const handleDelete = async () => {
    if (!canDelete) {
      toast({
        title: "Cannot Delete",
        description: "You can only delete your own fundraisers that have no ticket sales.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      // To delete an addressable event in Nostr, publish a new event with same d-tag but empty content
      // and add a "deleted" tag to indicate deletion
      publishEvent({
        kind: 31950,
        content: "",
        tags: [
          ["d", fundraiser.dTag],
          ["deleted", Math.floor(Date.now() / 1000).toString()],
        ],
      }, {
        onSuccess: (eventId) => {
          console.log('Fundraiser deleted:', eventId);
          toast({
            title: "Fundraiser Deleted",
            description: "Your fundraiser has been successfully deleted.",
          });
          
          // Invalidate queries to refresh the fundraiser list
          queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
          queryClient.invalidateQueries({ queryKey: ['fundraiser', fundraiser.id] });
          queryClient.invalidateQueries({ queryKey: ['campaign-stats', fundraiser.id] });
          
          onOpenChange(false);
        },
        onError: (error) => {
          console.error('Failed to delete fundraiser:', error);
          toast({
            title: "Deletion Failed",
            description: "Failed to delete fundraiser. Please try again.",
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      console.error('Error deleting fundraiser:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete fundraiser",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isPending && !isDeleting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Delete Fundraiser
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the fundraiser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
            <h4 className="font-medium text-sm mb-1">{fundraiser.title}</h4>
            <p className="text-xs text-muted-foreground">{fundraiser.description}</p>
          </div>

          {hasTickets ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Cannot delete:</strong> This fundraiser has ticket sales and cannot be deleted. 
                You can end it early using the manual winner selection if needed.
              </AlertDescription>
            </Alert>
          ) : !canDelete ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Cannot delete:</strong> You can only delete your own active fundraisers that have no ticket sales.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Safe to delete:</strong> No tickets have been sold for this fundraiser yet. 
                You can safely delete it if there was a setup mistake.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={isPending || isDeleting}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={!canDelete || isPending || isDeleting}
          >
            {(isPending || isDeleting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Fundraiser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}