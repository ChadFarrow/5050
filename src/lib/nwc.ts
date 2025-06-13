// Nostr Wallet Connect (NWC) utilities for generating invoices from fundraiser creators

import { SimplePool, Event as NostrEvent, finalizeEvent, UnsignedEvent, nip04 } from 'nostr-tools';
import { getEventHash, getSignature } from 'nostr-tools';

export interface NWCConnectionInfo {
  walletPubkey: string;
  relayUrl: string;
  secret: string;
}

export interface NWCMakeInvoiceRequest {
  method: string;
  params: {
    amount: number; // Amount in millisats
    description?: string;
    expiry?: number; // Expiry in seconds
  };
}

export interface NWCMakeInvoiceResponse {
  result_type: string;
  result: {
    invoice: string; // bolt11 invoice
    payment_hash: string;
    expiry: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Parse NWC connection string into components
 * Supports both formats:
 * - nostr+walletconnect://pubkey?relay=wss://relay.url&secret=... (Alby format)
 * - nostr+walletconnect://relay.url?relay=wss://relay.url&secret=...&pubkey=... (Generic format)
 */
export function parseNWCConnection(nwcString: string): NWCConnectionInfo {
  try {
    console.log('🔍 Parsing NWC connection:', nwcString.slice(0, 50) + '...');
    
    // Remove the nostr+walletconnect:// prefix
    const cleanUrl = nwcString.replace('nostr+walletconnect://', 'https://');
    const url = new URL(cleanUrl);
    
    console.log('📋 URL components:', {
      hostname: url.hostname,
      search: url.search,
      searchParams: Array.from(url.searchParams.entries())
    });
    
    const relayUrl = url.searchParams.get('relay');
    const secret = url.searchParams.get('secret');
    
    // Check for pubkey in query params first (generic format)
    let walletPubkey = url.searchParams.get('pubkey');
    
    // If no pubkey in query params, check if hostname is the pubkey (Alby format)
    if (!walletPubkey && url.hostname && url.hostname.length === 64) {
      console.log('📱 Using hostname as wallet pubkey (Alby format)');
      walletPubkey = url.hostname;
    }
    
    console.log('🔑 Extracted components:', {
      relayUrl: relayUrl?.slice(0, 30) + '...',
      secret: secret?.slice(0, 10) + '...',
      walletPubkey: walletPubkey?.slice(0, 10) + '...'
    });
    
    if (!relayUrl || !secret || !walletPubkey) {
      throw new Error(`Invalid NWC connection string - missing required parameters. Found: relay=${!!relayUrl}, secret=${!!secret}, pubkey=${!!walletPubkey}`);
    }
    
    return {
      walletPubkey,
      relayUrl,
      secret
    };
  } catch (error) {
    console.error('❌ Failed to parse NWC connection:', error);
    throw new Error(`Failed to parse NWC connection: ${error.message}`);
  }
}

/**
 * Generate an invoice using NWC connection
 */
export async function generateInvoiceFromNWC(
  nwcString: string,
  amountMsats: number,
  description?: string
): Promise<string> {
  try {
    const connectionInfo = parseNWCConnection(nwcString);
    console.log('Creating NWC invoice with:', { amountMsats, description });
    
    // Create the NWC request event
    const requestId = Math.random().toString(36).substring(2, 15);
    const request: NWCMakeInvoiceRequest = {
      method: 'make_invoice',
      params: {
        amount: amountMsats,
        description: description || '',
        expiry: 3600 // 1 hour
      }
    };
    
    // Encrypt the request content (NWC requests should be encrypted with NIP-04)
    let encryptedContent: string;
    try {
      console.log('🔐 Encrypting NWC request...');
      encryptedContent = await nip04.encrypt(connectionInfo.secret, connectionInfo.walletPubkey, JSON.stringify(request));
      console.log('🔒 Successfully encrypted NWC request');
    } catch (encryptError) {
      console.error('❌ Failed to encrypt NWC request:', encryptError);
      throw new Error(`Failed to encrypt NWC request: ${encryptError.message}`);
    }
    
    // Create unsigned event
    const unsignedEvent: UnsignedEvent = {
      kind: 23194, // NWC request kind
      content: encryptedContent,
      tags: [
        ['p', connectionInfo.walletPubkey] // Target wallet pubkey
      ],
      created_at: Math.floor(Date.now() / 1000)
    };
    
    // Convert secret to bytes for signing
    const secretBytes = new Uint8Array(32);
    const secretHex = connectionInfo.secret;
    for (let i = 0; i < 32; i++) {
      secretBytes[i] = parseInt(secretHex.substr(i * 2, 2), 16);
    }
    
    // Sign the event
    const signedEvent = finalizeEvent(unsignedEvent, secretBytes);
    
    // Connect to relay and send request
    const pool = new SimplePool();
    console.log('🔗 Connecting to NWC relay:', connectionInfo.relayUrl);
    
    // Publish the request
    console.log('📤 Publishing NWC request event...');
    const pubs = pool.publish([connectionInfo.relayUrl], signedEvent);
    
    // Wait for publish to complete
    const publishResults = await Promise.allSettled(pubs);
    console.log('📤 Publish results:', publishResults);
    
    console.log('✅ Published NWC request event:', signedEvent.id);
    
    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('⏰ NWC request timeout');
        pool.close([connectionInfo.relayUrl]);
        reject(new Error('NWC request timeout - no response from wallet'));
      }, 30000); // 30 second timeout
      
      // Subscribe to response events using correct SimplePool API
      console.log('👂 Subscribing to NWC response events...');
      const sub = pool.subscribeMany([connectionInfo.relayUrl], [{
        kinds: [23195], // NWC response kind
        authors: [connectionInfo.walletPubkey],
        '#e': [signedEvent.id] // Response to our request
      }], {
        async onevent(event: NostrEvent) {
          console.log('📨 Received NWC response event:', event.id);
          console.log('📨 Raw event content:', event.content);
          console.log('📨 Event content type:', typeof event.content);
          console.log('📨 Event content length:', event.content?.length);
          
          try {
            clearTimeout(timeout);
            sub.close();
            pool.close([connectionInfo.relayUrl]);
            
            // Check if content is empty or not a string
            if (!event.content || typeof event.content !== 'string') {
              console.error('❌ Invalid event content:', event.content);
              reject(new Error('Invalid NWC response - empty or non-string content'));
              return;
            }
            
            // Decrypt the response content (NWC responses are encrypted with NIP-04)
            let decryptedContent: string;
            try {
              console.log('🔐 Attempting to decrypt NWC response...');
              
              // Convert secret hex to bytes for decryption
              const secretBytes = new Uint8Array(32);
              for (let i = 0; i < 32; i++) {
                secretBytes[i] = parseInt(connectionInfo.secret.substr(i * 2, 2), 16);
              }
              
              decryptedContent = await nip04.decrypt(connectionInfo.secret, connectionInfo.walletPubkey, event.content);
              console.log('🔓 Successfully decrypted NWC response:', decryptedContent);
            } catch (decryptError) {
              console.error('❌ Failed to decrypt NWC response:', decryptError);
              console.error('❌ Raw encrypted content:', event.content);
              reject(new Error(`Failed to decrypt NWC response: ${decryptError.message}`));
              return;
            }
            
            // Try to parse JSON with better error handling
            let response: NWCMakeInvoiceResponse;
            try {
              response = JSON.parse(decryptedContent);
              console.log('📋 Parsed NWC response:', response);
            } catch (parseError) {
              console.error('❌ JSON parse error:', parseError);
              console.error('❌ Content that failed to parse:', decryptedContent);
              reject(new Error(`Failed to parse NWC response JSON: ${parseError.message}. Content: ${decryptedContent.slice(0, 100)}...`));
              return;
            }
            
            if (response.error) {
              console.error('❌ NWC wallet error:', response.error);
              reject(new Error(`NWC wallet error: ${response.error.message}`));
              return;
            }
            
            if (!response.result?.invoice) {
              console.error('❌ No invoice in NWC response');
              reject(new Error('No invoice received from NWC wallet'));
              return;
            }
            
            console.log('✅ Successfully created NWC invoice');
            resolve(response.result.invoice);
          } catch (error) {
            console.error('❌ Failed to parse NWC response:', error);
            reject(new Error(`Failed to parse NWC response: ${error.message}`));
          }
        },
        oneose() {
          // If we get end of stored events without a response, keep waiting for real-time
          console.log('📪 NWC: End of stored events, waiting for real-time response...');
        }
      });
    });
    
  } catch (error) {
    console.error('Error generating NWC invoice:', error);
    throw error;
  }
}

