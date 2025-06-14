// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { ChevronDown, LogOut, UserIcon, Zap } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { RelaySelector } from '@/components/RelaySelector';
import { useLoggedInAccounts, type Account } from '@/hooks/useLoggedInAccounts';
import { genUserName } from '@/lib/genUserName';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LightningConfig } from '@/components/LightningConfig';
import { useWallet } from '@/hooks/useWallet';

export function AccountSwitcher() {
  const { currentUser, removeLogin } = useLoggedInAccounts();
  const { isConnected } = useWallet();
  const [lightningDialogOpen, setLightningDialogOpen] = useState(false);

  if (!currentUser) return null;

  const getDisplayName = (account: Account): string => {
    return account.metadata.name ?? genUserName(account.pubkey);
  }

  return (
    <>
      <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className='flex items-center gap-3 p-3 rounded-full hover:bg-accent transition-all w-full text-foreground'>
          <Avatar className='w-10 h-10'>
            <AvatarImage src={currentUser.metadata.picture} alt={getDisplayName(currentUser)} />
            <AvatarFallback>{getDisplayName(currentUser).charAt(0)}</AvatarFallback>
          </Avatar>
          <div className='flex-1 text-left hidden md:block truncate'>
            <p className='font-medium text-sm truncate'>{getDisplayName(currentUser)}</p>
          </div>
          <ChevronDown className='w-4 h-4 text-muted-foreground' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56 p-2 animate-scale-in'>
        <div className='font-medium text-sm px-2 py-1.5'>Switch Relay</div>
        <RelaySelector className="w-full" />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setLightningDialogOpen(true)}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
        >
          <Zap className='w-4 h-4' />
          <span>Lightning Wallet</span>
          {isConnected && <div className='w-2 h-2 rounded-full bg-green-500 ml-auto'></div>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => removeLogin(currentUser.id)}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md text-red-500'
        >
          <LogOut className='w-4 h-4' />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={lightningDialogOpen} onOpenChange={setLightningDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Zap className="h-5 w-5 mr-2" />
              Lightning Wallet Settings
            </DialogTitle>
            <DialogDescription>
              Configure your Lightning wallet connection for ticket purchases
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <LightningConfig />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}