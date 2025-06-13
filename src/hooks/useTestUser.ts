import { useState, useEffect } from 'react';
import { useCurrentUser } from './useCurrentUser';
import { isTestMode, getRandomTestProfile, type TestProfile } from '@/lib/test-profiles';

interface TestUser {
  pubkey: string;
  npub: string;
  profile?: TestProfile;
}

/**
 * Hook that returns either the real current user or a random test user
 * depending on whether test mode is enabled
 */
export function useTestUser() {
  const { user: realUser } = useCurrentUser();
  const [testUser, setTestUser] = useState<TestUser | null>(null);
  const inTestMode = isTestMode();

  // Generate a new test user when test mode is enabled and we don't have one
  useEffect(() => {
    if (inTestMode && !testUser) {
      const profile = getRandomTestProfile();
      setTestUser({
        pubkey: profile.pubkey,
        npub: profile.npub,
        profile
      });
    } else if (!inTestMode) {
      setTestUser(null);
    }
  }, [inTestMode, testUser]);

  // Return test user in test mode, real user otherwise
  const user = inTestMode ? testUser : realUser;

  return {
    user,
    isTestMode: inTestMode,
    realUser,
    testProfile: testUser?.profile,
    // Function to get a new random test user for the next purchase
    getNewTestUser: () => {
      if (inTestMode) {
        const profile = getRandomTestProfile();
        const newTestUser = {
          pubkey: profile.pubkey,
          npub: profile.npub,
          profile
        };
        setTestUser(newTestUser);
        return newTestUser;
      }
      return null;
    }
  };
}