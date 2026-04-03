import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Timer, ArrowRight, Compass, Gift, Star, Zap, RefreshCw, ChevronRight, Navigation, MapPin, X, Loader2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListFlashDeals, useListMarketplaceRestaurants, useGetPersonalizedOffers } from "@workspace/api-client-react";
import { getGetPersonalizedOffersQueryKey } from "@workspace/api-client-react";
import { RestaurantCard } from "@/components/restaurant-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo } from "@/hooks/use-seo";
import { useGeolocation } from "@/hooks/use-geolocation";
import { Input } from "@/components/ui/input";
import { NearYouNow } from "@/components/near-you-now";

const CUISINES = [
  { name: "Italienisch", emoji: "🍝", from: "from-rose-400", to: "to-red-500" },
  { name: "Japanisch",   emoji: "🍣", from: "from-sky-400",  to: "to-blue-600" },
  { name: "Mexikanisch", emoji: "🌮", from: "from-amber-400", to: "to-orange-500" },
  { name: "Indisch",     emoji: "🍛", from: "from-yellow-400", to: "to-orange-400" },
  { name: "Französisch", emoji: "🥐", from: "from-violet-400", to: "to-purple-600" },
  { name: "Thailändisch",emoji: "🍜", from: "from-emerald-400", to: "to-teal-600" },
  { name: "Amerikanisch",emoji: "🍔", from: "from-orange-400", to: "to-red-400" },
  { name: "Britisch",    emoji: "🫖", from: "from-blue-400",  to: "to-indigo-600" },
];

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) return "Abgelaufen";
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    };
    setTimeLeft(calculate());
    const id = setInterval(() => setTimeLeft(calculate()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <div className="flex items-center gap-1.5 font-mono font-bold text-sm bg-black/30 text-white px-3 py-1.5 rounded-full backdrop-blur-md">
      <Timer className="w-3.5 h-3.5" />
      {timeLeft}
    </div>
  );
}

const TIER_CONFIG: Record<string, { gradient: string; badge: string; glow: string }> = {
  Bronze: { gradient: "from-amber-700/20 via-amber-500/10 to-transparent", badge: "bg-amber-100 text-amber-800 border-amber-300", glow: "shadow-amber-200" },
  Silver: { gradient: "from-slate-500/20 via-slate-400/10 to-transparent", badge: "bg-slate-100 text-slate-700 border-slate-300", glow: "shadow-slate-200" },
  Gold:   { gradient: "from-yellow-500/20 via-amber-400/10 to-transparent", badge: "bg-yellow-100 text-yellow-800 border-yellow-300", glow: "shadow-yellow-200" },
};

const MSG_ICON: Record<string, React.ElementType> = {
  win_back: RefreshCw,
  thank_you: Star,
  flash_blast: Zap,
  loyalty_reward: Gift,
};

