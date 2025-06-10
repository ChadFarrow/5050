import { ReactNode, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { AppContext, type AppConfig, type AppContextType, type Theme } from '@/contexts/AppContext';

interface AppProviderProps {
  children: ReactNode;
  /** Application storage key */
  storageKey: string;
  /** Default app configuration */
  defaultConfig: AppConfig;
  /** Optional list of preset relays to display in the RelaySelector */
  presetRelays?: { name: string; url: string }[];
}

export function AppProvider(props: AppProviderProps) {
  const {
    children,
    storageKey,
    defaultConfig,
    presetRelays,
  } = props;

  // App configuration state with localStorage persistence
  const [config, setConfig] = useLocalStorage<AppConfig>(storageKey, defaultConfig);

  // Generic config updater with callback pattern
  const updateConfig = (updater: (currentConfig: AppConfig) => AppConfig) => {
    setConfig(updater);
  };

  const appContextValue: AppContextType = {
    config,
    updateConfig,
    presetRelays,
  };

  // Apply theme effects to document
  useApplyTheme(config.theme);

  // Load Bitcoin Connect web components
  useEffect(() => {
    const loadBitcoinConnect = async () => {
      try {
        // Import Bitcoin Connect to register web components
        await import('@getalby/bitcoin-connect');
        
        // Initialize Bitcoin Connect with default config
        const { init } = await import('@getalby/bitcoin-connect');
        init({
          appName: 'PodRaffle',
          showBalance: true,
        });
        
        console.log('Bitcoin Connect loaded and initialized');
        
        // Add runtime modal fixes
        setTimeout(() => {
          const style = document.createElement('style');
          style.textContent = `
            bc-modal {
              z-index: 9999 !important;
            }
            bc-modal::part(overlay) {
              pointer-events: auto !important;
              z-index: 9999 !important;
            }
            bc-modal::part(modal) {
              pointer-events: auto !important;
              z-index: 10000 !important;
            }
            bc-modal * {
              pointer-events: auto !important;
            }
          `;
          document.head.appendChild(style);
          console.log('Applied Bitcoin Connect modal fixes');
        }, 500);
      } catch (error) {
        console.warn('Failed to load Bitcoin Connect:', error);
      }
    };

    loadBitcoinConnect();
  }, []);

  return (
    <AppContext.Provider value={appContextValue}>
      {children}
    </AppContext.Provider>
  );
}

/**
 * Hook to apply theme changes to the document root
 */
function useApplyTheme(theme: Theme) {
  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  // Handle system theme changes when theme is set to "system"
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      
      const systemTheme = mediaQuery.matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);
}