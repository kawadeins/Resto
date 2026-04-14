import { useTranslation } from "react-i18next";
/**
 * LiveSections — homepage "Hot jetzt", "Lunch-Rush", "Nightlife-Heatmap" etc.
 * Dynamically configured based on current lifestyle mode and time of day.
 * Uses the live-activity scoring engine to rank and filter restaurants.
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Flame, MapPin } from "lucide-react";
import type { MarketplaceRestaurant, MarketplaceFlashDeal } from "@workspace/api-client-react";
import type { LifestyleMode } from "@/hooks/use-lifestyle-mode";
import type { SocialCue } from "@/lib/social-api";
import { rankByLiveActivity, getLiveSections, type LiveSectionConfig } from "@/lib/live-activity";
import { LiveBadge, LivePulse } from "@/components/live-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Navigation, Clock } from "lucide-react";

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// ─── Live restaurant mini-card ────────────────────────────────────────────────

interface LiveCardProps {
  restaurant: MarketplaceRestaurant;
  rank: number;
  score: number;
  badge: ReturnType<typeof rankByLiveActivity>[0]["live"]["primaryBadge"];
  distance?: number;
}

function LiveCard({ restaurant, rank, score, badge, distance }: LiveCardProps) {
  const biz = (restaurant as any).businessType ?? "restaurant";
  const heat = score >= 80 ? "border-purple-300 shadow-purple-100"
    : score >= 62 ? "border-rose-300 shadow-rose-100"
    : score >= 44 ? "border-amber-300 shadow-amber-100"
    : "border-border/50";

  return (
    <Link
      href={`/restaurant/${restaurant.id}`}
      className="block group press-scale shrink-0 w-56 snap-start"
    >
      <div className={`relative overflow-hidden rounded-3xl bg-card border ${heat} shadow-lg group-hover:shadow-xl group-hover:-translate-y-1 transition-all duration-300`}>

        {/* Rank indicator */}
        <div className="absolute top-3 left-3 z-10 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <span className="text-white font-extrabold text-xs">#{rank}</span>
        </div>

        {/* Image / emoji */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
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
                : "bg-gradient-to-br from-primary/10 to-accent/10"
            }`}>
              {restaurant.cuisineEmoji || (biz === "cafe" ? "☕" : biz === "bar" ? "🍸" : "🍽️")}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Rating */}
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-full shadow">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="font-bold text-xs">{restaurant.rating.toFixed(1)}</span>
          </div>

          {/* Distance */}
          {distance !== undefined && (
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-semibold text-primary shadow">
              <Navigation className="w-3 h-3" />
              {formatDistance(distance)}
            </div>
          )}

          {/* Live score bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
            <div
              className={`h-full transition-all duration-700 ${
                score >= 80 ? "bg-purple-500" :
                score >= 62 ? "bg-rose-500" :
                score >= 44 ? "bg-amber-500" :
                "bg-emerald-500"
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          <h3 className="font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">
            {restaurant.name}
          </h3>

          {badge && <LiveBadge badge={badge} />}

          {!badge && restaurant.isOpenNow && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Geöffnet
            </span>
          )}

          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            {restaurant.openTime} – {restaurant.closeTime}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Single live section ──────────────────────────────────────────────────────

interface LiveSectionProps {
  config: LiveSectionConfig;
  restaurants: MarketplaceRestaurant[];
  flashDeals: MarketplaceFlashDeal[];
  mode: LifestyleMode;
  cues: Record<string, SocialCue>;
  userLat?: number | null;
  userLng?: number | null;
}

function LiveSection({ config, restaurants, flashDeals, mode, cues, userLat, userLng }: LiveSectionProps) {
  const { t } = useTranslation();
  const scored = useMemo(() => {
    const filtered = restaurants.filter(config.filter);
    return rankByLiveActivity(filtered, mode, cues, flashDeals).slice(0, 10);
  }, [restaurants, config, flashDeals, mode, cues]);

  if (scored.length === 0) return null;

  // Require at least 2 open places to show section
  const openCount = scored.filter(s => s.restaurant.isOpenNow).length;
  if (openCount < 1) return null;

  const hasHot = scored.some(s => s.live.score >= 62);

  return (
    <section className={`py-8 px-4 relative overflow-hidden`}>
      <div className={`absolute inset-0 bg-gradient-to-r ${config.gradient} pointer-events-none`} />
      <div className="container mx-auto max-w-6xl relative z-10">

        {/* Header */}
        <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              {/* Live pulse dot */}
              <LivePulse cls={hasHot ? "bg-rose-500" : "bg-emerald-500"} />

              <span className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/60">LIVE</span>

              <div className="w-8 h-8 rounded-2xl flex items-center justify-center text-lg shadow-md shadow-primary/20 bg-white border border-border/30">
                {config.emoji}
              </div>
              <h2 className="text-xl font-extrabold tracking-tight">{config.title}</h2>
            </div>
            <p className="text-xs text-muted-foreground ml-[calc(16px+8px+32px+10px)]">{config.subtitle}</p>
          </div>
          <Link href="/explore" className="press-scale text-xs font-bold text-primary bg-primary/8 hover:bg-primary/15 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
            Alle <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Horizontal scroll */}
        <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x -mx-4 px-4">
          {scored.map(({ restaurant, live }, i) => (
            <LiveCard
              key={restaurant.id}
              restaurant={restaurant}
              rank={i + 1}
              score={live.score}
              badge={live.primaryBadge}
            />
          ))}
        </div>

        {/* Mini intensity legend */}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {[
            { min: 80, color: "bg-purple-500", label: t("live.trending", { defaultValue: "Trending" }) },
            { min: 62, color: "bg-rose-500",   label: t("live.hot", { defaultValue: "Hot" }) },
            { min: 44, color: "bg-amber-500",   label: t("live.popular", { defaultValue: "Popular" }) },
            { min: 0,  color: "bg-emerald-500", label: t("live.active", { defaultValue: "Active" }) },
          ].map(t => (
            <div key={t.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold">
              <div className={`w-2 h-2 rounded-full ${t.color}`} />
              {t.label}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 italic">
            <Flame className="w-3 h-3 text-rose-400" />
            Basierend auf Echtzeit-Verfügbarkeit, Bewertungen & sozialer Aktivität
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Main export: all live sections ──────────────────────────────────────────

interface LiveSectionsProps {
  restaurants: MarketplaceRestaurant[];
  flashDeals: MarketplaceFlashDeal[];
  mode: LifestyleMode;
  cues: Record<string, SocialCue>;
  isLoading: boolean;
  userLat?: number | null;
  userLng?: number | null;
}

export function LiveSections({ restaurants, flashDeals, mode, cues, isLoading, userLat, userLng }: LiveSectionsProps) {
  const sections = useMemo(() => getLiveSections(mode), [mode]);

  if (isLoading) {
    return (
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center gap-2 mb-5">
            <LivePulse />
            <Skeleton className="h-6 w-40 rounded-full" />
          </div>
          <div className="flex gap-4 overflow-x-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="shrink-0 w-56 h-52 rounded-3xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!restaurants || restaurants.length === 0) return null;

  return (
    <>
      {sections.map(section => (
        <LiveSection
          key={section.id}
          config={section}
          restaurants={restaurants}
          flashDeals={flashDeals}
          mode={mode}
          cues={cues}
          userLat={userLat}
          userLng={userLng}
        />
      ))}
    </>
  );
}
