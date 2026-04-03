import { useMemo } from "react";
import { Link } from "wouter";
import { Navigation, Star, ArrowRight, Timer, Flame, MapPin, Armchair, Zap } from "lucide-react";
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

  const styles: Record<string, string> = {
    critical: "bg-red-500 text-white animate-pulse",
    high: "bg-orange-500 text-white",
    medium: "bg-gradient-to-r from-primary to-accent text-white",
    low: "bg-emerald-100 text-emerald-700",
  };
  const icons: Record<string, React.ReactNode> = {
    critical: <Flame className="w-3 h-3" />,
    high: <Timer className="w-3 h-3" />,
    medium: <Zap className="w-3 h-3" />,
    low: <Armchair className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${styles[urgency.level]}`}>
      {icons[urgency.level]}
      {urgency.text}
    </span>
  );
}

function NearYouCard({ sr, rank }: { sr: ScoredRestaurant; rank: number }) {
  const { restaurant: r, distance, isWeakHour, flashDeal } = sr;
  const urgency = urgencyLabel(sr.flashMinutesLeft, sr.isWeakHour, sr.minutesUntilClose);
  const distanceText = distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)} km`;

  return (
    <Link href={`/restaurant/${r.id}`} className="block group press-scale h-full">
      <div className="relative h-full rounded-3xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 bg-card border border-border group-hover:-translate-y-1">
        {/* Hero image */}
        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
          {r.heroImage ? (
            <img
              src={r.heroImage}
              alt={r.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-primary/10 to-accent/10">
              {r.cuisineEmoji}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* Top badges */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1.5">
              {rank <= 0 && (
                <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                  <Flame className="w-2.5 h-2.5" /> Top Pick
                </span>
              )}
              {r.hasActiveFlash && r.flashPercentage && (
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full text-white bg-gradient-to-r from-accent to-rose-500 shadow-md">
                  {r.flashPercentage}% RABATT
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
              <Navigation className="w-3 h-3" />
              {distanceText}
            </div>
          </div>

          {/* Open / closed */}
          <div className="absolute bottom-2.5 left-2.5">
            {r.isOpenNow ? (
              <span className="flex items-center gap-1.5 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Geöffnet
              </span>
            ) : (
              <span className="bg-black/60 backdrop-blur-sm text-white/70 text-[10px] font-semibold px-2.5 py-1 rounded-full">
                Geschlossen
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-sm leading-tight truncate group-hover:text-primary transition-colors">
                {r.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                <span>{r.cuisineEmoji} {r.cuisine}</span>
                {r.priceRange && <><span className="opacity-40">·</span><span>{"€".repeat(r.priceRange)}</span></>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 bg-amber-50 border border-amber-200/60 px-2 py-1 rounded-xl">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-bold text-xs text-amber-800">{r.rating?.toFixed(1)}</span>
            </div>
          </div>

          {r.address && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0 text-primary/50" />
              {r.address}{r.city ? `, ${r.city}` : ""}
            </p>
          )}

          {(urgency || isWeakHour) && <UrgencyBadge sr={sr} />}

          {flashDeal && flashDeal.flashExpiresAt && sr.flashMinutesLeft !== null && sr.flashMinutesLeft <= 120 && (
            <p className="text-[11px] text-muted-foreground">
              <Timer className="w-3 h-3 inline mr-1" />
              Angebot bis {new Date(flashDeal.flashExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          {r.isOpenNow && r.availabilityStatus && r.availabilityStatus !== "closed" && (
            <div className="text-[11px]">
              {r.availabilityStatus === "available" && (
                <span className="flex items-center gap-1 text-emerald-700 font-bold">
                  <Armchair className="w-3 h-3" /> Tische verfügbar
                </span>
              )}
              {r.availabilityStatus === "limited" && (
                <span className="flex items-center gap-1 text-amber-700 font-bold">
                  <Armchair className="w-3 h-3" /> Wenige Plätze
                </span>
              )}
              {r.availabilityStatus === "nearly_full" && (
                <span className="flex items-center gap-1 text-orange-600 font-bold">
                  <Armchair className="w-3 h-3" /> Fast ausgebucht
                </span>
              )}
              {r.availabilityStatus === "full" && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Armchair className="w-3 h-3" />
                  {r.nextAvailableSlot ? `Nächster Slot: ${r.nextAvailableSlot}` : "Ausgebucht"}
                </span>
              )}
            </div>
          )}

          <button className={`w-full py-2.5 rounded-2xl text-xs font-bold text-white transition-opacity hover:opacity-90 ${r.availabilityStatus === "available" ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-primary to-accent"}`}>
            {r.availabilityStatus === "available" ? "Jetzt buchen — Tische frei" : "Ansehen & Buchen"}
          </button>
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

  const hasUrgentDeal = ranked.some(sr => sr.flashMinutesLeft !== null && sr.flashMinutesLeft <= 120);
  const closestKm = ranked[0]?.distance ?? 0;

  return (
    <section className="py-10 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-primary/3 to-transparent pointer-events-none" />

      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="relative">
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/30">
                  <Navigation className="w-4 h-4 text-white" />
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">In Ihrer Nähe</h2>
              {hasUrgentDeal && (
                <span className="flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full animate-pulse">
                  <Flame className="w-2.5 h-2.5" /> Deals laufen ab
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {ranked.length} Restaurant{ranked.length !== 1 ? "s" : ""} ·{" "}
              {closestKm < 1 ? `${Math.round(closestKm * 1000)}m` : `${closestKm.toFixed(1)}km`} entfernt
            </p>
          </div>

          <Link href="/explore" className="press-scale text-sm font-bold text-primary bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
            Karte anzeigen <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ranked.map((sr, i) => (
            <NearYouCard key={sr.restaurant.id} sr={sr} rank={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
