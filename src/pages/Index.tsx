import { useState } from "react";
import { Plus, Trophy, Zap, Users, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginArea } from "@/components/auth/LoginArea";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCampaigns } from "@/hooks/useCampaigns";
import { CampaignCard } from "@/components/CampaignCard";
import { CreateCampaignDialog } from "@/components/CreateCampaignDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { RelaySelector } from "@/components/RelaySelector";

const Index = () => {
  const { user } = useCurrentUser();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { data: campaigns, isLoading } = useCampaigns();

  const activeCampaigns = campaigns?.filter(c => c.isActive) || [];
  const endedCampaigns = campaigns?.filter(c => !c.isActive) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-2 rounded-lg">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  PodRaffle
                </h1>
                <p className="text-sm text-muted-foreground">50/50 Fundraisers for Podcasters</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="outline" asChild>
                <Link to="/demo">View Demo</Link>
              </Button>
              <RelaySelector />
              <LoginArea className="max-w-60" />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 bg-clip-text text-transparent">
            Support Your Favorite Podcasters
          </h2>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Join 50/50 raffles to support podcast creators. Buy tickets for a chance to win half the pot 
            while helping podcasters fund their shows. Built on Nostr with Lightning payments.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="border-purple-200 dark:border-purple-800">
              <CardHeader className="text-center">
                <Zap className="h-12 w-12 mx-auto text-purple-600 mb-2" />
                <CardTitle className="text-lg">Lightning Fast</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Instant payments with Bitcoin Lightning Network
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="text-center">
                <Users className="h-12 w-12 mx-auto text-blue-600 mb-2" />
                <CardTitle className="text-lg">Fair & Transparent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Verifiable random winner selection on Nostr
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-teal-200 dark:border-teal-800">
              <CardHeader className="text-center">
                <DollarSign className="h-12 w-12 mx-auto text-teal-600 mb-2" />
                <CardTitle className="text-lg">50/50 Split</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Half to the winner, half to support the podcast
                </p>
              </CardContent>
            </Card>
          </div>

          {user && (
            <Button 
              onClick={() => setShowCreateDialog(true)}
              size="lg" 
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Fundraiser
            </Button>
          )}
        </div>
      </section>

      {/* Campaigns Section */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8">
              <TabsTrigger value="active">
                Active Campaigns
                {activeCampaigns.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeCampaigns.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="ended">
                Completed
                {endedCampaigns.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {endedCampaigns.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-6">
              {isLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-4 w-1/4" />
                        </div>
                        <Skeleton className="h-10 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : activeCampaigns.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeCampaigns.map((campaign) => (
                    <CampaignCard key={campaign.id} campaign={campaign} />
                  ))}
                </div>
              ) : (
                <div className="col-span-full">
                  <Card className="border-dashed">
                    <CardContent className="py-12 px-8 text-center">
                      <div className="max-w-sm mx-auto space-y-6">
                        <Trophy className="h-16 w-16 mx-auto text-muted-foreground" />
                        <div>
                          <h3 className="text-lg font-semibold mb-2">No Active Campaigns</h3>
                          <p className="text-muted-foreground">
                            No fundraisers are currently running. Try switching relays to discover more campaigns.
                          </p>
                        </div>
                        <RelaySelector className="w-full" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ended" className="space-y-6">
              {isLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-4 w-1/4" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : endedCampaigns.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {endedCampaigns.map((campaign) => (
                    <CampaignCard key={campaign.id} campaign={campaign} />
                  ))}
                </div>
              ) : (
                <div className="col-span-full">
                  <Card className="border-dashed">
                    <CardContent className="py-12 px-8 text-center">
                      <div className="max-w-sm mx-auto space-y-6">
                        <Trophy className="h-16 w-16 mx-auto text-muted-foreground" />
                        <div>
                          <h3 className="text-lg font-semibold mb-2">No Completed Campaigns</h3>
                          <p className="text-muted-foreground">
                            No fundraisers have been completed yet. Try another relay?
                          </p>
                        </div>
                        <RelaySelector className="w-full" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />

      {/* Footer */}
      <footer className="border-t bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-1.5 rounded">
                  <Trophy className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold">PodRaffle</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Decentralized 50/50 fundraisers for podcasters. Built on Nostr with Lightning payments.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">How It Works</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Podcasters create fundraiser campaigns</li>
                <li>• Listeners buy raffle tickets with Lightning</li>
                <li>• 50% goes to winner, 50% to creator</li>
                <li>• All transactions verified on Nostr</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Technology</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Nostr Protocol</li>
                <li>• Lightning Network</li>
                <li>• React & TypeScript</li>
                <li>• Open Source</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-8 pt-6 text-center text-sm text-muted-foreground">
            <p>Built with ❤️ for the decentralized web. Support your favorite podcasters!</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
