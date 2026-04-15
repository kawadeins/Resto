import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const FOUNDER_KEY = "rs_founder_2026";

interface VariantRow {
  id: number;
  businessType: string;
  variantKey: string;
  copyText: string;
  isWinner: boolean;
  isRetired: boolean;
  rolloutPct: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  convRate: number;
}

interface InsightsResponse {
  summary: {
    totalVariants: number;
    winners: number;
    retired: number;
    totalImpressions: number;
    totalClicks: number;
    avgCtr: number;
  };
  byElement: Record<string, VariantRow[]>;
  bestPerElement: Record<string, VariantRow>;
}

const ELEMENT_LABELS: Record<string, string> = {
  gate_headline: "Paywall Headline",
  gate_subheadline: "Paywall Subheadline",
  gate_cta: "Paywall CTA",
  expired_headline: "Trial Expired Headline",
  banner_headline: "Trial Banner Headline",
  trial_cta: "Trial Banner CTA",
  proof_focus: "Proof / ROI Card",
};

function fetchInsights(): Promise<InsightsResponse> {
  return fetch(`${API_BASE}/api/variants/insights`, {
    headers: { "x-founder-key": FOUNDER_KEY },
  }).then(r => r.json());
}

function runAutoOptimize(): Promise<{ ok: boolean; actions: string[] }> {
  return fetch(`${API_BASE}/api/variants/auto-optimize`, {
    method: "POST",
    headers: { "x-founder-key": FOUNDER_KEY },
  }).then(r => r.json());
}

