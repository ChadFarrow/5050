import { useState } from "react";
import { ArrowLeft, Trophy, Zap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";

// Mock data for demo
const mockCampaigns = [
  {
    id: "1",
    title: "Tech Talk Weekly Fundraiser",
    podcast: "Tech Talk Weekly",
    creator: "Alice Johnson",
    description: "Help us upgrade our recording equipment and keep bringing you the latest tech news!",
    target: 500000, // 500 sats
    ticketPrice: 10000, // 10 sats
    currentAmount: 350000, // 350 sats
    ticketsSold: 35,
    participants: 12,
    timeLeft: "2 days",
    image: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=200&fit=crop",
    isActive: true,
  },
  {
    id: "2", 
    title: "Indie Music Spotlight",
    podcast: "Underground Beats",
    creator: "Mike Chen",
    description: "Support independent artists and help us discover the next big thing in music!",
    target: 1000000, // 1000 sats
    ticketPrice: 25000, // 25 sats
    currentAmount: 750000, // 750 sats
    ticketsSold: 30,
    participants: 18,
    timeLeft: "5 hours",
    image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=200&fit=crop",
    isActive: true,
  },
  {
    id: "3",
    title: "Comedy Hour Special",
    podcast: "Laugh Track",
    creator: "Sarah Williams",
    description: "Help us book better guests and maybe get some decent coffee for the studio!",
    target: 300000, // 300 sats
    ticketPrice: 5000, // 5 sats
    currentAmount: 300000, // 300 sats (completed)
    ticketsSold: 60,
    participants: 25,
    timeLeft: "Ended",
    winner: "Bob Smith",
    winnerAmount: 150000, // 150 sats
    image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&h=200&fit=crop",
    isActive: false,
  },
];

export default function Demo() {
  const [selectedCampaign, setSelectedCampaign] = useState(mockCampaigns[0]);

  const formatSats = (millisats: number) => {
    const sats = Math.floor(millisats / 1000);
    return `${sats.toLocaleString()} sats`;
  };

  const getProgressPercent = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Button variant="ghost" asChild size="sm">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back to App</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </Button>
            
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-1.5 sm:p-2 rounded-lg flex-shrink-0">
                <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent truncate">
                  PodRaffle Demo
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Interactive Preview</p>
              </div>
            </div>
            
            <div className="w-6 sm:w-24" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Demo Introduction */}
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent leading-tight">
              See PodRaffle in Action
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto px-4">
              Explore how podcasters and listeners interact with 50/50 fundraisers. 
              Click on different campaigns to see how the platform works.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Campaign List */}
            <div className="lg:col-span-2">
              <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Active & Completed Campaigns</h3>
              <div className="space-y-4 sm:space-y-6">
                {mockCampaigns.map((campaign) => (
                  <Card 
                    key={campaign.id}
                    className={`cursor-pointer transition-all duration-200 ${
                      selectedCampaign.id === campaign.id 
                        ? 'ring-2 ring-purple-500 shadow-lg' 
                        : 'hover:shadow-md hover:border-purple-200'
                    }`}
                    onClick={() => setSelectedCampaign(campaign)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                          <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${campaign.creator}`} />
                            <AvatarFallback>{campaign.creator[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-base sm:text-lg leading-tight">{campaign.title}</CardTitle>
                            <CardDescription className="text-sm truncate">{campaign.podcast} • by {campaign.creator}</CardDescription>
                          </div>
                        </div>
                        <Badge variant={campaign.isActive ? "default" : "secondary"} className="flex-shrink-0">
                          {campaign.isActive ? "Active" : "Ended"}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      {campaign.image && (
                        <div className="aspect-video rounded-lg overflow-hidden mb-4">
                          <img 
                            src={campaign.image} 
                            alt={campaign.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      <p className="text-sm text-muted-foreground mb-4">{campaign.description}</p>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{formatSats(campaign.currentAmount)} / {formatSats(campaign.target)}</span>
                        </div>
                        <Progress value={getProgressPercent(campaign.currentAmount, campaign.target)} />
                        
                        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs sm:text-sm">Tickets</p>
                            <p className="font-semibold">{campaign.ticketsSold}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs sm:text-sm">Participants</p>
                            <p className="font-semibold">{campaign.participants}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs sm:text-sm">Time Left</p>
                            <p className="font-semibold text-xs sm:text-sm">{campaign.timeLeft}</p>
                          </div>
                        </div>
                        
                        {!campaign.isActive && campaign.winner && (
                          <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                            <p className="text-sm font-medium text-green-800 dark:text-green-200">
                              🎉 Winner: {campaign.winner} won {formatSats(campaign.winnerAmount)}!
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Selected Campaign Details */}
            <div className="space-y-4 sm:space-y-6">
              <Card className="lg:sticky lg:top-8">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Trophy className="h-5 w-5 mr-2" />
                    Campaign Details
                  </CardTitle>
                  <CardDescription>
                    {selectedCampaign.title}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Potential Prize</span>
                      <span className="font-semibold text-green-600">
                        {formatSats(Math.floor(selectedCampaign.currentAmount / 2))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Creator Share</span>
                      <span className="font-semibold">
                        {formatSats(selectedCampaign.currentAmount - Math.floor(selectedCampaign.currentAmount / 2))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Ticket Price</span>
                      <span className="font-semibold">{formatSats(selectedCampaign.ticketPrice)}</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">How It Works</h4>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-start space-x-2">
                        <Zap className="h-3 w-3 mt-0.5 text-yellow-500" />
                        <span>Buy tickets with Lightning payments</span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Users className="h-3 w-3 mt-0.5 text-blue-500" />
                        <span>More tickets = higher win chance</span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Trophy className="h-3 w-3 mt-0.5 text-purple-500" />
                        <span>Winner gets 50%, creator gets 50%</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {selectedCampaign.isActive ? (
                    <div className="space-y-2">
                      <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600" disabled>
                        Buy Tickets (Demo Mode)
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Connect to the live app to participate
                      </p>
                    </div>
                  ) : (
                    <div className="bg-muted p-3 rounded-lg text-center">
                      <p className="text-sm font-medium">Campaign Ended</p>
                      <p className="text-xs text-muted-foreground">
                        Winner selected randomly
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Demo Features */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Demo Features</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Real-time campaign updates</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Lightning payment integration</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>Transparent winner selection</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span>Nostr protocol integration</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-8 sm:mt-16 p-6 sm:p-8 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900 dark:to-blue-900 rounded-2xl">
            <h3 className="text-xl sm:text-2xl font-bold mb-4">Ready to Get Started?</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-2xl mx-auto">
              Join the decentralized future of podcast fundraising. Create campaigns, buy tickets, 
              and support your favorite creators while having a chance to win big!
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              <Button asChild size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 w-full sm:w-auto">
                <Link to="/">
                  Launch PodRaffle
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="w-full sm:w-auto">
                <a href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer">
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}