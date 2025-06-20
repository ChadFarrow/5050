// Nostr bot for donation announcements
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, creator, donorName, donorPubkey, amount, url } = req.body;
    
    if (!title || !creator || !donorName || !donorPubkey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Your dedicated server URL
    const NOSTR_SERVER_URL = process.env.NOSTR_SERVER_URL || 'http://192.241.148.111:3000';
    
    console.log('📤 Forwarding donation to Nostr server:', NOSTR_SERVER_URL);
    
    // Forward to your dedicated Nostr server
    const response = await fetch(`${NOSTR_SERVER_URL}/post-donation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, creator, donorName, donorPubkey, amount, url }),
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const result = await response.json();
    
    console.log('✅ Donation Nostr server response:', result);

    return res.status(200).json({ 
      success: true, 
      eventId: result.eventId,
      message: `Donation posted to ${result.successfulPosts} Nostr relays`,
      serverResponse: result
    });

  } catch (error) {
    console.error('❌ Failed to contact Nostr server for donation:', error);
    
    // Fallback: log what would be posted
    const content = `💝 Donation Received!

🎧 ${req.body.title}
👤 Donor: ${req.body.donorName}
💰 Amount: ${req.body.amount} sats

Thank you for supporting this fundraiser! 🙏

#PodRaffle #Donation`;

    console.log('📝 Fallback - would post:', content);
    
    return res.status(200).json({ 
      success: true, 
      eventId: 'fallback_donation_' + Date.now(),
      message: 'Server posting failed - logged locally',
      error: error.message
    });
  }
}