/**
 * Check if a string is a valid NWC connection string
 */
export function isValidNWCConnection(nwcString: string): boolean {
  try {
    parseNWCConnection(nwcString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Try to detect NWC connection from the current wallet
 */
export async function detectWalletNWC(): Promise<string | null> {
  try {
    console.log('🔍 Starting NWC detection...');
    
    // Check if WebLN is available
    if (!window.webln) {
      console.log('❌ No WebLN provider available');
      return null;
    }
    
    console.log('✅ WebLN provider found');
    
    // Get wallet info for debugging
    if (typeof window.webln.getInfo === 'function') {
      try {
        const info = await window.webln.getInfo();
        console.log('📱 Wallet info:', {
          alias: info.node?.alias,
          pubkey: info.node?.pubkey?.slice(0, 8) + '...',
          methods: Object.keys(window.webln)
        });
      } catch (error) {
        console.log('⚠️ Could not get wallet info:', error);
      }
    }
    
    // Check window object for wallet-specific properties
    console.log('🔍 Checking for wallet-specific APIs...');
    const windowKeys = Object.keys(window).filter(key => 
      key.toLowerCase().includes('alby') || 
      key.toLowerCase().includes('mutiny') || 
      key.toLowerCase().includes('nwc') ||
      key.toLowerCase().includes('wallet')
    );
    console.log('📋 Wallet-related window properties:', windowKeys);
    
    // Method 1: Check for Alby wallet
    if ((window as any).alby) {
      console.log('🐝 Alby wallet detected, checking for NWC...');
      const alby = (window as any).alby;
      console.log('🔧 Alby methods:', Object.keys(alby));
      
      // Deep inspect Alby object properties
      console.log('🔍 Inspecting Alby object structure...');
      for (const key of Object.keys(alby)) {
        const value = alby[key];
        if (value && typeof value === 'object') {
          console.log(`📦 alby.${key}:`, Object.keys(value));
        } else {
          console.log(`🔧 alby.${key}:`, typeof value);
        }
      }
      
      // Check if webln has any NWC-related properties
      if (alby.webln) {
        console.log('🔍 Checking Alby WebLN properties:', Object.keys(alby.webln));
        
        // Check for any NWC-related properties in webln
        const weblnKeys = Object.keys(alby.webln);
        for (const key of weblnKeys) {
          if (key.toLowerCase().includes('nwc') || key.toLowerCase().includes('connect')) {
            console.log(`🔗 Found potential NWC property: ${key}`, alby.webln[key]);
          }
        }
      }
      
      // Check if nostr object has NWC capabilities
      if (alby.nostr) {
        console.log('🔍 Checking Alby Nostr properties:', Object.keys(alby.nostr));
        
        // Some Alby versions might store NWC info in nostr object
        if (alby.nostr.nwc) {
          console.log('🔗 Found NWC in nostr object:', alby.nostr.nwc);
          if (typeof alby.nostr.nwc === 'string' && alby.nostr.nwc.startsWith('nostr+walletconnect://')) {
            console.log('✅ Found NWC connection from Alby nostr object');
            return alby.nostr.nwc;
          }
        }
      }
      
      // Try standard Alby API methods
      if (typeof alby.getConnectors === 'function') {
        try {
          const connectors = await alby.getConnectors();
          console.log('🔗 Alby connectors:', connectors);
          const nwcConnector = connectors.find((c: any) => c.type === 'nwc');
          if (nwcConnector?.connectionString) {
            console.log('✅ Found NWC connection from Alby connectors');
            return nwcConnector.connectionString;
          }
        } catch (error) {
          console.log('⚠️ Failed to get Alby connectors:', error);
        }
      }
      
      // Alternative Alby API check
      if (typeof alby.getWalletConnectInfo === 'function') {
        try {
          const walletConnectInfo = await alby.getWalletConnectInfo();
          console.log('🔗 Alby WalletConnect info:', walletConnectInfo);
          if (walletConnectInfo?.connectionString) {
            return walletConnectInfo.connectionString;
          }
        } catch (error) {
          console.log('⚠️ Failed to get Alby WalletConnect info:', error);
        }
      }
      
      // Check for user account information that might contain NWC
      if (typeof alby.getAccount === 'function') {
        try {
          const account = await alby.getAccount();
          console.log('👤 Alby account info:', account);
          if (account?.nwc) {
            console.log('✅ Found NWC connection from Alby account');
            return account.nwc;
          }
        } catch (error) {
          console.log('⚠️ Failed to get Alby account:', error);
        }
      }
      
      // Check if webbtc has any NWC info
      if (alby.webbtc) {
        console.log('₿ Checking Alby WebBTC properties:', Object.keys(alby.webbtc));
      }
    }
    
    // Method 2: Check for Mutiny wallet
    if ((window as any).mutiny) {
      console.log('⚡ Mutiny wallet detected, checking for NWC...');
      const mutiny = (window as any).mutiny;
      console.log('🔧 Mutiny methods:', Object.keys(mutiny));
      
      if (typeof mutiny.getNWCConnection === 'function') {
        try {
          const nwcConnection = await mutiny.getNWCConnection();
          if (nwcConnection) {
            console.log('✅ Found NWC connection from Mutiny wallet');
            return nwcConnection;
          }
        } catch (error) {
          console.log('⚠️ Failed to get Mutiny NWC:', error);
        }
      }
    }
    
    // Method 3: Check for generic NWC in WebLN provider
    if ((window.webln as any).nwc) {
      console.log('🔗 NWC property found on WebLN provider');
      const nwc = (window.webln as any).nwc;
      if (typeof nwc === 'string' && nwc.startsWith('nostr+walletconnect://')) {
        console.log('✅ Found NWC connection from WebLN provider');
        return nwc;
      }
    }
    
    // Method 4: Check for NWC in browser storage (some wallets store it there)
    try {
      const storedNWC = localStorage.getItem('nwc_connection') || localStorage.getItem('walletconnect');
      if (storedNWC && storedNWC.startsWith('nostr+walletconnect://')) {
        console.log('✅ Found NWC connection in localStorage');
        return storedNWC;
      }
    } catch (error) {
      console.log('⚠️ Could not check localStorage:', error);
    }
    
    console.log('❌ No NWC connection found through any detection method');
    return null;
  } catch (error) {
    console.warn('❌ Failed to detect wallet NWC:', error);
    return null;
  }
}

/**
 * Generate invoice for fundraiser using their NWC connection
 */
export async function generateFundraiserInvoiceNWC(
  campaign: { nwc?: string; title: string },
  amountMsats: number,
  ticketCount: number
): Promise<string> {
  const description = `${ticketCount} ticket${ticketCount > 1 ? 's' : ''} for ${campaign.title}`;
  
  if (!campaign.nwc) {
    throw new Error('No NWC connection configured for this fundraiser');
  }
  
  if (!isValidNWCConnection(campaign.nwc)) {
    throw new Error('Invalid NWC connection format');
  }
  
  return generateInvoiceFromNWC(campaign.nwc, amountMsats, description);
}