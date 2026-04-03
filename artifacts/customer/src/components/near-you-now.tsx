import { useMemo } from "react";
import { Link } from "wouter";
import { Navigation, Star, Clock, ArrowRight, Timer, Flame, MapPin, Armchair } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { rankHyperLocal, urgencyLabel, type ScoredRestaurant } from "@/lib/hyper-local";
import type { MarketplaceRestaurant, MarketplaceFlashDeal } from "@workspace/api-client-react";

interface NearYouNowProps {
  restaurants: MarketplaceRestaurant[];
  flashDeals: MarketplaceFlashDeal[];
  userLat: number;
  userLng: number;
  maxCount?: number;
  radiusKm?: number;
}

function UrgencyBadge({ sr }: { sr: ScoredRestaurant }) {
  const urgency = urgencyLabel(sr.flashMinutesLeft, sr.isWeakHour, sr.minutesUntilClose);
  if (!urgency) return null;

  const styles = {
    critical: "bg-red-500 text-white border-red-400 animate-pulse",
    high: "bg-orange-500 text-white border-orange-400",
    medium: "bg-primary text-primary-foreground border-primary/60",
    low: "bg-emerald-600/10 text-emerald-600 border-emerald-600/30",
  };

  const icons = {
    critical: <Flame className="w-3 h-3" />,
    high: <Timer className="w-3 h-3" />,
    medium: <Flame className="w-3 h-3" />,
    low: <Clock className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${styles[urgency.level]}`}>
      {icons[urgency.level]}
      {urgency.text}
    </span>
  );
}

function NearYouCard({ sr, rank }: { sr: ScoredRestaurant; rank: number }) {
  const { restaurant: r, distance, isWeakHour, flashDeal } = sr;
  const urgency = urgencyLabel(sr.flashMinutesLeft, sr.isWeakHour, sr.minutesUntilClose);
  const distanceText = distance < 1 ? `${Math.round(distance * 1000)}m away` : `${distance.toFixed(1)} km`;

  return (
    <Link href={`/restaurant/${r.id}`} className="group block h-full">
      <div className="relative h-full rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 bg-card border border-border group-hover:-translate-y-0.5 group-hover:border-primary/30">
        {/* Hero image */}
        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
          {r.heroImage ? (
            <img
              src={r.heroImage}
              alt={r.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl bg-muted/60">
              {r.cuisineEmoji}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Top badges row */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1.5">
              {/* Rank pill */}
              {rank <= 1 && (
                <span className="bg-amber-400 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                  <Flame className="w-2.5 h-2.5" /> Top Pick
                </span>
              )}
              {/* Flash deal */}
              {r.hasActiveFlash && r.flashPercentage && (
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border text-white backdrop-blur-sm ${
                  urgency?.level === "critical"
                    ? "bg-red-600/90 border-red-400/60 animate-pulse"
                    : "bg-destructive/90 border-white/20"
                }`}>
                  {r.flashPercentage}% OFF
                </span>
              )}
            </div>

            {/* Distance badge */}
            <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              <Navigation className="w-3 h-3" />
              {distanceText}
            </div>
          </div>

          {/* Open/closed status */}
          <div className="absolute bottom-3 left-3">
            {r.isOpenNow ? (
              <span className="flex items-center gap-1 bg-emerald-600/90 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Open Now
              </span>
            ) : (
              <span className="bg-black/60 backdrop-blur-sm text-white/80 text-[11px] px-2.5 py-1 rounded-full">
                Closed
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Name + rating */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-serif text-lg font-bold leading-tight truncate group-hover:text-primary transition-colors">
                {r.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm text-muted-foreground">{r.cuisineEmoji} {r.cuisine}</span>
                {r.priceRange && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-sm text-muted-foreground">{"€".repeat(r.priceRange)}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 bg-amber-50 border border-amber-200/60 text-amber-700 px-2 py-1 rounded-lg">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-bold text-sm">{r.rating?.toFixed(1)}</span>
            </div>
          </div>

          {/* Address */}
          {r.address && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              {r.address}{r.city ? `, ${r.city}` : ""}
            </p>
          )}

          {/* Urgency / weak hour indicator */}
          {(urgency || isWeakHour) && (
            <div>
              <UrgencyBadge sr={sr} />
            </div>
          )}

          {/* Flash deal detail */}
          {flashDeal && flashDeal.flashExpiresAt && sr.flashMinutesLeft !== null && sr.flashMinutesLeft <= 120 && (
            <p className="text-xs text-muted-foreground">
              <Timer className="w-3 h-3 inline mr-1" />
              Flash deal expires at{" "}
              {new Date(flashDeal.flashExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          {/* Availability chip */}
          {r.isOpenNow && r.availabilityStatus && r.availabilityStatus !== "closed" && (
            <div className="flex items-center gap-1.5 text-xs">
              {r.availabilityStatus === "available" && (
                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                  <Armchair className="w-3 h-3" />
                  Tables available now
                </span>
              )}
              {r.availabilityStatus === "limited" && (
                <span className="flex items-center gap-1 text-amber-600 font-semibold">
                  <Armchair className="w-3 h-3" />
                  Limited seats remaining
                </span>
              )}
              {r.availabilityStatus === "nearly_full" && (
                <span className="flex items-center gap-1 text-orange-500 font-semibold">
                  <Armchair className="w-3 h-3" />
                  Almost fully booked
                </span>
              )}
              {r.availabilityStatus === "full" && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Armchair className="w-3 h-3" />
                  {r.nextAvailableSlot ? `Next slot: ${r.nextAvailableSlot}` : "Fully booked"}
                </span>
              )}
            </div>
          )}

          {/* Book Now CTA */}
          <Button
            size="sm"
            className={`w-full rounded-full font-semibold shadow-sm ${r.availabilityStatus === "available" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
            asChild
          >
            <Link href={`/restaurant/${r.id}`}>
              {r.availabilityStatus === "available" ? "Book Now — Tables Ready" : "View & Book"}
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      </div>
    </Link>
  );
}

export function NearYouNow({
  restaurants,
  flashDeals,
  userLat,
  userLng,
  maxCount = 4,
  radiusKm = 10,
}: NearYouNowProps) {
  const ranked = useMemo(
    () => rankHyperLocal(restaurants, userLat, userLng, flashDeals, radiusKm).slice(0, maxCount),
    [restaurants, flashDeals, userLat, userLng, maxCount, radiusKm]
  );

  if (ranked.length === 0) return null;

  const hasUrgentDeal = ranked.some(
    (sr) => sr.flashMinutesLeft !== null && sr.flashMinutesLeft <= 120
  );
  const closestKm = ranked[0]?.distance ?? 0;

  return (
    <section className="py-16 relative overflow-hidden">
      {/* Subtle warm background */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-50/60 via-orange-50/30 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                  <Navigation className="w-4 h-4 text-primary" />
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Near You Now
              </h2>
              {hasUrgentDeal && (
                <Badge className="bg-red-500 text-white text-xs font-bold animate-pulse border-0">
                  <Flame className="w-3 h-3 mr-1" /> Deals expiring
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-base">
              {ranked.length} restaurant{ranked.length !== 1 ? "s" : ""} within{" "}
              {closestKm < 1
                ? `${Math.round(closestKm * 1000)}m`
                : `${closestKm.toFixed(1)}km`}{" "}
              · ranked by relevance, deals, and distance.
            </p>
          </div>

          <Link
            href="/explore"
            className="flex items-center text-sm font-medium text-primary hover:underline whitespace-nowrap"
          >
            View all on map <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        {/* Restaurant grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ranked.map((sr, i) => (
            <NearYouCard key={sr.restaurant.id} sr={sr} rank={i} />
          ))}
        </div>

        {/* Foot note when there are weak hours */}
        {ranked.some((sr) => sr.isWeakHour) && (
          <p className="text-xs text-center text-muted-foreground mt-6">
            <Clock className="w-3 h-3 inline mr-1" />
            Some restaurants are in quieter hours — great time to get the best tables.
          </p>
        )}
      </div>
    </section>
  );
}
