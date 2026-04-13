/**
 * competition-engine.tsx
 *
 * Business Competition Engine Widget
 * Shown in the restosmart overview for premium/trial users.
 *
 * Shows:
 *  - Current visibility tier and strength meter
 *  - Real-time competition level (derived from live platform data)
 *  - Demand signal (time-of-day + business-type aware)
 *  - Slot availability in the market
 *  - Recommended action CTA
 */

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, TrendingUp, Eye, BarChart3, AlertTriangle,
  ChevronRight, Flame, Clock, Users, ArrowRight,
  Activity, MapPin, Star, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { getBizType } from "@/lib/biz-copy";
import { track } from "@/lib/conversion-tracking";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompetitionSignals {
  visibility: {
    tier: "top1" | "top3" | "boosted" | "standard";
    label: string;
    score: number;
    desc: string;
    hasOwnBoost: boolean;
    hasPremium: boolean;
  };
  competition: {
    level: "high" | "medium" | "low";
    activeBoosters: number;
    headline: string;
    sub: string;
    totalVenuesInCity: number;
    sameTypeCount: number;
    boostRatio: number;
  };
  demand: {
    level: "high" | "medium" | "low";
    label: string;
    sub: string;
    isActive: boolean;
    peakTimes: string[];
  };
  slots: {
    top3Available: number;
    top3Total: number;
    boostedAvailable: number;
    boostedTotal: number;
  };
  recommendation: {
    action: "boost" | "upgrade" | "maintain" | "none";
    message: string;
    urgency: "high" | "medium" | "low";
  };
  meta: {
    hour: number;
    isWeekend: boolean;
    bizType: string;
    restaurantName: string;
    platformRating: number;
  };
}

// ─── Color helpers ────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  high:   { label: "Hoch",    dot: "bg-rose-500 animate-pulse",   text: "text-rose-500",   bg: "bg-rose-500/10 border-rose-500/20"   },
  medium: { label: "Mittel",  dot: "bg-amber-500 animate-pulse",  text: "text-amber-500",  bg: "bg-amber-500/10 border-amber-500/20"  },
  low:    { label: "Niedrig", dot: "bg-emerald-500",              text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
};

const TIER_CONFIG = {
  top1:     { color: "from-yellow-400 to-amber-500",  width: "100%", label: "Top Position" },
  top3:     { color: "from-violet-500 to-purple-600", width: "82%",  label: "Top 3" },
  boosted:  { color: "from-blue-500 to-cyan-500",     width: "65%",  label: "Boost aktiv" },
  standard: { color: "from-gray-500 to-gray-600",     width: "22%",  label: "Standard" },
};

const URGENCY_CONFIG = {
  high:   { border: "border-rose-500/30",  bg: "bg-rose-500/8",   btn: "bg-gradient-to-r from-rose-500 to-pink-600"   },
  medium: { border: "border-amber-500/30", bg: "bg-amber-500/8",  btn: "bg-gradient-to-r from-amber-500 to-orange-500" },
  low:    { border: "border-white/10",     bg: "bg-white/3",      btn: "bg-gradient-to-r from-primary to-accent"       },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SignalBadge({ level, label }: { level: "high" | "medium" | "low"; label: string }) {
  const cfg = LEVEL_CONFIG[level];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {label}
    </span>
  );
}

