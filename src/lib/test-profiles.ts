// Test utility for generating random Nostr profiles for testing raffle system
// This ensures different users are purchasing tickets instead of the same user always winning

import { getPublicKey, nip19 } from 'nostr-tools';

export interface TestProfile {
  pubkey: string;
  npub: string;
  secretKey: Uint8Array;
  name: string;
  about: string;
  avatar?: string;
}

// Pre-generated test profiles for consistent testing
const TEST_PROFILE_NAMES = [
  'Alice Podcaster',
  'Bob Listener', 
  'Charlie Fan',
  'Diana Supporter',
  'Eddie Patron',
  'Fiona Backer',
  'George Helper',
  'Hannah Friend',
  'Ivan Contributor',
  'Julia Donor',
  'Kyle Supporter',
  'Luna Fan',
  'Mike Listener',
  'Nina Helper',
  'Oscar Patron'
];

const TEST_PROFILE_ABOUTS = [
  'Podcast enthusiast and Lightning supporter',
  'Love supporting indie podcasters',
  'Bitcoin maximalist and raffle lover',
  'Here for the community and great content',
  'Supporting podcasters with Lightning',
  'Believer in value4value',
  'Podcast addict and crypto enthusiast',
  'Love discovering new shows',
  'Value4value supporter',
  'Independent media advocate',
  'Decentralized everything',
  'Podcasting revolution supporter',
  'Lightning network early adopter',
  'Freedom tech enthusiast',
  'Nostr protocol believer'
];

// Cache for generated profiles to maintain consistency within a session
let profileCache: TestProfile[] = [];

export function generateTestProfile(index: number): TestProfile {
  // Generate a deterministic secret key based on index
  const secretKey = new Uint8Array(32);
  secretKey.fill(index + 1); // Simple deterministic seed
  for (let i = 0; i < 32; i++) {
    secretKey[i] = (secretKey[i] + i + index) & 0xFF; // Add some variation
  }
  
  const pubkey = getPublicKey(secretKey);
  const npub = nip19.npubEncode(pubkey);
  
  const profile: TestProfile = {
    pubkey,
    npub,
    secretKey,
    name: TEST_PROFILE_NAMES[index % TEST_PROFILE_NAMES.length],
    about: TEST_PROFILE_ABOUTS[index % TEST_PROFILE_ABOUTS.length],
  };
  
  return profile;
}

export function getTestProfiles(count: number = 15): TestProfile[] {
  if (profileCache.length >= count) {
    return profileCache.slice(0, count);
  }
  
  // Generate profiles if not cached
  profileCache = [];
  for (let i = 0; i < count; i++) {
    profileCache.push(generateTestProfile(i));
  }
  
  return profileCache;
}

export function getRandomTestProfile(): TestProfile {
  const profiles = getTestProfiles();
  const randomIndex = Math.floor(Math.random() * profiles.length);
  return profiles[randomIndex];
}

export function isTestMode(): boolean {
  // Check if we're in development mode and test mode is enabled
  const isDev = process.env.NODE_ENV === 'development';
  const localStorageMode = localStorage.getItem('test-mode') === 'true';
  const urlMode = window.location.search.includes('test=true');
  const result = isDev && (localStorageMode || urlMode);
  
  console.log('Test mode check:', { isDev, localStorageMode, urlMode, result });
  return result;
}

export function enableTestMode() {
  localStorage.setItem('test-mode', 'true');
  console.log('Test mode enabled - random profiles will be used for ticket purchases');
}

export function disableTestMode() {
  localStorage.setItem('test-mode', 'false');
  console.log('Test mode disabled - your actual profile will be used for ticket purchases');
}

export function toggleTestMode() {
  const currentMode = isTestMode();
  if (currentMode) {
    disableTestMode();
  } else {
    enableTestMode();
  }
  return !currentMode;
}