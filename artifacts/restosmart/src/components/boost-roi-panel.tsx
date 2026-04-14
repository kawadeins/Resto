/**
 * BoostROIPanel — complete ROI + Profit Tracking System for boost campaigns.
 *
 * Covers: spend tracking, performance metrics, ROI calculation, business-type
 * adaptation, color performance logic, best/worst callouts, smart insights,
 * boost history, period reporting, and premium gating.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, Lightbulb,
  Crown, Lock, ArrowUpRight, ArrowDownRight, Minus,
  CalendarDays, Eye, MousePointer, CalendarCheck, History,
  Zap, Trophy, AlertTriangle, Target, Activity,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const C = {
  card:      "#121826",
  cardAlt:   "#0E1520",
  border:    "rgba(255,255,255,0.06)",
  borderGold:"rgba(245,158,11,0.2)",
  grad:      "linear-gradient(135deg,#8b5cf6,#ec4899)",
  gradGold:  "linear-gradient(135deg,#F59E0B,#f97316)",
  gradGreen: "linear-gradient(135deg,#22C55E,#16A34A)",
  gradRed:   "linear-gradient(135deg,#EF4444,#DC2626)",
  green:     "#22C55E",
  amber:     "#F59E0B",
  red:       "#EF4444",
  blue:      "#a78bfa",
  text:      "#FFFFFF",
  textSoft:  "#E5E7EB",
  muted:     "#9CA3AF",
  shadow:    "0 12px 36px rgba(0,0,0,0.4)",
} as const;

// ── Types ────────────────────────────────────────────────────────────────────

interface ROIBoost {
  id: number;
  type: string;
  label: string;
  emoji: string;
  status: string;
  createdAt: string;
  endsAt: string | null;
  impressions: number;
  clicks: number;
  bookings: number;
  heatExposure: number;
  cost: number;
  estimatedRevenue: number;
  netProfit: number;
  roi: number | null;
  roiTier: "green" | "yellow" | "red" | "neutral";
  costPerClick: number | null;
  costPerBooking: number | null;
  ctr: number | null;
}

interface ROISummary {
  period: string;
  totalSpent: number;
  totalEstReturn: number;
  netProfit: number;
  overallROI: number | null;
  boostCount: number;
  activeCount: number;
  bizType: string;
}

interface ROIInsight {
  icon: string;
  text: string;
  priority: "high" | "medium" | "low";
}

interface ROIData {
  summary: ROISummary;
  boosts: ROIBoost[];
  insights: ROIInsight[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPremiumUser(): boolean {
  const v = localStorage.getItem("restosmart_owner_premium");
  return v === "true" || v === "trial";
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("de-AT", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

function getStatusLabel(s: string, t: (k: string) => string): string {
  return s === "active" ? t("boost.status_active_label") : s === "paused" ? t("boost.status_paused_label") : s === "stopped" ? t("boost.status_stopped_label") : s;
}
function statusColor(s: string) {
  return s === "active" ? C.green : s === "paused" ? C.amber : C.muted;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ROIBadge({ roi, tier }: { roi: number | null; tier: string }) {
  if (roi === null) return <span style={{ color: C.muted, fontSize: 11 }}>—</span>;
  const color  = tier === "green" ? C.green : tier === "yellow" ? C.amber : C.red;
  const bg     = tier === "green" ? "rgba(34,197,94,0.1)" : tier === "yellow" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";
  const border = tier === "green" ? "rgba(34,197,94,0.22)" : tier === "yellow" ? "rgba(245,158,11,0.22)" : "rgba(239,68,68,0.22)";
  const Icon   = roi > 0 ? ArrowUpRight : roi < 0 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-0.5 font-bold px-2 py-0.5 rounded-full"
      style={{ color, backgroundColor: bg, border: `1px solid ${border}`, fontSize: 11 }}>
      <Icon style={{ width: 10, height: 10 }} />
      {roi > 0 ? "+" : ""}{roi}%
    </span>
  );
}

function MetricPill({ value, color = C.muted }: { value: string; color?: string }) {
  return <span style={{ color, fontWeight: 600, fontSize: 12, tabularNums: true } as any}>{value}</span>;
}

function SummaryTile({
  label, value, sub, color, icon: Icon, highlight = false,
}: {
  label: string; value: string; sub?: string;
  color?: string; icon?: React.ElementType; highlight?: boolean;
}) {
  return (
    <div style={{
      borderRadius: 14, padding: 16,
      backgroundColor: highlight ? "rgba(245,158,11,0.05)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${highlight ? C.borderGold : C.border}`,
      transition: "border-color 0.2s",
    }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon style={{ width: 11, height: 11, color: C.muted }} />}
        <span className="font-semibold uppercase tracking-wider" style={{ color: C.muted, fontSize: 10 }}>{label}</span>
      </div>
      <div className="font-extrabold tabular-nums leading-none" style={{ color: color ?? C.text, fontSize: 20 }}>{value}</div>
      {sub && <div className="mt-1.5" style={{ color: C.muted, fontSize: 11 }}>{sub}</div>}
    </div>
  );
}

function BestWorstCallout({ boosts }: { boosts: ROIBoost[] }) {
  const { t } = useTranslation();
  const withROI = boosts.filter(b => b.roi !== null && b.cost > 0);
  if (withROI.length < 2) return null;

  const best  = withROI.reduce((a, b) => a.roi! > b.roi! ? a : b);
  const worst = withROI.reduce((a, b) => a.roi! < b.roi! ? a : b);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Best */}
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
        <div className="flex items-center justify-center rounded-xl shrink-0"
          style={{ width: 36, height: 36, background: "rgba(34,197,94,0.15)" }}>
          <Trophy style={{ width: 16, height: 16, color: C.green }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 10, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("boost.best_boost", { defaultValue: "Best Boost" })}</span>
          </div>
          <div className="font-semibold truncate" style={{ color: C.text, fontSize: 13 }}>
            {best.emoji} {best.label}
          </div>
          <div style={{ color: C.muted, fontSize: 11 }}>
            ROI {best.roi! > 0 ? "+" : ""}{best.roi}% · €{best.cost.toFixed(2)} ausgegeben
          </div>
        </div>
      </div>

      {/* Worst */}
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.16)" }}>
        <div className="flex items-center justify-center rounded-xl shrink-0"
          style={{ width: 36, height: 36, background: "rgba(239,68,68,0.12)" }}>
          <AlertTriangle style={{ width: 16, height: 16, color: C.red }} />
        </div>
        <div className="min-w-0">
          <div style={{ fontSize: 10, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("boost.worst_boost", { defaultValue: "Weakest Boost" })}</div>
          <div className="font-semibold truncate" style={{ color: C.text, fontSize: 13 }}>
            {worst.emoji} {worst.label}
          </div>
          <div style={{ color: C.muted, fontSize: 11 }}>
            ROI {worst.roi! > 0 ? "+" : ""}{worst.roi}% · €{worst.cost.toFixed(2)} ausgegeben
          </div>
        </div>
      </div>
    </div>
  );
}

