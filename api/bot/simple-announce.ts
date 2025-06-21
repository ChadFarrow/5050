// Simple bot announcement without nostr-tools dependencies
import { VercelRequest, VercelResponse } from '@vercel/node';

interface FundraiserData {
  title: string;
  creator: string;
  amount?: number;
  endDate?: number;
  ticketPrice?: number;
  description?: string;
  url?: string;
}

// This is a test/placeholder API endpoint

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const botNsec = process.env.PODRAFFLE_BOT_NSEC;
    
    if (!botNsec) {
      return res.status(500).json({ error: 'Bot configuration missing' });
    }

    const fundraiserData: FundraiserData = req.body;
    
    if (!fundraiserData.title || !fundraiserData.creator) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

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

    // For now, just return success without actually posting
    // This at least proves the API works
    console.log('Bot would post:', content);
    
    return res.status(200).json({ 
      success: true, 
      eventId: 'test_' + Date.now(),
      message: 'Bot announcement prepared (test mode)',
      content: content.substring(0, 100) + '...'
    });

  } catch (error) {
    console.error('Error in bot function:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}