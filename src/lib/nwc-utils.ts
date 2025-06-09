import { generateSecretKey } from 'nostr-tools';
import type { NWCError, NWCConnection } from './nwc-types';

// Utility Functions
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function parseConnectionString(connectionString: string): NWCConnection {
  try {
    const url = new URL(connectionString);
    
    if (url.protocol !== 'nostr+walletconnect:') {
      throw new Error('Invalid protocol. Expected nostr+walletconnect:');
    }

    const walletPubkey = url.hostname;
    if (!walletPubkey || walletPubkey.length !== 64) {
      throw new Error('Invalid wallet pubkey');
    }

    const relayUrl = url.searchParams.get('relay');
    if (!relayUrl) {
      throw new Error('Missing relay parameter');
    }

    const secret = url.searchParams.get('secret');
    if (!secret || secret.length !== 64) {
      throw new Error('Invalid secret parameter');
    }

    const lud16 = url.searchParams.get('lud16') || undefined;

    return {
      walletPubkey,
      relayUrl: decodeURIComponent(relayUrl),
      secret,
      lud16,
    };
  } catch (error) {
    throw new Error(`Invalid NWC connection string: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function generateConnectionString(params: {
  walletPubkey: string;
  relayUrl: string;
  lud16?: string;
}): { connectionString: string; secret: string } {
  const secret = bytesToHex(generateSecretKey());
  
  const url = new URL(`nostr+walletconnect://${params.walletPubkey}`);
  url.searchParams.set('relay', encodeURIComponent(params.relayUrl));
  url.searchParams.set('secret', secret);
  
  if (params.lud16) {
    url.searchParams.set('lud16', params.lud16);
  }

  return {
    connectionString: url.toString(),
    secret,
  };
}

export function getErrorMessage(error: NWCError): string {
  const errorMessages: Record<NWCError['code'], string> = {
    RATE_LIMITED: 'Too many requests. Please try again later.',
    NOT_IMPLEMENTED: 'This method is not supported by the wallet.',
    INSUFFICIENT_BALANCE: 'Insufficient balance to complete the transaction.',
    QUOTA_EXCEEDED: 'You have exceeded your quota for this operation.',
    RESTRICTED: 'This operation is restricted.',
    UNAUTHORIZED: 'You are not authorized to perform this operation.',
    INTERNAL: 'An internal error occurred.',
    OTHER: error.message || 'An unknown error occurred.'
  };

  return errorMessages[error.code] || error.message;
}

export function isValidNWCConnection(connectionString: string): boolean {
  try {
    parseConnectionString(connectionString);
    return true;
  } catch {
    return false;
  }
}