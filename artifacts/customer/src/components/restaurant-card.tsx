import { Link } from "wouter";
import { Star, Clock, MapPin, TrendingDown, Navigation, Armchair, Zap, ShieldCheck } from "lucide-react";
import { MarketplaceRestaurant } from "@workspace/api-client-react";

interface RestaurantCardProps {
  restaurant: MarketplaceRestaurant;
  showFlashDeal?: boolean;
  distance?: number;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function AvailabilityChip({ restaurant }: { restaurant: MarketplaceRestaurant }) {
  const status = restaurant.availabilityStatus;
  if (!restaurant.isOpenNow || !status || status === "closed") return null;

  const config: Record<string, { label: string; dot: string; cls: string }> = {
    available:   { label: "Tische frei",         dot: "bg-emerald-500", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    limited:     { label: "Wenige Plätze",        dot: "bg-amber-400",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
    nearly_full: { label: "Fast ausgebucht",      dot: "bg-orange-500",  cls: "bg-orange-50 text-orange-700 border-orange-200" },
    full:        { label: "Ausgebucht",           dot: "bg-red-400",     cls: "bg-red-50 text-red-600 border-red-200" },
    paused:      { label: "Keine Buchungen",      dot: "bg-gray-400",    cls: "bg-gray-50 text-gray-500 border-gray-200" },
  };

  const c = config[status];
  if (!c) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export function RestaurantCard({ restaurant, showFlashDeal = false, distance }: RestaurantCardProps) {
  const priceString = "€".repeat(restaurant.priceRange || 2);
  const isAvailable = restaurant.isOpenNow && restaurant.availabilityStatus === "available";
  const hasFlash = showFlashDeal && restaurant.hasActiveFlash;

  return (
    <Link href={`/restaurant/${restaurant.id}`} className="block group press-scale">
      <div className={`relative overflow-hidden rounded-3xl bg-card border transition-all duration-300
        ${isAvailable ? "border-emerald-200 shadow-lg shadow-emerald-100" : "border-border shadow-md shadow-black/5"}
        group-hover:shadow-xl group-hover:-translate-y-1`}
      >
        {/* Image */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {restaurant.heroImage ? (
            <img
              src={restaurant.heroImage}
              alt={restaurant.name}
              className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20 text-5xl">
              {restaurant.cuisineEmoji || "🍽️"}
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Top-left badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {restaurant.isOpenNow ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Geöffnet
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white/80 text-[11px] font-semibold px-3 py-1.5 rounded-full">
                Geschlossen
              </span>
            )}
            {hasFlash && (
              <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-accent to-rose-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-md shadow-rose-200 animate-pulse">
                <Zap className="w-3 h-3" />
                {restaurant.flashPercentage}% RABATT
              </span>
            )}
          </div>

          {/* Rating bubble — bottom right */}
          <div className="absolute bottom-3 right-3">
            <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-full shadow-lg">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-bold text-sm text-foreground">{restaurant.rating.toFixed(1)}</span>
            </div>
          </div>

          {/* Distance bubble — bottom left */}
          {distance !== undefined && (
            <div className="absolute bottom-3 left-3">
              <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2.5 py-1.5 rounded-full shadow-md text-xs font-semibold text-primary">
                <Navigation className="w-3 h-3" />
                {formatDistance(distance)}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Name + price */}
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-bold text-base leading-tight line-clamp-1 text-foreground group-hover:text-primary transition-colors">
              {restaurant.name}
            </h3>
            <span className="shrink-0 text-sm font-semibold text-muted-foreground">{priceString}</span>
          </div>

          {/* Cuisine chip + verified badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 bg-secondary text-secondary-foreground text-xs font-semibold px-3 py-1 rounded-full">
              <span className="text-sm leading-none">{restaurant.cuisineEmoji}</span>
              {restaurant.cuisine}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary/80 bg-primary/8 border border-primary/20 px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3" />
              Verifiziert
            </span>
            <AvailabilityChip restaurant={restaurant} />
          </div>

          {/* Meta info */}
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-primary/60" />
              <span className="line-clamp-1">{restaurant.address}, {restaurant.city}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 shrink-0 text-primary/60" />
              <span>{restaurant.openTime} – {restaurant.closeTime}</span>
            </div>
          </div>

          {/* Tags */}
          {restaurant.tags && restaurant.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {restaurant.tags.slice(0, 2).map(tag => (
                <span key={tag} className="px-2.5 py-0.5 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                  {tag}
                </span>
              ))}
              {restaurant.tags.length > 2 && (
                <span className="px-2.5 py-0.5 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
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
