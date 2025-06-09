# PodRaffle - 50/50 Fundraisers for Podcasters

A decentralized platform built on Nostr for podcasters to run 50/50 style fundraisers. Listeners can buy raffle tickets using Lightning payments, with half the proceeds going to the winner and half supporting the podcast.

## Features

- **Decentralized**: Built on Nostr protocol for censorship resistance
- **Lightning Payments**: Fast, low-fee Bitcoin payments via Lightning Network
- **50/50 Split**: Fair distribution - half to winner, half to creator
- **Transparent**: All transactions and winner selection verifiable on Nostr
- **Mobile Friendly**: Responsive design works on all devices

## How It Works

### For Podcasters
1. **Create Campaign**: Set up a fundraiser with target amount, ticket price, and end date
2. **Promote**: Share your campaign with listeners
3. **Automatic Payout**: When campaign ends, 50% goes to random winner, 50% to you

### For Listeners
1. **Browse Campaigns**: Discover active fundraisers from your favorite podcasters
2. **Buy Tickets**: Purchase raffle tickets with Lightning payments
3. **Win Big**: Get a chance to win half the total pot while supporting creators

## Technology Stack

- **Frontend**: React 18, TypeScript, TailwindCSS, shadcn/ui
- **Protocol**: Nostr (decentralized social protocol)
- **Payments**: Lightning Network (Bitcoin Layer 2)
- **Build Tool**: Vite
- **State Management**: TanStack Query

## Custom Nostr Events

This application defines custom Nostr event kinds for fundraiser functionality:

- **Kind 31950**: Fundraiser Campaign - Defines campaign details, target, pricing
- **Kind 31951**: Ticket Purchase - Records ticket purchases with payment proof  
- **Kind 31952**: Campaign Result - Declares winner and final distribution

See `NIP.md` for complete event specifications.

## Getting Started

### Prerequisites
- Node.js 18+
- A Nostr client/extension (like Alby, nos2x) for authentication
- Lightning wallet for payments

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd podraffle

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building for Production

```bash
npm run build
```

## Usage

### Creating a Campaign

1. **Login**: Connect your Nostr account using a browser extension
2. **Create**: Click "Create Fundraiser" and fill in campaign details:
   - Campaign title and description
   - Podcast information
   - Target amount (in sats)
   - Ticket price (in sats)
   - End date
3. **Publish**: Campaign is published to Nostr relays

### Buying Tickets

1. **Browse**: View active campaigns on the homepage
2. **Select**: Click on a campaign to view details
3. **Purchase**: Choose number of tickets and complete Lightning payment
4. **Track**: View your tickets and win probability

### Campaign Management

- Campaigns automatically end at the specified date
- Winner selection uses cryptographically secure randomness
- Results are published to Nostr for transparency
- Payouts are handled automatically via Lightning

## Configuration

### Relay Settings
The app connects to Nostr relays to fetch and publish events. Users can switch between different relays using the relay selector.

Default relays:
- wss://relay.nostr.band
- wss://relay.damus.io
- wss://nos.lol

### Lightning Integration
Currently uses mock Lightning payments for demo purposes. In production, this would integrate with:
- LNURL-pay for receiving payments
- Lightning wallets for payouts
- NIP-57 Zaps for Nostr-native payments

## Development

### Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui components
│   ├── auth/           # Authentication components
│   ├── CampaignCard.tsx
│   ├── CreateCampaignDialog.tsx
│   └── BuyTicketsDialog.tsx
├── hooks/              # Custom React hooks
│   ├── useCampaigns.ts
│   ├── useCampaignStats.ts
│   └── useNostr.ts
├── pages/              # Page components
│   ├── Index.tsx
│   └── Campaign.tsx
├── lib/                # Utility functions
└── contexts/           # React contexts
```

### Custom Hooks

- `useCampaigns()`: Fetch all fundraiser campaigns
- `useCampaignStats()`: Get campaign statistics and ticket purchases
- `useCurrentUser()`: Access logged-in user information
- `useNostrPublish()`: Publish events to Nostr

### Adding Features

1. **New Event Types**: Update `NIP.md` and create validation functions
2. **UI Components**: Use shadcn/ui patterns for consistency
3. **Hooks**: Follow TanStack Query patterns for data fetching
4. **Styling**: Use Tailwind classes and CSS custom properties

## Security Considerations

- **Payment Verification**: All ticket purchases must have valid Lightning payment proof
- **Random Selection**: Winner selection uses cryptographically secure randomness
- **Event Validation**: All Nostr events are validated before processing
- **User Authentication**: Secure key management via Nostr browser extensions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For questions or support:
- Open an issue on GitHub
- Join the discussion on Nostr
- Contact the development team

---

**Disclaimer**: This is experimental software. Use at your own risk. Always verify payments and campaign details before participating.