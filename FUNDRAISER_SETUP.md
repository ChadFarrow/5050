# Setting Up Proper Fundraising with Lightning Address

## Overview

The platform now supports **proper fundraising** where payments go directly to the fundraiser creator instead of the ticket buyer. This is achieved using **Lightning addresses**.

## How It Works

### For Fundraiser Creators:
1. **Add Lightning Address** to your fundraiser event
2. **Ticket buyers** get invoices generated from YOUR Lightning address  
3. **Payments** flow directly to you
4. **No self-payment issues**

### For Ticket Buyers:
1. **Real invoices** created by fundraiser creator
2. **Payments** go to fundraiser creator (not yourself)
3. **Green success message** indicates proper fundraising flow

## Setting Up Lightning Address

### 1. Get a Lightning Address
Popular Lightning address providers:
- **Alby**: `username@getalby.com`
- **Strike**: `username@strike.me` 
- **CashApp**: `$cashtag@cash.app`
- **Wallet of Satoshi**: `username@walletofsatoshi.com`

### 2. Add to Fundraiser Event
When creating a fundraiser, include this tag:
```json
["lightning_address", "your-username@getalby.com"]
```

### 3. Test the Setup
1. Create fundraiser with Lightning address
2. Buy tickets (not in test mode)
3. Should see green message: "This invoice was created by the fundraiser creator"
4. Payment goes to fundraiser creator, not buyer

## Current Behavior

### ✅ With Lightning Address:
- Creates invoice from fundraiser creator's Lightning address
- Shows green confirmation message
- Real fundraising - money flows to creator
- No self-payment issues

### ⚠️ Without Lightning Address:
- Falls back to buyer's wallet (self-payment issue)
- Shows yellow warning message  
- Buyer pays themselves (may fail)
- Not real fundraising

### 🧪 Test Mode:
- Creates fake invoices with "Simulate Payment"
- Perfect for testing random user functionality
- No real Lightning transactions

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
    ["lightning_address", "podcaster@getalby.com"]
  ]
}
```

## Benefits

- ✅ **Real fundraising** - money goes to creators
- ✅ **No wallet conflicts** - no self-payment issues  
- ✅ **Better UX** - clear success/warning messages
- ✅ **Standard protocol** - uses Lightning address standard
- ✅ **Backwards compatible** - falls back to old behavior if no Lightning address

## Next Steps

1. **Test the feature** with a Lightning address
2. **Update existing fundraisers** to include Lightning addresses
3. **Share instructions** with fundraiser creators
4. **Monitor usage** and iterate based on feedback

This enables proper peer-to-peer fundraising on Nostr with real Lightning payments!