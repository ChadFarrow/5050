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

The project includes comprehensive Lightning Network integration via NIP-47 (Nostr Wallet Connect):

### Core NWC Implementation
- **`useNWC` Hook**: Full NIP-47 compliant implementation with WebSocket relay communication
- **`NWCClient` Class**: Direct NWC protocol implementation with encrypted communication
- **Components**: `LightningInvoice` and `LightningConfig` provide complete wallet management UI
- **Real Lightning Payments**: Production-ready invoice creation and payment verification

### MCP Server Integration
- **Alby NWC MCP Server**: Optional integration with https://github.com/getalby/nwc-mcp-server
- **Fallback Logic**: Automatically falls back to direct NWC if MCP server unavailable
- **Enhanced Performance**: MCP server can improve reliability and reduce WebSocket overhead
- **Configuration**: MCP settings available in Advanced Settings with server URL and optional API key

### Setup Instructions
1. **Basic NWC**: Connect any NIP-47 compatible wallet (Alby, Mutiny, etc.) via connection string
2. **MCP Server** (optional): Run `npx @getalby/nwc-mcp-server` and enable in Advanced Settings
3. **Ticket Purchases**: Real Lightning invoices created via `createInvoice()` with payment verification

The implementation follows NIP-47 specification completely and supports all required methods: `make_invoice`, `pay_invoice`, `get_balance`, and `get_info`.

## Custom NIP Implementation

This project implements a custom NIP for podcast fundraising documented in `NIP.md`. The three event kinds (31950, 31951, 31952) are addressable events that enable:

- **Campaign Discovery**: Query Kind 31950 events to find active fundraisers
- **Payment Tracking**: Kind 31951 events link Lightning payments to ticket purchases
- **Result Verification**: Kind 31952 events provide transparent winner selection

**Critical**: When modifying fundraiser functionality, always update `NIP.md` to reflect changes in event structure, required tags, or validation rules. The hooks in `src/hooks/useCampaigns.ts` and `src/hooks/useCampaignStats.ts` contain validation functions that must match the NIP specification.

## Testing Your Changes

Run the comprehensive test suite with: `npm run test`

This command runs TypeScript checking, ESLint, Vitest tests, and a production build to ensure code quality and deployment readiness.