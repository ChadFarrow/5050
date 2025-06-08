import { useNWCReal } from './useNWCReal';
import { useLocalStorage } from './useLocalStorage';
import { type NWCConfig, parseNWCConnectionString } from '@/lib/lightning';
import { useToast } from './useToast';

export function useFundraiserWallet() {
  const nwc = useNWCReal();
  const [_nwcConfig, setNWCConfig] = useLocalStorage<NWCConfig | null>('fundraiser-nwc-config', null);
  const { toast } = useToast();

  const configureWallet = async (connectionString: string) => {
    try {
      // Parse the NWC connection string
      const config = parseNWCConnectionString(connectionString);
      
      // Save the configuration
      setNWCConfig(config);
      
      toast({
        title: "Wallet Connected",
        description: "Your lightning wallet has been successfully connected.",
      });

      return true;
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive",
      });
      return false;
    }
  };

  const createFundraiserInvoice = async (amount: number, description: string) => {
    try {
      if (!nwc.isConfigured) {
        throw new Error("Please connect your lightning wallet first");
      }

      const invoice = await nwc.createInvoice({
        amount,
        description,
        expiry: 24 * 3600, // 24 hours expiry
      });

      toast({
        title: "Invoice Created",
        description: "Lightning invoice has been generated successfully.",
      });

      return invoice;
    } catch (error) {
      toast({
        title: "Invoice Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create invoice",
        variant: "destructive",
      });
      throw error;
    }
  };

  const checkInvoiceStatus = async (paymentHash: string) => {
    try {
      if (!nwc.isConfigured) {
        throw new Error("Please connect your lightning wallet first");
      }

      // Use the createInvoice mutation to check status
      const response = await nwc.createInvoice({
        amount: 0,
        description: `check_status_${paymentHash}`,
      });

      return response;
    } catch (error) {
      toast({
        title: "Status Check Failed",
        description: error instanceof Error ? error.message : "Failed to check invoice status",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getWalletBalance = async () => {
    try {
      if (!nwc.isConfigured) {
        throw new Error("Please connect your lightning wallet first");
      }

      await nwc.refetchBalance();
      return nwc.balance;
    } catch (error) {
      toast({
        title: "Balance Check Failed",
        description: error instanceof Error ? error.message : "Failed to get wallet balance",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    isConfigured: nwc.isConfigured,
    balance: nwc.balance,
    isLoadingBalance: nwc.isLoadingBalance,
    configureWallet,
    createFundraiserInvoice,
    checkInvoiceStatus,
    getWalletBalance,
  };
} 