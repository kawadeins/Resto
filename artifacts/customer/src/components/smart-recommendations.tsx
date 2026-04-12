/**
 * SmartRecommendationsSection
 * Shows personalized restaurant recommendations based on real user signals.
 * Falls back to top-rated places for new users.
 */
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Sparkles, Star, ChevronRight, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const GRAD = "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Recommendation {
  id: number;
  name: string;
  cuisine: string;
  cuisine_emoji: string;
  rating: number | string;
  price_range: number;
  hero_image: string | null;
  address: string;
  tags: string[];
  is_featured: boolean;
  score: number;
  reason: string;
  category: string;
}

interface TasteProfile {
  topCuisine: string | null;
  topCuisineDE: string | null;
  identity: { label: string; emoji: string } | null;
  signalCount: number;
}

interface RecommendationsResponse {
  recommendations: Recommendation[];
  hasPersonal: boolean;
  tasteProfile: TasteProfile;
}

// ── Rating stars ──────────────────────────────────────────────────────────────
function Stars({ rating }: { rating: number | string }) {
  const r = parseFloat(String(rating));
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className={`w-3 h-3 ${i < full ? "text-amber-400" : i === full && half ? "text-amber-300" : "text-muted-foreground/25"}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-[11px] font-bold text-muted-foreground ml-1">{parseFloat(String(rating)).toFixed(1)}</span>
    </span>
  );
}

// ── Price dots ────────────────────────────────────────────────────────────────
function PriceRange({ level }: { level: number }) {
  return (
    <span className="text-[11px] font-semibold text-muted-foreground">
      {"€".repeat(level)}{"€".repeat(Math.max(0, 3 - level)).replace(/€/g, "·")}
    </span>
  );
}

// ── Single recommendation card ────────────────────────────────────────────────
function RecoCard({ rec }: { rec: Recommendation }) {
  const imgSrc = rec.hero_image?.startsWith("/api")
    ? `${API_BASE}${rec.hero_image}`
    : rec.hero_image ?? null;

  return (
    <Link href={`/restaurant/${rec.id}`}>
      <div
        className="group relative flex flex-col overflow-hidden rounded-3xl bg-card border border-border/50 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer w-[220px] shrink-0 active:scale-[0.97]"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
      >
        {/* ── Image / fallback ── */}
        <div className="relative h-[130px] overflow-hidden bg-muted/40">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={rec.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-5xl"
              style={{ background: "linear-gradient(135deg,hsl(263,70%,52%,0.12),hsl(330,85%,58%,0.12))" }}
            >
              {rec.cuisine_emoji}
            </div>
          )}
          {/* Category pill */}
          <div className="absolute top-2 left-2">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-extrabold text-white px-2.5 py-1 rounded-full shadow-lg"
              style={{ background: GRAD }}
            >
              <Sparkles className="w-2.5 h-2.5" />
              {rec.category}
            </span>
          </div>
          {/* Featured badge */}
          {rec.is_featured && (
            <div className="absolute top-2 right-2">
              <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                ⭐ Empfohlen
              </span>
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div className="p-3.5 flex flex-col gap-2 flex-1">
          <div className="flex items-start justify-between gap-1">
            <p className="font-bold text-sm leading-tight line-clamp-1 flex-1">{rec.name}</p>
            <span className="text-lg leading-none shrink-0">{rec.cuisine_emoji}</span>
          </div>

          <div className="flex items-center gap-2">
            <Stars rating={rec.rating} />
            <PriceRange level={rec.price_range} />
          </div>

          {/* Reason chip */}
          <div
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full line-clamp-1 text-center"
            style={{
              background: "hsl(263 70% 52% / 0.09)",
              color: "hsl(263, 70%, 48%)",
            }}
          >
            {rec.reason}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Loading skeletons ─────────────────────────────────────────────────────────
function RecoSkeleton() {
  return (
    <div className="w-[220px] shrink-0 rounded-3xl overflow-hidden border border-border/40">
      <Skeleton className="h-[130px] w-full" />
      <div className="p-3.5 space-y-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-6 w-full rounded-full" />
      </div>
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────
export function SmartRecommendationsSection({ email }: { email: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<RecommendationsResponse>({
    queryKey: ["recommendations", email],
    queryFn: () =>
      fetch(`${API_BASE}/api/recommendations/${encodeURIComponent(email)}`, { credentials: "include" })
        .then(r => r.json()),
    enabled: !!email,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const recs = data?.recommendations ?? [];
  const taste = data?.tasteProfile;
  const hasPersonal = data?.hasPersonal ?? false;

  // Don't render if nothing to show and not loading
  if (!isLoading && recs.length === 0) return null;

  // Subtitle based on taste profile
  const subtitle = taste?.identity
    ? `${taste.identity.emoji} Du bist ein ${taste.identity.label} — hier sind deine Empfehlungen`
    : hasPersonal
      ? "Basierend auf deiner Aktivität in RestoSmart"
      : "Beliebte Orte in Wien – perfekt für deinen ersten Besuch";

  return (
    <section className="py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* ── Section header ── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
              style={{ background: GRAD }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                {hasPersonal ? "Für dich" : "Beliebt in Wien"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xs leading-snug">{subtitle}</p>
            </div>
          </div>
          <Link href="/explore" className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5 shrink-0">
            Alle <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* ── Scrollable card row ── */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory"
          style={{ scrollPaddingLeft: 0 }}
        >
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <RecoSkeleton key={i} />)
            : recs.map(rec => (
                <div key={rec.id} className="snap-start">
                  <RecoCard rec={rec} />
                </div>
              ))
          }
        </div>

        {/* ── Taste profile footer (only when personal) ── */}
        {!isLoading && hasPersonal && taste?.topCuisineDE && (
          <div className="mt-4 flex items-center gap-2">
            <div
              className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border"
              style={{
                background: "hsl(263 70% 52% / 0.06)",
                borderColor: "hsl(263 70% 52% / 0.2)",
                color: "hsl(263, 70%, 48%)",
              }}
            >
              <Sparkles className="w-3 h-3" />
              {"Dein Geschmack: "}{taste.topCuisineDE}
              {taste.identity && ` · ${taste.identity.label}`}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {"Basierend auf "}{taste.signalCount}{"+ Interaktionen"}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
