# Payment Architecture Issue & Temporary Fix

## The Problem

The current ticket purchase system has a fundamental flaw where **buyers create invoices with their own wallets** instead of paying the **fundraiser creator**. This means:

❌ Buyers try to pay themselves (wallet errors)  
❌ No money goes to the fundraiser creator  
❌ Fundraising doesn't actually work  

## Root Cause

The system was designed to use **NIP-57 Lightning Zaps** (see `NIP.md` line 136), but the current implementation uses manual invoices created by the buyer's wallet instead.

## Temporary Development Fix

I've implemented a temporary workaround for development/testing:

### Test Mode (Recommended for Testing)
- **Enable**: Toggle "Test Mode" in campaign sidebar or add `?test=true` to URL
- **Behavior**: Creates fake invoices with "Simulate Payment" button
- **Benefits**: Test random user functionality without real payments

### Normal Mode (Self-Payment Issue)
- **Behavior**: Creates real Lightning invoices with YOUR wallet
- **Issue**: When you pay the invoice, you're paying yourself (may cause wallet errors)
- **Warning**: Yellow warning message shown on payment screen
- **For Development**: Can still test invoice creation and UI flows

## Proper Solution (TODO)

To fix this properly, we need to implement **NIP-57 Zap integration**:

1. **Fundraiser creators** provide Lightning addresses in their campaign events
2. **Ticket buyers** send zaps directly to creators
3. **Zap receipts** are referenced in ticket purchase events
4. **Money flows** directly from buyers → fundraiser creators

## Current Workaround Usage

### For Testing Random Users:
```
1. Go to any campaign page
2. Toggle "Test Mode" in sidebar  
3. Buy tickets with "Simulate Payment"
4. See different random users purchasing tickets
```

### For Real Invoice Testing:
```
1. Keep test mode OFF
2. Buy tickets → real Lightning invoice created
3. Warning shown: "you're paying yourself"
4. Can test invoice creation, QR codes, UI flows
5. Payment may fail due to self-payment issue
```

## Files Modified

- `src/components/BuyTicketsDialog.tsx` - Added external payment creation
- `src/components/LightningInvoice.tsx` - Added external payment UI
- Payment flows now detect and handle different payment types

This temporary fix allows continued development and testing while the proper zap integration is implemented.