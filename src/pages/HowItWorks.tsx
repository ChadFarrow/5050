import { ArrowLeft, Zap, Users, DollarSign, Trophy, Ticket, Crown, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";

const HowItWorks = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-1.5 rounded-lg">
                  <Trophy className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  PodRaffle
                </h1>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            How PodRaffle Works
          </h1>
          <p className="text-lg text-muted-foreground">
            A decentralized 50/50 fundraising platform for podcasters built on Nostr with Lightning payments
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader className="text-center">
              <Zap className="h-12 w-12 mx-auto text-purple-600 mb-2" />
              <CardTitle>Lightning Fast</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Instant Bitcoin payments via Lightning Network
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader className="text-center">
              <Users className="h-12 w-12 mx-auto text-blue-600 mb-2" />
              <CardTitle>Fair & Transparent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Verifiable random winner selection on Nostr
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-teal-200 dark:border-teal-800">
            <CardHeader className="text-center">
              <DollarSign className="h-12 w-12 mx-auto text-teal-600 mb-2" />
              <CardTitle>50/50 Split</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Half to the winner, half supports the podcast
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Step by Step Process */}
        <div className="space-y-8">
          <h2 className="text-2xl font-bold text-center mb-8">The Process</h2>
          
          {/* Step 1: Podcaster Creates Fundraiser */}
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Badge variant="secondary" className="bg-purple-100 text-purple-800">Step 1</Badge>
                <CardTitle className="flex items-center">
                  <Trophy className="h-5 w-5 mr-2 text-purple-600" />
                  Podcaster Creates Fundraiser
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>Podcasters set up their fundraising campaign with:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                <li>Campaign title and description</li>
                <li>Ticket price (in Bitcoin sats)</li>
                <li>End date and time</li>
                <li>Optional fundraising target</li>
                <li>Podcast information and episode details</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Fundraisers can be set to automatically select a winner when they end, or manually drawn by the creator.
              </p>
            </CardContent>
          </Card>

          {/* Step 2: Listeners Buy Tickets */}
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">Step 2</Badge>
                <CardTitle className="flex items-center">
                  <Ticket className="h-5 w-5 mr-2 text-blue-600" />
                  Listeners Buy Tickets & Donate
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>Podcast supporters can participate by:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                <li><strong>Buying Tickets:</strong> Purchase raffle tickets with Lightning payments</li>
                <li><strong>Donating to Prize Pool:</strong> Make direct donations to increase the prize pool</li>
                <li>Connecting their Lightning wallet (Alby, Mutiny, etc.)</li>
                <li>Paying instantly through the web interface</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                All ticket purchases and donations are recorded as Nostr events for complete transparency.
              </p>
            </CardContent>
          </Card>

          {/* Step 3: Winner Selection */}
          <Card className="border-l-4 border-l-teal-500">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Badge variant="secondary" className="bg-teal-100 text-teal-800">Step 3</Badge>
                <CardTitle className="flex items-center">
                  <Crown className="h-5 w-5 mr-2 text-teal-600" />
                  Winner Selection
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>When the fundraiser ends, a winner is selected:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                <li><strong>Automatic:</strong> System automatically selects winner when time expires</li>
                <li><strong>Manual:</strong> Podcaster manually draws winner at their convenience</li>
                <li>Cryptographically secure random number generation</li>
                <li>Winner selection is published as a Nostr event for verification</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                The winner is notified via encrypted Nostr direct message with instructions to claim their prize.
              </p>
            </CardContent>
          </Card>

          {/* Step 4: Prize Distribution */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Badge variant="secondary" className="bg-green-100 text-green-800">Step 4</Badge>
                <CardTitle className="flex items-center">
                  <Gift className="h-5 w-5 mr-2 text-green-600" />
                  Prize Claim & Payout
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>The prize distribution process:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                <li><strong>Winner Claims Prize:</strong> Winner returns to site and submits Lightning address or invoice</li>
                <li><strong>Creator Processes Payment:</strong> Podcaster sends 50% of total raised to winner</li>
                <li><strong>Creator Keeps 50%:</strong> Remaining funds support the podcast</li>
                <li>All payouts are confirmed and recorded for transparency</li>
              </ul>
              <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  💡 Example: If 100,000 sats are raised, winner gets 50,000 sats and podcaster gets 50,000 sats
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Technology Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-center mb-8">Built on Decentralized Technology</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Nostr Protocol</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Decentralized social protocol</li>
                  <li>All fundraiser data stored as events</li>
                  <li>Transparent and verifiable</li>
                  <li>Censorship resistant</li>
                  <li>No central authority required</li>
                </ul>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Bitcoin Lightning Network</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Instant Bitcoin payments</li>
                  <li>Low transaction fees</li>
                  <li>Global accessibility</li>
                  <li>No intermediaries</li>
                  <li>WebLN wallet integration</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-center mb-8">Why Choose PodRaffle?</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">For Podcasters</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Generate revenue to support your show</li>
                <li>• Engage your audience with fun fundraising</li>
                <li>• No platform fees or middlemen</li>
                <li>• Complete control over your campaigns</li>
                <li>• Transparent and verifiable process</li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">For Listeners</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Support your favorite podcasts</li>
                <li>• Chance to win Bitcoin prizes</li>
                <li>• Fair and transparent winner selection</li>
                <li>• Instant Lightning payments</li>
                <li>• Decentralized and censorship-resistant</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center mt-12 p-8 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-6">
            Join the decentralized fundraising revolution for podcasters
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              <Link to="/">Browse Fundraisers</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/demo">View Demo</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;