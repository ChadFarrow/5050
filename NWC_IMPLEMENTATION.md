# NIP-47 Nostr Wallet Connect Implementation Guide

This project includes support for NIP-47 (Nostr Wallet Connect) as a Lightning payment option. Currently, it's implemented in **demo mode** for testing and development purposes.

## Current Status: Demo Mode

The current implementation:
- ✅ **Validates NWC connection strings** correctly
- ✅ **Parses wallet pubkey, secret, relays, and LUD16** from connection strings
- ✅ **Provides a complete UI** for NWC configuration
- ⚠️ **Creates demo invoices** like `lnbc100n1demo_invoice_1749346329848` for testing

## Demo vs Real Implementation

### Demo Mode (Current)
```typescript
// Creates mock invoices for testing
const mockInvoice: LightningInvoice = {
  bolt11: `lnbc${Math.floor(amount / 1000)}n1demo_invoice_${Date.now()}`,
  payment_hash: "mock_hash...",
  // ... other mock fields
};
```

### Real Implementation (Production)
```typescript
// Would use actual NIP-47 protocol
const response = await sendNWCRequest('make_invoice', {
  amount,
  description,
  expiry: 3600,
});
// Returns real Lightning invoice from connected wallet
```

## How to Enable Real NWC

### 1. Configuration
Set demo mode to false in `src/App.tsx`:
```typescript
const defaultConfig: AppConfig = {
  theme: "light",
  relayUrl: "wss://relay.nostr.band",
  nwcDemoMode: false, // Change this to false
};
```

### 2. Implementation
Replace the demo `useNWC` hook with the real implementation from `src/hooks/useNWCReal.ts`:

```typescript
// In src/hooks/useNWC.ts - replace demo implementation with:
import { useNWCReal } from './useNWCReal';
export const useNWC = useNWCReal;
```

### 3. Required Dependencies
The real implementation requires:
```bash
npm install nostr-tools
```

## NIP-47 Protocol Flow

### 1. Connection Setup
```
User's Wallet → Generates connection string
nostr+walletconnect://[pubkey]?relay=[relay]&secret=[secret]&lud16=[address]
```

### 2. Invoice Creation
```
Client → Encrypts request with NIP-04
Client → Publishes kind 23194 event to relay
Wallet → Receives and decrypts request
Wallet → Creates Lightning invoice
Wallet → Encrypts response with NIP-04
Wallet → Publishes kind 23195 event to relay
Client → Receives and decrypts response
```

### 3. Supported Commands
- `make_invoice` - Create Lightning invoices
- `pay_invoice` - Pay Lightning invoices
- `get_balance` - Get wallet balance
- `get_info` - Get wallet information
- `lookup_invoice` - Check invoice status

## Compatible Wallets

### Alby
1. Open Alby extension
2. Go to Settings → Developer → Nostr Wallet Connect
3. Create new connection
4. Copy connection string

### Mutiny Wallet
1. Open Mutiny app
2. Go to Settings → Connections → Nostr Wallet Connect
3. Generate connection string
4. Copy and paste into app

### Other NWC Wallets
- Zeus
- LNbits (with NWC extension)
- Custom implementations

## Security Considerations

### Connection String Security
- Contains sensitive secret key - treat like a password
- Store securely in local storage (encrypted)
- Never log or transmit connection strings
- Rotate secrets regularly

### NIP-04 Encryption
- All requests/responses encrypted with NIP-04
- Uses connection secret key for encryption
- Wallet pubkey used as recipient
- No plaintext sensitive data over Nostr

### Relay Privacy
- Communication happens over specified relays
- Relay operators can see encrypted events but not content
- Use trusted relays for sensitive operations
- Consider running your own relay for maximum privacy

## Testing Your Implementation

### 1. Connection String Validation
```typescript
import { parseNWCConnectionString } from '@/lib/lightning';

const connectionString = 'nostr+walletconnect://...';
try {
  const config = parseNWCConnectionString(connectionString);
  console.log('✅ Valid connection string');
} catch (error) {
  console.log('❌ Invalid:', error.message);
}
```

### 2. Invoice Creation Test
```typescript
const { createInvoice } = useNWC();

try {
  const invoice = await createInvoice({
    amount: 1000, // 1 sat in msats
    description: 'Test invoice',
    expiry: 3600
  });
  console.log('Invoice created:', invoice.bolt11);
} catch (error) {
  console.error('Failed to create invoice:', error);
}
```

## Troubleshooting

### Common Issues

1. **"Invalid connection string"**
   - Check format: `nostr+walletconnect://[64-char-hex]?relay=wss://...&secret=[64-char-hex]`
   - Ensure all required parameters are present

2. **"NWC request timeout"**
   - Check relay connectivity
   - Verify wallet is online and connected
   - Try different relay

3. **"Failed to decrypt response"**
   - Verify secret key is correct
   - Check wallet pubkey matches
   - Ensure NIP-04 implementation is correct

### Debug Mode
Enable debug logging:
```typescript
// In useNWCReal.ts
console.log('Sending NWC request:', method, params);
console.log('Encrypted content:', encryptedContent);
console.log('Response received:', response);
```

## Production Checklist

- [ ] Set `nwcDemoMode: false` in App.tsx
- [ ] Replace demo useNWC with real implementation
- [ ] Test with real wallet connection
- [ ] Verify invoice creation works
- [ ] Test payment flow
- [ ] Implement error handling
- [ ] Add proper logging
- [ ] Security audit of implementation
- [ ] Test with multiple wallet types

## Resources

- [NIP-47 Specification](https://github.com/nostr-protocol/nips/blob/master/47.md)
- [NIP-04 Encryption](https://github.com/nostr-protocol/nips/blob/master/04.md)
- [Nostr Tools Library](https://github.com/nbd-wtf/nostr-tools)
- [Alby NWC Documentation](https://guides.getalby.com/developer-guide/v/alby-wallet-api/reference/nostr-wallet-connect)