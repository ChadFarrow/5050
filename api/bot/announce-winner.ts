// Vercel serverless function for announcing fundraiser winners
import { VercelRequest, VercelResponse } from '@vercel/node';

interface WinnerData {
  title: string;
  creator: string;
  winner: string;
  prizeAmount: number;
  totalRaised: number;
  url?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Import dynamically to avoid build issues
    const { finalizeEvent, nip19 } = await import('nostr-tools');
    const { Relay } = await import('nostr-tools/relay');
    
    const botNsec = process.env.PODRAFFLE_BOT_NSEC;
    
    if (!botNsec) {
      console.error('PODRAFFLE_BOT_NSEC environment variable not set');
      return res.status(500).json({ error: 'Bot configuration error' });
    }

    const winnerData: WinnerData = req.body;
    
    if (!winnerData.title || !winnerData.creator || !winnerData.winner) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, creator, winner' 
      });
    }

    // Get secret key from nsec
    const { data: secretKey } = nip19.decode(botNsec);
    
    // Create the winner announcement content
    const content = `🏆 Winner Announced!

🎧 ${winnerData.title}
👤 Creator: ${winnerData.creator}
🎉 Winner: ${winnerData.winner}
💰 Prize: ${winnerData.prizeAmount} sats
📊 Total Raised: ${winnerData.totalRaised} sats

Congratulations to the winner! 🎉

${winnerData.url ? `View: ${winnerData.url}` : ''}

#PodRaffle #Bitcoin #Lightning #Winner #Podcast`;

    // Create and sign the event
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
    }, secretKey as Uint8Array);

    // Publish to relays
    const relays = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://relay.primal.net'];
    const publishPromises = relays.map(async (relayUrl) => {
      try {
        const relay = await Relay.connect(relayUrl);
        await relay.publish(event);
        relay.close();
        console.log(`✅ Published to ${relayUrl}`);
        return { relay: relayUrl, success: true };
      } catch (error) {
        console.error(`❌ Failed to publish to ${relayUrl}:`, error);
        return { relay: relayUrl, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(publishPromises);
    const publishResults = results.map(result => 
      result.status === 'fulfilled' ? result.value : { success: false, error: 'Promise rejected' }
    );

    console.log('Bot winner announcement posted:', event.id);
    
    return res.status(200).json({ 
      success: true, 
      eventId: event.id,
      publishResults 
    });

  } catch (error) {
    console.error('Error posting bot winner announcement:', error);
    return res.status(500).json({ 
      error: 'Failed to post winner announcement',
      details: error.message 
    });
  }
}