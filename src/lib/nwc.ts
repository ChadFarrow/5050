// Nostr Wallet Connect (NWC) utilities for generating invoices from fundraiser creators

import { SimplePool, Event as NostrEvent, finalizeEvent, UnsignedEvent, nip04, getPublicKey } from 'nostr-tools';

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
    // Basic format check first
    if (!nwcString.startsWith('nostr+walletconnect://')) {
      throw new Error('NWC connection must start with nostr+walletconnect://');
    }
    
    // Remove the nostr+walletconnect:// prefix
    const cleanUrl = nwcString.replace('nostr+walletconnect://', 'https://');
    const url = new URL(cleanUrl);
    
    const relayUrl = url.searchParams.get('relay');
    const secret = url.searchParams.get('secret');
    
    // Check for pubkey in query params first (generic format)
    let walletPubkey = url.searchParams.get('pubkey');
    
    // If no pubkey in query params, check if hostname is the pubkey (Alby format)
    if (!walletPubkey && url.hostname && url.hostname.length === 64) {
      walletPubkey = url.hostname;
    }
    
    if (!relayUrl || !secret || !walletPubkey) {
      throw new Error(`Invalid NWC connection string - missing required parameters. Found: relay=${!!relayUrl}, secret=${!!secret}, pubkey=${!!walletPubkey}`);
    }
    
    return {
      walletPubkey,
      relayUrl,
      secret
    };
  } catch (error) {
    throw new Error(`Failed to parse NWC connection: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
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
    
    // Convert secret to bytes for signing
    const secretBytes = new Uint8Array(32);
    const secretHex = connectionInfo.secret;
    for (let i = 0; i < 32; i++) {
      secretBytes[i] = parseInt(secretHex.substr(i * 2, 2), 16);
    }
    
    // Get public key for the unsigned event
    const pubkey = getPublicKey(secretBytes);
    
    // Create unsigned event
    const unsignedEvent: UnsignedEvent = {
      kind: 23194, // NWC request kind
      content: encryptedContent,
      tags: [
        ['p', connectionInfo.walletPubkey] // Target wallet pubkey
      ],
      created_at: Math.floor(Date.now() / 1000),
      pubkey
    };
    
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
    // Quick basic checks first to avoid expensive parsing on incomplete strings
    if (!nwcString || typeof nwcString !== 'string') {
      return false;
    }
    
    // Only attempt full parsing if the string looks reasonably complete
    if (!nwcString.startsWith('nostr+walletconnect://') || nwcString.length < 50) {
      return false;
    }
    
    // If it looks like a complete NWC string, then do full validation
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
    console.log('🔍 Starting enhanced NWC detection...');
    
    // First, let's do a comprehensive window object inspection
    console.log('🌐 Complete window object inspection for debugging:');
    console.log('🔍 Window keys containing wallet-related terms:', 
      Object.keys(window).filter(key => 
        key.toLowerCase().includes('alby') || 
        key.toLowerCase().includes('mutiny') || 
        key.toLowerCase().includes('nwc') ||
        key.toLowerCase().includes('wallet') ||
        key.toLowerCase().includes('bitcoin') ||
        key.toLowerCase().includes('webln') ||
        key.toLowerCase().includes('nostr')
      )
    );
    
    // Check if WebLN is available
    if (!window.webln) {
      console.log('❌ No WebLN provider available');
      return null;
    }
    
    console.log('✅ WebLN provider found');
    console.log('🔍 WebLN object keys:', Object.keys(window.webln));
    console.log('🔍 WebLN object methods:', Object.keys(window.webln).filter(key => typeof (window.webln as Record<string, unknown>)[key] === 'function'));
    
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
    
    // Check for bitcoin connect provider
    console.log('🔍 Checking for bitcoin connect in window...');
    if ('bitcoinConnect' in window) {
      console.log('✅ bitcoinConnect found in window');
    } else {
      console.log('❌ bitcoinConnect not found in window');
    }
    
    // Check for specific wallet browser extensions
    console.log('🔍 Detailed wallet extension check:');
    console.log('  - Alby extension:', 'alby' in window);
    console.log('  - Mutiny extension:', 'mutiny' in window);
    console.log('  - Generic webln:', !!window.webln);
    console.log('  - Bitcoin Connect:', 'bitcoinConnect' in window);
    
    // Enhanced Method 1: Check for Alby wallet with more API methods
    if ('alby' in window) {
      console.log('🐝 Alby wallet detected, checking for NWC...');
      const alby = (window as { alby: Record<string, unknown> }).alby;
      console.log('🔧 Alby methods:', Object.keys(alby));
      
      // Try newer Alby Connect API
      if (typeof alby.enable === 'function') {
        try {
          console.log('🔄 Enabling Alby Connect...');
          await (alby.enable as () => Promise<void>)();
          console.log('✅ Alby Connect enabled');
        } catch (error) {
          console.log('⚠️ Alby Connect enable failed:', error);
        }
      }
      
      // Check if we can get a direct NWC connection string
      if (typeof alby.getConnectorString === 'function') {
        try {
          const connectorString = await (alby.getConnectorString as () => Promise<string>)();
          console.log('🔗 Alby connector string:', connectorString);
          if (connectorString && connectorString.startsWith('nostr+walletconnect://')) {
            console.log('✅ Found NWC connection from Alby connector string');
            return connectorString;
          }
        } catch (error) {
          console.log('⚠️ Failed to get Alby connector string:', error);
        }
      }
      
      // Try to get NWC through the newer Alby API
      if (typeof alby.createNWCConnection === 'function') {
        try {
          const nwcConnection = await (alby.createNWCConnection as () => Promise<string>)();
          console.log('🔗 Alby NWC connection:', nwcConnection);
          if (nwcConnection) {
            console.log('✅ Found NWC connection from Alby createNWCConnection');
            return nwcConnection;
          }
        } catch (error) {
          console.log('⚠️ Failed to create Alby NWC connection:', error);
        }
      }
      
      // Deep inspect Alby object properties
      console.log('🔍 Inspecting Alby object structure...');
      for (const key of Object.keys(alby)) {
        const value = alby[key];
        if (value && typeof value === 'object') {
          console.log(`📦 alby.${key}:`, Object.keys(value));
          
          // Type-safe property access
          const valueObj = value as Record<string, unknown>;
          
          // Check for NWC in nested objects
          if ('nwc' in valueObj || 'connectionString' in valueObj || 'walletConnect' in valueObj) {
            console.log(`🔗 Found potential NWC in alby.${key}:`, { 
              nwc: valueObj.nwc, 
              connectionString: valueObj.connectionString,
              walletConnect: valueObj.walletConnect
            });
            
            const nwcCandidate = valueObj.nwc || valueObj.connectionString || valueObj.walletConnect;
            if (typeof nwcCandidate === 'string' && nwcCandidate.startsWith('nostr+walletconnect://')) {
              console.log(`✅ Found valid NWC connection from alby.${key}`);
              return nwcCandidate;
            }
          }
        } else {
          console.log(`🔧 alby.${key}:`, typeof value);
        }
      }
      
      // Check if webln has any NWC-related properties
      if ('webln' in alby && alby.webln && typeof alby.webln === 'object') {
        console.log('🔍 Checking Alby WebLN properties:', Object.keys(alby.webln));
        
        // Check for any NWC-related properties in webln
        const weblnObj = alby.webln as Record<string, unknown>;
        const weblnKeys = Object.keys(weblnObj);
        for (const key of weblnKeys) {
          if (key.toLowerCase().includes('nwc') || key.toLowerCase().includes('connect')) {
            console.log(`🔗 Found potential NWC property: ${key}`, weblnObj[key]);
            const candidate = weblnObj[key];
            if (typeof candidate === 'string' && candidate.startsWith('nostr+walletconnect://')) {
              console.log(`✅ Found valid NWC connection from alby.webln.${key}`);
              return candidate;
            }
          }
        }
      }
      
      // Check if nostr object has NWC capabilities
      if ('nostr' in alby && alby.nostr && typeof alby.nostr === 'object') {
        console.log('🔍 Checking Alby Nostr properties:', Object.keys(alby.nostr));
        
        const nostrObj = alby.nostr as Record<string, unknown>;
        
        // Some Alby versions might store NWC info in nostr object
        if ('nwc' in nostrObj) {
          console.log('🔗 Found NWC in nostr object:', nostrObj.nwc);
          if (typeof nostrObj.nwc === 'string' && nostrObj.nwc.startsWith('nostr+walletconnect://')) {
            console.log('✅ Found NWC connection from Alby nostr object');
            return nostrObj.nwc;
          }
        }
      }
      
      // Try standard Alby API methods
      if (typeof alby.getConnectors === 'function') {
        try {
          const connectors = await (alby.getConnectors as () => Promise<Array<{ type?: string; name?: string; connectionString?: string }>>)();
          console.log('🔗 Alby connectors:', connectors);
          const nwcConnector = connectors.find((c) => c.type === 'nwc' || c.name?.toLowerCase().includes('nwc'));
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
          const walletConnectInfo = await (alby.getWalletConnectInfo as () => Promise<{ connectionString?: string }>)();
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
          const account = await (alby.getAccount as () => Promise<{ nwc?: string }>)();
          console.log('👤 Alby account info:', account);
          if (account?.nwc) {
            console.log('✅ Found NWC connection from Alby account');
            return account.nwc;
          }
        } catch (error) {
          console.log('⚠️ Failed to get Alby account:', error);
        }
      }
    }
    
    // Method 2: Check for Bitcoin Connect provider extensions
    if ('bitcoinConnect' in window) {
      console.log('₿ Bitcoin Connect detected, checking for wallet extensions...');
      const bitcoinConnect = (window as { bitcoinConnect: Record<string, unknown> }).bitcoinConnect;
      console.log('🔧 Bitcoin Connect methods:', Object.keys(bitcoinConnect));
      
      if (typeof bitcoinConnect.getProvider === 'function') {
        try {
          const provider = await (bitcoinConnect.getProvider as () => Promise<{ getNWC?: () => Promise<string> }>)();
          console.log('📱 Bitcoin Connect provider:', provider);
          
          // Check if the provider has NWC capabilities
          if (provider && typeof provider.getNWC === 'function') {
            const nwc = await provider.getNWC();
            if (nwc && nwc.startsWith('nostr+walletconnect://')) {
              console.log('✅ Found NWC from Bitcoin Connect provider');
              return nwc;
            }
          }
        } catch (error) {
          console.log('⚠️ Failed to get Bitcoin Connect provider:', error);
        }
      }
    }
    
    // Method 3: Check for Mutiny wallet
    if ('mutiny' in window) {
      console.log('⚡ Mutiny wallet detected, checking for NWC...');
      const mutiny = (window as { mutiny: Record<string, unknown> }).mutiny;
      console.log('🔧 Mutiny methods:', Object.keys(mutiny));
      
      if (typeof mutiny.getNWCConnection === 'function') {
        try {
          const nwcConnection = await (mutiny.getNWCConnection as () => Promise<string>)();
          if (nwcConnection && nwcConnection.startsWith('nostr+walletconnect://')) {
            console.log('✅ Found NWC connection from Mutiny wallet');
            return nwcConnection;
          }
        } catch (error) {
          console.log('⚠️ Failed to get Mutiny NWC:', error);
        }
      }
    }
    
    // Method 4: Check for generic NWC in WebLN provider
    if (window.webln && 'nwc' in window.webln) {
      console.log('🔗 NWC property found on WebLN provider');
      const nwc = (window.webln as { nwc: string }).nwc;
      if (typeof nwc === 'string' && nwc.startsWith('nostr+walletconnect://')) {
        console.log('✅ Found NWC connection from WebLN provider');
        return nwc;
      }
    }
    
    // Method 5: Comprehensive storage inspection for existing NWC connections
    console.log('🗄️ Checking all browser storage for existing NWC connections...');
    
    try {
      // Check localStorage extensively
      console.log('📦 localStorage inspection:');
      const localStorageKeys = Object.keys(localStorage);
      console.log('  - All localStorage keys:', localStorageKeys);
      
      // Common NWC storage patterns
      const nwcStorageKeys = [
        'nwc_connection', 'walletconnect', 'alby_nwc', 'lightning_nwc', 'nostr_wallet_connect',
        'alby-hub-nwc', 'nwc', 'wallet_connect', 'lightning_wallet', 'alby_connection',
        'bitcoin_connect_nwc', 'webln_nwc', 'alby-extension-nwc'
      ];
      
      // Check specific known keys
      for (const key of nwcStorageKeys) {
        const storedValue = localStorage.getItem(key);
        if (storedValue) {
          console.log(`  - Found data in ${key}:`, storedValue.slice(0, 50) + '...');
          if (storedValue.startsWith('nostr+walletconnect://')) {
            console.log(`✅ Found valid NWC connection in localStorage key: ${key}`);
            return storedValue;
          }
        }
      }
      
      // Check all localStorage keys for anything that looks like NWC
      for (const key of localStorageKeys) {
        if (key.toLowerCase().includes('nwc') || 
            key.toLowerCase().includes('wallet') || 
            key.toLowerCase().includes('connect') ||
            key.toLowerCase().includes('nostr') ||
            key.toLowerCase().includes('alby')) {
          const value = localStorage.getItem(key);
          if (value) {
            console.log(`  - Checking wallet-related key ${key}:`, value.slice(0, 100) + '...');
            
            // Try parsing as JSON in case it's wrapped
            try {
              const parsed = JSON.parse(value);
              console.log(`  - Parsed ${key} as JSON:`, parsed);
              
              // Check for NWC in parsed object
              if (typeof parsed === 'object' && parsed !== null) {
                const searchObject = (obj: Record<string, unknown>, path = ''): string | null => {
                  for (const [k, v] of Object.entries(obj)) {
                    const currentPath = path ? `${path}.${k}` : k;
                    if (typeof v === 'string' && v.startsWith('nostr+walletconnect://')) {
                      console.log(`✅ Found NWC in ${key} at path ${currentPath}`);
                      return v;
                    }
                    if (typeof v === 'object' && v !== null) {
                      const result = searchObject(v as Record<string, unknown>, currentPath);
                      if (result) return result;
                    }
                  }
                  return null;
                };
                
                const foundNWC = searchObject(parsed);
                if (foundNWC) return foundNWC;
              }
            } catch {
              // Not JSON, check if it's a direct NWC string
              if (value.startsWith('nostr+walletconnect://')) {
                console.log(`✅ Found NWC connection in localStorage key: ${key}`);
                return value;
              }
            }
          }
        }
      }
      
      // Check sessionStorage too
      console.log('📦 sessionStorage inspection:');
      const sessionStorageKeys = Object.keys(sessionStorage);
      console.log('  - All sessionStorage keys:', sessionStorageKeys);
      
      for (const key of sessionStorageKeys) {
        if (key.toLowerCase().includes('nwc') || 
            key.toLowerCase().includes('wallet') || 
            key.toLowerCase().includes('connect')) {
          const value = sessionStorage.getItem(key);
          if (value) {
            console.log(`  - Checking session key ${key}:`, value.slice(0, 100) + '...');
            if (value.startsWith('nostr+walletconnect://')) {
              console.log(`✅ Found NWC connection in sessionStorage key: ${key}`);
              return value;
            }
          }
        }
      }
      
    } catch (error) {
      console.log('⚠️ Could not check browser storage:', error);
    }
    
    // Method 6: Try to prompt user to create NWC connection if Alby is detected
    if ('alby' in window) {
      console.log('🐝 Alby detected but no NWC found - checking if we can prompt wallet to create one');
      const alby = (window as { alby: Record<string, unknown> }).alby;
      
      // Try to trigger Alby NWC creation flow if available
      if (typeof alby.requestNWC === 'function') {
        try {
          console.log('🔄 Attempting to request NWC from Alby...');
          const nwc = await (alby.requestNWC as () => Promise<string>)();
          if (nwc && nwc.startsWith('nostr+walletconnect://')) {
            console.log('✅ NWC created via Alby requestNWC');
            return nwc;
          }
        } catch (error) {
          console.log('⚠️ Alby requestNWC failed:', error);
        }
      }
      
      // Check if Alby has any wallet connect methods
      if (typeof alby.requestWalletConnect === 'function') {
        try {
          console.log('🔄 Attempting requestWalletConnect from Alby...');
          const result = await (alby.requestWalletConnect as () => Promise<{ connectionString?: string }>)();
          if (result?.connectionString?.startsWith('nostr+walletconnect://')) {
            console.log('✅ NWC created via Alby requestWalletConnect');
            return result.connectionString;
          }
        } catch (error) {
          console.log('⚠️ Alby requestWalletConnect failed:', error);
        }
      }
    }
    
    console.log('❌ No NWC connection found through any detection method');
    console.log('💡 Suggestion: User should manually create and paste an NWC connection from their wallet settings');
    console.log('💡 For debugging: Check the console logs above to see what wallet APIs were detected');
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