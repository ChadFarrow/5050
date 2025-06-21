// Server-side only - Nostr bot for posting fundraiser updates
// NOTE: This will only work if you deploy to a server environment (not static hosting)
// For static hosting, you'll need to set up a separate server/API for bot posting
import { finalizeEvent, nip19 } from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';

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

class NostrBot {
  private nsec: string;
  private relays: string[];

  constructor(nsec: string, relays: string[] = ['wss://relay.damus.io', 'wss://relay.nostr.band']) {
    this.nsec = nsec;
    this.relays = relays;
  }

  private getSecretKey(): Uint8Array {
    try {
      const { data } = nip19.decode(this.nsec);
      return data as Uint8Array;
    } catch {
      throw new Error('Invalid nsec format');
    }
  }

  private async publishToRelays(event: ReturnType<typeof finalizeEvent>): Promise<void> {
    const publishPromises = this.relays.map(async (relayUrl) => {
      try {
        const relay = await Relay.connect(relayUrl);
        await relay.publish(event);
        relay.close();
        console.log(`✅ Published to ${relayUrl}`);
      } catch (error) {
        console.error(`❌ Failed to publish to ${relayUrl}:`, error);
      }
    });

    await Promise.allSettled(publishPromises);
  }

  async postFundraiserCreated(options: FundraiserUpdateOptions): Promise<void> {
    const sk = this.getSecretKey();
    
    const content = `🎉 New Fundraiser Created!

🎧 ${options.title}
👤 Creator: ${options.creator}
${options.ticketPrice ? `🎫 Ticket Price: ${options.ticketPrice} sats` : ''}
${options.amount ? `🎯 Target: ${options.amount} sats` : ''}
${options.endDate ? `⏰ Ends: ${new Date(options.endDate * 1000).toLocaleDateString()}` : ''}

${options.description || ''}

${options.url ? `Join: ${options.url}` : ''}

#PodRaffle #Bitcoin #Lightning #Nostr #Podcast`;

    const event = finalizeEvent({
      kind: 1,
      content,
      tags: [
        ['t', 'podraffle'],
        ['t', 'bitcoin'],
        ['t', 'lightning'],
        ['t', 'podcast'],
        ['t', 'fundraiser'],
      ],
      created_at: Math.floor(Date.now() / 1000),
    }, sk);

    await this.publishToRelays(event);
  }

  async postWinnerAnnouncement(options: WinnerAnnouncementOptions): Promise<void> {
    const sk = this.getSecretKey();
    
    const content = `🏆 Winner Announced!

🎧 ${options.title}
👤 Creator: ${options.creator}
🎉 Winner: ${options.winner}
💰 Prize: ${options.prizeAmount} sats
📊 Total Raised: ${options.totalRaised} sats

Congratulations to the winner! 🎉

${options.url ? `View: ${options.url}` : ''}

#PodRaffle #Bitcoin #Lightning #Winner #Podcast`;

    const event = finalizeEvent({
      kind: 1,
      content,
      tags: [
        ['t', 'podraffle'],
        ['t', 'bitcoin'],
        ['t', 'lightning'],
        ['t', 'podcast'],
        ['t', 'winner'],
      ],
      created_at: Math.floor(Date.now() / 1000),
    }, sk);

    await this.publishToRelays(event);
  }

  async postFundraiserEnded(options: FundraiserUpdateOptions & { totalRaised: number }): Promise<void> {
    const sk = this.getSecretKey();
    
    const content = `⏰ Fundraiser Ended

🎧 ${options.title}
👤 Creator: ${options.creator}
💰 Total Raised: ${options.totalRaised} sats
🎯 Drawing winner soon...

${options.url ? `View: ${options.url}` : ''}

#PodRaffle #Bitcoin #Lightning #Podcast`;

    const event = finalizeEvent({
      kind: 1,
      content,
      tags: [
        ['t', 'podraffle'],
        ['t', 'bitcoin'],
        ['t', 'lightning'],
        ['t', 'podcast'],
        ['t', 'ended'],
      ],
      created_at: Math.floor(Date.now() / 1000),
    }, sk);

    await this.publishToRelays(event);
  }
}

// Server-side only function to get bot instance
export function createNostrBot(): NostrBot | null {
  const botNsec = process.env.PODRAFFLE_BOT_NSEC;
  
  if (!botNsec) {
    console.warn('PODRAFFLE_BOT_NSEC environment variable not set');
    return null;
  }

  return new NostrBot(botNsec);
}

// Helper functions for easy use
export async function announceFundraiserCreated(options: FundraiserUpdateOptions): Promise<void> {
  const bot = createNostrBot();
  if (bot) {
    await bot.postFundraiserCreated(options);
  }
}

export async function announceWinner(options: WinnerAnnouncementOptions): Promise<void> {
  const bot = createNostrBot();
  if (bot) {
    await bot.postWinnerAnnouncement(options);
  }
}

export async function announceFundraiserEnded(options: FundraiserUpdateOptions & { totalRaised: number }): Promise<void> {
  const bot = createNostrBot();
  if (bot) {
    await bot.postFundraiserEnded(options);
  }
}