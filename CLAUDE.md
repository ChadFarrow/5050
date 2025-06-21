# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# PodRaffle - Podcast 50/50 Fundraising Platform

This project is a decentralized fundraising platform for podcasters built on the Nostr protocol. It enables podcasters to create 50/50 style fundraising campaigns where listeners purchase raffle tickets using Lightning payments, with half the proceeds going to a randomly selected winner and half supporting the podcast.

## Common Commands

- **Development**: `npm run dev` - Start development server with auto-install
- **Build**: `npm run build` - Build for production with 404.html copy for SPA routing  
- **Test**: `npm run test` - Run TypeScript check, ESLint, Vitest tests, and build
- **Deploy**: `npm run deploy` - Build and deploy to Surge.sh

**Single test file**: `npm run test -- path/to/test.test.tsx` or `npx vitest run path/to/test.test.tsx`

## Technology Stack

- **React 18.x**: Stable version of React with hooks, concurrent rendering, and improved performance
- **TailwindCSS 3.x**: Utility-first CSS framework for styling
- **Vite**: Fast build tool and development server
- **shadcn/ui**: Unstyled, accessible UI components built with Radix UI and Tailwind
- **Nostrify**: Nostr protocol framework for Deno and web
- **React Router**: For client-side routing with BrowserRouter and ScrollToTop functionality
- **TanStack Query**: For data fetching, caching, and state management
- **TypeScript**: For type-safe JavaScript development

## Core Application Architecture

This is a fundraising platform with three main business domains:

### Custom Nostr Events (defined in NIP.md)
- **Kind 31950**: Fundraiser campaigns with target amounts, ticket pricing, and end dates
- **Kind 31951**: Ticket purchases with Lightning payment verification
- **Kind 31952**: Campaign results with winner selection and payout distribution

### Key Data Flow
1. **Campaign Management**: `useFundraisers()` and `useFundraiser()` hooks query Kind 31950 events
2. **Ticket Tracking**: `useCampaignStats()` aggregates Kind 31951 purchase events and Kind 31952 results
3. **Payment Integration**: Lightning Network via NIP-47 Zaps (with real Lightning implementation)

### Domain-Specific Hooks
- `useFundraisers()` / `useCampaigns()`: Fetch all fundraiser campaigns with validation
- `useCampaignStats()`: Real-time campaign statistics, ticket purchases, and results
- `useUserTickets()`: User-specific ticket purchase history
- All hooks include comprehensive event validation according to NIP specification

## Lightning Network Integration

The project uses Bitcoin Connect for a modern, user-friendly Lightning wallet connection experience:

### Bitcoin Connect Integration
- **`@getalby/bitcoin-connect`**: Modern web components library for Lightning wallet connections
- **`useBitcoinConnect` Hook**: React hook for WebLN provider integration  
- **`useWallet` Hook**: Simplified interface using Bitcoin Connect
- **Web Components**: Native `<bc-button>` component for easy wallet selection
- **Multi-Wallet Support**: Alby, Coinos, LNC, and other WebLN-compatible wallets

### Core Features
- **Components**: `LightningInvoice` and `LightningConfig` provide complete wallet management UI
- **Real Lightning Payments**: Production-ready invoice creation and payment verification
- **Direct Payments**: Users can pay invoices directly from the interface without copy/paste
- **WebLN Integration**: Leverages the WebLN standard for seamless wallet interactions

### Setup Instructions
1. **Bitcoin Connect**: One-click connection with multiple wallet options
2. **Ticket Purchases**: Real Lightning invoices created and payable directly in the UI
3. **Wallet Support**: Works with any WebLN-compatible wallet

The implementation provides a streamlined Lightning experience focused on ease of use and broad wallet compatibility through the WebLN standard.

## Nostr Bot Configuration

**Digital Ocean Server:**
- **Server IP**: `192.241.148.111:3000`
- **PM2 Process**: `nostr-bot` (ID: 0)
- **Bot Code Location**: `/opt/nostr-bot/server.js`
- **Environment**: `PODRAFFLE_BOT_NSEC` set in `/opt/nostr-bot/.env`

**Available Endpoints:**
- `POST /post-to-nostr` - Fundraiser announcements (called by `/api/bot-announce`)
- `POST /post-ticket-purchase` - Ticket purchase announcements (called by `/api/bot-announce-ticket`)  
- `POST /post-donation` - Donation announcements (called by `/api/bot-announce-donation`)
- `POST /announce-winner` - Winner announcements
- `POST /health` - Health check
- `POST /test` - Test posting

**Vercel API Forwarding:**
- `/api/bot-announce.js` → forwards to `/post-to-nostr`
- `/api/bot-announce-ticket.js` → forwards to `/post-ticket-purchase`  
- `/api/bot-announce-donation.js` → forwards to `/post-donation`

**Bot Management Commands:**
```bash
# SSH to server
ssh root@192.241.148.111

# Check bot status
pm2 list
pm2 show 0

# View logs
pm2 logs 0 --lines 20

# Restart bot
pm2 restart 0

# Edit bot code
nano /opt/nostr-bot/server.js

# Check what's running on port 3000
netstat -tlnp | grep 3000
```

**Content Enhancement:**
- Vercel functions create enhanced content with prize pool and time remaining
- Profile links automatically added using `createNostrProfileUrl()` and nosta.me
- Prices converted from msats to sats before sending to bot
- Bot uses `req.body.content ||` fallback pattern for backward compatibility

## Custom NIP Implementation

This project implements a custom NIP for podcast fundraising documented in `NIP.md`. The three event kinds (31950, 31951, 31952) are addressable events that enable:

- **Campaign Discovery**: Query Kind 31950 events to find active fundraisers
- **Payment Tracking**: Kind 31951 events link Lightning payments to ticket purchases
- **Result Verification**: Kind 31952 events provide transparent winner selection

**Critical**: When modifying fundraiser functionality, always update `NIP.md` to reflect changes in event structure, required tags, or validation rules. The hooks in `src/hooks/useCampaigns.ts` and `src/hooks/useCampaignStats.ts` contain validation functions that must match the NIP specification.

## Testing Your Changes

Run the comprehensive test suite with: `npm run test`

This command runs TypeScript checking, ESLint, Vitest tests, and a production build to ensure code quality and deployment readiness.