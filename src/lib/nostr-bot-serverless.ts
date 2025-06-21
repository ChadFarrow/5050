// Client-side functions to call Vercel serverless bot functions
interface FundraiserUpdateOptions {
  title: string;
  creator: string;
  amount?: number;
  endDate?: number;
  ticketPrice?: number;
  description?: string;
  url?: string;
}

interface WinnerAnnouncementOptions {
  title: string;
  creator: string;
  winner: string;
  prizeAmount: number;
  totalRaised: number;
  url?: string;
}

export async function announceFundraiserCreated(options: FundraiserUpdateOptions): Promise<void> {
  try {
    console.log('🚀 Attempting to post to /api/bot/announce-fundraiser with:', options);
    
    const response = await fetch('/api/bot/announce-fundraiser', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
    
    // Get response text first to see what we're actually getting
    const responseText = await response.text();
    console.log('📄 Raw response:', responseText);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    // Try to parse as JSON
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON response: ${responseText}`);
    }

    console.log('✅ Bot fundraiser announcement posted:', result.eventId);
    
    return result;
  } catch (error) {
    console.error('❌ Failed to post bot fundraiser announcement:', error);
    throw error;
  }
}

export async function announceWinner(options: WinnerAnnouncementOptions): Promise<void> {
  try {
    const response = await fetch('/api/bot/announce-winner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Bot winner announcement posted:', result.eventId);
    
    return result;
  } catch (error) {
    console.error('❌ Failed to post bot winner announcement:', error);
    throw error;
  }
}

interface TicketPurchaseOptions {
  title: string;
  creator: string;
  buyerName: string;
  buyerPubkey: string;
  ticketCount: number;
  ticketPrice: number;
  totalAmount: number;
  url?: string;
}

interface DonationOptions {
  title: string;
  creator: string;
  donorName: string;
  donorPubkey: string;
  amount: number;
  url?: string;
}

export async function announceTicketPurchase(options: TicketPurchaseOptions): Promise<void> {
  try {
    console.log('🚀 Attempting to post ticket purchase announcement:', options);
    
    const response = await fetch('/api/bot-announce-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    const responseText = await response.text();
    console.log('📄 Ticket purchase response:', responseText);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON response: ${responseText}`);
    }

    console.log('✅ Bot ticket purchase announcement posted:', result.eventId);
    return result;
  } catch (error) {
    console.error('❌ Failed to post bot ticket purchase announcement:', error);
    throw error;
  }
}

export async function announceDonation(options: DonationOptions): Promise<void> {
  try {
    console.log('🚀 Attempting to post donation announcement:', options);
    
    const response = await fetch('/api/bot/announce-donation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    const responseText = await response.text();
    console.log('📄 Donation response:', responseText);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON response: ${responseText}`);
    }

    console.log('✅ Bot donation announcement posted:', result.eventId);
    return result;
  } catch (error) {
    console.error('❌ Failed to post bot donation announcement:', error);
    throw error;
  }
}