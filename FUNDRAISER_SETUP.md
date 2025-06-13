# Setting Up Proper Fundraising with NWC

## Overview

The platform now supports **proper fundraising** where payments go directly to the fundraiser creator instead of the ticket buyer. This is achieved using **Nostr Wallet Connect (NWC)** connections.

## How It Works

### For Fundraiser Creators:
1. **Add NWC Connection** to your fundraiser event
2. **Ticket buyers** get invoices generated from YOUR wallet via NWC
3. **Payments** flow directly to you
4. **No self-payment issues**

### For Ticket Buyers:
1. **Real invoices** created by fundraiser creator's wallet
2. **Payments** go to fundraiser creator (not yourself)
3. **Green success message** indicates proper fundraising flow

## Setting Up NWC Connection

### 1. Get an NWC Connection
Wallets that support Nostr Wallet Connect:
- **Alby**: Go to Settings → Developer → Nostr Wallet Connect → Create Connection
- **Mutiny**: In-app NWC connection generation
- **Cashu.me**: NWC support for ecash wallets
- **LNbits**: Built-in NWC extension

### 2. Configure During Fundraiser Creation
**NEW: NWC setup is now part of the Create Fundraiser flow**

1. **Click "Create Fundraiser"** on the main page
2. **Fill out fundraiser details** (title, description, etc.)
3. **In the "Payment Setup" section**:
   - **Manual Entry**: Paste your NWC connection string
   - **Auto-Detection**: Click "Use Current Wallet" if you have Alby connected
   - **Helpful Guidance**: Get wallet-specific setup instructions

4. **Complete fundraiser creation** with NWC already configured

### 3. Test the Setup
1. Create fundraiser with NWC connection configured
2. Buy tickets from the fundraiser
3. Should see green message: "This invoice was created by the fundraiser creator via NWC"
4. Payment goes to fundraiser creator, not buyer

## Current Behavior

### ✅ With NWC Connection:
- Creates invoice from fundraiser creator's wallet via NWC
- Shows green confirmation message
- Real fundraising - money flows to creator
- No self-payment issues

### ⚠️ Without NWC Connection:
- Falls back to buyer's wallet (self-payment issue)
- Shows yellow warning message  
- Buyer pays themselves (may fail)
- Not real fundraising

## Example Fundraiser Event

```json
{
  "kind": 31950,
  "content": "Support our podcast!",
  "tags": [
    ["d", "my-fundraiser-2024"],
    ["title", "Podcast Fundraiser"],
    ["description", "Help support our show"],
    ["target", "1000000"],
    ["ticket_price", "10000"],
    ["end_date", "1704067200"],
    ["podcast", "My Podcast"],
    ["nwc", "nostr+walletconnect://relay.example.com?relay=wss://relay.example.com&secret=...&pubkey=..."]
  ]
}
```

## Benefits

- ✅ **Real fundraising** - money goes to creators
- ✅ **No wallet conflicts** - no self-payment issues  
- ✅ **Better UX** - clear success/warning messages
- ✅ **Nostr-native** - uses Nostr Wallet Connect protocol
- ✅ **Secure** - wallet maintains control over invoice generation
- ✅ **Backwards compatible** - falls back to old behavior if no NWC connection

## Next Steps

1. **Create fundraisers** with the new streamlined NWC setup
2. **Test the complete flow** from creation to ticket purchase
3. **Share the improved workflow** with fundraiser creators
4. **Monitor usage** and iterate based on feedback

## Benefits of New Flow

- ✅ **Streamlined Setup** - Configure payments during fundraiser creation
- ✅ **Better UX** - No separate setup step required after creation
- ✅ **Auto-Detection** - One-click setup for supported wallets like Alby
- ✅ **Clear Guidance** - Wallet-specific instructions and validation
- ✅ **Prevents Issues** - Warns users about payment setup before creating fundraiser

This enables proper peer-to-peer fundraising on Nostr with real Lightning payments via NWC!