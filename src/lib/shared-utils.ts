import { useToast } from '@/hooks/useToast';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import type { NostrMetadata } from '@nostrify/nostrify';

// Toast Utilities
export const useToastUtils = () => {
  const { toast } = useToast();

  return {
    success: (title: string, description?: string) =>
      toast({ title, description }),
    
    error: (title: string, description?: string) =>
      toast({ title, description, variant: "destructive" }),
    
    lightning: {
      connected: () => toast({
        title: "Lightning Wallet Connected",
        description: "Successfully connected to your Lightning wallet"
      }),
      
      disconnected: () => toast({
        title: "Lightning Wallet Disconnected", 
        description: "Disconnected from Lightning wallet"
      }),
      
      invoiceCreated: (amount: number) => toast({
        title: "Invoice Created",
        description: `Created invoice for ${Math.floor(amount / 1000)} sats`
      }),
      
      paymentSent: () => toast({
        title: "Payment Sent",
        description: "Lightning payment sent successfully"
      }),
      
      paymentFailed: (reason?: string) => toast({
        title: "Payment Failed",
        description: reason || "Failed to send Lightning payment",
        variant: "destructive"
      })
    },
    
    campaign: {
      ticketsPurchased: (count: number, amount: string) => toast({
        title: "Tickets Purchased!",
        description: `Successfully bought ${count} ticket${count > 1 ? 's' : ''} for ${amount}`
      }),
      
      campaignCreated: () => toast({
        title: "Campaign Created!",
        description: "Your fundraiser campaign has been published"
      })
    }
  };
};

// Author Display Hook
export const useAuthorDisplay = (pubkey: string) => {
  const author = useAuthor(pubkey);
  const metadata: NostrMetadata | undefined = author.data?.metadata;
  
  return {
    displayName: metadata?.name ?? genUserName(pubkey),
    profileImage: metadata?.picture,
    isLoading: author.isLoading,
    error: author.error,
    metadata
  };
};

// Form Validation Utilities
export const createFormValidators = () => ({
  required: (value: string, fieldName: string) => {
    if (!value?.trim()) {
      throw new Error(`${fieldName} is required`);
    }
    return value.trim();
  },
  
  positiveNumber: (value: string | number, fieldName: string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num) || num <= 0) {
      throw new Error(`${fieldName} must be a positive number`);
    }
    return num;
  },
  
  futureDate: (value: Date | string, fieldName: string) => {
    const date = new Date(value);
    if (date <= new Date()) {
      throw new Error(`${fieldName} must be in the future`);
    }
    return date;
  },
  
});

// Common Loading States
export const createLoadingStates = () => ({
  isAnyLoading: (...loadingStates: boolean[]) => 
    loadingStates.some(state => state),
    
  getLoadingText: (states: Record<string, boolean>) => {
    const activeStates = Object.entries(states)
      .filter(([_, isLoading]) => isLoading)
      .map(([key]) => key);
    
    if (activeStates.length === 0) return null;
    return activeStates.join(', ') + '...';
  }
});

// Error Boundary Utilities
export const handleAsyncError = async <T>(
  operation: () => Promise<T>,
  errorHandler?: (error: Error) => void
): Promise<T | null> => {
  try {
    return await operation();
  } catch (error) {
    const errorMessage = error instanceof Error ? error : new Error('Unknown error');
    if (errorHandler) {
      errorHandler(errorMessage);
    } else {
      console.error('Async operation failed:', errorMessage);
    }
    return null;
  }
};

// Local Storage Utilities
export const createStorageUtils = <T>(key: string, defaultValue: T) => ({
  get: (): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  
  set: (value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to save to localStorage:`, error);
    }
  },
  
  remove: (): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove from localStorage:`, error);
    }
  }
});