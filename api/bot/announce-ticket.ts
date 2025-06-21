// Vercel serverless function for announcing ticket purchases
import { VercelRequest, VercelResponse } from '@vercel/node';

interface TicketPurchaseData {
  title: string;
  creator: string;
  buyerName: string;
  buyerPubkey: string;
  ticketCount: number;
  ticketPrice: number;
  totalAmount: number;
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

    const ticketData: TicketPurchaseData = req.body;
    
    if (!ticketData.title || !ticketData.creator || !ticketData.buyerName || !ticketData.buyerPubkey) {
      return res.status(400).json({ error: 'Missing required fields: title, creator, buyerName, buyerPubkey' });
    }

    // Get secret key from nsec
    const { data: secretKey } = nip19.decode(botNsec);
    
    // Create the announcement content
    const content = `🎫 Ticket Purchase!

🎧 ${ticketData.title}
👤 Creator: ${ticketData.creator}
🙋 Buyer: ${ticketData.buyerName}
🎫 ${ticketData.ticketCount} ticket${ticketData.ticketCount > 1 ? 's' : ''} @ ${ticketData.ticketPrice} sats each
💰 Total: ${ticketData.totalAmount} sats

${ticketData.url ? `Join: ${ticketData.url}` : ''}

#PodRaffle #TicketPurchase #Bitcoin #Lightning #Nostr`;

    // Create and sign the event
    const event = finalizeEvent({
      kind: 1,
      content,
      tags: [
        ['t', 'podraffle'],
        ['t', 'ticketpurchase'],
        ['t', 'bitcoin'],
        ['t', 'lightning'],
        ['p', ticketData.buyerPubkey], // Tag the buyer
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
        console.log(`✅ Published ticket purchase to ${relayUrl}`);
        return { relay: relayUrl, success: true };
      } catch (error) {
        console.error(`❌ Failed to publish ticket purchase to ${relayUrl}:`, error);
        return { relay: relayUrl, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(publishPromises);
    const publishResults = results.map(result => 
      result.status === 'fulfilled' ? result.value : { success: false, error: 'Promise rejected' }
    );

    console.log('Bot ticket purchase announcement posted:', event.id);
    
    return res.status(200).json({ 
      success: true, 
      eventId: event.id,
      publishResults 
    });

  } catch (error) {
    console.error('Error posting bot ticket purchase announcement:', error);
    return res.status(500).json({ 
      error: 'Failed to post ticket purchase announcement',
      details: error.message 
    });
  }
}