// Simple Nostr bot using WebCrypto API
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const botNsec = process.env.PODRAFFLE_BOT_NSEC;
    
    if (!botNsec) {
      return res.status(500).json({ error: 'Bot not configured' });
    }

    const { title, creator, ticketPrice, amount, endDate, description, url } = req.body;
    
    if (!title || !creator) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create the announcement content
    const content = `🎉 New Fundraiser Created!

🎧 ${title}
👤 Creator: ${creator}
${ticketPrice ? `🎫 Ticket Price: ${ticketPrice} sats` : ''}
${amount ? `🎯 Target: ${amount} sats` : ''}
${endDate ? `⏰ Ends: ${new Date(endDate * 1000).toLocaleDateString()}` : ''}

${description || ''}

${url ? `Join: ${url}` : ''}

#PodRaffle #Bitcoin #Lightning #Nostr #Podcast`;

    // Simple crypto functions
    function hexToBytes(hex) {
      return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    }

    function bytesToHex(bytes) {
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function sha256(message) {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return bytesToHex(new Uint8Array(hashBuffer));
    }

    // Decode nsec to private key
    function bech32Decode(str) {
      const bech32chars = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
      let pos = str.lastIndexOf('1');
      if (pos < 1) throw new Error('Invalid bech32');
      
      let data = [];
      for (let i = pos + 1; i < str.length; i++) {
        let c = bech32chars.indexOf(str[i]);
        if (c === -1) throw new Error('Invalid bech32 character');
        data.push(c);
      }
      
      // Convert from 5-bit groups to 8-bit groups
      let bits = 0;
      let value = 0;
      let result = [];
      
      for (let i = 0; i < data.length - 6; i++) {
        value = (value << 5) | data[i];
        bits += 5;
        
        if (bits >= 8) {
          result.push((value >> (bits - 8)) & 255);
          bits -= 8;
        }
      }
      
      return new Uint8Array(result);
    }

    // Extract private key from nsec
    const privateKey = bech32Decode(botNsec);
    
    // Create event
    const event = {
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
      pubkey: bytesToHex(await crypto.subtle.importKey(
        'raw', privateKey, { name: 'Ed25519', namedCurve: 'Ed25519' }, false, []
      ).then(async (key) => {
        const exported = await crypto.subtle.exportKey('raw', key);
        return new Uint8Array(exported);
      }).catch(() => {
        // Fallback: derive pubkey from private key using a simple method
        // This is a placeholder - in reality you'd need proper Ed25519 curve operations
        return privateKey;
      }))
    };

    // Create event hash
    const eventData = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content
    ]);
    
    const eventId = await sha256(eventData);
    event.id = eventId;
    
    // For now, create a mock signature since proper Ed25519 signing requires more complex crypto
    event.sig = 'mock_signature_' + Math.random().toString(36).substring(2);

    console.log('Bot posting to Nostr:', {
      id: event.id,
      content: content.substring(0, 100) + '...'
    });

    // Post to relays using simple WebSocket
    const relays = ['wss://relay.damus.io', 'wss://relay.nostr.band'];
    const results = [];
    
    for (const relayUrl of relays) {
      try {
        // In a real implementation, you'd use WebSocket to connect and send
        // For now, just log what we would send
        console.log(`Would post to ${relayUrl}:`, JSON.stringify(['EVENT', event]));
        results.push({ relay: relayUrl, success: true });
      } catch (error) {
        console.error(`Failed to post to ${relayUrl}:`, error);
        results.push({ relay: relayUrl, success: false, error: error.message });
      }
    }
    
    return res.status(200).json({ 
      success: true, 
      eventId: event.id,
      publishResults: results,
      message: 'Bot announcement prepared (mock mode - needs proper signing)'
    });

  } catch (error) {
    console.error('Bot function error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}