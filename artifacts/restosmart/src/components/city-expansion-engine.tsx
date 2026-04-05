/**
 * City Expansion Engine — Owner Widget
 *
 * Shows the owner their city's health stage, local opportunity signals,
 * and competitive advantage messaging. Adapts to early vs dominant cities.
 */

import { useQuery } from "@tanstack/react-query";
import { MapPin, TrendingUp, Zap, Users, Star, ChevronRight, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface CitySignals {
  city: string;
  stage: "Früh" | "Wachstum" | "Stark" | "Dominant";
  score: number;
  stageColor: string;
  stageEN: string;
  bizCount: number;
  restaurantCount: number;
  cafeCount: number;
  barCount: number;
  avgRating: number;
  activeBoosts: number;
  totalImpressions: number;
  totalCities: number;
  signals: {
    demandLevel: "high" | "medium" | "low";
    competitionLevel: "high" | "medium" | "low";
    opportunityLevel: "high" | "medium" | "low";
    headline: string;
    sub: string;
    earlyAdvantage: string | null;
    isDemandActive: boolean;
  };
}

const STAGE_LABELS: Record<string, string> = {
  Früh:     "Frühe Phase",
  Wachstum: "Wachstum",
  Stark:    "Starke Stadt",
  Dominant: "Dominante Stadt",
};

const LEVEL_LABEL: Record<string, { label: string; color: string }> = {
  high:   { label: "Hoch",    color: "text-rose-400" },
  medium: { label: "Mittel",  color: "text-amber-400" },
  low:    { label: "Niedrig", color: "text-emerald-400" },
};

const OPP_LABEL: Record<string, { label: string; color: string }> = {
  high:   { label: "Hohes Potenzial",  color: "text-emerald-400" },
  medium: { label: "Gutes Potenzial",  color: "text-amber-400" },
  low:    { label: "Gesättigt",        color: "text-[#555]" },
};

interface Props {
  onBoost?:    () => void;
  onUpgrade?:  () => void;
}

export function CityExpansionEngine({ onBoost, onUpgrade }: Props) {
  const city = localStorage.getItem("restosmart_owner_city") ?? "Wien";
  const premium = localStorage.getItem("restosmart_owner_premium");
  const hasPremium = premium === "active" || premium === "trial";

  const query = useQuery<CitySignals>({
    queryKey: ["city-signals", city],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/cities/signals?city=${encodeURIComponent(city)}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 120_000,
  });

  const d = query.data;

  if (query.isLoading) {
    return (
      <div className="rounded-2xl border border-white/6 bg-white/2 p-5 animate-pulse h-32" />
    );
  }
  if (!d) return null;

  const sig = d.signals;
  const isEarlyCity = d.stage === "Früh" || d.stage === "Wachstum";

  const stageColorMap: Record<string, string> = {
    Dominant: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    Stark:    "text-blue-400   bg-blue-500/10   border-blue-500/20",
    Wachstum: "text-amber-400  bg-amber-500/10  border-amber-500/20",
    Früh:     "text-rose-400   bg-rose-500/10   border-rose-500/20",
  };

  const scoreFillColor: Record<string, string> = {
    Dominant: "from-emerald-500 to-teal-500",
    Stark:    "from-blue-500 to-indigo-500",
    Wachstum: "from-amber-500 to-orange-500",
    Früh:     "from-rose-500 to-pink-500",
  };

  return (
    <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">

      {/* Header row */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-white/4">
        <div className="w-7 h-7 rounded-lg bg-white/6 flex items-center justify-center shrink-0">
          <MapPin className="w-3.5 h-3.5 text-[#888]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{d.city}</span>
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full border",
              stageColorMap[d.stage]
            )}>
              {STAGE_LABELS[d.stage]}
            </span>
            {sig.isDemandActive && (
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold animate-pulse">
                NACHFRAGE AKTIV
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#555] mt-0.5">{sig.headline}</p>
        </div>
        {/* City health score pill */}
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold text-white">{d.score}</div>
          <div className="text-[9px] text-[#444] uppercase tracking-widest">City Score</div>
        </div>
      </div>

      {/* Score bar */}
      <div className="px-5 py-2">
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", scoreFillColor[d.stage])}
            style={{ width: `${d.score}%` }}
          />
        </div>
      </div>

      {/* Signal row */}
      <div className="grid grid-cols-3 divide-x divide-white/4 border-t border-white/4">
        {/* Demand */}
        <div className="px-4 py-3 text-center">
          <p className={cn("text-xs font-bold", LEVEL_LABEL[sig.demandLevel].color)}>
            {LEVEL_LABEL[sig.demandLevel].label}
          </p>
          <p className="text-[9px] text-[#444] mt-0.5 uppercase tracking-widest">Nachfrage</p>
        </div>
        {/* Competition */}
        <div className="px-4 py-3 text-center">
          <p className={cn("text-xs font-bold", LEVEL_LABEL[sig.competitionLevel].color)}>
            {LEVEL_LABEL[sig.competitionLevel].label}
          </p>
          <p className="text-[9px] text-[#444] mt-0.5 uppercase tracking-widest">Konkurrenz</p>
        </div>
        {/* Opportunity */}
        <div className="px-4 py-3 text-center">
          <p className={cn("text-xs font-bold", OPP_LABEL[sig.opportunityLevel].color)}>
            {OPP_LABEL[sig.opportunityLevel].label}
          </p>
          <p className="text-[9px] text-[#444] mt-0.5 uppercase tracking-widest">Potenzial</p>
        </div>
      </div>

      {/* City stats row */}
      <div className="flex items-center gap-4 px-5 py-2 border-t border-white/4 text-[11px] text-[#444]">
        <span className="flex items-center gap-1">
          <Globe className="w-3 h-3" />
          {d.bizCount} Betriebe in {d.city}
        </span>
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3" />
          Ø {d.avgRating} Rating
        </span>
        {d.activeBoosts > 0 && (
          <span className="flex items-center gap-1 text-amber-400">
            <Zap className="w-3 h-3" />
            {d.activeBoosts} aktive Boosts
          </span>
        )}
        <span className="ml-auto text-[#333]">{d.totalCities} Städte verfügbar</span>
      </div>

      {/* Early advantage banner — only for early-stage cities */}
      {isEarlyCity && sig.earlyAdvantage && (
        <div className="mx-4 mb-4 mt-1 rounded-xl bg-gradient-to-r from-amber-500/8 to-orange-500/5 border border-amber-500/15 px-4 py-2.5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold text-amber-300">
              Früh dabei — mehr Sichtbarkeit
            </p>
            <p className="text-[10px] text-[#555] mt-0.5">{sig.earlyAdvantage}</p>
          </div>
          <button
            onClick={hasPremium ? onBoost : onUpgrade}
            className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors"
          >
            {hasPremium ? "Boost aktivieren" : "Premium sichern"}
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* CTA for dominant city — keep boosting */}
      {!isEarlyCity && sig.opportunityLevel !== "low" && (
        <div className="mx-4 mb-4 mt-1 rounded-xl bg-white/3 border border-white/6 px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-[11px] text-[#555]">{sig.sub}</p>
          <button
            onClick={onBoost}
            className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-violet-400 hover:text-violet-300 transition-colors"
          >
            Sichtbarkeit erhöhen
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
