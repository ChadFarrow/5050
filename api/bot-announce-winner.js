// Nostr bot for winner announcements
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, creator, winner, prizeAmount, totalRaised, url } = req.body;
    
    if (!title || !creator || !winner || !prizeAmount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Your dedicated server URL
    const NOSTR_SERVER_URL = process.env.NOSTR_SERVER_URL || 'http://192.241.148.111:3000';
    
    console.log('📤 Forwarding winner announcement to Nostr server:', NOSTR_SERVER_URL);
    
    // Forward to your dedicated Nostr server
    const response = await fetch(`${NOSTR_SERVER_URL}/post-winner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, creator, winner, prizeAmount, totalRaised, url }),
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const result = await response.json();
    
    console.log('✅ Winner announcement Nostr server response:', result);

    return res.status(200).json({ 
      success: true, 
      eventId: result.eventId,
      message: `Winner announcement posted to ${result.successfulPosts} Nostr relays`,
      serverResponse: result
    });

  } catch (error) {
    console.error('❌ Failed to contact Nostr server for winner announcement:', error);
    
    // Fallback: log what would be posted
    const content = `🏆 WE HAVE A WINNER! 🏆

🎧 ${req.body.title}
👤 Winner: ${req.body.winner}
💰 Prize: ${req.body.prizeAmount} sats
🎟️ Total Raised: ${req.body.totalRaised} sats

Congratulations to our winner! 🎉

${req.body.url}

#PodRaffle #Winner #Bitcoin #Lightning #Nostr`;

    console.log('📝 Fallback - would post:', content);
    
    return res.status(200).json({ 
      success: true, 
      eventId: 'fallback_winner_' + Date.now(),
      message: 'Server posting failed - logged locally',
      error: error.message
    });
  }
}