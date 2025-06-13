import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, User } from 'lucide-react';
import { isTestMode, toggleTestMode } from '@/lib/test-profiles';

export function TestModeToggle() {
  const [testModeEnabled, setTestModeEnabled] = useState(false);

  useEffect(() => {
    setTestModeEnabled(isTestMode());
  }, []);

  const handleToggle = () => {
    const newMode = toggleTestMode();
    setTestModeEnabled(newMode);
    // Reload the page to ensure all components use the new mode
    window.location.reload();
  };

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Card className="border-dashed border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {testModeEnabled ? (
            <>
              <Users className="h-4 w-4" />
              Test Mode
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                ON
              </Badge>
            </>
          ) : (
            <>
              <User className="h-4 w-4" />
              Normal Mode
              <Badge variant="outline">OFF</Badge>
            </>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          {testModeEnabled 
            ? 'Ticket purchases will use random test profiles to simulate different users'
            : 'Ticket purchases will use your actual profile'
          }
          <br />
          <strong>Tip:</strong> Add <code>?test=true</code> to the URL to enable quickly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center space-x-2">
          <Switch
            id="test-mode"
            checked={testModeEnabled}
            onCheckedChange={handleToggle}
          />
          <Label htmlFor="test-mode" className="text-sm">
            Enable random test profiles
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          This helps test the raffle system by creating tickets from different users
        </p>
      </CardContent>
    </Card>
  );
}