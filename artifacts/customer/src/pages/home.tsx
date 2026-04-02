import { useEffect, useState } from "wouter/preact"; // Oops, use React
import { Link } from "wouter";
import { Timer, ArrowRight, Utensils, Coffee, Pizza, Wine, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListFlashDeals, useListMarketplaceRestaurants } from "@workspace/api-client-react";
import { RestaurantCard } from "@/components/restaurant-card";
import { Skeleton } from "@/components/ui/skeleton";
import React from "react"; // To be safe

const CUISINES = [
  { name: "Italian", emoji: "🍝" },
  { name: "Japanese", emoji: "🍣" },
  { name: "Mexican", emoji: "🍕" },
  { name: "Indian", emoji: "🌮" },
  { name: "French", emoji: "🍷" },
  { name: "Thai", emoji: "🍜" },
];

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = React.useState<string>("");

  React.useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(expiresAt).getTime() - new Date().getTime();
      
      if (difference <= 0) {
        return "Expired";
      }

      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  return (
    <div className="flex items-center gap-1.5 font-mono font-bold bg-black/20 px-3 py-1 rounded-md backdrop-blur-md">
      <Timer className="w-4 h-4" />
      {timeLeft}
    </div>
  );
}

export default function Home() {
  const { data: flashDeals, isLoading: loadingDeals } = useListFlashDeals();
  const { data: featured, isLoading: loadingFeatured } = useListMarketplaceRestaurants({ featured: true });
  const { data: openNow, isLoading: loadingOpen } = useListMarketplaceRestaurants({ openNow: true });

  const activeDeal = flashDeals?.[0]; // Show first active deal in hero

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative px-4 pt-6 pb-12 md:py-20 overflow-hidden bg-primary/5">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=2874&auto=format&fit=crop')] opacity-[0.03] mix-blend-multiply pointer-events-none"></div>
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6 text-center md:text-left">
              <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight text-foreground leading-[1.1]">
                Find your next <span className="text-primary italic">favorite</span> table.
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto md:mx-0">
                Curated dining experiences in London. From hidden gems to Michelin stars.
              </p>
              
              <div className="pt-2 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <Button asChild size="lg" className="rounded-full px-8 h-14 text-base shadow-lg shadow-primary/25">
                  <Link href="/explore">
                    Explore Restaurants <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Flash Deal Hero Card */}
            <div className="relative mt-8 md:mt-0 max-w-md mx-auto w-full">
              {loadingDeals ? (
                <Skeleton className="w-full aspect-square rounded-2xl" />
              ) : activeDeal && activeDeal.restaurant ? (
                <div className="relative rounded-2xl overflow-hidden shadow-2xl group hover-elevate">
                  <div className="aspect-[4/5] bg-muted w-full relative">
                    {activeDeal.restaurant.heroImage && (
                      <img 
                        src={activeDeal.restaurant.heroImage} 
                        alt={activeDeal.restaurant.name} 
                        className="object-cover w-full h-full"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none"></div>
                    
                    {/* Deal Badge */}
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                      <div className="bg-destructive text-destructive-foreground font-bold px-4 py-2 rounded-xl shadow-lg transform -rotate-2 border-2 border-white/20 backdrop-blur-sm">
                        <div className="text-3xl leading-none">{activeDeal.percentage}%</div>
                        <div className="text-xs uppercase tracking-wider">OFF TODAY</div>
                      </div>
                      
                      {activeDeal.flashExpiresAt && (
                        <div className="text-white">
                          <CountdownTimer expiresAt={activeDeal.flashExpiresAt} />
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                      <div className="flex items-center gap-2 text-white/80 mb-2">
                        <span className="text-xl">{activeDeal.restaurant.cuisineEmoji}</span>
                        <span className="font-medium text-sm tracking-wide uppercase">{activeDeal.restaurant.cuisine}</span>
                      </div>
                      <h3 className="font-serif text-3xl font-bold mb-4">{activeDeal.restaurant.name}</h3>
                      <Button asChild variant="secondary" className="w-full rounded-full bg-white text-black hover:bg-gray-100 font-semibold shadow-xl">
                        <Link href={`/restaurant/${activeDeal.restaurant.id}`}>
                          Book this deal
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-card border rounded-2xl p-8 text-center shadow-lg h-full flex flex-col items-center justify-center aspect-square">
                  <Compass className="w-16 h-16 text-muted-foreground/30 mb-4" />
                  <h3 className="font-serif text-2xl font-bold mb-2">No active deals right now</h3>
                  <p className="text-muted-foreground mb-6">Check back later for exclusive flash discounts.</p>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href="/explore">Browse all restaurants</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 bg-background border-b">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="font-serif text-2xl font-bold mb-6">What are you craving?</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
            {CUISINES.map((cuisine) => (
              <Link 
                key={cuisine.name} 
                href={`/explore?cuisine=${cuisine.name}`}
                className="flex flex-col items-center gap-3 min-w-[100px] snap-center group"
              >
                <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center text-4xl transition-transform group-hover:scale-110 group-hover:bg-primary/10 group-hover:shadow-md">
                  {cuisine.emoji}
                </div>
                <span className="font-medium text-sm">{cuisine.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-serif text-3xl font-bold mb-2 text-foreground">Featured Picks</h2>
              <p className="text-muted-foreground">The most talked-about spots in town.</p>
            </div>
            <Link href="/explore?featured=true" className="hidden sm:flex items-center text-sm font-medium text-primary hover:underline">
              See all <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {loadingFeatured ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))
            ) : featured && featured.length > 0 ? (
              featured.slice(0, 3).map(restaurant => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} showFlashDeal />
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No featured restaurants found.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Open Now */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <h2 className="font-serif text-3xl font-bold text-foreground">Open Right Now</h2>
              </div>
              <p className="text-muted-foreground">Hungry now? These places are ready for you.</p>
            </div>
            <Link href="/explore?openNow=true" className="hidden sm:flex items-center text-sm font-medium text-primary hover:underline">
              See all <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loadingOpen ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))
            ) : openNow && openNow.length > 0 ? (
              openNow.slice(0, 4).map(restaurant => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No restaurants are currently open.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
