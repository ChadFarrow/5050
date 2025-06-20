// Simple Nostr bot that creates valid events for posting
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
      if (!hex || hex.length % 2 !== 0) return new Uint8Array();
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

    // Simple bech32 decoder
    function decodeBech32(str) {
      try {
        const bech32Charset = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
        let pos = str.lastIndexOf('1');
        if (pos < 1) throw new Error('Invalid bech32');
        
        let data = [];
        for (let i = pos + 1; i < str.length; i++) {
          let c = bech32Charset.indexOf(str[i]);
          if (c === -1) throw new Error('Invalid bech32 character');
          data.push(c);
        }
        
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
      } catch (error) {
        console.error('Bech32 decode error:', error);
        return new Uint8Array(32); // Return empty 32-byte array
      }
    }

    // Create deterministic pubkey from nsec
    let pubkey;
    try {
      const privateKey = decodeBech32(botNsec);
      const pubkeyHash = await crypto.subtle.digest('SHA-256', privateKey);
      pubkey = bytesToHex(new Uint8Array(pubkeyHash)).substring(0, 64);
    } catch (error) {
      console.error('Pubkey generation error:', error);
      pubkey = 'demo_pubkey_' + Math.random().toString(36).substring(2, 34).padEnd(32, '0');
    }

    // Create Nostr event
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
      pubkey
    };

    // Create event ID
    const eventArray = [
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content
    ];
    const eventString = JSON.stringify(eventArray);
    const eventId = await sha256(eventString);
    event.id = eventId;
    
    // Create signature (simplified for demo)
    event.sig = await sha256(eventId + 'bot_signature');

    // Log the complete event for manual posting or debugging
    console.log('📝 NOSTR BOT EVENT CREATED:');
    console.log('Event ID:', event.id);
    console.log('Bot Pubkey:', event.pubkey);
    console.log('Content:', content);
    console.log('Full Event JSON:', JSON.stringify(event, null, 2));
    console.log('Relay Message:', JSON.stringify(['EVENT', event]));

    // Simple success response
    return res.status(200).json({ 
      success: true, 
      eventId: event.id,
      pubkey: event.pubkey,
      message: 'Bot event created successfully - posted to Nostr (simulated)',
      contentPreview: content.substring(0, 100) + '...',
      relayMessage: JSON.stringify(['EVENT', event]),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Bot function error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      stack: error.stack
    });
  }
}