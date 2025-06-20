// Nostr bot that forwards to dedicated server
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, creator, ticketPrice, amount, endDate, description, url } = req.body;
    
    if (!title || !creator) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Your dedicated server URL
    const NOSTR_SERVER_URL = process.env.NOSTR_SERVER_URL || 'http://192.241.148.111:3000';
    
    console.log('📤 Forwarding to Nostr server:', NOSTR_SERVER_URL);
    
    // Forward to your dedicated Nostr server
    const response = await fetch(`${NOSTR_SERVER_URL}/post-to-nostr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, creator, ticketPrice, amount, endDate, description, url }),
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const result = await response.json();
    
    console.log('✅ Nostr server response:', result);

    return res.status(200).json({ 
      success: true, 
      eventId: result.eventId,
      message: `Posted to ${result.successfulPosts} Nostr relays via dedicated server`,
      serverResponse: result
    });

  } catch (error) {
    console.error('❌ Failed to contact Nostr server:', error);
    
    // Fallback: still create the event locally for logging
    const content = `🎉 New Fundraiser Created!

🎧 ${req.body.title}
👤 Creator: ${req.body.creator}
${req.body.ticketPrice ? `🎫 Ticket Price: ${req.body.ticketPrice} sats` : ''}

#PodRaffle #Bitcoin #Lightning #Nostr #Podcast`;

    console.log('📝 Fallback - would post:', content);
    
    return res.status(200).json({ 
      success: true, 
      eventId: 'fallback_' + Date.now(),
      message: 'Server posting failed - logged locally',
      error: error.message
    });
  }
}