import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "wouter";
import {
  Timer, ArrowRight, Compass, Gift, Star, Zap, RefreshCw,
  ChevronRight, Navigation, MapPin, X, Loader2, Search, Sparkles,
  UtensilsCrossed, Coffee, Wine, Moon, Sun, Sunset,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import {
  useListFlashDeals,
  useListMarketplaceRestaurants,
  useGetPersonalizedOffers,
  getGetPersonalizedOffersQueryKey,
} from "@workspace/api-client-react";
import { RestaurantCard } from "@/components/restaurant-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo } from "@/hooks/use-seo";
import { useGeolocation } from "@/hooks/use-geolocation";
import { Input } from "@/components/ui/input";
import { NearYouNow } from "@/components/near-you-now";
import { useLifestyleMode, ModeSection } from "@/hooks/use-lifestyle-mode";
import { SmartOffersSection } from "@/components/smart-offers-section";
import { LiveSections } from "@/components/live-sections";
import { ActivityFeedSection } from "@/components/activity-feed-section";
import { GroupSuggestionsSection } from "@/components/group-suggestions-section";
import { AutoPlanCard } from "@/components/auto-plan-card";
import { ActivePlansBanner } from "@/components/active-plans-banner";
import { InstantPlanButton } from "@/components/instant-plan-button";
import { useSocialCues } from "@/contexts/social-context";
import { rankByContext } from "@/lib/ranking-engine";
import { getFriends, getFriendRadar, type FriendProfile, type RadarZone } from "@/lib/social-api";
import { evaluateAutoPlans } from "@/lib/auto-plans-engine";
import { evaluateLifeLoop } from "@/lib/life-loop-engine";
import { getTwin } from "@/lib/digital-twin";
import type { UserContext } from "@/lib/smart-offers";
import type { MarketplaceRestaurant, MarketplaceFlashDeal } from "@workspace/api-client-react";
import { VibeOnboarding } from "@/components/vibe-onboarding";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const CUISINE_DE: Record<string, string> = {
  Austrian: "Österreichisch", Burgers: "Burger", French: "Französisch",
  Indian: "Indisch", International: "International", Italian: "Italienisch",
  Japanese: "Japanisch", Vegetarian: "Vegetarisch", Cocktails: "Cocktails",
};

// ─── Cuisine bubbles ──────────────────────────────────────────────────────────

const CUISINES = [
  { name: "Österreichisch", emoji: "🥩", from: "from-stone-400",   to: "to-amber-600" },
  { name: "Italienisch",    emoji: "🍝", from: "from-rose-400",    to: "to-red-500" },
  { name: "Japanisch",      emoji: "🍣", from: "from-sky-400",     to: "to-blue-600" },
  { name: "Mexikanisch",    emoji: "🌮", from: "from-amber-400",   to: "to-orange-500" },
  { name: "Indisch",        emoji: "🍛", from: "from-yellow-400",  to: "to-orange-400" },
  { name: "Französisch",    emoji: "🥐", from: "from-violet-400",  to: "to-purple-600" },
  { name: "Vegetarisch",    emoji: "🌿", from: "from-emerald-400", to: "to-teal-600" },
  { name: "Amerikanisch",   emoji: "🍔", from: "from-orange-400",  to: "to-red-400" },
];

// ─── Countdown Timer ─────────────────────────────────────────────────────────

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  useEffect(() => {
    const calculate = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) return "Abgelaufen";
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

// ─── Loyalty strip ────────────────────────────────────────────────────────────

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
      <div className="container mx-auto max-w-6xl"><Skeleton className="h-24 w-full rounded-3xl" /></div>
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
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.badge}`}>{data.tier} Mitglied</span>
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

// ─── Mode icon helper ─────────────────────────────────────────────────────────

function ModeIcon({ mode }: { mode: string }) {
  if (mode === "morning")   return <Sun className="w-3.5 h-3.5" />;
  if (mode === "lunch")     return <UtensilsCrossed className="w-3.5 h-3.5" />;
  if (mode === "afternoon") return <Coffee className="w-3.5 h-3.5" />;
  if (mode === "evening")   return <Sunset className="w-3.5 h-3.5" />;
  return <Moon className="w-3.5 h-3.5" />;
}

// ─── Section accent classes ───────────────────────────────────────────────────

const ACCENT_CLASSES: Record<string, { icon: string; link: string; sectionBg: string; dot: string }> = {
  primary: { icon: "bg-gradient-to-br from-primary to-accent", link: "text-primary bg-primary/10 hover:bg-primary/15", sectionBg: "bg-gradient-to-b from-primary/5 to-transparent", dot: "bg-primary" },
  amber:   { icon: "bg-gradient-to-br from-amber-500 to-orange-500", link: "text-amber-700 bg-amber-100 hover:bg-amber-200", sectionBg: "bg-gradient-to-b from-amber-500/6 to-transparent", dot: "bg-amber-500" },
  rose:    { icon: "bg-gradient-to-br from-rose-500 to-pink-600", link: "text-rose-700 bg-rose-100 hover:bg-rose-200", sectionBg: "bg-gradient-to-b from-rose-500/6 to-transparent", dot: "bg-rose-500" },
  violet:  { icon: "bg-gradient-to-br from-violet-500 to-purple-600", link: "text-violet-700 bg-violet-100 hover:bg-violet-200", sectionBg: "bg-gradient-to-b from-violet-500/6 to-transparent", dot: "bg-violet-500" },
  emerald: { icon: "bg-gradient-to-br from-emerald-500 to-teal-600", link: "text-emerald-700 bg-emerald-100 hover:bg-emerald-200", sectionBg: "bg-gradient-to-b from-emerald-500/6 to-transparent", dot: "bg-emerald-500" },
};

// ─── Dynamic Section ─────────────────────────────────────────────────────────

function DynamicSection({
  section, allData, flashDeals, loading, onCardClick, layout = "grid3",
}: {
  section: ModeSection;
  allData: MarketplaceRestaurant[] | undefined;
  flashDeals: MarketplaceFlashDeal[];
  loading: boolean;
  onCardClick: (type: string) => void;
  layout?: "grid3" | "grid4";
}) {
  const ac = ACCENT_CLASSES[section.accent] ?? ACCENT_CLASSES.primary;
  const filtered = allData?.filter((r) => {
    if (section.businessType && (r as any).businessType !== section.businessType) return false;
    if (section.openNow && !r.isOpenNow) return false;
    if (section.featured && !r.isFeatured) return false;
    return true;
  }) ?? [];
  const items = filtered.slice(0, section.maxItems);
  const gridCls = layout === "grid4"
    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5";

  return (
    <section className={`py-10 px-4 ${ac.sectionBg}`}>
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {section.id.startsWith("open") ? (
                <span className="relative flex h-5 w-5 items-center justify-center">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 ${ac.dot}`} />
                  <span className={`relative flex h-3 w-3 rounded-full ${ac.dot}`} />
                </span>
              ) : (
                <div className={`w-6 h-6 rounded-lg ${ac.icon} flex items-center justify-center text-sm`}>
                  {section.icon}
                </div>
              )}
              <h2 className="text-2xl font-extrabold tracking-tight">{section.title}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{section.subtitle}</p>
          </div>
          <Link href={section.exploreLink} className={`press-scale text-sm font-bold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 ${ac.link}`}>
            Alle <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className={gridCls}>
          {loading ? (
            Array.from({ length: section.maxItems }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[4/3] w-full rounded-3xl" />
                <Skeleton className="h-5 w-3/4 rounded-full" />
                <Skeleton className="h-4 w-1/2 rounded-full" />
              </div>
            ))
          ) : items.length > 0 ? (
            items.map((r) => (
              <div key={r.id} onClick={() => onCardClick((r as any).businessType ?? "restaurant")}>
                <RestaurantCard restaurant={r} showFlashDeal={flashDeals.some((fd) => fd.restaurantId === r.id)} />
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <div className="text-3xl mb-3">🍽️</div>
              <p className="font-semibold text-foreground">Keine Lokale verfügbar</p>
              <p className="text-sm mt-1">Schau später wieder vorbei oder entdecke alle Lokale.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Rotating hero headline ───────────────────────────────────────────────────

type HeadlineSegment = { text: string; gradient?: boolean };

const ROTATING_HEADLINES: HeadlineSegment[][] = [
  [
    { text: "Wien schläft nicht. " },
    { text: "Die Nacht gehört Ihnen.", gradient: true },
  ],
  [
    { text: "Entdecken Sie Wiens verborgene Nächte. " },
    { text: "Jeder Moment zählt.", gradient: true },
  ],
  [
    { text: "Wo andere schließen, beginnt Ihr Geschäft. " },
    { text: "Willkommen in der Nacht.", gradient: true },
  ],
  [
    { text: "Mehr Gäste. Mehr Umsatz.", gradient: true },
    { text: " Die Nacht arbeitet für Sie." },
  ],
];

function RotatingHeroHeadline() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % ROTATING_HEADLINES.length);
    }, 3500);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div
      className="overflow-x-clip"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.h1
          key={index}
          initial={{ x: -56, opacity: 0, filter: "blur(8px)" }}
          animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ x: 56, opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.48, ease: [0.4, 0, 0.2, 1] }}
          className="text-5xl md:text-6xl font-extrabold leading-[1.05] tracking-tight text-foreground"
        >
          {ROTATING_HEADLINES[index].map((seg, i) =>
            seg.gradient
              ? <span key={i} className="gradient-text">{seg.text}</span>
              : <span key={i}>{seg.text}</span>
          )}
        </motion.h1>
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  useSeo({
    title: "RestoSmart Wien — Restaurants, Cafés & Bars entdecken",
    description: "Die besten Restaurants, Cafés und Bars in Wien. Jetzt entdecken, buchen und exklusive Angebote sichern.",
  });

  const { mode, config, track, interactions } = useLifestyleMode();

  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [manualCity, setManualCity] = useState("");
  const [showCityFallback, setShowCityFallback] = useState(false);
  const [modeBannerDismissed, setModeBannerDismissed] = useState(false);
  const [friendCount, setFriendCount] = useState(0);
  const geo = useGeolocation();

  // ── Social cues from context ─────────────────────────────────────────────
  const { cues } = useSocialCues();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("restosmart_email");
      if (saved) setCustomerEmail(saved);
    }
  }, []);

  useEffect(() => {
    if (geo.status === "denied" || geo.status === "unavailable") setShowCityFallback(true);
  }, [geo.status]);

  const { data: flashDeals = [], isLoading: loadingDeals } = useListFlashDeals();
  const { data: allRestaurants, isLoading: loadingAll } = useListMarketplaceRestaurants({});
  const activeDeal = flashDeals[0];

  // ── Customer profile ─────────────────────────────────────────────────────
  const { data: customerProfile } = useQuery({
    queryKey: ["customer-profile-home", customerEmail],
    queryFn: async () => {
      if (!customerEmail) return null;
      const res = await fetch(`${API_BASE}/api/customer-profile/${encodeURIComponent(customerEmail)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!customerEmail,
    staleTime: 5 * 60 * 1000,
  });

  // ── Friends data ─────────────────────────────────────────────────────────
  const { data: friends = [] } = useQuery<FriendProfile[]>({
    queryKey: ["friends", customerEmail],
    queryFn: () => getFriends(customerEmail),
    enabled: !!customerEmail,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    setFriendCount(friends.length);
  }, [friends.length]);

  // ── Friend Radar data ─────────────────────────────────────────────────────
  const { data: radarZones = [] } = useQuery<RadarZone[]>({
    queryKey: ["friend-radar", customerEmail],
    queryFn: () => getFriendRadar(customerEmail),
    enabled: !!customerEmail && friends.length > 0,
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // ── UserContext for smart offers ─────────────────────────────────────────
  const userContext = useMemo((): UserContext => ({
    favoriteCuisines:      customerProfile?.favoriteCuisines ?? [],
    dietaryStyle:          customerProfile?.dietaryStyle ?? "no_preference",
    allergies:             customerProfile?.allergies ?? [],
    favoriteRestaurantIds: customerProfile?.favoriteRestaurantIds ?? [],
    totalBookings:         customerProfile?.stats?.totalBookings ?? 0,
    lat:  geo.lat,
    lng:  geo.lng,
  }), [customerProfile, geo.lat, geo.lng]);

  // ── Today's meal plan (used to prevent auto-plan contradiction) ──────────
  const { data: mealPlanData } = useQuery<{ plans?: Array<{ date: string }>; } | Array<{ date: string }>>({
    queryKey: ["meal-plan-home", customerEmail],
    queryFn: () =>
      fetch(`${API_BASE}/api/meal-plan/${encodeURIComponent(customerEmail)}`)
        .then((r) => r.json()),
    enabled: !!customerEmail,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const hasTodayMealPlan = useMemo(() => {
    const today = new Date();
    const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const todayStr = toDateStr(today);
    const plans = (Array.isArray(mealPlanData) ? mealPlanData : (mealPlanData as any)?.plans ?? []) as Array<{ date: string }>;
    return plans.some((p) => p.date?.startsWith(todayStr));
  }, [mealPlanData]);

  // ── Auto Plans engine ─────────────────────────────────────────────────────
  const autoPlan = useMemo(() => {
    if (!customerEmail || !allRestaurants || allRestaurants.length === 0) return null;
    return evaluateAutoPlans({
      email: customerEmail,
      restaurants: allRestaurants,
      flashDeals,
      friends,
      radarZones,
      cues,
      mode,
      hasTodayMealPlan,
    });
  }, [customerEmail, allRestaurants, flashDeals, friends, radarZones, cues, mode, hasTodayMealPlan]);

  // ── Life Loop Decision (section ordering + context hint) ─────────────────
  const lifeLoop = useMemo(() => {
    const twin = getTwin();
    return evaluateLifeLoop({
      twin,
      mode,
      radarZones,
      cues,
      hasFlashDeals: (flashDeals?.length ?? 0) > 0,
      friendCount: friends.length,
      restaurants: allRestaurants ?? [],
    });
  }, [mode, radarZones, cues, flashDeals, friends, allRestaurants]);

  // Determine render order: should social activity show above live sections?
  const socialBeforeLive = useMemo(() => {
    const liveIdx = lifeLoop.sectionOrder.indexOf("live_sections");
    const feedIdx = lifeLoop.sectionOrder.indexOf("activity_feed");
    return feedIdx < liveIdx;
  }, [lifeLoop.sectionOrder]);

  const searchUrl = manualCity ? `/explore?search=${encodeURIComponent(manualCity)}` : "/explore";

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── VIBE ONBOARDING (first visit only) ── */}
      <VibeOnboarding />

      {/* ── ACTIVE PLANS BANNER (incoming invitations) ── */}
      {customerEmail && <ActivePlansBanner email={customerEmail} />}

      {/* ── AUTO PLAN CARD (proactive suggestion) ── */}
      {autoPlan?.isReady && autoPlan.suggestion && (
        <AutoPlanCard
          autoPlan={autoPlan}
          email={customerEmail}
          restaurants={allRestaurants ?? []}
          flashDeals={flashDeals}
          friends={friends}
          radarZones={radarZones}
          cues={cues}
          mode={mode}
        />
      )}

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-8 pb-10 md:pt-16 md:pb-20 transition-all duration-700">
        <div className={`absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-gradient-to-br ${config.blobPrimary} blur-3xl pointer-events-none transition-all duration-700`} />
        <div className={`absolute -bottom-24 -right-24 w-[400px] h-[400px] rounded-full bg-gradient-to-br ${config.blobAccent} blur-3xl pointer-events-none transition-all duration-700`} />

        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <div className="grid md:grid-cols-2 gap-10 items-center">

            {/* Left */}
            <div className="space-y-6 text-center md:text-left">
              <div className="flex items-center gap-3 justify-center md:justify-start">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25 shrink-0">
                  <UtensilsCrossed className="w-5.5 h-5.5 text-white" style={{ width: "22px", height: "22px" }} />
                </div>
                <span className="text-[28px] font-extrabold tracking-tight leading-none">
                  <span className="gradient-text">Resto</span><span className="text-foreground">Smart</span>
                </span>
              </div>

              {!modeBannerDismissed && (
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-bold px-4 py-2 rounded-full border border-primary/20 transition-all duration-500">
                  <ModeIcon mode={mode} />
                  {config.badgeLabel} — {config.label}
                  <button onClick={() => setModeBannerDismissed(true)} className="ml-1 text-primary/50 hover:text-primary transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <RotatingHeroHeadline />

              <p className="text-muted-foreground text-lg max-w-md mx-auto md:mx-0 leading-relaxed transition-all duration-500">
                {config.subline}
              </p>

              {/* Life Loop context hint — shown when the engine has enough signal */}
              {lifeLoop.confidence >= 0.65 && (
                <div className="flex items-start gap-2 bg-primary/8 border border-primary/15 rounded-2xl px-4 py-2.5 max-w-sm mx-auto md:mx-0">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-primary/90 font-medium leading-snug">{lifeLoop.contextHint}</p>
                </div>
              )}

              <div className="relative max-w-sm mx-auto md:mx-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder={config.searchPlaceholder}
                  value={manualCity}
                  onChange={(e) => setManualCity(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && manualCity) window.location.href = searchUrl; }}
                  className="pl-12 pr-16 h-14 rounded-2xl bg-card border-border/60 shadow-lg text-sm font-medium focus:ring-2 focus:ring-primary/30"
                />
                {manualCity && (
                  <Link href={searchUrl}>
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center shadow-md">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                )}
              </div>

              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <Button asChild size="lg" className="rounded-2xl h-12 px-6 font-bold bg-gradient-to-br from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/30 border-0">
                  <Link href="/explore">Entdecken <ArrowRight className="w-4 h-4 ml-2" /></Link>
                </Button>

                {/* Instant Plan button — hero variant */}
                {customerEmail && allRestaurants && (
                  <InstantPlanButton
                    email={customerEmail}
                    restaurants={allRestaurants}
                    flashDeals={flashDeals}
                    friends={friends}
                    radarZones={radarZones}
                    cues={cues}
                    mode={mode}
                    variant="hero"
                  />
                )}

                <Link href="/explore?businessType=restaurant" className="flex items-center gap-2 h-12 px-5 rounded-2xl border border-primary/20 bg-primary/5 text-primary text-sm font-semibold press-scale hover:bg-primary/10 transition-colors">
                  <UtensilsCrossed className="w-4 h-4" /> Restaurants
                </Link>
                <Link href="/explore?businessType=cafe" className="flex items-center gap-2 h-12 px-5 rounded-2xl border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold press-scale hover:bg-amber-100 transition-colors">
                  <Coffee className="w-4 h-4" /> Cafés
                </Link>
                <Link href="/explore?businessType=bar" className="flex items-center gap-2 h-12 px-5 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-semibold press-scale hover:bg-rose-100 transition-colors">
                  <Wine className="w-4 h-4" /> Bars
                </Link>

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
                      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                        <div className="bg-gradient-to-br from-accent to-rose-600 text-white font-extrabold px-4 py-2.5 rounded-2xl shadow-xl shadow-rose-300/40 -rotate-2">
                          <div className="text-3xl leading-none">{activeDeal.percentage}%</div>
                          <div className="text-[10px] uppercase tracking-widest font-bold opacity-90">RABATT HEUTE</div>
                        </div>
                        {activeDeal.flashExpiresAt && <CountdownTimer expiresAt={activeDeal.flashExpiresAt} />}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                        <div className="flex items-center gap-2 text-white/70 mb-1 text-sm">
                          <span className="text-lg">{activeDeal.restaurant.cuisineEmoji}</span>
                          <span className="font-semibold uppercase tracking-wider text-xs">{CUISINE_DE[activeDeal.restaurant.cuisine] ?? activeDeal.restaurant.cuisine}</span>
                        </div>
                        <h3 className="text-2xl font-extrabold mb-3">{activeDeal.restaurant.name}</h3>
                        <div className="w-full py-3 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 text-center text-sm font-bold">
                          Jetzt buchen →
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ) : (() => {
                const topR = allRestaurants
                  ? [...allRestaurants].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0))[0]
                  : null;
                return topR ? (
                  <Link href={`/restaurant/${topR.id}`} className="block press-scale group">
                    <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-primary/15">
                      <div className="aspect-[4/5] bg-muted">
                        {topR.heroImage ? (
                          <img
                            src={topR.heroImage}
                            alt={topR.name}
                            className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/10" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute top-4 left-4">
                          <div className="bg-white/15 backdrop-blur-md border border-white/20 text-white font-bold px-3 py-1.5 rounded-2xl text-sm flex items-center gap-1.5">
                            <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                            <span>Beliebt in Wien</span>
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                          <div className="flex items-center gap-2 text-white/70 mb-1 text-sm">
                            <span className="text-lg">{topR.cuisineEmoji}</span>
                            <span className="font-semibold uppercase tracking-wider text-xs">{CUISINE_DE[(topR as any).cuisine] ?? (topR as any).cuisine}</span>
                          </div>
                          <h3 className="text-2xl font-extrabold mb-1">{topR.name}</h3>
                          <p className="text-white/70 text-xs mb-3 line-clamp-1">{topR.address}</p>
                          <div className="w-full py-3 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 text-center text-sm font-bold">
                            Jetzt ansehen →
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="bg-card border border-border/50 rounded-3xl p-8 text-center shadow-xl aspect-[4/5] flex flex-col items-center justify-center">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-5 text-4xl">🍽️</div>
                    <h3 className="font-bold text-xl mb-2">Wien entdecken</h3>
                    <p className="text-muted-foreground text-sm mb-6">Die besten Restaurants, Cafés und Bars der Stadt.</p>
                    <Button asChild className="rounded-2xl bg-gradient-to-br from-primary to-accent border-0">
                      <Link href="/explore">Jetzt entdecken</Link>
                    </Button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* ── PERSONALIZED STRIP ── */}
      {customerEmail && <PersonalizedSection email={customerEmail} />}

      {/* ── AI SMART OFFERS ── */}
      <SmartOffersSection
        restaurants={allRestaurants ?? []}
        flashDeals={flashDeals}
        user={userContext}
        mode={mode}
        interactions={interactions}
        isLoading={loadingAll}
      />

      {/* ── SOCIAL + LIVE SECTIONS — order is determined by the Life Loop engine ── */}
      {socialBeforeLive ? (
        <>
          {customerEmail && (
            <ActivityFeedSection email={customerEmail} friendCount={friendCount} />
          )}
          {customerEmail && (
            <GroupSuggestionsSection email={customerEmail} friendCount={friendCount} />
          )}
          <LiveSections
            restaurants={allRestaurants ?? []}
            flashDeals={flashDeals}
            mode={mode}
            cues={cues}
            isLoading={loadingAll}
            userLat={geo.lat}
            userLng={geo.lng}
          />
        </>
      ) : (
        <>
          <LiveSections
            restaurants={allRestaurants ?? []}
            flashDeals={flashDeals}
            mode={mode}
            cues={cues}
            isLoading={loadingAll}
            userLat={geo.lat}
            userLng={geo.lng}
          />
          {customerEmail && (
            <ActivityFeedSection email={customerEmail} friendCount={friendCount} />
          )}
          {customerEmail && (
            <GroupSuggestionsSection email={customerEmail} friendCount={friendCount} />
          )}
        </>
      )}

      {/* ── NEAR YOU NOW ── */}
      {geo.status === "granted" && geo.lat !== null && geo.lng !== null && allRestaurants && allRestaurants.length > 0 && (
        <NearYouNow
          restaurants={allRestaurants}
          flashDeals={flashDeals}
          userLat={geo.lat}
          userLng={geo.lng}
          maxCount={4}
          radiusKm={10}
          cues={cues}
        />
      )}

      {/* ── TOP IN WIEN — context-ranked by time + rating + budgeted boost ── */}
      {allRestaurants && allRestaurants.length > 0 && (
        <section className="py-8 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⭐</span>
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight">Top in Wien</h2>
                  <p className="text-xs text-muted-foreground">Hochbewertete Lokale passend zur Uhrzeit</p>
                </div>
              </div>
              <Link href="/explore?rating=4" className="text-xs font-bold text-primary hover:underline press-scale">Alle →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rankByContext(allRestaurants, mode, 3).map((ranked) => (
                <RestaurantCard
                  key={ranked.restaurant.id}
                  restaurant={ranked.restaurant}
                  showFlashDeal
                  isSponsored={ranked.isSponsored}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── DYNAMIC MODE SECTIONS ── */}
      {config.sections.map((section) => (
        <DynamicSection
          key={section.id}
          section={section}
          allData={allRestaurants}
          flashDeals={flashDeals}
          loading={loadingAll}
          onCardClick={track}
          layout={section.maxItems === 4 ? "grid4" : "grid3"}
        />
      ))}

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

      {/* ── BUSINESS TYPE QUICK-NAV ── */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-2xl font-extrabold mb-5 tracking-tight">Nach Betriebsart</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { type: "restaurant", emoji: "🍽️", label: "Restaurants", from: "from-primary/80", to: "to-accent/80", textCls: "text-primary" },
              { type: "cafe", emoji: "☕", label: "Cafés", from: "from-amber-500", to: "to-orange-500", textCls: "text-amber-700" },
              { type: "bar", emoji: "🍸", label: "Bars", from: "from-rose-500", to: "to-pink-600", textCls: "text-rose-700" },
            ].map((bt) => (
              <Link
                key={bt.type}
                href={`/explore?businessType=${bt.type}`}
                onClick={() => track(bt.type)}
                className="group press-scale"
              >
                <div className="relative rounded-3xl overflow-hidden border border-border/50 bg-card hover:border-border shadow-md hover:shadow-xl transition-all duration-300">
                  <div className={`absolute inset-0 bg-gradient-to-br ${bt.from} ${bt.to} opacity-10 group-hover:opacity-18 transition-opacity`} />
                  <div className="relative p-5 text-center space-y-2">
                    <div className="text-4xl">{bt.emoji}</div>
                    <div className={`text-sm font-bold ${bt.textCls}`}>{bt.label}</div>
                    <div className="text-xs text-muted-foreground">Entdecken</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── WIEN DISTRICTS QUICK-NAV ── */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Entdecke Wien nach Bezirk</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Hyper-lokal — wähle dein Viertel</p>
            </div>
            <Link href="/explore" className="text-xs font-bold text-primary hover:underline press-scale">Alle →</Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {[
              { label: "1. Innere Stadt", tag: "innerestadt", emoji: "🏛️", bg: "from-amber-400 to-orange-500" },
              { label: "2. Leopoldstadt", tag: "leopoldstadt", emoji: "🎡", bg: "from-emerald-400 to-teal-500" },
              { label: "6./7. Neubau", tag: "neubau",         emoji: "🎨", bg: "from-violet-400 to-purple-500" },
              { label: "9. Alsergrund",  tag: "alsergrund",   emoji: "📚", bg: "from-sky-400 to-blue-500" },
              { label: "15. Rudolfsheim",tag: "rudolfsheim",  emoji: "🏘️", bg: "from-rose-400 to-pink-500" },
            ].map((d) => (
              <Link
                key={d.tag}
                href={`/explore?search=${d.tag}`}
                className="group press-scale"
              >
                <div className="relative rounded-2xl overflow-hidden border border-border/40 bg-card shadow-sm hover:shadow-lg transition-all duration-300">
                  <div className={`absolute inset-0 bg-gradient-to-br ${d.bg} opacity-10 group-hover:opacity-20 transition-opacity`} />
                  <div className="relative p-4 text-center space-y-1.5">
                    <div className="text-3xl">{d.emoji}</div>
                    <div className="text-[11px] font-bold text-foreground/80 leading-tight">{d.label}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOR BUSINESS BANNER ── */}
      <section className="py-6 px-4">
        <div className="container mx-auto max-w-6xl">
          <Link href="/for-business" className="block group">
            <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/6 via-background to-accent/6 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/8 p-5 md:p-6">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/8 to-transparent rounded-full blur-2xl pointer-events-none" />
              <div className="relative flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">🏪</div>
                  <div>
                    <div className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">
                      FÜR BETRIEBE
                    </div>
                    <p className="font-extrabold text-foreground text-base md:text-lg leading-tight">
                      Restaurant, Café oder Bar? Wachse mit uns.
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Mehr Gäste · Boost-Sichtbarkeit · Kostenlos starten
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl group-hover:opacity-90 transition-opacity">
                  Mehr erfahren
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ── BOTTOM DISCOVERY CTA ── */}
      <section className="py-10 px-4 mb-4">
        <div className="container mx-auto max-w-6xl">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary via-violet-600 to-accent p-8 md:p-12 text-white text-center shadow-2xl shadow-primary/30">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)] pointer-events-none" />
            <div className="relative z-10">
              <div className="text-5xl mb-4">{config.ctaEmoji}</div>
              <h2 className="text-2xl md:text-3xl font-extrabold mb-3 tracking-tight">{config.ctaTitle}</h2>
              <p className="text-white/75 mb-6 max-w-md mx-auto">{config.ctaSubtitle}</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button asChild size="lg" className="rounded-2xl bg-white text-primary font-bold hover:bg-white/90 shadow-xl press-scale h-12 px-8 border-0">
                  <Link href="/explore">
                    Jetzt entdecken <Compass className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                {customerEmail && allRestaurants && (
                  <InstantPlanButton
                    email={customerEmail}
                    restaurants={allRestaurants}
                    flashDeals={flashDeals}
                    friends={friends}
                    radarZones={radarZones}
                    cues={cues}
                    mode={mode}
                    variant="inline"
                    className="bg-white/20 hover:bg-white/30 border border-white/30 text-white font-bold h-12"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FLOATING ACTION BUTTON ── */}
      {customerEmail && allRestaurants && (
        <InstantPlanButton
          email={customerEmail}
          restaurants={allRestaurants}
          flashDeals={flashDeals}
          friends={friends}
          radarZones={radarZones}
          cues={cues}
          mode={mode}
          variant="fab"
        />
      )}

    </div>
  );
}
