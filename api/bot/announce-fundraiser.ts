// Vercel serverless function for announcing new fundraisers
import { VercelRequest, VercelResponse } from '@vercel/node';
import { finalizeEvent, nip19 } from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';

interface FundraiserData {
  title: string;
  creator: string;
  amount?: number;
  endDate?: number;
  ticketPrice?: number;
  description?: string;
  url?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const botNsec = process.env.PODRAFFLE_BOT_NSEC;
    
    if (!botNsec) {
      console.error('PODRAFFLE_BOT_NSEC environment variable not set');
      return res.status(500).json({ error: 'Bot configuration error' });
    }

    const fundraiserData: FundraiserData = req.body;
    
    if (!fundraiserData.title || !fundraiserData.creator) {
      return res.status(400).json({ error: 'Missing required fields: title, creator' });
    }

    // Get secret key from nsec
    const { data: secretKey } = nip19.decode(botNsec);
    
    // Create the announcement content
    const content = `🎉 New Fundraiser Created!

🎧 ${fundraiserData.title}
👤 Creator: ${fundraiserData.creator}
${fundraiserData.ticketPrice ? `🎫 Ticket Price: ${fundraiserData.ticketPrice} sats` : ''}
${fundraiserData.amount ? `🎯 Target: ${fundraiserData.amount} sats` : ''}
${fundraiserData.endDate ? `⏰ Ends: ${new Date(fundraiserData.endDate * 1000).toLocaleDateString()}` : ''}

${fundraiserData.description || ''}

${fundraiserData.url ? `Join: ${fundraiserData.url}` : ''}

#PodRaffle #Bitcoin #Lightning #Nostr #Podcast`;

    // Create and sign the event
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

    console.log('Bot announcement posted:', event.id);
    
    return res.status(200).json({ 
      success: true, 
      eventId: event.id,
      publishResults 
    });

  } catch (error) {
    console.error('Error posting bot announcement:', error);
    return res.status(500).json({ 
      error: 'Failed to post announcement',
      details: error.message 
    });
  }
}