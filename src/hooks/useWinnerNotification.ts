import { useCallback } from 'react';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import type { CampaignResult } from './useCampaignStats';
import type { Campaign } from './useCampaigns';

export function useWinnerNotification() {
  const { mutate: publishEvent } = useNostrPublish();
  const { user } = useCurrentUser();

  const sendWinnerNotification = useCallback(async (
    campaign: Campaign,
    result: CampaignResult,
    winnerPubkey: string
  ) => {
    if (!user) {
      throw new Error('User not logged in');
    }

    // Create the notification message
    const notificationMessage = `🎉 Congratulations! You won the "${campaign.title}" raffle!

🎫 Your winning ticket: #${result.winningTicket}
💰 Prize amount: ${Math.floor(result.winnerAmount / 1000)} sats
🏆 Out of ${result.totalTickets} tickets sold

To claim your prize:
1. Visit: ${window.location.origin}/campaign/${campaign.pubkey}/${campaign.dTag}
2. Look for the "Claim Prize" button
3. Enter your Lightning address or invoice
4. The campaign creator will send your winnings

This message was sent automatically when the raffle ended. Contact the campaign creator if you have any questions.

Campaign: ${campaign.title}
Creator: ${campaign.podcast}`;

    return new Promise<void>((resolve, reject) => {
      // Use the signer to encrypt the message (NIP-04)
      if (user.signer.nip04?.encrypt) {
        user.signer.nip04.encrypt(winnerPubkey, notificationMessage)
          .then(encryptedContent => {
            // Send encrypted DM (kind 4)
            publishEvent({
              kind: 4,
              content: encryptedContent,
              tags: [
                ['p', winnerPubkey],
                ['subject', `You won the ${campaign.title} raffle!`]
              ]
            }, {
              onSuccess: () => {
                console.log('Winner notification sent successfully to:', winnerPubkey);
                resolve();
              },
              onError: (error) => {
                console.error('Failed to send winner notification:', error);
                reject(error);
              }
            });
          })
          .catch(error => {
            console.error('Failed to encrypt winner notification:', error);
            reject(error);
          });
      } else {
        // Fallback: send unencrypted mention (not ideal but better than nothing)
        console.warn('NIP-04 encryption not available, sending public mention instead');
        publishEvent({
          kind: 1, // Text note
          content: `🎉 @${winnerPubkey} won the "${campaign.title}" raffle! Ticket #${result.winningTicket} won ${Math.floor(result.winnerAmount / 1000)} sats! Visit ${window.location.origin}/campaign/${campaign.pubkey}/${campaign.dTag} to claim your prize.`,
          tags: [
            ['p', winnerPubkey],
            ['t', 'raffle'],
            ['t', 'winner'],
          ]
        }, {
          onSuccess: () => {
            console.log('Winner mention sent successfully to:', winnerPubkey);
            resolve();
          },
          onError: (error) => {
            console.error('Failed to send winner mention:', error);
            reject(error);
          }
        });
      }
    });
  }, [user, publishEvent]);

  return { sendWinnerNotification };
}