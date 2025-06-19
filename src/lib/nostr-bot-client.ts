// Client-side Nostr bot for static hosting
// This version posts from your account (asks for signing approval)
import { finalizeEvent } from 'nostr-tools';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCallback } from 'react';

interface FundraiserUpdateOptions {
  title: string;
  creator: string;
  amount?: number;
  endDate?: number;
  ticketPrice?: number;
  description?: string;
  url?: string;
}

interface WinnerAnnouncementOptions {
  title: string;
  creator: string;
  winner: string;
  prizeAmount: number;
  totalRaised: number;
  url?: string;
}

// Hook for client-side bot functionality
export function useNostrBot() {
  const { mutate: publishEvent } = useNostrPublish();
  const { user } = useCurrentUser();

  const postFundraiserCreated = useCallback(async (options: FundraiserUpdateOptions): Promise<void> => {
    if (!user) {
      console.warn('No user logged in for bot posting');
      return;
    }

    const content = `🎉 New Fundraiser Created!

🎧 ${options.title}
👤 Creator: ${options.creator}
${options.ticketPrice ? `🎫 Ticket Price: ${options.ticketPrice} sats` : ''}
${options.amount ? `🎯 Target: ${options.amount} sats` : ''}
${options.endDate ? `⏰ Ends: ${new Date(options.endDate * 1000).toLocaleDateString()}` : ''}

${options.description || ''}

${options.url ? `Join: ${options.url}` : ''}

#PodRaffle #Bitcoin #Lightning #Nostr #Podcast`;

    return new Promise<void>((resolve, reject) => {
      publishEvent({
        kind: 1,
        content,
        tags: [
          ['t', 'podraffle'],
          ['t', 'bitcoin'],
          ['t', 'lightning'],
          ['t', 'podcast'],
          ['t', 'fundraiser'],
        ],
      }, {
        onSuccess: () => {
          console.log('✅ Bot announcement posted successfully');
          resolve();
        },
        onError: (error) => {
          console.error('❌ Failed to post bot announcement:', error);
          reject(error);
        }
      });
    });
  }, [publishEvent, user]);

  const postWinnerAnnouncement = useCallback(async (options: WinnerAnnouncementOptions): Promise<void> => {
    if (!user) {
      console.warn('No user logged in for bot posting');
      return;
    }

    const content = `🏆 Winner Announced!

🎧 ${options.title}
👤 Creator: ${options.creator}
🎉 Winner: ${options.winner}
💰 Prize: ${options.prizeAmount} sats
📊 Total Raised: ${options.totalRaised} sats

Congratulations to the winner! 🎉

${options.url ? `View: ${options.url}` : ''}

#PodRaffle #Bitcoin #Lightning #Winner #Podcast`;

    return new Promise<void>((resolve, reject) => {
      publishEvent({
        kind: 1,
        content,
        tags: [
          ['t', 'podraffle'],
          ['t', 'bitcoin'],
          ['t', 'lightning'],
          ['t', 'podcast'],
          ['t', 'winner'],
        ],
      }, {
        onSuccess: () => {
          console.log('✅ Bot winner announcement posted successfully');
          resolve();
        },
        onError: (error) => {
          console.error('❌ Failed to post bot winner announcement:', error);
          reject(error);
        }
      });
    });
  }, [publishEvent, user]);

  return {
    postFundraiserCreated,
    postWinnerAnnouncement,
    isReady: !!user,
  };
}