function PremiumGate({ onUpgrade }: { onUpgrade: () => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", minHeight: 140 }}>
      <div style={{ filter: "blur(3px)", opacity: 0.3, pointerEvents: "none", userSelect: "none", padding: "12px 0" }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-9 rounded-xl mb-2 animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.07)" }} />
        ))}
      </div>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
        background: "rgba(18,24,38,0.75)", backdropFilter: "blur(2px)",
      }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: C.gradGold }} className="flex items-center justify-center">
          <Lock style={{ width: 18, height: 18, color: "#fff" }} />
        </div>
        <div className="text-center px-6">
          <div className="font-bold mb-1" style={{ color: C.text, fontSize: 14 }}>{t("paywall.premium_feature", { defaultValue: "Premium Feature" })}</div>
          <div style={{ color: C.muted, fontSize: 12 }}>
            {t("paywall.premium_feature_desc", { defaultValue: "Smart Insights and detailed reports are available for Premium users only." })}
          </div>
        </div>
        <motion.button
          whileHover={{ boxShadow: "0 0 22px rgba(245,158,11,0.45)" }}
          whileTap={{ scale: 0.97 }}
          onClick={onUpgrade}
          style={{
            background: C.gradGold, border: "none", borderRadius: 10,
            padding: "9px 20px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <Crown style={{ width: 13, height: 13 }} />
          Jetzt upgraden
        </motion.button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type StatusFilter = "all" | "active" | "closed";

export function BoostROIPanel() {
  const { t } = useTranslation();
  const [period, setPeriod]           = useState<"week" | "month">("month");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showHistory, setShowHistory] = useState(false);
  const isPremium = isPremiumUser();

  // Resolve restaurantId from /promotions/my
  const { data: myData } = useQuery<{ restaurantId: number | null }>({
    queryKey: ["promotions-my"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/promotions/my`);
      if (!res.ok) return { restaurantId: null };
      return res.json();
    },
    staleTime: 60000,
  });
  const restaurantId = myData?.restaurantId ?? null;

  const { data, isLoading } = useQuery<ROIData>({
    queryKey: ["boost-roi", restaurantId, period],
    queryFn: async () => {
      if (!restaurantId) return {
        summary: { period, totalSpent: 0, totalEstReturn: 0, netProfit: 0, overallROI: null, boostCount: 0, activeCount: 0, bizType: "restaurant" },
        boosts: [], insights: [],
      };
      const res = await fetch(`${API_BASE}/api/promotions/roi?restaurantId=${restaurantId}&period=${period}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!restaurantId,
    staleTime: 60000,
  });

  // ── Loading skeleton ──
  if (isLoading) return (
    <div style={{ backgroundColor: C.card, borderRadius: 20, border: `1px solid ${C.border}`, padding: 24, boxShadow: C.shadow }}>
      <div className="flex items-center gap-3 mb-5">
        <div style={{ background: C.gradGold, borderRadius: 12, width: 40, height: 40 }} className="flex items-center justify-center">
          <TrendingUp style={{ width: 17, height: 17, color: "#fff" }} />
        </div>
        <div className="h-5 w-56 rounded animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.07)" }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />)}
      </div>
      <div className="h-48 rounded-2xl animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
    </div>
  );

  if (!data || data.boosts.length === 0) return null;

  const { summary, boosts, insights } = data;

  // Apply status filter
  const filteredBoosts = boosts.filter(b => {
    if (statusFilter === "active")  return b.status === "active";
    if (statusFilter === "closed")  return b.status === "stopped" || b.status === "paused";
    return true;
  });

  const profitColor = summary.netProfit > 0 ? C.green : summary.netProfit < 0 ? C.red : C.muted;

  // Best performer for table highlight
  const withROI = boosts.filter(b => b.roi !== null && b.cost > 0);
  const bestId  = withROI.length > 0 ? withROI.reduce((a, b) => a.roi! > b.roi! ? a : b).id : null;
  const worstId = withROI.length > 0 ? withROI.reduce((a, b) => a.roi! < b.roi! ? a : b).id : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ backgroundColor: C.card, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: "24px 24px 0" }} className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div style={{
            background: C.gradGold, borderRadius: 13, width: 44, height: 44, flexShrink: 0,
            boxShadow: "0 4px 16px rgba(245,158,11,0.3)",
          }} className="flex items-center justify-center">
            <DollarSign style={{ width: 20, height: 20, color: "#fff" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold" style={{ color: C.text }}>ROI & Gewinn-Tracking</span>
              <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full"
                style={{ color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 10 }}>
                <Crown style={{ width: 9, height: 9 }} /> Premium
              </span>
            </div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
              Echte Kosten · gemessene Performance · geschätzter Umsatz
            </div>
          </div>
        </div>

        {/* Period + History toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-xl"
            style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}` }}>
            {(["week", "month"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: "5px 12px", borderRadius: 8, border: "none",
                background: period === p ? C.grad : "transparent",
                color: period === p ? "#fff" : C.muted,
                fontWeight: 600, fontSize: 12, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <CalendarDays style={{ width: 11, height: 11 }} />
                {p === "week" ? t("boost.period_7d", { defaultValue: "7 days" }) : t("boost.period_30d", { defaultValue: "30 days" })}
              </button>
            ))}
          </div>

          <button onClick={() => setShowHistory(h => !h)}
            style={{
              padding: "5px 12px", borderRadius: 10, border: `1px solid ${C.border}`,
              background: showHistory ? "rgba(123,140,255,0.15)" : "rgba(255,255,255,0.04)",
              color: showHistory ? C.blue : C.muted,
              fontWeight: 600, fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5,
            }}>
            <History style={{ width: 11, height: 11 }} />
            {t("boost.history", { defaultValue: "History" })}
          </button>
        </div>
      </div>

      <div style={{ padding: "0 24px 28px" }} className="space-y-5">

        {/* ── Summary Tiles ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryTile
            label={t("boost.roi_total_spent")}
            value={`€${summary.totalSpent.toFixed(2)}`}
            sub={`${summary.boostCount} Boost${summary.boostCount !== 1 ? "s" : ""} · ${summary.activeCount} ${t("common.active", { defaultValue: "active" })}`}
            icon={Zap}
          />
          <SummaryTile
            label={t("boost.roi_est_return")}
            value={`€${summary.totalEstReturn.toFixed(2)}`}
            sub={t("boost.stat_clicks") + " + " + t("boost.stat_bookings")}
            color={C.blue}
            icon={Target}
          />
          <SummaryTile
            label={t("boost.roi_net_profit")}
            value={`${summary.netProfit >= 0 ? "+" : ""}€${Math.abs(summary.netProfit).toFixed(2)}`}
            sub={summary.netProfit >= 0 ? t("common.positive", { defaultValue: "Positive" }) : t("common.loss", { defaultValue: "Loss" })}
            color={profitColor}
            icon={summary.netProfit >= 0 ? TrendingUp : TrendingDown}
          />
          <SummaryTile
            label={t("boost.roi_overall")}
            value={summary.overallROI !== null ? `${summary.overallROI > 0 ? "+" : ""}${summary.overallROI}%` : "—"}
            sub={summary.overallROI !== null && summary.overallROI > 0 ? t("common.profitable", { defaultValue: "Profitable" }) : summary.overallROI !== null ? t("common.negative", { defaultValue: "In deficit" }) : t("boost.roi_no_data")}
            color={summary.overallROI !== null ? (summary.overallROI > 0 ? C.green : C.red) : C.muted}
            icon={Activity}
            highlight={summary.overallROI !== null && summary.overallROI > 100}
          />
        </div>

        {/* ── Best / Worst Callout ─────────────────────────────────────────── */}
        <BestWorstCallout boosts={boosts} />

        {/* ── Boost Table ─────────────────────────────────────────────────── */}
        <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          {/* Table header + status filter */}
          <div className="flex items-center justify-between px-4 py-2.5 flex-wrap gap-2"
            style={{ backgroundColor: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Boost-Analyse
            </span>
            <div className="flex items-center gap-1">
              {(["all", "active", "closed"] as const).map(f => (
                <button key={f} onClick={() => setStatusFilter(f)}
                  style={{
                    padding: "3px 10px", borderRadius: 7, border: "none",
                    background: statusFilter === f ? C.grad : "transparent",
                    color: statusFilter === f ? "#fff" : C.muted,
                    fontWeight: 600, fontSize: 11, cursor: "pointer",
                  }}>
                  {f === "all" ? t("common.all") : f === "active" ? t("boost.status_active_label") : t("campaigns.status_completed")}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {[t("boost.title"), t("boost.roi_total_spent"), t("boost.impressions_short"), t("boost.clicks_short") + " / CTR", t("boost.stat_bookings"), t("boost.roi_est_return"), "ROI"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap" style={{ color: C.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredBoosts.map((b, i) => {
                    const isBest  = b.id === bestId;
                    const isWorst = b.id === worstId;
                    const rowBg   = isBest ? "rgba(34,197,94,0.04)" : isWorst ? "rgba(239,68,68,0.03)" : undefined;
                    return (
                      <motion.tr
                        key={b.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.04 }}
                        style={{
                          borderTop: `1px solid ${C.border}`,
                          backgroundColor: rowBg,
                        }}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Boost name */}
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: C.text }}>
                          <div className="flex items-center gap-2">
                            <span>{b.emoji}</span>
                            <div>
                              <div className="font-medium flex items-center gap-1.5">
                                {b.label}
                                {isBest  && <span style={{ fontSize: 9, fontWeight: 800, color: C.green, background: "rgba(34,197,94,0.12)", borderRadius: 4, padding: "1px 5px" }}>BEST</span>}
                                {isWorst && <span style={{ fontSize: 9, fontWeight: 800, color: C.red,   background: "rgba(239,68,68,0.1)",  borderRadius: 4, padding: "1px 5px" }}>WEAK</span>}
                              </div>
                              {showHistory && (
                                <div style={{ color: C.muted, fontSize: 10 }}>{fmtDate(b.createdAt)}</div>
                              )}
                            </div>
                          </div>
                          <div className="mt-0.5">
                            <span style={{ fontSize: 10, color: statusColor(b.status), fontWeight: 600 }}>
                              {getStatusLabel(b.status, t)}
                            </span>
                          </div>
                        </td>

                        {/* Cost + CPC */}
                        <td className="px-4 py-3" style={{ color: C.amber }}>
                          <div className="font-semibold tabular-nums">
                            {b.cost > 0 ? `€${b.cost.toFixed(2)}` : "—"}
                          </div>
                          {b.costPerClick !== null && b.cost > 0 && (
                            <div style={{ color: C.muted, fontSize: 10, marginTop: 1 }}>
                              €{b.costPerClick.toFixed(2)}/Klick
                            </div>
                          )}
                          {b.costPerBooking !== null && b.cost > 0 && (
                            <div style={{ color: C.muted, fontSize: 10 }}>
                              €{b.costPerBooking.toFixed(2)}/Buch.
                            </div>
                          )}
                        </td>

                        {/* Impressions */}
                        <td className="px-4 py-3 tabular-nums" style={{ color: C.muted }}>
                          <span className="inline-flex items-center gap-1">
                            <Eye style={{ width: 10, height: 10 }} />
                            {b.impressions.toLocaleString("de")}
                          </span>
                        </td>

                        {/* Clicks + CTR */}
                        <td className="px-4 py-3 tabular-nums">
                          <div className="inline-flex items-center gap-1" style={{ color: C.muted }}>
                            <MousePointer style={{ width: 10, height: 10 }} />
                            {b.clicks.toLocaleString("de")}
                          </div>
                          {b.ctr !== null && b.clicks > 0 && (
                            <div style={{ color: C.blue, fontSize: 10, marginTop: 1 }}>{b.ctr}% CTR</div>
                          )}
                        </td>

                        {/* Bookings */}
                        <td className="px-4 py-3 tabular-nums">
                          <span className="inline-flex items-center gap-1" style={{ color: b.bookings > 0 ? C.green : C.muted }}>
                            <CalendarCheck style={{ width: 10, height: 10 }} />
                            {b.bookings}
                          </span>
                        </td>

                        {/* Estimated revenue */}
                        <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: C.blue }}>
                          {b.estimatedRevenue > 0 ? `€${b.estimatedRevenue.toFixed(2)}` : "—"}
                          {b.estimatedRevenue > 0 && (
                            <div style={{ color: C.muted, fontSize: 10, fontWeight: 400, marginTop: 1 }}>{t("boost.estimate", { defaultValue: "Estimate" })}</div>
                          )}
                        </td>

                        {/* ROI */}
                        <td className="px-4 py-3">
                          <ROIBadge roi={b.roi} tier={b.roiTier} />
                          {b.roi !== null && (
                            <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>
                              {b.roi > 150 ? t("boost.roi_strong", { defaultValue: "Strong" }) : b.roi > 0 ? t("boost.roi_medium", { defaultValue: "Medium" }) : t("boost.roi_weak", { defaultValue: "Weak" })}
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>

                {filteredBoosts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center" style={{ color: C.muted, fontSize: 13 }}>
                      Keine Boosts für diesen Filter gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="px-4 py-2.5" style={{ borderTop: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.01)" }}>
            <p style={{ color: C.muted, fontSize: 10 }}>
              Umsatzschätzung basiert auf Klick- und Buchungswerten für Ihren Betriebstyp (Wien-Durchschnitt). ROI = (Schätz. Umsatz − Kosten) / Kosten × 100. Alle Werte sind Schätzungen und kein Umsatzversprechen.
            </p>
          </div>
        </div>

        {/* ── Smart Insights ───────────────────────────────────────────────── */}
        <div style={{ borderRadius: 16, border: `1px solid ${C.borderGold}`, backgroundColor: "rgba(245,158,11,0.03)", padding: 20 }}>
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb style={{ width: 16, height: 16, color: C.amber }} />
            <span className="font-semibold" style={{ color: C.text, fontSize: 14 }}>{t("boost.smart_insights", { defaultValue: "Smart Insights" })}</span>
            <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full ml-auto"
              style={{ color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 10 }}>
              <Crown style={{ width: 9, height: 9 }} /> Nur Premium
            </span>
          </div>

          {isPremium ? (
            <div className="space-y-2.5">
              {insights.map((ins, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-start gap-3 rounded-xl px-3 py-3"
                  style={{
                    backgroundColor:
                      ins.priority === "high"   ? "rgba(239,68,68,0.06)" :
                      ins.priority === "medium" ? "rgba(245,158,11,0.05)" :
                                                  "rgba(255,255,255,0.03)",
                    border:
                      ins.priority === "high"   ? "1px solid rgba(239,68,68,0.18)" :
                      ins.priority === "medium" ? "1px solid rgba(245,158,11,0.18)" :
                                                  `1px solid ${C.border}`,
                  }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>{ins.icon}</span>
                  <p style={{ color: C.textSoft, fontSize: 12, lineHeight: 1.6 }}>{ins.text}</p>
                  {ins.priority === "high" && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: C.red, background: "rgba(239,68,68,0.1)", borderRadius: 4, padding: "2px 6px", flexShrink: 0, alignSelf: "flex-start", marginTop: 1 }}>
                      WICHTIG
                    </span>
                  )}
                </motion.div>
              ))}
              {insights.length === 0 && (
                <p style={{ color: C.muted, fontSize: 12 }}>
                  Noch keine Insights verfügbar — aktivieren Sie Boosts, um Daten zu sammeln.
                </p>
              )}
            </div>
          ) : (
            <PremiumGate onUpgrade={() => { window.location.href = "/billing"; }} />
          )}
        </div>

        {/* ── Period note ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: "rgba(79,140,255,0.05)", border: "1px solid rgba(79,140,255,0.13)", color: C.muted }}>
          <BarChart3 style={{ width: 13, height: 13, color: C.blue, flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11, lineHeight: 1.5 }}>
            {t("boost.roi_title") + ": "}<strong style={{ color: C.text }}>{period === "week" ? t("boost.roi_period_week") : t("boost.roi_period_month")}</strong> —{" "}
            {summary.boostCount} Kampagne{summary.boostCount !== 1 ? "n" : ""} analysiert.
            Schätzwerte basieren auf Branchendurchschnittswerten für Wien und sind keine Umsatzgarantie.
          </span>
        </div>

      </div>
    </motion.div>
  );
}
