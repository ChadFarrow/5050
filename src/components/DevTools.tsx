import { useState } from "react";
import { Trash2, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQueryClient } from '@tanstack/react-query';

export function DevTools() {
  const [isClearing, setIsClearing] = useState(false);
  const queryClient = useQueryClient();

  const clearLocalData = async () => {
    setIsClearing(true);
    
    try {
      // Clear React Query cache
      queryClient.clear();
      
      // Clear localStorage
      localStorage.clear();
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Force page reload to reset state
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (error) {
      console.error('Error clearing data:', error);
      setIsClearing(false);
    }
  };

  const clearQueryCache = () => {
    queryClient.clear();
    queryClient.resetQueries();
  };

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <Card className="border-red-200 bg-red-50 dark:bg-red-950">
      <CardHeader>
        <CardTitle className="flex items-center text-red-800 dark:text-red-200">
          <Database className="h-5 w-5 mr-2" />
          Development Tools
        </CardTitle>
        <CardDescription>
          Tools for clearing cached data during development. Only visible in development mode.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Trash2 className="h-4 w-4" />
          <AlertDescription>
            <strong>Note:</strong> These tools only clear local cached data. 
            Events published to Nostr relays will persist and may reappear when the app reconnects.
          </AlertDescription>
        </Alert>
        
        <div className="grid gap-3">
          <Button
            onClick={clearQueryCache}
            variant="outline"
            className="border-orange-200 text-orange-700 hover:bg-orange-50"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Clear Query Cache Only
          </Button>
          
          <Button
            onClick={clearLocalData}
            disabled={isClearing}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isClearing ? "Clearing..." : "Clear All Local Data & Reload"}
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground">
          <p><strong>Query Cache:</strong> Clears fundraiser and stats cache</p>
          <p><strong>All Local Data:</strong> Clears cache + localStorage + reloads page</p>
        </div>
      </CardContent>
    </Card>
  );
}