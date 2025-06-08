# NIP-XX: Podcast 50/50 Fundraiser Events

`draft` `optional`

This NIP defines event kinds for creating and managing 50/50 style fundraisers for podcasters on Nostr.

## Event Kinds

### Kind 31950: Fundraiser

A fundraiser is an addressable event that defines a 50/50 raffle for a podcaster.

**Required tags:**
- `d` - unique identifier for the fundraiser
- `title` - fundraiser title
- `description` - fundraiser description
- `target` - target amount in millisats (string)
- `ticket_price` - price per ticket in millisats (string)
- `end_date` - unix timestamp when fundraiser ends (string)
- `podcast` - podcast name or identifier

**Optional tags:**
- `image` - fundraiser image URL
- `podcast_url` - podcast website or RSS feed URL
- `episode` - specific episode this fundraiser is for
- `duration` - fundraiser duration in seconds (alternative to calculating from creation time and end_date)

**Content:** Additional fundraiser details in plaintext

Example:
```json
{
  "kind": 31950,
  "content": "Help support our weekly podcast! 50% of funds raised go to the winner, 50% helps us keep the show running.",
  "tags": [
    ["d", "weekly-show-2024-01"],
    ["title", "Weekly Show Fundraiser"],
    ["description", "Support our weekly podcast with a chance to win!"],
    ["target", "1000000"],
    ["ticket_price", "10000"],
    ["end_date", "1704067200"],
    ["podcast", "The Weekly Show"],
    ["podcast_url", "https://example.com/podcast"],
    ["image", "https://example.com/campaign-image.jpg"]
  ],
  "pubkey": "...",
  "created_at": 1703462400,
  "id": "...",
  "sig": "..."
}
```

### Kind 31951: Ticket Purchase

A ticket purchase event represents a participant buying tickets for a fundraiser.

**Required tags:**
- `d` - unique identifier for this purchase
- `a` - fundraiser coordinate (kind:pubkey:d-tag)
- `amount` - total amount paid in millisats (string)
- `tickets` - number of tickets purchased (string)
- `bolt11` - lightning invoice that was paid
- `payment_hash` - payment hash from the lightning payment

**Optional tags:**
- `zap_receipt` - event ID of the corresponding zap receipt (kind 9735)

**Content:** Optional message from the ticket buyer

Example:
```json
{
  "kind": 31951,
  "content": "Good luck everyone!",
  "tags": [
    ["d", "purchase-abc123"],
    ["a", "31950:npub1234:weekly-show-2024-01"],
    ["amount", "50000"],
    ["tickets", "5"],
    ["bolt11", "lnbc500u1p..."],
    ["payment_hash", "abc123..."],
    ["zap_receipt", "def456..."]
  ],
  "pubkey": "...",
  "created_at": 1703462500,
  "id": "...",
  "sig": "..."
}
```

### Kind 31952: Fundraiser Result

A fundraiser result event is published by the fundraiser creator when the fundraiser ends, declaring the winner and final amounts.

**Required tags:**
- `d` - same as the original fundraiser d-tag
- `a` - fundraiser coordinate (kind:pubkey:d-tag)
- `winner` - pubkey of the winning participant
- `winning_ticket` - the winning ticket number (string)
- `total_raised` - total amount raised in millisats (string)
- `winner_amount` - amount going to winner in millisats (string)
- `creator_amount` - amount going to creator in millisats (string)
- `total_tickets` - total number of tickets sold (string)

**Optional tags:**
- `winner_payment` - lightning payment details for winner payout
- `random_seed` - seed used for random number generation (for transparency)

**Content:** Message about the fundraiser results

Example:
```json
{
  "kind": 31952,
  "content": "Congratulations to the winner! Thank you to everyone who participated.",
  "tags": [
    ["d", "weekly-show-2024-01"],
    ["a", "31950:npub1234:weekly-show-2024-01"],
    ["winner", "npub5678..."],
    ["winning_ticket", "42"],
    ["total_raised", "500000"],
    ["winner_amount", "250000"],
    ["creator_amount", "250000"],
    ["total_tickets", "50"],
    ["random_seed", "randomseed123"]
  ],
  "pubkey": "...",
  "created_at": 1704067300,
  "id": "...",
  "sig": "..."
}
```

## Implementation Notes

1. **Payment Integration**: Ticket purchases should integrate with NIP-57 Lightning Zaps for payments
2. **Fairness**: Random number generation for winner selection should be transparent and verifiable
3. **Validation**: Clients should validate that ticket purchases have corresponding valid lightning payments
4. **Fundraiser States**: Fundraisers can be in states: active, ended, or cancelled
5. **Ticket Numbering**: Tickets should be numbered sequentially starting from 1 for each fundraiser

## Security Considerations

- Verify lightning payments before counting ticket purchases
- Use cryptographically secure random number generation for winner selection
- Consider implementing dispute resolution mechanisms
- Validate fundraiser end dates and prevent manipulation