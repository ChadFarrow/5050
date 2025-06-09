// Re-export everything from the modular NWC implementation
export * from './nwc-types';
export * from './nwc-utils';
export { NWCClient } from './nwc-client';

// Legacy exports for backward compatibility
export { isValidNWCConnection } from './nwc-utils';