function ctrBar(ctr: number, maxCtr: number) {
  const pct = maxCtr > 0 ? Math.round((ctr / maxCtr) * 100) : 0;
  return (
    <div className="h-1.5 bg-white/5 rounded-full mt-1 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function VariantOptimizationPanel() {
  const { t } = useTranslation();
  const [lastActions, setLastActions] = useState<string[]>([]);
  const [autoTriggered, setAutoTriggered] = useState(false);

  const { data, isLoading, refetch } = useQuery<InsightsResponse>({
    queryKey: ["variant-insights"],
    queryFn: fetchInsights,
    refetchInterval: 60_000,
  });

  const { mutate: triggerOptimize, isPending: optimizing } = useMutation({
    mutationFn: runAutoOptimize,
    onSuccess: (res) => {
      setLastActions(res.actions ?? []);
      setAutoTriggered(true);
      refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#444] text-sm">
        {t("optimizer.loading_data")}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-[#444] text-sm py-12">
        {t("optimizer.no_data_panel")}
      </div>
    );
  }

  const { summary, byElement, bestPerElement } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Auto-Conversion Optimization</h2>
          <p className="text-[#555] text-sm mt-1">
            {t("optimizer.ab_system_desc")}
          </p>
        </div>
        <button
          onClick={() => triggerOptimize()}
          disabled={optimizing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-bold hover:bg-violet-600/30 transition-colors disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${optimizing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          {optimizing ? t("variants.optimizing", { defaultValue: "Optimizing…" }) : t("variants.optimize_now", { defaultValue: "Auto-Optimize now" })}
        </button>
      </div>

      {/* Auto-optimize result */}
      {autoTriggered && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-4"
        >
          <p className="text-xs font-bold text-emerald-400 mb-2">
            {lastActions.length === 0
              ? t("variants.no_winners", { defaultValue: "Auto-Optimize: No new winners yet – not enough data." })
              : `Auto-Optimize: ${lastActions.length} Aktion${lastActions.length !== 1 ? "en" : ""} durchgeführt`}
          </p>
          {lastActions.map((a, i) => (
            <p key={i} className="text-xs text-emerald-300/70 font-mono">{a}</p>
          ))}
        </motion.div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t("variants.active_variants", { defaultValue: "Active variants" }), value: summary.totalVariants - summary.retired, sub: t("variants.retired_count", { count: summary.retired, defaultValue: `${summary.retired} retired` }) },
          { label: t("variants.winners", { defaultValue: "Winners declared" }), value: summary.winners, sub: t("variants.auto_detected", { defaultValue: "automatically detected" }) },
          { label: t("variants.total_impressions", { defaultValue: "Total impressions" }), value: summary.totalImpressions.toLocaleString(), sub: t("variants.across_all", { defaultValue: "across all elements" }) },
          { label: t("variants.avg_ctr", { defaultValue: "Avg. CTR" }), value: `${summary.avgCtr}%`, sub: t("variants.ctr_desc", { defaultValue: "Click rate (all variants)" }) },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-white/6 bg-white/3 p-4">
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-[11px] text-[#777] mt-0.5">{s.label}</div>
            <div className="text-[10px] text-[#444] mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Best performers shortlist */}
      {Object.keys(bestPerElement).length > 0 && (
        <div className="rounded-xl border border-amber-700/20 bg-amber-950/10 p-5">
          <h3 className="text-xs font-bold text-amber-400/80 uppercase tracking-widest mb-4">
            Aktuell beste Variante je Element
          </h3>
          <div className="space-y-3">
            {Object.entries(bestPerElement).map(([et, v]) => (
              <div key={et} className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold text-[#555] uppercase tracking-widest">
                    {ELEMENT_LABELS[et] ?? et}
                  </div>
                  <div className="text-sm text-white mt-0.5 leading-snug">"{v.copyText}"</div>
                  <div className="text-[10px] text-[#555] mt-0.5">
                    Variante {v.variantKey} · {v.impressions} Impressionen · {v.ctr}% CTR
                    {v.isWinner && <span className="ml-1 text-emerald-400 font-semibold">{"✓ Gewinner"}{v.rolloutPct < 100 ? ` (${v.rolloutPct}%)` : ""}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-lg font-bold ${v.ctr > 0 ? "text-violet-300" : "text-[#444]"}`}>{v.ctr}%</div>
                  <div className="text-[10px] text-[#555]">CTR</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-element breakdown */}
      <div className="space-y-6">
        {Object.entries(byElement).map(([et, variants]) => {
          const maxCtr = Math.max(...variants.map(v => v.ctr), 0.01);
          const winner = variants.find(v => v.isWinner);
          const hasEnoughData = variants.some(v => v.impressions >= 10);

          return (
            <div key={et} className="rounded-xl border border-white/6 bg-white/2 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">{ELEMENT_LABELS[et] ?? et}</h3>
                {winner && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    Gewinner: Variante {winner.variantKey}{winner.rolloutPct < 100 ? ` (${winner.rolloutPct}% Rollout)` : ""}
                  </span>
                )}
                {!winner && !hasEnoughData && (
                  <span className="text-[10px] text-[#444]">Noch zu wenig Daten</span>
                )}
                {!winner && hasEnoughData && (
                  <span className="text-[10px] font-semibold text-amber-400/70">Auswertung läuft…</span>
                )}
              </div>

              <div className="space-y-3">
                {variants
                  .filter(v => !v.isRetired)
                  .sort((a, b) => b.ctr - a.ctr)
                  .map(v => (
                    <div key={v.id} className={`rounded-lg p-3 ${v.isWinner ? "border border-emerald-600/30 bg-emerald-950/20" : "border border-white/5 bg-white/2"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${v.isWinner ? "bg-emerald-500/20 text-emerald-400" : "bg-white/8 text-[#666]"}`}>
                              {v.variantKey}
                            </span>
                            <span className="text-[10px] text-[#555]">
                              {v.businessType !== "all" ? `(${v.businessType})` : ""}
                            </span>
                          </div>
                          <p className="text-sm text-[#ccc] leading-snug">{v.copyText}</p>
                          {ctrBar(v.ctr, maxCtr)}
                          <div className="flex gap-4 mt-1.5 text-[10px] text-[#555]">
                            <span>{v.impressions} Imp.</span>
                            <span>{v.clicks} Klicks</span>
                            <span>{v.ctr}% CTR</span>
                            {v.conversions > 0 && <span className="text-emerald-400/70">{v.convRate}% Conv.</span>}
                          </div>
                        </div>
                        <div className={`text-xl font-bold shrink-0 ${v.isWinner ? "text-emerald-400" : v.ctr > 0 ? "text-violet-300" : "text-[#333]"}`}>
                          {v.ctr}%
                        </div>
                      </div>
                    </div>
                  ))}

                {/* Retired variants (collapsed) */}
                {variants.filter(v => v.isRetired).length > 0 && (
                  <div className="text-[10px] text-[#333] mt-1">
                    {variants.filter(v => v.isRetired).map(v => (
                      <span key={v.id} className="mr-3 line-through">
                        Variante {v.variantKey}: {v.copyText.slice(0, 30)}…
                      </span>
                    ))}
                    (ausgemustert)
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-white/5 bg-white/2 p-5">
        <h3 className="text-xs font-bold text-[#555] uppercase tracking-widest mb-3">Wie das System funktioniert</h3>
        <div className="space-y-2 text-xs text-[#444] leading-relaxed">
          <p>• Jede Variante bekommt zuerst gleich viele Impressionen (balancierter Zufall).</p>
          <p>• Nach {">"}40 Impressionen vergleicht das System die Klickraten (CTR).</p>
          <p>• Hat eine Variante ≥20% höhere CTR als die anderen, wird sie zum Gewinner erklärt.</p>
          <p>• Der Gewinner wird ab sofort immer ausgeliefert — schwächere Varianten werden ausgemustert.</p>
          <p>• Preislogik, Zahlungsfluss und Kerndesign bleiben unverändert.</p>
        </div>
      </div>
    </div>
  );
}