function CompetitionRow({ icon: Icon, label, value, sub, highlight = false }: {
  icon: typeof Eye;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${highlight ? "bg-white/5 border border-white/8" : ""}`}>
      <div className="w-7 h-7 rounded-lg bg-white/6 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-[#888]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-[#888] leading-tight">{label}</p>
        {sub && <p className="text-[10px] text-[#555] leading-tight mt-0.5">{sub}</p>}
      </div>
      <span className="text-xs font-bold text-white shrink-0">{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CompetitionEngine({ onBoost, onUpgrade }: {
  onBoost?: () => void;
  onUpgrade?: () => void;
}) {
  const bizType   = getBizType();
  const premium   = localStorage.getItem("restosmart_owner_premium");
  const hasPremium = premium === "active" || premium === "trial";
  const isTrial   = premium === "trial";

  const signalsQuery = useQuery<CompetitionSignals>({
    queryKey: ["competition-signals", bizType, hasPremium],
    queryFn: async () => {
      const params = new URLSearchParams({
        restaurantId:  "1",
        businessType:  bizType,
        hasPremium:    hasPremium ? "true" : "false",
      });
      const r = await fetch(`/api/competition/signals?${params}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime:      60_000,
    refetchInterval: 120_000,
  });

  if (!hasPremium) return null;
  if (signalsQuery.isError) return null;

  const d = signalsQuery.data;

  if (!d) {
    // Skeleton loading state
    return (
      <div className="rounded-2xl border border-white/8 bg-white/2 p-5 animate-pulse">
        <div className="h-4 w-40 bg-white/10 rounded mb-3" />
        <div className="h-2 w-full bg-white/8 rounded mb-2" />
        <div className="h-2 w-3/4 bg-white/6 rounded" />
      </div>
    );
  }

  const tier       = TIER_CONFIG[d.visibility.tier];
  const compCfg    = LEVEL_CONFIG[d.competition.level];
  const demandCfg  = LEVEL_CONFIG[d.demand.level];
  const urgencyCfg = URGENCY_CONFIG[d.recommendation.urgency];

  const handleCTAClick = () => {
    track("upgrade_cta_clicked", { source: "competition_engine", action: d.recommendation.action });
    if (d.recommendation.action === "upgrade" && onUpgrade) {
      onUpgrade();
    } else if (d.recommendation.action === "boost" && onBoost) {
      onBoost();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/6">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#555]">
            Wettbewerbs-Engine
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SignalBadge level={d.competition.level} label={`Konkurrenz: ${compCfg.label}`} />
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* ── Visibility strength bar ──────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white">Deine Sichtbarkeit</span>
            <span className="text-[11px] text-[#555] font-medium">{d.visibility.label}</span>
          </div>
          <div className="h-2 bg-white/6 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: tier.width }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              className={`h-full rounded-full bg-gradient-to-r ${tier.color}`}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-[#444]">Standard</span>
            <span className="text-[10px] text-[#444]">Boost</span>
            <span className="text-[10px] text-[#444]">Top 3</span>
            <span className="text-[10px] text-[#444]">Top #1</span>
          </div>
          <p className="text-[11px] text-[#666] mt-1.5 leading-snug">{d.visibility.desc}</p>
        </div>

        {/* ── 2-column signals grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2.5">

          {/* Demand signal */}
          <div className={`rounded-xl border p-3 ${d.demand.isActive ? "border-amber-500/25 bg-amber-500/6" : "border-white/8 bg-white/2"}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              {d.demand.isActive
                ? <Flame className="w-3.5 h-3.5 text-amber-400" />
                : <Clock className="w-3.5 h-3.5 text-[#555]" />}
              <span className={`text-[10px] font-bold uppercase tracking-wide ${d.demand.isActive ? "text-amber-400" : "text-[#555]"}`}>
                Nachfrage
              </span>
            </div>
            <p className={`text-xs font-semibold leading-tight mb-0.5 ${d.demand.isActive ? "text-white" : "text-[#888]"}`}>
              {d.demand.label}
            </p>
            <SignalBadge level={d.demand.level} label={demandCfg.label} />
          </div>

          {/* Competition signal */}
          <div className={`rounded-xl border p-3 ${d.competition.level === "high" ? "border-rose-500/25 bg-rose-500/5" : "border-white/8 bg-white/2"}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Users className="w-3.5 h-3.5 text-[#666]" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#555]">Konkurrenz</span>
            </div>
            <p className="text-xs font-semibold text-white leading-tight mb-0.5">
              {d.competition.activeBoosters > 0
                ? `${d.competition.activeBoosters} Boost${d.competition.activeBoosters !== 1 ? "s" : ""} aktiv`
                : "Gerade wenig Wettbewerb"}
            </p>
            <p className="text-[10px] text-[#555] leading-tight">{d.competition.sub}</p>
          </div>

        </div>

        {/* ── Competition headline ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/8 bg-white/2 px-3.5 py-2.5 flex items-start gap-3">
          <MapPin className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-white leading-tight">{d.competition.headline}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-[10px] text-[#555]">
                {d.competition.totalVenuesInCity} Betriebe in Wien
              </span>
              {d.slots.top3Available < d.slots.top3Total && (
                <span className="text-[10px] text-amber-400 font-semibold">
                  Noch {d.slots.top3Available} Top-3-Platz{d.slots.top3Available !== 1 ? "e" : ""} frei
                </span>
              )}
              {d.slots.top3Available === d.slots.top3Total && (
                <span className="text-[10px] text-emerald-400 font-semibold">
                  Top-3 verfügbar — jetzt platzieren
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Peak times for this biz type ────────────────────────────────── */}
        <div className="flex items-start gap-2.5">
          <BarChart3 className="w-3.5 h-3.5 text-[#444] mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] text-[#555] mb-1">Beste Sichtbarkeitszeiten für dein Betriebstyp:</p>
            <div className="flex gap-2 flex-wrap">
              {d.demand.peakTimes.map(t => (
                <span key={t} className="text-[10px] font-semibold text-[#888] bg-white/4 border border-white/8 rounded-lg px-2 py-0.5">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recommended action CTA ──────────────────────────────────────── */}
        {d.recommendation.action !== "none" && d.recommendation.action !== "maintain" ? (
          <div className={`rounded-xl border ${urgencyCfg.border} ${urgencyCfg.bg} p-3.5`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {d.recommendation.urgency === "high" && (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <p className="text-xs font-bold text-white leading-tight">
                    {d.recommendation.message}
                  </p>
                </div>
                <p className="text-[10px] text-[#555]">
                  {d.recommendation.action === "boost"
                    ? "Boost aktivieren für mehr Sichtbarkeit in der Nähesuche"
                    : "Mehr Reichweite, Analysen & Boost-Zugang mit Premium"}
                </p>
              </div>
              <div className="shrink-0">
                {d.recommendation.action === "boost" ? (
                  <Link href="/boost">
                    <Button
                      size="sm"
                      className={`h-8 px-3 rounded-xl text-[11px] font-bold text-white border-0 ${urgencyCfg.btn}`}
                      onClick={handleCTAClick}
                    >
                      Boost <Zap className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                ) : (
                  <Link href="/billing">
                    <Button
                      size="sm"
                      className={`h-8 px-3 rounded-xl text-[11px] font-bold text-white border-0 ${urgencyCfg.btn}`}
                      onClick={handleCTAClick}
                    >
                      Premium <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : d.recommendation.action === "maintain" ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/6 px-3.5 py-2.5 flex items-center gap-2.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-emerald-300 leading-tight">{d.recommendation.message}</p>
              <p className="text-[10px] text-emerald-500/80">Deine Sichtbarkeit ist optimal aufgestellt</p>
            </div>
          </div>
        ) : null}

        {/* ── Trial context note ───────────────────────────────────────────── */}
        {isTrial && d.recommendation.action === "boost" && (
          <p className="text-[10px] text-[#444] text-center">
            Boosts sind während der Testphase verfügbar — kein echtes Budget erforderlich
          </p>
        )}

      </div>
    </motion.div>
  );
}
