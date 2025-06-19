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
    const response = await fetch('/api/bot/announce-fundraiser', {
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