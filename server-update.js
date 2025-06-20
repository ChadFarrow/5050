// Add these new endpoints to your server.js file

// Add after the existing /post-to-nostr endpoint:

app.post('/post-ticket-purchase', async (req, res) => {
  try {
    console.log('🎫 Received ticket purchase to post:', req.body);
    
    const botNsec = process.env.PODRAFFLE_BOT_NSEC;
    if (!botNsec) {
      return res.status(500).json({ error: 'Bot not configured' });
    }

    const { title, creator, buyerName, buyerPubkey, ticketCount, ticketPrice, totalAmount, url } = req.body;
    
    const content = `🎫 Ticket Purchase!

🎧 ${title}
👤 Buyer: @${buyerName}
🎫 ${ticketCount} ticket${ticketCount > 1 ? 's' : ''} @ ${ticketPrice} sats each
💰 Total: ${totalAmount} sats

Good luck! 🍀

${url ? `Join: ${url}` : ''}

#PodRaffle #TicketPurchase #Bitcoin #Lightning`;

    const { data: secretKey } = nip19.decode(botNsec);
    const publicKey = getPublicKey(secretKey);
    
    console.log('🔑 Bot posting ticket purchase as:', nip19.npubEncode(publicKey));
    
    const event = finalizeEvent({
      kind: 1,
      content,
      tags: [
        ['t', 'podraffle'],
        ['t', 'ticketpurchase'],
        ['t', 'bitcoin'],
        ['t', 'lightning'],
        ['p', buyerPubkey, '', 'mention'],
      ],
      created_at: Math.floor(Date.now() / 1000),
    }, secretKey);

    console.log('🎫 Created ticket purchase event:', event.id);

    const relays = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://relay.primal.net'];
    const results = [];
    
    for (const relayUrl of relays) {
      try {
        console.log(`🔌 Connecting to ${relayUrl}...`);
        const relay = await Relay.connect(relayUrl);
        await relay.publish(event);
        relay.close();
        console.log(`✅ Published ticket purchase to ${relayUrl}`);
        results.push({ relay: relayUrl, success: true });
      } catch (error) {
        console.error(`❌ Failed to publish ticket purchase to ${relayUrl}:`, error.message);
        results.push({ relay: relayUrl, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`🎫 Ticket purchase posted to ${successCount}/${results.length} relays`);

    res.json({ 
      success: true, 
      eventId: event.id,
      pubkey: event.pubkey,
      npub: nip19.npubEncode(event.pubkey),
      publishResults: results,
      successfulPosts: successCount,
      content: content
    });

  } catch (error) {
    console.error('❌ Ticket purchase server error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/post-donation', async (req, res) => {
  try {
    console.log('💝 Received donation to post:', req.body);
    
    const botNsec = process.env.PODRAFFLE_BOT_NSEC;
    if (!botNsec) {
      return res.status(500).json({ error: 'Bot not configured' });
    }

    const { title, creator, donorName, donorPubkey, amount, url } = req.body;
    
    const content = `💝 Donation Received!

🎧 ${title}
👤 Generous donor: @${donorName}
💰 Amount: ${amount} sats

Thank you for supporting this fundraiser! 🙏

${url ? `Join: ${url}` : ''}

#PodRaffle #Donation #Bitcoin #Lightning #Support`;

    const { data: secretKey } = nip19.decode(botNsec);
    const publicKey = getPublicKey(secretKey);
    
    console.log('🔑 Bot posting donation as:', nip19.npubEncode(publicKey));
    
    const event = finalizeEvent({
      kind: 1,
      content,
      tags: [
        ['t', 'podraffle'],
        ['t', 'donation'],
        ['t', 'bitcoin'],
        ['t', 'lightning'],
        ['t', 'support'],
        ['p', donorPubkey, '', 'mention'],
      ],
      created_at: Math.floor(Date.now() / 1000),
    }, secretKey);

    console.log('💝 Created donation event:', event.id);

    const relays = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://relay.primal.net'];
    const results = [];
    
    for (const relayUrl of relays) {
      try {
        console.log(`🔌 Connecting to ${relayUrl}...`);
        const relay = await Relay.connect(relayUrl);
        await relay.publish(event);
        relay.close();
        console.log(`✅ Published donation to ${relayUrl}`);
        results.push({ relay: relayUrl, success: true });
      } catch (error) {
        console.error(`❌ Failed to publish donation to ${relayUrl}:`, error.message);
        results.push({ relay: relayUrl, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`💝 Donation posted to ${successCount}/${results.length} relays`);

    res.json({ 
      success: true, 
      eventId: event.id,
      pubkey: event.pubkey,
      npub: nip19.npubEncode(event.pubkey),
      publishResults: results,
      successfulPosts: successCount,
      content: content
    });

  } catch (error) {
    console.error('❌ Donation server error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});