function PersonalizedSection({ email }: { email: string }) {
  const { data, isLoading } = useGetPersonalizedOffers(
    { email },
    { query: { queryKey: getGetPersonalizedOffersQueryKey({ email }), enabled: !!email } }
  );

  if (isLoading) return (
    <section className="px-4 py-4">
      <div className="container mx-auto max-w-6xl">
        <Skeleton className="h-24 w-full rounded-3xl" />
      </div>
    </section>
  );

  if (!data) return null;

  const Icon = data.messageType ? (MSG_ICON[data.messageType] ?? Gift) : Gift;
  const cfg = TIER_CONFIG[data.tier] ?? TIER_CONFIG.Bronze;
  const pct = data.tier === "Gold" ? 100
    : data.tier === "Silver" ? Math.min(100, Math.round(((data.points - 200) / 300) * 100))
    : Math.min(100, Math.round((data.points / 200) * 100));

  return (
    <section className="px-4 py-4">
      <div className="container mx-auto max-w-6xl">
        <div className={`rounded-3xl border border-border/50 bg-gradient-to-r ${cfg.gradient} bg-card p-5 flex flex-col md:flex-row gap-4 md:items-center shadow-lg ${cfg.glow}`}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
                  {data.tier} Mitglied
                </span>
                <span className="text-xs text-muted-foreground font-medium">{data.points} Pkt.</span>
              </div>
              {data.personalizedMessage && (
                <p className="text-sm text-foreground leading-snug line-clamp-2">{data.personalizedMessage}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {data.nextTier && (
              <div className="hidden sm:block w-32 space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                  <span>{data.tier}</span><span>{data.nextTier}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-center text-muted-foreground">{data.pointsToNextTier} Pkt. bis {data.nextTier}</p>
              </div>
            )}
            <Link href="/my-bookings" className="press-scale flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors px-3 py-2 rounded-full whitespace-nowrap">
              Punkte ansehen <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  useSeo({
    title: "Londons beste Restaurants entdecken",
    description: "Entdecken und buchen Sie die besten Restaurants in London mit exklusiven Blitzangeboten und Treuepunkten.",
  });

  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [manualCity, setManualCity] = useState("");
  const [showCityFallback, setShowCityFallback] = useState(false);
  const geo = useGeolocation();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("restosmart_email");
      if (saved) setCustomerEmail(saved);
    }
  }, []);

  useEffect(() => {
    if (geo.status === "denied" || geo.status === "unavailable") {
      setShowCityFallback(true);
    }
  }, [geo.status]);

  const { data: flashDeals, isLoading: loadingDeals } = useListFlashDeals();
  const { data: featured, isLoading: loadingFeatured } = useListMarketplaceRestaurants({ featured: true });
  const { data: openNow, isLoading: loadingOpen } = useListMarketplaceRestaurants({ openNow: true });
  const { data: allRestaurants } = useListMarketplaceRestaurants({});
  const activeDeal = flashDeals?.[0];

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-8 pb-10 md:pt-16 md:pb-20">
        {/* Background gradient blob */}
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-primary/20 to-accent/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-accent/15 to-primary/10 blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <div className="grid md:grid-cols-2 gap-10 items-center">

            {/* Left: headline + CTA */}
            <div className="space-y-6 text-center md:text-left">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-bold px-4 py-2 rounded-full border border-primary/20">
                <Sparkles className="w-3.5 h-3.5" />
                Londons beste Tische
              </div>

              <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.05] tracking-tight text-foreground">
                Finden Sie Ihren<br />
                nächsten{" "}
                <span className="gradient-text">Lieblingstisch.</span>
              </h1>

              <p className="text-muted-foreground text-lg max-w-md mx-auto md:mx-0 leading-relaxed">
                Ausgewählte Restauranterlebnisse — von Geheimtipps bis Michelin-Sterne.
              </p>

              {/* Search bar */}
              <div className="relative max-w-sm mx-auto md:mx-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Restaurant, Küche oder Ort..."
                  value={manualCity}
                  onChange={(e) => setManualCity(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && manualCity) window.location.href = `/explore?search=${encodeURIComponent(manualCity)}`; }}
                  className="pl-12 pr-16 h-14 rounded-2xl bg-card border-border/60 shadow-lg text-sm font-medium focus:ring-2 focus:ring-primary/30"
                />
                {manualCity && (
                  <Link href={`/explore?search=${encodeURIComponent(manualCity)}`}>
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center shadow-md">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                )}
              </div>

              {/* CTA buttons */}
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <Button asChild size="lg" className="rounded-2xl h-12 px-6 font-bold bg-gradient-to-br from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/30 border-0">
                  <Link href="/explore">
                    Entdecken <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>

                {geo.status === "idle" && (
                  <Button size="lg" variant="outline" className="rounded-2xl h-12 px-5 font-semibold border-primary/30 hover:border-primary/60 hover:bg-primary/5 press-scale" onClick={geo.request}>
                    <Navigation className="w-4 h-4 mr-2 text-primary" />
                    In meiner Nähe
                  </Button>
                )}
                {geo.status === "requesting" && (
                  <Button size="lg" variant="outline" className="rounded-2xl h-12 px-5" disabled>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Wird ermittelt...
                  </Button>
                )}
                {geo.status === "granted" && (
                  <div className="flex items-center gap-2 h-12 px-4 rounded-2xl border border-emerald-300 bg-emerald-50 text-sm font-semibold text-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Standort aktiv
                    <button onClick={geo.clear} className="ml-1 text-emerald-500 hover:text-emerald-700 press-scale">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {showCityFallback && geo.status === "denied" && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Standortzugriff verweigert — Stadt oben eingeben.
                </p>
              )}
            </div>

            {/* Right: Flash Deal card */}
            <div className="relative mt-4 md:mt-0 max-w-sm mx-auto w-full">
              {loadingDeals ? (
                <Skeleton className="w-full aspect-[4/5] rounded-3xl" />
              ) : activeDeal && activeDeal.restaurant ? (
                <Link href={`/restaurant/${activeDeal.restaurant.id}`} className="block press-scale group">
                  <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-accent/20">
                    <div className="aspect-[4/5] bg-muted">
                      {activeDeal.restaurant.heroImage && (
                        <img
                          src={activeDeal.restaurant.heroImage}
                          alt={activeDeal.restaurant.name}
                          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      {/* Flash badge */}
                      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                        <div className="bg-gradient-to-br from-accent to-rose-600 text-white font-extrabold px-4 py-2.5 rounded-2xl shadow-xl shadow-rose-300/40 -rotate-2">
                          <div className="text-3xl leading-none">{activeDeal.percentage}%</div>
                          <div className="text-[10px] uppercase tracking-widest font-bold opacity-90">RABATT HEUTE</div>
                        </div>
                        {activeDeal.flashExpiresAt && (
                          <CountdownTimer expiresAt={activeDeal.flashExpiresAt} />
                        )}
                      </div>

                      {/* Info overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                        <div className="flex items-center gap-2 text-white/70 mb-1 text-sm">
                          <span className="text-lg">{activeDeal.restaurant.cuisineEmoji}</span>
                          <span className="font-semibold uppercase tracking-wider text-xs">{activeDeal.restaurant.cuisine}</span>
                        </div>
                        <h3 className="text-2xl font-extrabold mb-3">{activeDeal.restaurant.name}</h3>
                        <div className="w-full py-3 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 text-center text-sm font-bold">
                          Jetzt buchen →
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="bg-card border border-border/50 rounded-3xl p-8 text-center shadow-xl aspect-[4/5] flex flex-col items-center justify-center">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-5 text-4xl">
                    ⚡
                  </div>
                  <h3 className="font-bold text-xl mb-2">Keine Blitzangebote</h3>
                  <p className="text-muted-foreground text-sm mb-6">Schauen Sie später für exklusive Rabatte vorbei.</p>
                  <Button asChild variant="outline" className="rounded-2xl">
                    <Link href="/explore">Alle Restaurants</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── PERSONALIZED STRIP ── */}
      {customerEmail && <PersonalizedSection email={customerEmail} />}

      {/* ── NEAR YOU NOW ── */}
      {geo.status === "granted" && geo.lat !== null && geo.lng !== null && allRestaurants && allRestaurants.length > 0 && (
        <NearYouNow
          restaurants={allRestaurants}
          flashDeals={flashDeals ?? []}
          userLat={geo.lat}
          userLng={geo.lng}
          maxCount={4}
          radiusKm={10}
        />
      )}

      {/* ── CUISINE BUBBLES ── */}
      <section className="py-10 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-2xl font-extrabold mb-6 tracking-tight">Worauf haben Sie Hunger?</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x">
            {CUISINES.map((cuisine) => (
              <Link
                key={cuisine.name}
                href={`/explore?cuisine=${cuisine.name}`}
                className="flex flex-col items-center gap-2.5 min-w-[88px] snap-center press-scale group"
              >
                <div className={`w-16 h-16 rounded-3xl bg-gradient-to-br ${cuisine.from} ${cuisine.to} flex items-center justify-center text-3xl shadow-lg transition-transform duration-200 group-hover:scale-110 group-hover:shadow-xl`}>
                  {cuisine.emoji}
                </div>
                <span className="text-xs font-bold text-center text-foreground/80 leading-tight">{cuisine.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED ── */}
      <section className="py-10 px-4 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Star className="w-3.5 h-3.5 text-white fill-white" />
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight">Empfehlungen</h2>
              </div>
              <p className="text-sm text-muted-foreground">Die meistdiskutierten Lokale der Stadt</p>
            </div>
            <Link href="/explore?featured=true" className="press-scale text-sm font-bold text-primary bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
              Alle <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {loadingFeatured ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/3] w-full rounded-3xl" />
                  <Skeleton className="h-5 w-3/4 rounded-full" />
                  <Skeleton className="h-4 w-1/2 rounded-full" />
                </div>
              ))
            ) : featured && featured.length > 0 ? (
              featured.slice(0, 3).map(r => (
                <RestaurantCard key={r.id} restaurant={r} showFlashDeal />
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Keine Empfehlungen gefunden.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── OPEN NOW ── */}
      <section className="py-10 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="relative flex h-5 w-5 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative flex h-3 w-3 rounded-full bg-emerald-500" />
                </span>
                <h2 className="text-2xl font-extrabold tracking-tight">Jetzt geöffnet</h2>
              </div>
              <p className="text-sm text-muted-foreground">Hunger jetzt? Diese Lokale warten auf Sie</p>
            </div>
            <Link href="/explore?openNow=true" className="press-scale text-sm font-bold text-primary bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
              Alle <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {loadingOpen ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/3] w-full rounded-3xl" />
                  <Skeleton className="h-5 w-3/4 rounded-full" />
                  <Skeleton className="h-4 w-1/2 rounded-full" />
                </div>
              ))
            ) : openNow && openNow.length > 0 ? (
              openNow.slice(0, 4).map(r => (
                <RestaurantCard key={r.id} restaurant={r} />
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Derzeit keine Restaurants geöffnet.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── BOTTOM DISCOVERY CTA ── */}
      <section className="py-10 px-4 mb-4">
        <div className="container mx-auto max-w-6xl">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary via-violet-600 to-accent p-8 md:p-12 text-white text-center shadow-2xl shadow-primary/30">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)] pointer-events-none" />
            <div className="relative z-10">
              <div className="text-5xl mb-4">🍽️</div>
              <h2 className="text-2xl md:text-3xl font-extrabold mb-3 tracking-tight">Alle Restaurants entdecken</h2>
              <p className="text-white/75 mb-6 max-w-md mx-auto">Filtern Sie nach Küche, Preis, Bewertung und Verfügbarkeit.</p>
              <Button asChild size="lg" className="rounded-2xl bg-white text-primary font-bold hover:bg-white/90 shadow-xl press-scale h-12 px-8 border-0">
                <Link href="/explore">
                  Jetzt entdecken <Compass className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
