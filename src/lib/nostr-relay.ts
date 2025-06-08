import type { NostrEvent } from '@nostrify/nostrify';

export interface RelayMessage {
  type: 'EVENT' | 'REQ' | 'CLOSE' | 'NOTICE' | 'EOSE' | 'OK';
  data: any[];
}

export class NostrRelayClient {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, (event: NostrEvent) => void>();
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private relayUrl: string) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.relayUrl);

        this.ws.onopen = () => {
          console.log(`Connected to relay: ${this.relayUrl}`);
          this.connected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (message) => {
          try {
            const data = JSON.parse(message.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Failed to parse relay message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log(`Disconnected from relay: ${this.relayUrl}`);
          this.connected = false;
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error(`Relay error: ${this.relayUrl}`, error);
          reject(new Error(`Failed to connect to relay: ${this.relayUrl}`));
        };

        // Connection timeout
        setTimeout(() => {
          if (!this.connected) {
            this.ws?.close();
            reject(new Error(`Connection timeout: ${this.relayUrl}`));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(data: any[]) {
    const [type, ...rest] = data;

    switch (type) {
      case 'EVENT':
        const [subscriptionId, event] = rest;
        const handler = this.subscriptions.get(subscriptionId);
        if (handler) {
          handler(event as NostrEvent);
        }
        break;

      case 'NOTICE':
        console.log('Relay notice:', rest[0]);
        break;

      case 'OK':
        const [eventId, success, message] = rest;
        console.log(`Event ${eventId} ${success ? 'accepted' : 'rejected'}: ${message}`);
        break;

      case 'EOSE':
        console.log('End of stored events for subscription:', rest[0]);
        break;

      default:
        console.log('Unknown message type:', type, rest);
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`Attempting to reconnect in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    } else {
      console.error(`Max reconnection attempts reached for ${this.relayUrl}`);
    }
  }

  async sendEvent(event: NostrEvent): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.ws) {
        reject(new Error('Not connected to relay'));
        return;
      }

      const message = ['EVENT', event];
      
      try {
        this.ws.send(JSON.stringify(message));
        
        // Listen for OK response
        const originalOnMessage = this.ws.onmessage;
        const timeout = setTimeout(() => {
          this.ws!.onmessage = originalOnMessage;
          reject(new Error('Event send timeout'));
        }, 10000);

        this.ws.onmessage = (msg) => {
          const data = JSON.parse(msg.data);
          if (data[0] === 'OK' && data[1] === event.id) {
            clearTimeout(timeout);
            this.ws!.onmessage = originalOnMessage;
            resolve(data[2]); // success boolean
          } else {
            // Pass other messages to original handler
            originalOnMessage?.call(this.ws, msg);
          }
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  subscribe(
    filters: any[], 
    onEvent: (event: NostrEvent) => void,
    subscriptionId?: string
  ): string {
    if (!this.connected || !this.ws) {
      throw new Error('Not connected to relay');
    }

    const subId = subscriptionId || this.generateSubscriptionId();
    this.subscriptions.set(subId, onEvent);

    const message = ['REQ', subId, ...filters];
    this.ws.send(JSON.stringify(message));

    return subId;
  }

  unsubscribe(subscriptionId: string) {
    if (!this.connected || !this.ws) {
      return;
    }

    this.subscriptions.delete(subscriptionId);
    const message = ['CLOSE', subscriptionId];
    this.ws.send(JSON.stringify(message));
  }

  private generateSubscriptionId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  disconnect() {
    if (this.ws) {
      this.connected = false;
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Multi-relay pool for better reliability
export class NostrRelayPool {
  private relays = new Map<string, NostrRelayClient>();
  private connectedRelays = new Set<string>();

  constructor(private relayUrls: string[]) {}

  async connect(): Promise<void> {
    const connections = this.relayUrls.map(async (url) => {
      try {
        const relay = new NostrRelayClient(url);
        await relay.connect();
        this.relays.set(url, relay);
        this.connectedRelays.add(url);
        return { url, success: true };
      } catch (error) {
        console.error(`Failed to connect to ${url}:`, error);
        return { url, success: false, error };
      }
    });

    const results = await Promise.allSettled(connections);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    if (successful === 0) {
      throw new Error('Failed to connect to any relays');
    }

    console.log(`Connected to ${successful}/${this.relayUrls.length} relays`);
  }

  async sendEvent(event: NostrEvent): Promise<{ url: string; success: boolean }[]> {
    const promises = Array.from(this.connectedRelays).map(async (url) => {
      const relay = this.relays.get(url);
      if (!relay) return { url, success: false };

      try {
        const success = await relay.sendEvent(event);
        return { url, success };
      } catch (error) {
        console.error(`Failed to send event to ${url}:`, error);
        return { url, success: false };
      }
    });

    return Promise.all(promises);
  }

  subscribe(
    filters: any[], 
    onEvent: (event: NostrEvent, relayUrl: string) => void,
    subscriptionId?: string
  ): string[] {
    const subId = subscriptionId || Math.random().toString(36).substr(2, 9);
    const subscriptionIds: string[] = [];

    this.connectedRelays.forEach((url) => {
      const relay = this.relays.get(url);
      if (relay) {
        try {
          const id = relay.subscribe(filters, (event) => onEvent(event, url), `${subId}_${url}`);
          subscriptionIds.push(id);
        } catch (error) {
          console.error(`Failed to subscribe to ${url}:`, error);
        }
      }
    });

    return subscriptionIds;
  }

  unsubscribe(subscriptionIds: string[]) {
    subscriptionIds.forEach((id) => {
      const relayUrl = id.split('_').pop();
      if (relayUrl) {
        const relay = this.relays.get(relayUrl);
        relay?.unsubscribe(id);
      }
    });
  }

  disconnect() {
    this.relays.forEach((relay) => relay.disconnect());
    this.relays.clear();
    this.connectedRelays.clear();
  }

  getConnectedRelays(): string[] {
    return Array.from(this.connectedRelays);
  }
}

// Helper function to wait for specific event response
export async function waitForEventResponse(
  pool: NostrRelayPool,
  filter: any,
  timeoutMs: number = 30000
): Promise<NostrEvent | null> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        pool.unsubscribe(subscriptionIds);
        resolve(null);
      }
    }, timeoutMs);

    const subscriptionIds = pool.subscribe(
      [filter],
      (event: NostrEvent) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          pool.unsubscribe(subscriptionIds);
          resolve(event);
        }
      }
    );

    if (subscriptionIds.length === 0) {
      clearTimeout(timeout);
      reject(new Error('No relays available for subscription'));
    }
  });
}