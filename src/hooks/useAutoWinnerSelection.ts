import { useEffect, useRef } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useFundraisers } from '@/hooks/useCampaigns';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useQueryClient } from '@tanstack/react-query';
import { formatSats } from '@/lib/utils';
import type { Fundraiser } from '@/hooks/useCampaigns';
import type { CampaignStats, TicketPurchase } from '@/hooks/useCampaignStats';

interface TicketAssignment {
  purchaseIndex: number;
  purchase: TicketPurchase;
  startTicket: number;
  endTicket: number;
}

// Generate cryptographically secure random number
function generateSecureRandomSeed(): string {
  const array = new Uint32Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, num => num.toString(16).padStart(8, '0')).join('');
}

// Generate deterministic random number from seed
function seededRandom(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Normalize to 0-1 range and scale to min-max
  const normalized = Math.abs(hash) / 2147483647;
  return Math.floor(normalized * (max - min + 1)) + min;
}

export function useAutoWinnerSelection() {
  const { user } = useCurrentUser();
  const { data: fundraisers } = useFundraisers();
  const { mutate: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const processedFundraisers = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !fundraisers) return;

    const checkAndDrawWinners = async () => {
      const now = Math.floor(Date.now() / 1000);
      
      // Find fundraisers created by the current user that have ended but no winner yet
      // Skip fundraisers marked for manual draw
      const expiredUserFundraisers = fundraisers.filter(fundraiser => 
        fundraiser.pubkey === user.pubkey && 
        fundraiser.endDate <= now && 
        !fundraiser.isActive &&
        !fundraiser.manualDraw && // Skip manual draw fundraisers
        !processedFundraisers.current.has(fundraiser.id)
      );

      console.log('🤖 Auto-winner selection check:', {
        currentTime: now,
        totalFundraisers: fundraisers.length,
        userFundraisers: fundraisers.filter(f => f.pubkey === user.pubkey).length,
        userEndedFundraisers: fundraisers.filter(f => f.pubkey === user.pubkey && f.endDate <= now).length,
        expiredUserFundraisers: expiredUserFundraisers.length,
        processedCount: processedFundraisers.current.size,
        processed: Array.from(processedFundraisers.current),
      });

      // Debug: Show details about user's fundraisers
      const userFundraisers = fundraisers.filter(f => f.pubkey === user.pubkey);
      userFundraisers.forEach(f => {
        console.log(`📊 Fundraiser "${f.title}":`, {
          id: f.id,
          endDate: f.endDate,
          endDateReadable: new Date(f.endDate * 1000).toLocaleString(),
          isActive: f.isActive,
          isExpired: f.endDate <= now,
          isProcessed: processedFundraisers.current.has(f.id),
        });
      });

      for (const fundraiser of expiredUserFundraisers) {
        // Mark as processed immediately to avoid duplicate processing
        processedFundraisers.current.add(fundraiser.id);
        
        try {
          // Get campaign stats to check if winner already exists and get ticket data
          const statsQueryKey = ['fundraiser-stats', fundraiser.pubkey, fundraiser.dTag];
          let stats = queryClient.getQueryData<CampaignStats>(statsQueryKey);
          
          // If stats not in cache, fetch them
          if (!stats) {
            console.log(`Fetching stats for fundraiser ${fundraiser.id} to check for auto-winner selection`);
            await queryClient.prefetchQuery({
              queryKey: statsQueryKey,
              staleTime: 0, // Force fresh data
            });
            stats = queryClient.getQueryData<CampaignStats>(statsQueryKey);
          }

          // Skip if no stats, already has winner, or no tickets sold
          if (!stats || stats.result || stats.totalTickets === 0) {
            console.log(`⏭️ Skipping fundraiser "${fundraiser.title}" (${fundraiser.id}):`, {
              hasStats: !!stats,
              hasWinner: !!stats?.result,
              totalTickets: stats?.totalTickets || 0,
              totalRaised: stats?.totalRaised || 0,
              purchases: stats?.purchases?.length || 0,
            });
            continue;
          }

          console.log(`Auto-drawing winner for fundraiser: ${fundraiser.title}`, {
            totalTickets: stats.totalTickets,
            totalRaised: stats.totalRaised,
            purchases: stats.purchases.length,
          });

          await drawWinnerForFundraiser(fundraiser, stats);
        } catch (error) {
          console.error(`Failed to auto-draw winner for fundraiser ${fundraiser.id}:`, error);
          // Remove from processed set so it can be retried later
          processedFundraisers.current.delete(fundraiser.id);
        }
      }
    };

    const drawWinnerForFundraiser = async (fundraiser: Fundraiser, stats: CampaignStats) => {
      // Create ticket assignments array
      const ticketAssignments: TicketAssignment[] = [];
      let currentTicket = 1;
      
      stats.purchases.forEach((purchase, index) => {
        const startTicket = currentTicket;
        const endTicket = currentTicket + purchase.tickets - 1;
        
        ticketAssignments.push({
          purchaseIndex: index,
          purchase,
          startTicket,
          endTicket,
        });
        
        currentTicket = endTicket + 1;
      });

      // Generate secure random seed
      const randomSeed = generateSecureRandomSeed();
      
      // Select winning ticket number
      const winningTicketNumber = seededRandom(randomSeed, 1, stats.totalTickets);
      
      // Find the winner
      const winnerAssignment = ticketAssignments.find(
        assignment => winningTicketNumber >= assignment.startTicket && winningTicketNumber <= assignment.endTicket
      );

      if (!winnerAssignment) {
        throw new Error('Failed to determine winner in auto-selection');
      }

      // Calculate amounts (50/50 split)
      const totalRaised = stats.totalRaised;
      const winnerAmount = Math.floor(totalRaised / 2);
      const creatorAmount = totalRaised - winnerAmount;

      // Create campaign coordinate
      const campaignCoordinate = `31950:${fundraiser.pubkey}:${fundraiser.dTag}`;

      // Build tags for result event
      const tags: string[][] = [
        ["d", fundraiser.dTag],
        ["a", campaignCoordinate],
        ["winner", winnerAssignment.purchase.pubkey],
        ["winning_ticket", winningTicketNumber.toString()],
        ["total_raised", totalRaised.toString()],
        ["winner_amount", winnerAmount.toString()],
        ["creator_amount", creatorAmount.toString()],
        ["total_tickets", stats.totalTickets.toString()],
        ["random_seed", randomSeed],
        ["auto_drawn", "true"], // Mark as automatically drawn
      ];

      const content = `🎉 Winner automatically selected! Out of ${stats.totalTickets} tickets sold, ticket #${winningTicketNumber} was drawn. The winner receives ${formatSats(winnerAmount)} and ${formatSats(creatorAmount)} goes to support ${fundraiser.podcast}. This winner was selected automatically when the fundraiser ended.`;

      return new Promise<void>((resolve, reject) => {
        publishEvent({
          kind: 31952,
          content,
          tags,
        }, {
          onSuccess: (eventId) => {
            console.log(`Auto-winner selection published for fundraiser ${fundraiser.id}:`, eventId);
            
            // Invalidate queries to refresh the UI
            queryClient.invalidateQueries({ queryKey: ['fundraiser-stats', fundraiser.pubkey, fundraiser.dTag] });
            queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
            
            resolve();
          },
          onError: (error) => {
            console.error(`Failed to publish auto-winner selection for fundraiser ${fundraiser.id}:`, error);
            reject(error);
          }
        });
      });
    };

    // Run initial check immediately
    console.log('🚀 Starting auto-winner selection system...');
    checkAndDrawWinners();

    // Run another check after 5 seconds to catch any that might have been missed
    const quickRecheck = setTimeout(checkAndDrawWinners, 5000);

    // Set up periodic checking every 30 seconds
    const interval = setInterval(checkAndDrawWinners, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(quickRecheck);
    };
  }, [user, fundraisers, publishEvent, queryClient]);

  // Function to manually reset processed fundraisers (for testing)
  const resetProcessedFundraisers = () => {
    processedFundraisers.current.clear();
    console.log('🔄 Reset processed fundraisers list');
  };

  // Function to manually trigger winner selection check
  const manualTriggerCheck = () => {
    console.log('🔧 Manual trigger: checking for winners...');
    if (user && fundraisers) {
      const checkAndDrawWinners = async () => {
        // Same logic as above - this is a simplified manual trigger
        const now = Math.floor(Date.now() / 1000);
        const expiredUserFundraisers = fundraisers.filter(fundraiser => 
          fundraiser.pubkey === user.pubkey && 
          fundraiser.endDate <= now && 
          !fundraiser.isActive
        );
        console.log('🔍 Manual check found expired fundraisers:', expiredUserFundraisers.length);
      };
      checkAndDrawWinners();
    }
  };

  return {
    resetProcessedFundraisers,
    manualTriggerCheck,
  };
}