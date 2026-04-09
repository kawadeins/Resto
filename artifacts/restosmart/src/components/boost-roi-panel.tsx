/**
 * BoostROIPanel — premium ROI + profit tracking for boost campaigns.
 * Shows per-boost cost/return/ROI, spend summary, and AI-like smart insights.
 * ROI insights and weekly/monthly breakdown are premium-only.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, DollarSign, BarChart3, Lightbulb,
  Crown, Lock, ArrowUpRight, ArrowDownRight, Minus,
  CalendarDays, Eye, MousePointer, CalendarCheck,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const C = {
  card:   "#121826",
  border: "rgba(255,255,255,0.06)",
  grad:   "linear-gradient(135deg,#4F8CFF,#7B5CFF)",
  gradGold: "linear-gradient(135deg,#F59E0B,#f97316)",
  green:  "#22C55E",
  amber:  "#F59E0B",
  red:    "#EF4444",
  text:   "#FFFFFF",
  muted:  "#9CA3AF",
  shadow: "0 10px 30px rgba(0,0,0,0.35)",
} as const;

interface ROIBoost {
  id: number;
  type: string;
  label: string;
  emoji: string;
  status: string;
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

function isPremiumUser(): boolean {
  const v = localStorage.getItem("restosmart_owner_premium");
  return v === "true" || v === "trial";
}

function ROIBadge({ roi, tier }: { roi: number | null; tier: string }) {
  if (roi === null) return (
    <span className="text-[11px]" style={{ color: C.muted }}>—</span>
  );
  const color = tier === "green" ? C.green : tier === "yellow" ? C.amber : C.red;
  const bg    = tier === "green" ? "rgba(34,197,94,0.1)" : tier === "yellow" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";
  const border= tier === "green" ? "rgba(34,197,94,0.25)" : tier === "yellow" ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.25)";
  const Icon  = tier === "green" ? ArrowUpRight : tier === "red" ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
      style={{ color, backgroundColor: bg, border: `1px solid ${border}` }}>
      <Icon style={{ width: 10, height: 10 }} />
      {roi > 0 ? "+" : ""}{roi}%
    </span>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ borderRadius: 14, border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.02)", padding: 16 }}>
      <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: C.muted }}>{label}</div>
      <div className="text-xl font-extrabold tabular-nums leading-none" style={{ color: color ?? C.text }}>{value}</div>
      {sub && <div className="text-[11px] mt-1.5" style={{ color: C.muted }}>{sub}</div>}
    </div>
  );
}

function PremiumGate({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ filter: "blur(4px)", opacity: 0.35, pointerEvents: "none", userSelect: "none" }}>
        <div className="space-y-3 p-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
          ))}
        </div>
      </div>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
        background: "rgba(18,24,38,0.7)", backdropFilter: "blur(2px)",
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: C.gradGold }} className="flex items-center justify-center shadow-lg">
          <Lock style={{ width: 20, height: 20, color: "#fff" }} />
        </div>
        <div className="text-center px-4">
          <div className="font-bold text-sm mb-1" style={{ color: C.text }}>Premium-Funktion</div>
          <div className="text-xs" style={{ color: C.muted }}>Smart Insights und detaillierte Reports sind nur für Premium-Nutzer verfügbar.</div>
        </div>
        <motion.button
          whileHover={{ boxShadow: "0 0 22px rgba(245,158,11,0.4)" }}
          whileTap={{ scale: 0.97 }}
          onClick={onUpgrade}
          style={{ background: C.gradGold, border: "none", borderRadius: 10, padding: "10px 20px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          <Crown style={{ width: 14, height: 14, display: "inline", marginRight: 6, verticalAlign: "middle" }} />
          Jetzt upgraden
        </motion.button>
      </div>
    </div>
  );
}

export function BoostROIPanel() {
  const [period, setPeriod] = useState<"week" | "month">("month");
  const isPremium = isPremiumUser();

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
      if (!restaurantId) return { summary: { period, totalSpent: 0, totalEstReturn: 0, netProfit: 0, overallROI: null, boostCount: 0, activeCount: 0, bizType: "restaurant" }, boosts: [], insights: [] };
      const res = await fetch(`${API_BASE}/api/promotions/roi?restaurantId=${restaurantId}&period=${period}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!restaurantId,
    staleTime: 60000,
  });

  if (isLoading) return (
    <div style={{ backgroundColor: C.card, borderRadius: 20, border: `1px solid ${C.border}`, padding: 24, boxShadow: C.shadow }}>
      <div className="flex items-center gap-3 mb-5">
        <div style={{ background: C.gradGold, borderRadius: 12, width: 38, height: 38 }} className="flex items-center justify-center">
          <TrendingUp style={{ width: 16, height: 16, color: "#fff" }} />
        </div>
        <div className="h-5 w-52 rounded animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.07)" }} />
      </div>
      <div className="h-40 rounded-2xl animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
    </div>
  );

  if (!data || data.boosts.length === 0) return null;

  const { summary, boosts, insights } = data;
  const profitColor = summary.netProfit > 0 ? C.green : summary.netProfit < 0 ? C.red : C.muted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ backgroundColor: C.card, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}
    >
      {/* ── Header ── */}
      <div style={{ padding: "24px 24px 16px" }} className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div style={{ background: C.gradGold, borderRadius: 12, width: 40, height: 40, boxShadow: "0 4px 14px rgba(245,158,11,0.3)", flexShrink: 0 }} className="flex items-center justify-center">
            <DollarSign style={{ width: 18, height: 18, color: "#fff" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold" style={{ color: C.text }}>ROI & Gewinn-Tracking</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
                <Crown style={{ width: 9, height: 9 }} /> Premium
              </span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: C.muted }}>Echte Kosten vs. Schätzung des generierten Umsatzes</div>
          </div>
        </div>

        {/* Period switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}` }}>
          {(["week", "month"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "5px 12px", borderRadius: 8, border: "none",
                background: period === p ? C.grad : "transparent",
                color: period === p ? "#fff" : C.muted,
                fontWeight: 600, fontSize: 12, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <CalendarDays style={{ width: 11, height: 11 }} />
              {p === "week" ? "7 Tage" : "30 Tage"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 24px 24px" }} className="space-y-5">

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="Ausgegeben"
            value={`€${summary.totalSpent.toFixed(2)}`}
            sub={`${summary.boostCount} Boost${summary.boostCount !== 1 ? "s" : ""}`}
          />
          <SummaryCard
            label="Geschätzter Umsatz"
            value={`€${summary.totalEstReturn.toFixed(2)}`}
            sub="Klicks + Buchungen"
            color="#7B8CFF"
          />
          <SummaryCard
            label="Nettogewinn"
            value={`${summary.netProfit >= 0 ? "+" : ""}€${summary.netProfit.toFixed(2)}`}
            sub="Umsatz minus Kosten"
            color={profitColor}
          />
          <SummaryCard
            label="Gesamt-ROI"
            value={summary.overallROI !== null ? `${summary.overallROI > 0 ? "+" : ""}${summary.overallROI}%` : "—"}
            sub={summary.overallROI !== null && summary.overallROI > 0 ? "Rentabel" : "Noch kein Gewinn"}
            color={summary.overallROI !== null && summary.overallROI > 0 ? C.green : C.muted}
          />
        </div>

        {/* ── Per-boost ROI Table ── */}
        <div style={{ borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div className="px-4 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${C.border}` }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
              Boost-Analyse
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Boost", "Kosten", "Einbl.", "Klicks", "Buch.", "Ges. Umsatz", "ROI"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap" style={{ color: C.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {boosts.map((b, i) => (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    style={{ borderTop: i > 0 ? `1px solid ${C.border}` : undefined }}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: C.text }}>
                      <span className="mr-1.5">{b.emoji}</span>{b.label}
                      {b.status === "active" && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ color: C.green, backgroundColor: "rgba(34,197,94,0.1)" }}>
                          <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: C.green }} />
                          Aktiv
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: C.amber }}>
                      {b.cost > 0 ? `€${b.cost.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: C.muted }}>
                      <span className="inline-flex items-center gap-1">
                        <Eye style={{ width: 10, height: 10 }} />{b.impressions.toLocaleString("de")}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: C.muted }}>
                      <span className="inline-flex items-center gap-1">
                        <MousePointer style={{ width: 10, height: 10 }} />{b.clicks.toLocaleString("de")}
                        {b.ctr !== null && b.clicks > 0 && (
                          <span style={{ color: "#7B8CFF", fontSize: 10 }}>{b.ctr}%</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: C.green }}>
                      <span className="inline-flex items-center gap-1">
                        <CalendarCheck style={{ width: 10, height: 10 }} />{b.bookings}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: "#7B8CFF" }}>
                      {b.estimatedRevenue > 0 ? `€${b.estimatedRevenue.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ROIBadge roi={b.roi} tier={b.roiTier} />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2" style={{ borderTop: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.01)" }}>
            <p className="text-[10px]" style={{ color: C.muted }}>
              Umsatzschätzung basierend auf Klick- und Buchungswerten für Ihren Betriebstyp. ROI = (Schätz. Umsatz − Kosten) / Kosten × 100.
            </p>
          </div>
        </div>

        {/* ── Smart Insights (premium-gated) ── */}
        <div style={{ borderRadius: 16, border: `1px solid rgba(245,158,11,0.18)`, backgroundColor: "rgba(245,158,11,0.04)", padding: 20 }}>
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb style={{ width: 16, height: 16, color: "#F59E0B" }} />
            <span className="font-semibold text-sm" style={{ color: C.text }}>Smart Insights</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto"
              style={{ color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <Crown style={{ width: 9, height: 9 }} /> Nur Premium
            </span>
          </div>

          {isPremium ? (
            <div className="space-y-3">
              {insights.map((ins, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                  style={{
                    backgroundColor: ins.priority === "high" ? "rgba(239,68,68,0.06)" : ins.priority === "medium" ? "rgba(245,158,11,0.05)" : "rgba(255,255,255,0.03)",
                    border: ins.priority === "high" ? "1px solid rgba(239,68,68,0.15)" : ins.priority === "medium" ? "1px solid rgba(245,158,11,0.15)" : `1px solid ${C.border}`,
                  }}
                >
                  <span className="text-base leading-none mt-0.5 select-none shrink-0">{ins.icon}</span>
                  <p className="text-xs leading-relaxed" style={{ color: C.text }}>{ins.text}</p>
                </motion.div>
              ))}
              {insights.length === 0 && (
                <p className="text-xs" style={{ color: C.muted }}>Noch keine Insights verfügbar — aktivieren Sie Boosts, um Daten zu sammeln.</p>
              )}
            </div>
          ) : (
            <PremiumGate onUpgrade={() => { window.location.href = "/restosmart/billing"; }} />
          )}
        </div>

        {/* ── Period breakdown note ── */}
        {isPremium && (
          <div className="flex items-center gap-2 text-[11px] rounded-xl px-3 py-2.5"
            style={{ backgroundColor: "rgba(79,140,255,0.06)", border: "1px solid rgba(79,140,255,0.14)", color: C.muted }}>
            <BarChart3 style={{ width: 13, height: 13, color: "#7B8CFF", flexShrink: 0 }} />
            <span>
              Zeitraum: <strong style={{ color: C.text }}>{period === "week" ? "Letzte 7 Tage" : "Letzte 30 Tage"}</strong> — {summary.boostCount} Boost-Kampagne{summary.boostCount !== 1 ? "n" : ""} analysiert. Schätzungen basieren auf Branchendurchschnittswerten für Wien.
            </span>
          </div>
        )}

      </div>
    </motion.div>
  );
}
