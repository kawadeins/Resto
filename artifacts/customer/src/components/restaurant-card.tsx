import { Link } from "wouter";
import { Star, Clock, MapPin, Navigation, Zap, Coffee, Wine, UtensilsCrossed, ArrowRight } from "lucide-react";
import { MarketplaceRestaurant } from "@workspace/api-client-react";
import { useMemo } from "react";
import { scoreLiveActivity } from "@/lib/live-activity";
import { LiveBadge } from "@/components/live-badge";
import { SocialCueChip } from "@/components/social-cue-chip";
import { useLifestyleMode } from "@/hooks/use-lifestyle-mode";

interface RestaurantCardProps {
  restaurant: MarketplaceRestaurant;
  showFlashDeal?: boolean;
  distance?: number;
  isSponsored?: boolean;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

type BizType = "restaurant" | "cafe" | "bar" | string;

const TYPE_CONFIG: Record<string, {
  label: string;
  icon: typeof Coffee;
  badgeCls: string;
  borderAvail: string;
  borderDefault: string;
}> = {
  restaurant: {
    label: "Restaurant",
    icon: UtensilsCrossed,
    badgeCls: "text-primary/80 bg-primary/8 border-primary/20",
    borderAvail: "border-emerald-200 shadow-lg shadow-emerald-100",
    borderDefault: "border-border shadow-md shadow-black/5",
  },
  cafe: {
    label: "Café",
    icon: Coffee,
    badgeCls: "text-amber-700 bg-amber-50 border-amber-200",
    borderAvail: "border-amber-200 shadow-lg shadow-amber-100",
    borderDefault: "border-amber-100/60 shadow-md shadow-black/5",
  },
  bar: {
    label: "Bar",
    icon: Wine,
    badgeCls: "text-rose-700 bg-rose-50 border-rose-200",
    borderAvail: "border-rose-200 shadow-lg shadow-rose-100",
    borderDefault: "border-rose-100/60 shadow-md shadow-black/5",
  },
};

function getTypeConfig(businessType?: BizType) {
  return TYPE_CONFIG[businessType ?? "restaurant"] ?? TYPE_CONFIG.restaurant;
}

const CUISINE_DE: Record<string, string> = {
  Austrian:      "Österreichisch",
  Burgers:       "Burger",
  French:        "Französisch",
  Indian:        "Indisch",
  International: "International",
  Italian:       "Italienisch",
  Japanese:      "Japanisch",
  Vegetarian:    "Vegetarisch",
  Cocktails:     "Cocktails",
  "Café":        "Café",
};

const BOOST_LABELS: Record<string, string> = {
  breakfast_boost:  "Frühstücks-Boost",
  lunch_boost:      "Mittags-Boost",
  happy_hour_boost: "Happy-Hour-Boost",
  nightlife_boost:  "Nightlife-Boost",
  local_spotlight:  "Local Spotlight",
  local_heat_boost: "Heat Boost",
};

function AvailabilityChip({ restaurant }: { restaurant: MarketplaceRestaurant }) {
  const status = (restaurant as any).availabilityStatus;
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

export function RestaurantCard({ restaurant, showFlashDeal = false, distance, isSponsored = false }: RestaurantCardProps) {
  const priceString = "€".repeat(restaurant.priceRange || 2);
  const isAvailable = restaurant.isOpenNow && (restaurant as any).availabilityStatus === "available";
  const hasFlash = showFlashDeal && restaurant.hasActiveFlash;
  const biz: BizType = (restaurant as any).businessType ?? "restaurant";
  const typeCfg = getTypeConfig(biz);
  const TypeIcon = typeCfg.icon;

  // Live activity score
  const { mode } = useLifestyleMode();
  const live = useMemo(() => scoreLiveActivity(restaurant, mode), [restaurant, mode]);
  // Only show meaningful live signals — "Aktiv" (active intensity) is redundant with the "Geöffnet" badge
  const showLiveBadge = live.primaryBadge &&
    live.intensity !== "quiet" &&
    live.intensity !== "active";

  return (
    <Link href={`/restaurant/${restaurant.id}`} className="block group press-scale">
      <div className={`relative overflow-hidden rounded-3xl bg-card border transition-all duration-300
        ${isAvailable ? typeCfg.borderAvail : typeCfg.borderDefault}
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
            <div className={`w-full h-full flex items-center justify-center text-5xl ${
              biz === "cafe"
                ? "bg-gradient-to-br from-amber-100 to-orange-100"
                : biz === "bar"
                ? "bg-gradient-to-br from-rose-100 to-purple-100"
                : "bg-gradient-to-br from-primary/20 to-accent/20"
            }`}>
              {restaurant.cuisineEmoji || (biz === "cafe" ? "☕" : biz === "bar" ? "🍸" : "🍽️")}
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

          {/* Rating — bottom right */}
          <div className="absolute bottom-3 right-3">
            <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-full shadow-lg">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-bold text-sm text-foreground">{restaurant.rating.toFixed(1)}</span>
            </div>
          </div>

          {/* Distance — bottom left */}
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

          {/* Type + cuisine + availability + sponsored */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${typeCfg.badgeCls}`}>
              <TypeIcon className="w-3 h-3" />
              {typeCfg.label}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-secondary text-secondary-foreground text-xs font-semibold px-3 py-1 rounded-full">
              <span className="text-sm leading-none">{restaurant.cuisineEmoji}</span>
              {CUISINE_DE[restaurant.cuisine] ?? restaurant.cuisine}
            </span>
            <AvailabilityChip restaurant={restaurant} />
            {isSponsored && (
              <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                Gesponsert
              </span>
            )}
          </div>

          {/* Live badge + social cue — only render row when there's a meaningful signal */}
          <div className="flex items-center gap-2 flex-wrap min-h-0">
            {showLiveBadge && live.primaryBadge && (
              <LiveBadge badge={live.primaryBadge} />
            )}
            <SocialCueChip restaurantId={restaurant.id} variant="card" />
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

          {/* Tags — show 1 primary tag only to reduce visual noise */}
          {restaurant.tags && restaurant.tags.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                  {restaurant.tags[0]}
                </span>
                {restaurant.tags.length > 1 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground/60">
                    +{restaurant.tags.length - 1}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold text-primary/70 flex items-center gap-0.5 shrink-0">
                Ansehen <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
