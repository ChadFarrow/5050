import { createContext, useContext, useState, ReactNode } from 'react';

interface LoginContextType {
  isLoginDialogOpen: boolean;
  openLoginDialog: () => void;
  closeLoginDialog: () => void;
}

const LoginContext = createContext<LoginContextType | undefined>(undefined);

export function LoginProvider({ children }: { children: ReactNode }) {
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);

  const openLoginDialog = () => setIsLoginDialogOpen(true);
  const closeLoginDialog = () => setIsLoginDialogOpen(false);

  return (
    <LoginContext.Provider value={{ isLoginDialogOpen, openLoginDialog, closeLoginDialog }}>
      {children}
    </LoginContext.Provider>
  );
}

export function useLoginDialog() {
  const context = useContext(LoginContext);
  if (context === undefined) {
    throw new Error('useLoginDialog must be used within a LoginProvider');
  }
  return context;
}