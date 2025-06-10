import { useState } from 'react';
import { Copy, Check, ExternalLink, Server, Terminal, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/useToast';

interface MCPServerGuideProps {
  connectionString?: string;
}

export function MCPServerGuide({ connectionString }: MCPServerGuideProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "Command copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const claudeDesktopConfig = `{
  "mcpServers": {
    "nwc": {
      "command": "npx",
      "args": ["-y", "@getalby/nwc-mcp-server"],
      "env": {
        "NWC_CONNECTION_STRING": "${connectionString || 'YOUR_NWC_CONNECTION_STRING_HERE'}"
      }
    }
  }
}`;

  const httpServerCommand = `NWC_CONNECTION_STRING="${connectionString || 'your_connection_string'}" npx @getalby/nwc-mcp-server --http --port 3000`;

  const dockerCommand = `docker run -e NWC_CONNECTION_STRING="${connectionString || 'your_connection_string'}" -p 3000:3000 getalby/nwc-mcp-server --http --port 3000`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Server className="h-5 w-5 mr-2" />
          MCP Server Setup Guide
        </CardTitle>
        <CardDescription>
          Set up the Alby NWC MCP server to bridge your Lightning wallet with this application
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> Alby's hosted MCP server has CORS restrictions that prevent direct browser access. 
            Use one of the local server options below for web applications.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="http" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="http">HTTP Server</TabsTrigger>
            <TabsTrigger value="claude">Claude Desktop</TabsTrigger>
            <TabsTrigger value="docker">Docker</TabsTrigger>
          </TabsList>

          <TabsContent value="http" className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Badge variant="secondary">Recommended for Web Apps</Badge>
                <span className="text-sm text-muted-foreground">Standalone HTTP server</span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">1. Install the MCP server globally</h4>
                  <div className="bg-muted p-3 rounded-lg font-mono text-sm relative">
                    <pre>npm install -g @getalby/nwc-mcp-server</pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0"
                      onClick={() => handleCopy('npm install -g @getalby/nwc-mcp-server')}
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">2. Start the HTTP server</h4>
                  <div className="bg-muted p-3 rounded-lg font-mono text-sm relative">
                    <pre className="whitespace-pre-wrap break-all">{httpServerCommand}</pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0"
                      onClick={() => handleCopy(httpServerCommand)}
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">3. Configure the app</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    In the Advanced Settings, enable MCP Server and set the URL to:
                  </p>
                  <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                    http://localhost:3000
                  </div>
                </div>

                <Alert>
                  <Terminal className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    The server will start on port 3000. You should see output like:
                    <br />
                    <code className="text-xs">NWC MCP Server listening on http://localhost:3000</code>
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="claude" className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Badge variant="outline">Claude Integration</Badge>
                <span className="text-sm text-muted-foreground">For Claude Desktop users</span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">1. Locate Claude Desktop config file</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>macOS:</strong> <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></div>
                    <div><strong>Windows:</strong> <code>%APPDATA%/Claude/claude_desktop_config.json</code></div>
                    <div><strong>Linux:</strong> <code>~/.config/claude/claude_desktop_config.json</code></div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">2. Add NWC MCP server configuration</h4>
                  <div className="bg-muted p-3 rounded-lg font-mono text-xs relative max-h-64 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{claudeDesktopConfig}</pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0"
                      onClick={() => handleCopy(claudeDesktopConfig)}
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">3. Restart Claude Desktop</h4>
                  <p className="text-sm text-muted-foreground">
                    After saving the configuration, restart Claude Desktop to load the MCP server.
                  </p>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Note:</strong> This method only works for Claude Desktop integration. 
                    For web app access, use the HTTP server method above.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="docker" className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Badge variant="outline">Docker</Badge>
                <span className="text-sm text-muted-foreground">Containerized deployment</span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Run with Docker</h4>
                  <div className="bg-muted p-3 rounded-lg font-mono text-sm relative">
                    <pre className="whitespace-pre-wrap break-all">{dockerCommand}</pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0"
                      onClick={() => handleCopy(dockerCommand)}
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Note:</strong> Docker image availability depends on Alby's publishing. 
                    Use the NPX method if Docker image is not available.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="border-t pt-4 space-y-4">
          <h4 className="font-medium">Testing Your Setup</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-2">
              <span>1.</span>
              <span>Start your chosen MCP server method</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>2.</span>
              <span>Enable MCP Server in Advanced Settings</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>3.</span>
              <span>Use the diagnostic tools to test the connection</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>4.</span>
              <span>Try creating a test invoice</span>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium mb-2">Alternative: Direct NWC Connection</h4>
          <p className="text-sm text-muted-foreground mb-3">
            If MCP server setup is too complex, you can disable MCP and use direct NWC connection. 
            This connects directly to your wallet's Nostr relay via WebSocket.
          </p>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://github.com/getAlby/nwc-mcp-server', '_blank')}
            >
              View MCP Server Docs <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://nwc.dev', '_blank')}
            >
              NWC Protocol Docs <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}