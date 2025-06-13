# Test Mode for Random Nostr Profiles

This feature allows you to test the raffle system with random Nostr profiles instead of always using your own profile for ticket purchases. This helps simulate a real raffle scenario where different users are purchasing tickets.

## How to Enable Test Mode

### Method 1: Toggle in UI (Recommended)
1. Go to any campaign page while in development mode
2. Look for the "Test Mode" card in the sidebar 
3. Toggle the switch to enable random test profiles
4. The page will reload to activate test mode

### Method 2: URL Parameter
Add `?test=true` to any URL to enable test mode for that session.

### Method 3: Browser Console
Open browser console and run:
```javascript
localStorage.setItem('test-mode', 'true');
window.location.reload();
```

## How It Works

When test mode is enabled:

1. **Random Profile Selection**: Each ticket purchase uses a random test profile from a pool of 15 pre-generated profiles
2. **Consistent Names**: Test profiles have realistic names like "Alice Podcaster", "Bob Listener", etc.
3. **Valid Nostr Keys**: Each profile has a valid Nostr keypair that can sign events
4. **Deterministic**: The same test profiles are used consistently within a session

## Test Profiles

The system includes 15 pre-generated test profiles with names like:
- Alice Podcaster
- Bob Listener  
- Charlie Fan
- Diana Supporter
- Eddie Patron
- And 10 more...

Each profile has:
- Valid Nostr public/private key pair
- Realistic name and bio
- Consistent identity across purchases

## Benefits

- **Realistic Testing**: Simulate multiple users purchasing tickets
- **Winner Variety**: Different users can win instead of always the same person
- **UI Testing**: Test winner display, participant lists, and stats with diverse users
- **Demo Purposes**: Great for showcasing the platform to others

## Disabling Test Mode

1. Use the toggle in the UI to turn it off
2. Remove `?test=true` from the URL
3. Or run in console: `localStorage.setItem('test-mode', 'false')`

## Notes

- Only available in development mode (`NODE_ENV=development`)
- Test profiles are generated deterministically for consistency
- Lightning payments still work normally (you still pay with your real wallet)
- Only the Nostr identity changes, not the payment flow
- Events are published to the same relays as normal events