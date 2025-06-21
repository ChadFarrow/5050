// Vercel serverless function for announcing donations
import { VercelRequest, VercelResponse } from '@vercel/node';

interface DonationData {
  title: string;
  creator: string;
  donorName: string;
  donorPubkey: string;
  amount: number;
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

    const donationData: DonationData = req.body;
    
    if (!donationData.title || !donationData.creator || !donationData.donorName || !donationData.donorPubkey) {
      return res.status(400).json({ error: 'Missing required fields: title, creator, donorName, donorPubkey' });
    }

    // Get secret key from nsec
    const { data: secretKey } = nip19.decode(botNsec);
    
    // Create the announcement content
    const content = `💝 Prize Pool Donation!

🎧 ${donationData.title}
👤 Creator: ${donationData.creator}
🙋 Donor: ${donationData.donorName}
💰 Donation: ${donationData.amount} sats

This donation increases the prize pool for all participants! 🎉

${donationData.url ? `Join: ${donationData.url}` : ''}

#PodRaffle #Donation #Bitcoin #Lightning #Nostr`;

    // Create and sign the event
    const event = finalizeEvent({
      kind: 1,
      content,
      tags: [
        ['t', 'podraffle'],
        ['t', 'donation'],
        ['t', 'bitcoin'],
        ['t', 'lightning'],
        ['p', donationData.donorPubkey], // Tag the donor
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
        console.log(`✅ Published donation to ${relayUrl}`);
        return { relay: relayUrl, success: true };
      } catch (error) {
        console.error(`❌ Failed to publish donation to ${relayUrl}:`, error);
        return { relay: relayUrl, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(publishPromises);
    const publishResults = results.map(result => 
      result.status === 'fulfilled' ? result.value : { success: false, error: 'Promise rejected' }
    );

    console.log('Bot donation announcement posted:', event.id);
    
    return res.status(200).json({ 
      success: true, 
      eventId: event.id,
      publishResults 
    });

  } catch (error) {
    console.error('Error posting bot donation announcement:', error);
    return res.status(500).json({ 
      error: 'Failed to post donation announcement',
      details: error.message 
    });
  }
}