# Lightning Network Setup Guide

This guide will help you set up real Lightning invoices for your fundraiser app instead of mock invoices.

## Overview

The app now supports real Lightning Network payments through various service providers. When users buy tickets, they'll receive actual Lightning invoices that can be paid with any Lightning wallet.

## Supported Lightning Services

### 1. LNbits (Recommended)
**Best for:** Self-hosting, full control, free
- **Setup:** Deploy your own LNbits instance
- **Cost:** Free (you pay for hosting)
- **Documentation:** https://lnbits.org/
- **Features:** Full Lightning wallet, extensions, API access

### 2. BTCPay Server
**Best for:** Merchants, self-hosting, Bitcoin-only
- **Setup:** Deploy BTCPay Server with Lightning
- **Cost:** Free (you pay for hosting)
- **Documentation:** https://btcpayserver.org/
- **Features:** Full payment processor, Lightning support

### 3. Strike API
**Best for:** Easy setup, USD integration
- **Setup:** Get API key from Strike
- **Cost:** Transaction fees apply
- **Documentation:** https://docs.strike.me/
- **Features:** Fiat integration, easy API

### 4. OpenNode
**Best for:** Business use, hosted solution
- **Setup:** Sign up for OpenNode account
- **Cost:** Transaction fees apply
- **Documentation:** https://www.opennode.com/docs/
- **Features:** Hosted Lightning, business features

## Quick Setup with LNbits

### Step 1: Deploy LNbits

**Option A: Docker (Recommended)**
```bash
# Clone LNbits
git clone https://github.com/lnbits/lnbits.git
cd lnbits

# Run with Docker
docker run -d \
  --name lnbits \
  -p 5000:5000 \
  -v ${PWD}/.env:/app/.env \
  lnbits/lnbits:latest
```

**Option B: Railway/Heroku**
- Use the one-click deploy buttons on https://lnbits.org/
- Set environment variables for your Lightning backend

**Option C: VPS Installation**
```bash
# Install dependencies
sudo apt update
sudo apt install python3 python3-pip git

# Clone and setup
git clone https://github.com/lnbits/lnbits.git
cd lnbits
pip3 install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run LNbits
python3 -m uvicorn lnbits.app:app --host 0.0.0.0 --port 5000
```

### Step 2: Configure Lightning Backend

LNbits needs a Lightning backend. Options include:

**LND (Recommended)**
```bash
# In your .env file
LNBITS_BACKEND_WALLET_CLASS=LndWallet
LND_GRPC_ENDPOINT=127.0.0.1
LND_GRPC_PORT=10009
LND_GRPC_CERT="/path/to/tls.cert"
LND_GRPC_MACAROON="/path/to/admin.macaroon"
```

**Core Lightning**
```bash
# In your .env file
LNBITS_BACKEND_WALLET_CLASS=CoreLightningWallet
CORELIGHTNING_RPC="/path/to/lightning-rpc"
```

**Fake Wallet (Testing Only)**
```bash
# In your .env file - DO NOT USE IN PRODUCTION
LNBITS_BACKEND_WALLET_CLASS=FakeWallet
```

### Step 3: Create API Key

1. Open your LNbits instance (e.g., `http://your-server:5000`)
2. Create a new wallet
3. Go to "API docs" or "Extensions"
4. Generate an API key with invoice creation permissions
5. Copy the API key and wallet ID

### Step 4: Configure the App

1. Open your fundraiser app
2. Click "Lightning Setup" in the header
3. Select "LNbits" as provider
4. Enter your configuration:
   - **Base URL:** `https://your-lnbits-instance.com`
   - **API Key:** Your LNbits API key
   - **Wallet ID:** Your wallet ID (optional)
5. Click "Test Connection" to verify
6. Save configuration

## Alternative: Using Strike API

### Step 1: Get Strike API Access
1. Sign up at https://strike.me/
2. Apply for API access
3. Get your API key from the developer dashboard

