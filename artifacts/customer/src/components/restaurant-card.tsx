import { Link } from "wouter";
import { Star, Clock, MapPin, TrendingDown, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MarketplaceRestaurant } from "@workspace/api-client-react";

interface RestaurantCardProps {
  restaurant: MarketplaceRestaurant;
  showFlashDeal?: boolean;
  distance?: number; // km — computed from Haversine
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function RestaurantCard({ restaurant, showFlashDeal = false, distance }: RestaurantCardProps) {
  const priceString = "€".repeat(restaurant.priceRange || 2);
  
  return (
    <Link href={`/restaurant/${restaurant.id}`} className="block group">
      <div className="relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:-translate-y-1 duration-300">
        {/* Image Aspect */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {restaurant.heroImage ? (
            <img 
              src={restaurant.heroImage} 
              alt={restaurant.name} 
              className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary text-secondary-foreground font-serif text-3xl">
              {restaurant.name.charAt(0)}
            </div>
          )}
          
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {restaurant.isOpenNow ? (
              <Badge variant="secondary" className="bg-green-500/90 text-white hover:bg-green-600 border-none backdrop-blur-sm shadow-sm">
                Open
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-zinc-800/80 text-white hover:bg-zinc-900 border-none backdrop-blur-sm shadow-sm">
                Closed
              </Badge>
            )}
            
            {showFlashDeal && restaurant.hasActiveFlash && (
              <Badge variant="destructive" className="bg-destructive/90 hover:bg-destructive border-none backdrop-blur-sm shadow-sm flex items-center gap-1 font-bold">
                <TrendingDown className="w-3 h-3" />
                {restaurant.flashPercentage}% OFF
              </Badge>
            )}
          </div>
          
          <div className="absolute bottom-3 right-3">
             <Badge variant="secondary" className="bg-white/90 text-black hover:bg-white border-none backdrop-blur-sm shadow-sm flex items-center gap-1 font-medium">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                {restaurant.rating.toFixed(1)}
              </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-serif font-bold text-lg leading-tight line-clamp-1 group-hover:text-primary transition-colors">
              {restaurant.name}
            </h3>
          </div>
          
          <div className="flex items-center text-sm text-muted-foreground mb-3 gap-2">
            <span className="flex items-center gap-1">
              <span className="text-base leading-none">{restaurant.cuisineEmoji}</span>
              {restaurant.cuisine}
            </span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/30"></span>
            <span className="font-medium">{priceString}</span>
          </div>

          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="line-clamp-1 flex-1">{restaurant.address}, {restaurant.city}</span>
              {distance !== undefined && (
                <span className="shrink-0 flex items-center gap-0.5 text-primary font-semibold">
                  <Navigation className="w-3 h-3" />
                  {formatDistance(distance)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{restaurant.openTime} - {restaurant.closeTime}</span>
            </div>
          </div>
          
          {restaurant.tags && restaurant.tags.length > 0 && (
            <div className="mt-3 flex gap-1.5 overflow-hidden">
              {restaurant.tags.slice(0, 2).map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-medium text-secondary-foreground whitespace-nowrap">
                  {tag}
                </span>
              ))}
              {restaurant.tags.length > 2 && (
                <span className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-medium text-secondary-foreground">
                  +{restaurant.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
