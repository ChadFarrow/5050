// Hybrid bot solution - works with static hosting by asking user to sign with bot account
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

// Hook for hybrid bot functionality
export function useNostrBotHybrid() {
  const { mutate: publishEvent } = useNostrPublish();
  const { user, metadata } = useCurrentUser();

  const postFundraiserCreated = useCallback(async (options: FundraiserUpdateOptions): Promise<void> => {
    if (!user) {
      console.warn('No user logged in for bot posting');
      return;
    }

    // Check if this looks like a bot account (has "bot" or "podraffle" in name)
    const isBotAccount = metadata?.name?.toLowerCase().includes('bot') || 
                        metadata?.name?.toLowerCase().includes('podraffle') ||
                        metadata?.display_name?.toLowerCase().includes('bot') ||
                        metadata?.display_name?.toLowerCase().includes('podraffle');

    const content = `🎉 New Fundraiser Created!

🎧 ${options.title}
👤 Creator: ${options.creator}
${options.ticketPrice ? `🎫 Ticket Price: ${options.ticketPrice} sats` : ''}
${options.amount ? `🎯 Target: ${options.amount} sats` : ''}
${options.endDate ? `⏰ Ends: ${new Date(options.endDate * 1000).toLocaleDateString()}` : ''}

${options.description || ''}

${options.url ? `Join: ${options.url}` : ''}

#PodRaffle #Bitcoin #Lightning #Nostr #Podcast${isBotAccount ? '' : '\n\n(Posted by creator - switch to bot account for official announcements)'}`;

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
  }, [publishEvent, user, metadata]);

  const postWinnerAnnouncement = useCallback(async (options: WinnerAnnouncementOptions): Promise<void> => {
    if (!user) {
      console.warn('No user logged in for bot posting');
      return;
    }

    const isBotAccount = metadata?.name?.toLowerCase().includes('bot') || 
                        metadata?.name?.toLowerCase().includes('podraffle') ||
                        metadata?.display_name?.toLowerCase().includes('bot') ||
                        metadata?.display_name?.toLowerCase().includes('podraffle');

    const content = `🏆 Winner Announced!

🎧 ${options.title}
👤 Creator: ${options.creator}
🎉 Winner: ${options.winner}
💰 Prize: ${options.prizeAmount} sats
📊 Total Raised: ${options.totalRaised} sats

Congratulations to the winner! 🎉

${options.url ? `View: ${options.url}` : ''}

#PodRaffle #Bitcoin #Lightning #Winner #Podcast${isBotAccount ? '' : '\n\n(Posted by creator - switch to bot account for official announcements)'}`;

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
  }, [publishEvent, user, metadata]);

  return {
    postFundraiserCreated,
    postWinnerAnnouncement,
    isReady: !!user,
    isBotAccount: metadata?.name?.toLowerCase().includes('bot') || 
                  metadata?.name?.toLowerCase().includes('podraffle') ||
                  metadata?.display_name?.toLowerCase().includes('bot') ||
                  metadata?.display_name?.toLowerCase().includes('podraffle'),
  };
}