### Step 2: Configure the App
1. Select "Custom" provider in Lightning Setup
2. Use Strike API endpoints
3. Enter your Strike API key

## Alternative: Using OpenNode

### Step 1: Create OpenNode Account
1. Sign up at https://www.opennode.com/
2. Verify your account
3. Generate API key in settings

### Step 2: Configure the App
1. Select "Custom" provider
2. Base URL: `https://api.opennode.com` (or `https://dev-api.opennode.com` for testnet)
3. Enter your OpenNode API key

## Security Considerations

### API Key Security
- **Never share your API keys publicly**
- Use API keys with minimal permissions (invoice creation only)
- Store API keys securely (they're encrypted in browser storage)
- Rotate API keys regularly

### Network Security
- Use HTTPS for all Lightning service endpoints
- Consider using VPN or private networks for self-hosted solutions
- Monitor your Lightning node for unusual activity

### Wallet Security
- Use separate wallets for fundraising vs personal funds
- Set up proper backup and recovery procedures
- Monitor balances and transactions regularly

## Testing Your Setup

### 1. Test Invoice Creation
1. Configure your Lightning service
2. Click "Test Connection" in Lightning Setup
3. Verify a test invoice is created successfully

### 2. Test Full Payment Flow
1. Create a small test fundraiser
2. Buy tickets with a small amount (1-10 sats)
3. Pay the invoice with a Lightning wallet
4. Verify the payment is detected and tickets are issued

### 3. Recommended Test Wallets
- **Phoenix:** Mobile wallet with good UX
- **Breez:** Non-custodial mobile wallet
- **Zeus:** Advanced mobile wallet
- **Alby:** Browser extension wallet

## Troubleshooting

### Common Issues

**"Lightning service not configured"**
- Make sure you've completed the Lightning Setup
- Check that your API key is valid
- Verify your base URL is correct

**"Failed to create invoice"**
- Check your API key permissions
- Verify your Lightning backend is running
- Check network connectivity to your Lightning service

**"Connection test failed"**
- Verify your base URL includes protocol (https://)
- Check firewall settings
- Ensure your Lightning service is accessible

**"Payment not detected"**
- Wait a few seconds for payment confirmation
- Check your Lightning node logs
- Verify the payment was actually sent

### Getting Help

1. **LNbits Support:** https://t.me/lnbits
2. **Lightning Network:** https://discord.gg/xWBOmwX
3. **App Issues:** Create an issue in the project repository

## Production Deployment

### Recommended Architecture
```
[Users] → [Your App] → [LNbits] → [Lightning Node] → [Lightning Network]
```

### Scaling Considerations
- Use a dedicated server for your Lightning node
- Consider Lightning Service Providers (LSPs) for liquidity
- Monitor channel capacity and rebalance as needed
- Set up proper logging and monitoring

### Backup Strategy
- Backup Lightning node channel state regularly
- Keep secure backups of seed phrases and API keys
- Document your setup for disaster recovery

## Cost Analysis

### Self-Hosted (LNbits + LND)
- **Setup Cost:** $0 (software is free)
- **Hosting Cost:** $10-50/month (VPS)
- **Transaction Fees:** Lightning network fees only (~1-10 sats)
- **Maintenance:** Requires technical knowledge

### Hosted Services (Strike/OpenNode)
- **Setup Cost:** $0
- **Hosting Cost:** $0
- **Transaction Fees:** 1-3% of transaction value
- **Maintenance:** Minimal

## Next Steps

1. Choose your Lightning service provider
2. Follow the setup guide for your chosen provider
3. Configure the app with your Lightning service
4. Test with small amounts first
5. Launch your fundraisers with real Lightning payments!

## Support

If you need help setting up Lightning payments, consider:
- Hiring a Bitcoin/Lightning consultant
- Using managed Lightning services
- Starting with testnet for learning
- Joining Lightning developer communities

Remember: Lightning Network is still evolving technology. Start small, test thoroughly, and always have backup plans.