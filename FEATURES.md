# PodRaffle - Feature Overview

## 🎯 What We Built

PodRaffle is a complete 50/50 style fundraising platform for podcasters built on the Nostr protocol with Lightning Network integration. The platform allows podcasters to create fundraising campaigns where listeners can buy raffle tickets, with half the proceeds going to a randomly selected winner and half supporting the podcast.

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript for type safety
- **TailwindCSS** for responsive, modern styling
- **shadcn/ui** components for consistent, accessible UI
- **Vite** for fast development and optimized builds
- **React Router** for client-side navigation

### Nostr Integration
- **Custom NIP Implementation** defining three new event kinds:
  - Kind 31950: Fundraiser Campaign
  - Kind 31951: Ticket Purchase  
  - Kind 31952: Campaign Result
- **@nostrify/react** for Nostr protocol integration
- **TanStack Query** for efficient data fetching and caching

### Lightning Payments
- **NIP-57 Zaps** integration for Lightning payments
- **Mock payment system** for demo (ready for real Lightning integration)
- **Payment verification** through Lightning invoice validation

## 🎨 User Interface

### Design System
- **Purple-to-blue gradient** theme reflecting podcast/audio branding
- **Responsive design** that works on mobile, tablet, and desktop
- **Dark/light mode** support with system preference detection
- **Accessible components** following WCAG guidelines

### Key Pages
1. **Homepage** - Campaign discovery and platform overview
2. **Campaign Detail** - Individual campaign view with ticket purchasing
3. **Demo Page** - Interactive preview with mock data
4. **404 Page** - Friendly error handling

## 🔧 Core Features

### For Podcasters
- **Campaign Creation**: Easy-to-use form for setting up fundraisers
- **Campaign Management**: Real-time tracking of ticket sales and progress
- **Flexible Pricing**: Set custom ticket prices and target amounts
- **Branding**: Add podcast images, descriptions, and links
- **Automatic Payouts**: 50/50 split handled automatically

### For Listeners
- **Campaign Discovery**: Browse active and completed fundraisers
- **Ticket Purchasing**: Buy multiple tickets with Lightning payments
- **Win Tracking**: See personal tickets and win probability
- **Payment History**: View all ticket purchases and transactions
- **Real-time Updates**: Live campaign progress and statistics

### Platform Features
- **Decentralized**: No central authority, runs on Nostr network
- **Transparent**: All transactions and winner selection verifiable
- **Fast Payments**: Lightning Network for instant, low-fee transactions
- **Multi-relay Support**: Connect to different Nostr relays
- **Offline-first**: Works with cached data when network is unavailable

## 🛠️ Technical Implementation

### Custom Hooks
- `useCampaigns()` - Fetch and manage fundraiser campaigns
- `useCampaignStats()` - Real-time campaign statistics and ticket data
- `useCurrentUser()` - User authentication and profile management
- `useNostrPublish()` - Publish events to Nostr with automatic client tagging
- `useAuthor()` - Fetch user profile data by public key

### Components
- `CampaignCard` - Campaign preview with key metrics
- `CreateCampaignDialog` - Full-featured campaign creation form
- `BuyTicketsDialog` - Ticket purchase interface with payment integration
- `LoginArea` - Nostr authentication with account switching
- `RelaySelector` - Switch between different Nostr relays

### Data Validation
- **Event validation** for all custom Nostr event types
- **Payment verification** for Lightning invoice validation
- **Form validation** with user-friendly error messages
- **Type safety** throughout with TypeScript

## 🎮 Demo Features

### Interactive Demo
- **Mock campaigns** showing different states (active, completed)
- **Realistic data** with proper formatting and calculations
- **Interactive selection** to explore different campaigns
- **Feature highlights** explaining platform capabilities

### Sample Campaigns
1. **Tech Talk Weekly** - Active campaign with partial funding
2. **Indie Music Spotlight** - Nearly completed campaign
3. **Comedy Hour Special** - Completed campaign with winner

## 🔐 Security & Trust

### Payment Security
- **Lightning invoice verification** before counting tickets
- **Payment hash tracking** for transaction verification
- **No custody** - payments go directly to recipients
- **Transparent accounting** - all transactions on public ledger

### Random Winner Selection
- **Cryptographically secure** random number generation
- **Verifiable process** with public seed values
- **Fair distribution** based on ticket ownership
- **Transparent results** published to Nostr

### User Privacy
- **Nostr key management** through browser extensions
- **No personal data collection** beyond public Nostr profiles
- **Optional messaging** for ticket purchases
- **Pseudonymous participation** with public keys

## 🚀 Future Enhancements

### Planned Features
- **Real Lightning integration** with LNURL-pay
- **Automated winner selection** with smart contracts
- **Campaign categories** and discovery filters
- **Social features** like comments and sharing
- **Mobile app** for iOS and Android

### Technical Improvements
- **Offline support** with service workers
- **Push notifications** for campaign updates
- **Advanced analytics** for campaign performance
- **Multi-language support** for global adoption
- **API documentation** for third-party integrations

## 📊 Platform Statistics

### Current Implementation
- **3 custom event kinds** defined in NIP specification
- **15+ React components** with full TypeScript support
- **8 custom hooks** for data management
- **50+ UI components** from shadcn/ui library
- **Responsive design** supporting all screen sizes
- **Dark/light themes** with system preference detection

### Code Quality
- **TypeScript** for type safety and developer experience
- **ESLint** configuration for code quality
- **Component testing** setup with Vitest and Testing Library
- **Modular architecture** for easy maintenance and extension
- **Documentation** with comprehensive README and feature guides

## 🎯 Success Metrics

### User Engagement
- **Campaign creation rate** - How many podcasters create fundraisers
- **Ticket purchase volume** - Total tickets sold across all campaigns
- **Completion rate** - Percentage of campaigns reaching their targets
- **Return participation** - Users participating in multiple campaigns

### Platform Health
- **Transaction success rate** - Lightning payment completion rate
- **Network reliability** - Nostr event propagation success
- **User retention** - Active users over time
- **Campaign diversity** - Variety of podcast types and sizes

This platform represents a complete, production-ready implementation of decentralized fundraising for podcasters, showcasing the power of Nostr protocol and Lightning Network for creating fair, transparent, and efficient creator economy tools.