/**
 * SmartOffersSection — "For You" homepage section
 *
 * Displays personalized offers ranked by the smart-offers engine.
 * Each card shows WHY it was surfaced through context chips.
 */
import { useMemo } from "react";
import { Link } from "wouter";
import { Star, ArrowRight, Sparkles, MapPin, Navigation, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { rankSmartOffers, getPersonalizationLevel, type SmartOffer, type UserContext } from "@/lib/smart-offers";
import type { MarketplaceRestaurant, MarketplaceFlashDeal } from "@workspace/api-client-react";
import type { LifestyleMode } from "@/hooks/use-lifestyle-mode";

// ─── Smart offer card ─────────────────────────────────────────────────────────

function SmartOfferCard({ offer, rank }: { offer: SmartOffer; rank: number }) {
  const { restaurant: r, reasons, primaryReason, distance, flashDeal } = offer;
  const distText = distance !== undefined
    ? (distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`)
    : null;
  const bizType = (r as any).businessType ?? "restaurant";

  const bizBg =
    bizType === "cafe" ? "bg-amber-50 border-amber-100/60" :
    bizType === "bar"  ? "bg-rose-50 border-rose-100/60"   :
    "bg-card border-border";

  return (
    <Link href={`/restaurant/${r.id}`} className="block group press-scale shrink-0 w-72 md:w-80">
      <div className={`relative h-full rounded-3xl overflow-hidden border shadow-md hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1 ${bizBg}`}>

        {/* Image */}
        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
          {r.heroImage ? (
            <img
              src={r.heroImage}
              alt={r.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-5xl ${
              bizType === "cafe" ? "bg-gradient-to-br from-amber-100 to-orange-100"
              : bizType === "bar" ? "bg-gradient-to-br from-rose-100 to-purple-100"
              : "bg-gradient-to-br from-primary/15 to-accent/15"
            }`}>
              {r.cuisineEmoji || (bizType === "cafe" ? "☕" : bizType === "bar" ? "🍸" : "🍽️")}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Rank badge */}
          {rank === 0 && (
            <div className="absolute top-3 left-3 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-md">
              ✦ Beste Wahl
            </div>
          )}

          {/* Flash deal badge */}
          {r.hasActiveFlash && r.flashPercentage && (
            <div className="absolute top-3 right-3 bg-gradient-to-r from-accent to-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
              ⚡ {r.flashPercentage}%
            </div>
          )}

          {/* Open indicator */}
          <div className="absolute bottom-3 left-3">
            {r.isOpenNow ? (
              <span className="flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Geöffnet
              </span>
            ) : (
              <span className="bg-black/60 backdrop-blur-sm text-white/70 text-[10px] font-semibold px-2.5 py-1 rounded-full">
                Geschlossen
              </span>
            )}
          </div>

          {/* Distance pill */}
          {distText && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
              <Navigation className="w-3 h-3" />
              {distText}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Name + rating */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-sm leading-tight truncate group-hover:text-primary transition-colors">
                {r.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <span>{r.cuisineEmoji} {r.cuisine}</span>
                {r.priceRange && <><span className="opacity-30">·</span><span>{"€".repeat(r.priceRange)}</span></>}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0 bg-amber-50 border border-amber-200/60 px-2 py-1 rounded-xl">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-bold text-xs text-amber-800">{r.rating?.toFixed(1)}</span>
            </div>
          </div>

          {/* PRIMARY reason — the big "why" chip */}
          <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${primaryReason.cls}`}>
            <span className="text-sm leading-none">{primaryReason.emoji}</span>
            {primaryReason.text}
          </div>

          {/* Secondary reason chips */}
          {reasons.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {reasons.slice(1, 3).map((r) => (
                <span
                  key={r.text}
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${r.cls}`}
                >
                  {r.emoji} {r.text}
                </span>
              ))}
            </div>
          )}

          {/* Address */}
          {r.address && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0 text-primary/50" />
              {r.address}{r.city ? `, ${r.city}` : ""}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Personalization level badge ─────────────────────────────────────────────

function PersonalizationBadge({ level }: { level: "high" | "medium" | "low" }) {
  const config = {
    high:   { text: "Stark personalisiert", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    medium: { text: "Personalisiert",       cls: "bg-primary/8 text-primary border-primary/25" },
    low:    { text: "Entdecken",            cls: "bg-muted text-muted-foreground border-border" },
  };
  const c = config[level];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${c.cls}`}>
      <Sparkles className="w-3 h-3" />
      {c.text}
    </span>
  );
}

// ─── Why personalized tooltip ─────────────────────────────────────────────────

function WhyHint({ user }: { user: UserContext }) {
  const hints: string[] = [];
  if (user.favoriteCuisines.length > 0) hints.push("Lieblingsküchen");
  if (user.dietaryStyle && user.dietaryStyle !== "no_preference") hints.push("Ernährungsweise");
  if (user.lat && user.lng) hints.push("Standort");
  if (user.totalBookings > 0) hints.push("Buchungshistorie");
  if (hints.length === 0) return null;

  return (
    <p className="text-xs text-muted-foreground">
      Basierend auf: {hints.join(", ")}
    </p>
  );
}

// ─── Loading skeletons ────────────────────────────────────────────────────────

function SmartOfferSkeleton() {
  return (
    <div className="shrink-0 w-72 space-y-3">
      <Skeleton className="aspect-[16/9] w-full rounded-3xl" />
      <Skeleton className="h-4 w-3/4 rounded-full" />
      <Skeleton className="h-3 w-1/2 rounded-full" />
      <Skeleton className="h-7 w-36 rounded-full" />
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────

interface SmartOffersSectionProps {
  restaurants: MarketplaceRestaurant[] | undefined;
  flashDeals: MarketplaceFlashDeal[];
  user: UserContext;
  mode: LifestyleMode;
  interactions: { cafe: number; restaurant: number; bar: number };
  isLoading: boolean;
}

export function SmartOffersSection({
  restaurants,
  flashDeals,
  user,
  mode,
  interactions,
  isLoading,
}: SmartOffersSectionProps) {
  const offers = useMemo(() => {
    if (!restaurants) return [];
    return rankSmartOffers(restaurants, user, mode, interactions, flashDeals, 8);
  }, [restaurants, flashDeals, user, mode, interactions]);

  const personalizationLevel = useMemo(() => getPersonalizationLevel(user), [user]);

  // Don't render if nothing to show
  if (!isLoading && offers.length === 0) return null;

  return (
    <section className="py-10 px-4 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/4 via-transparent to-accent/4 pointer-events-none" />

      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/25">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">Für Sie ausgewählt</h2>
              <PersonalizationBadge level={personalizationLevel} />
            </div>
            <WhyHint user={user} />
          </div>

          <Link
            href="/explore"
            className="press-scale text-sm font-bold text-primary bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
          >
            Alle entdecken <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Horizontal scroll of offer cards */}
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x -mx-4 px-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SmartOfferSkeleton key={i} />)
          ) : (
            offers.map((offer, i) => (
              <div key={offer.restaurant.id} className="snap-start">
                <SmartOfferCard offer={offer} rank={i} />
              </div>
            ))
          )}
        </div>

        {/* Upgrade prompt for low personalization */}
        {!isLoading && personalizationLevel === "low" && (
          <div className="mt-4 flex items-center justify-center gap-3 p-4 rounded-2xl bg-muted/40 border border-border/50">
            <div className="text-2xl">🎯</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Empfehlungen verbessern</p>
              <p className="text-xs text-muted-foreground">Speichern Sie Lieblingsküchen und Ernährungsweise für präzisere Vorschläge.</p>
            </div>
            <Link
              href="/profile"
              className="shrink-0 flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-full transition-colors"
            >
              Profil <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
