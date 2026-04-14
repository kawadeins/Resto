/**
 * PromotionTools — launch/pause/monitor boosts + Smart Revenue Trigger system.
 * Premium-only. Auto-discovers owner restaurant via /api/promotions/my.
 * Real-time pricing via /api/pricing/current — no fake urgency, all real signals.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "@/contexts/session-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Pause, Play, Square, TrendingUp, Eye, MousePointer, CalendarCheck,
  Flame, Wallet, Info, Activity, Clock, Users, Sparkles, Shield, BarChart3,
  MapPin, Lightbulb, ToggleLeft, ToggleRight, ArrowRight, Target, BrainCircuit,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BOOST_CONFIGS, isBoostCurrentlyActive } from "@/lib/monetization-engine";
import { WalletPanel } from "./wallet-panel";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ── Boost base costs (must stay in sync with wallet.ts BOOST_BASE_COSTS) ──────
const BOOST_BASE_COSTS: Record<string, number> = {
  breakfast_boost:  1.50,
  lunch_boost:      2.00,
  happy_hour_boost: 2.00,
  nightlife_boost:  2.50,
  local_spotlight:  1.80,
  local_heat_boost: 1.80,
};

function clientBoostCost(boostType: string, pricing: PricingData | undefined): number {
  const base = BOOST_BASE_COSTS[boostType] ?? 2.00;
  if (!pricing?.breakdown?.demandMultiplier) return base;
  const raw = base * pricing.breakdown.demandMultiplier;
  return Math.max(0.50, Math.min(9.99, Math.round(raw * 10) / 10));
}

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  card:      "#0f0a1e",
  border:    "rgba(255,255,255,0.08)",
  borderAct: "rgba(34,197,94,0.22)",
  borderPau: "rgba(245,158,11,0.20)",
  grad:      "linear-gradient(135deg,#8b5cf6,#ec4899)",
  gradAmber: "linear-gradient(135deg,#F59E0B,#f97316)",
  active:    "#22C55E",
  paused:    "#F59E0B",
  danger:    "#EF4444",
  text:      "#FFFFFF",
  muted:     "#A1A1AA",
  shadow:    "0 10px 30px rgba(0,0,0,0.4)",
  glowAct:   "0 10px 30px rgba(0,0,0,0.4),0 0 24px rgba(34,197,94,0.14)",
  glowOppty: "0 0 28px rgba(139,92,246,0.35)",
} as const;

// ── Shared interfaces ─────────────────────────────────────────────────────────

interface Promotion {
  id: number;
  restaurant_id: number;
  type: string;
  status: "active" | "paused" | "ended";
  started_at: string;
  ends_at: string | null;
  impressions: number;
  clicks: number;
  bookings_attributed: number;
  heat_exposure: number;
  group_exposure: number;
}

interface MyPromotionsData {
  restaurantId: number | null;
  restaurantName: string;
  businessType: string;
  promotions: Promotion[];
}

interface BudgetState {
  id: number;
  type: string;
  status: string;
  dailyBudget: number;
  spentToday: number;
  budgetRemaining: number | null;
  budgetExhausted: boolean;
}

interface PricingData {
  pricePerImpression: number;
  pricePer1000: number;
  demandLevel: "low" | "normal" | "high" | "very_high";
  totalActivePlatformBoosts: number;
  competingBoosts: number;
  slotPosition: number;
  locationTier: string;
  demandSignal: string;
  timeSignal: string;
  competitionSignal: string;
  locationSignal: string;
  pricingContext: string;
  suggestion: string;
  bestBoostWindow: string;
  slotTiers: { tier: string; label: string; multiplier: number; pricePer1000: number }[];
  breakdown: {
    basePrice: number; demandMultiplier: number; timeMultiplier: number;
    slotMultiplier: number; locationMultiplier: number; weekendBonus: number;
    finalPrice: number; totalMultiplier: number;
  };
  config: { basePrice: number; maxMultiplier: number; maxPrice: number; maxChangePercent: number };
}

interface SmartSuggestion {
  type: "timing" | "budget" | "opportunity" | "savings";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionLabel?: string;
}

// ── Reusable sub-components ───────────────────────────────────────────────────

function BoostStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  if (status === "active") return (
    <span style={{ color: C.active, backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full">
      <motion.span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.active }}
        animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }} />
      Live & aktiv
    </span>
  );
  if (status === "paused") return (
    <span style={{ color: C.paused, backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.22)" }}
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full">
      Pausiert
    </span>
  );
  return (
    <span style={{ color: C.muted, backgroundColor: "rgba(156,163,175,0.08)", border: "1px solid rgba(156,163,175,0.15)" }}
      className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full">
      Beendet
    </span>
  );
}

function MiniStat({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <div className="text-center">
      <Icon className="w-3.5 h-3.5 mx-auto mb-1.5" style={{ color: C.muted }} />
      <div className="text-sm font-bold tabular-nums leading-none" style={{ color: C.text }}>{value.toLocaleString("de")}</div>
      <div className="text-[10px] mt-1 leading-none" style={{ color: C.muted }}>{label}</div>
    </div>
  );
}

function GradBtn({ onClick, disabled, children, full = true, urgent = false }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; full?: boolean; urgent?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { boxShadow: urgent ? "0 0 28px rgba(139,92,246,0.6)" : "0 0 22px rgba(139,92,246,0.45)", scale: 1.01 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      animate={urgent && !disabled ? { boxShadow: ["0 0 0px rgba(139,92,246,0)", "0 0 20px rgba(139,92,246,0.35)", "0 0 0px rgba(139,92,246,0)"] } : {}}
      transition={urgent ? { duration: 2.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.15 }}
      style={{
        background: disabled ? "rgba(255,255,255,0.08)" : C.grad,
        height: 44, borderRadius: 12, border: "none",
        color: disabled ? C.muted : "#fff",
        fontWeight: 600, fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        width: full ? "100%" : undefined, flex: full ? undefined : 1,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </motion.button>
  );
}

function SecBtn({ onClick, children, danger = false }: {
  onClick: () => void; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ backgroundColor: danger ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.07)" }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      style={{
        height: 44, borderRadius: 12,
        border: `1px solid ${danger ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.1)"}`,
        background: "transparent",
        color: danger ? C.danger : C.muted,
        fontWeight: 500, fontSize: 13, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 5, flex: 1,
      }}
    >
      {children}
    </motion.button>
  );
}

function DemandChip({ level }: { level: PricingData["demandLevel"] }) {
  const { t } = useTranslation();
  const map: Record<PricingData["demandLevel"], { label: string; bg: string; color: string; border: string }> = {
    low:       { label: t("boost.demand_low"),       color: C.active, bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.22)"  },
    normal:    { label: t("boost.demand_normal"),    color: "#a78bfa", bg: "rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.22)" },
    high:      { label: t("boost.demand_high"),      color: C.paused,  bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.22)" },
    very_high: { label: t("boost.demand_very_high"), color: C.danger,  bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.22)"  },
  };
  const m = map[level] ?? map.normal;
  return (
    <span style={{ color: m.color, backgroundColor: m.bg, border: `1px solid ${m.border}` }}
      className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full">
      {m.label}
    </span>
  );
}

// ── ROI Revenue Engine ────────────────────────────────────────────────────────

interface ROIEstimate {
  impressionsLow:  number;
  impressionsHigh: number;
  guestsLow:  number;
  guestsHigh: number;
  revenueLow:  number;
  revenueHigh: number;
  cost:         number;
  roiMultiple:  number;
  confidence:   string;
  guestLabel:   string;
  isStrongROI:  boolean;
}

function calcROI(
  businessType: string,
  pricing: PricingData | undefined,
  historicalPromos: Promotion[],
): ROIEstimate | null {
  if (!pricing) return null;

  const bizCfg: Record<string, {
    avgOrderLow: number; avgOrderHigh: number;
    baseConvRate: number; baseCTR: number;
    impressionsLow: number; impressionsHigh: number;
    guestLabel: string;
  }> = {
    restaurant: { avgOrderLow: 22, avgOrderHigh: 35, baseConvRate: 0.14, baseCTR: 0.030, impressionsLow: 350, impressionsHigh: 520, guestLabel: "guests_label_r" },
    café:       { avgOrderLow: 8,  avgOrderHigh: 14, baseConvRate: 0.18, baseCTR: 0.040, impressionsLow: 280, impressionsHigh: 430, guestLabel: "guests_label_c" },
    bar:        { avgOrderLow: 15, avgOrderHigh: 25, baseConvRate: 0.12, baseCTR: 0.032, impressionsLow: 380, impressionsHigh: 560, guestLabel: "guests_label_r" },
  };

  const cfg = bizCfg[businessType] ?? bizCfg.restaurant;

  const demandMult: Record<PricingData["demandLevel"], number> = {
    low: 0.65, normal: 1.0, high: 1.35, very_high: 1.7,
  };
  const mult = demandMult[pricing.demandLevel] ?? 1.0;

  const totalImpHist  = historicalPromos.reduce((s, p) => s + (Number(p.impressions) || 0), 0);
  const totalClkHist  = historicalPromos.reduce((s, p) => s + (Number(p.clicks) || 0), 0);
  const totalBkgHist  = historicalPromos.reduce((s, p) => s + (Number(p.bookings_attributed) || 0), 0);

  let ctr      = cfg.baseCTR;
  let convRate = cfg.baseConvRate;
  let confidence = "confidence_base";

  if (totalImpHist > 50 && totalClkHist > 0) {
    ctr = Math.min(0.12, totalClkHist / totalImpHist);
    confidence = "confidence_your";
  }
  if (totalClkHist > 5 && totalBkgHist > 0) {
    convRate = Math.min(0.40, totalBkgHist / totalClkHist);
  }

  const impressionsLow  = Math.round(cfg.impressionsLow  * mult);
  const impressionsHigh = Math.round(cfg.impressionsHigh * mult);
  const guestsLow  = Math.max(1, Math.round(impressionsLow  * ctr * convRate));
  const guestsHigh = Math.max(2, Math.round(impressionsHigh * ctr * convRate));
  const revenueLow  = Math.round(guestsLow  * cfg.avgOrderLow);
  const revenueHigh = Math.round(guestsHigh * cfg.avgOrderHigh);

  const midImpressions = (impressionsLow + impressionsHigh) / 2;
  const cost = Math.max(0.5, Math.round((midImpressions / 1000) * pricing.pricePer1000 * 10) / 10);
  const roiMultiple  = cost > 0 ? revenueLow / cost : 0;
  const isStrongROI  = roiMultiple >= 5;

  return {
    impressionsLow, impressionsHigh, guestsLow, guestsHigh,
    revenueLow, revenueHigh, cost, roiMultiple,
    confidence, guestLabel: cfg.guestLabel, isStrongROI,
  };
}

function BoostROIEstimate({ roi, isOpportunity }: { roi: ROIEstimate; isOpportunity: boolean }) {
  const { t } = useTranslation();
  const rows = [
    { label: t("boost.stat_impressions"), value: `+${roi.impressionsLow.toLocaleString("de")}–${roi.impressionsHigh.toLocaleString("de")} Personen` },
    { label: `Erwartete ${roi.guestLabel === "guests_label_r" ? t("boost.guests_label_r") : t("boost.guests_label_c")}`, value: `${roi.guestsLow}–${roi.guestsHigh}` },
    { label: t("boost.potential_revenue"), value: `\u20AC${roi.revenueLow}–\u20AC${roi.revenueHigh}`, highlight: true },
  ];

  const roiColor = roi.isStrongROI ? C.active : roi.roiMultiple >= 3 ? "#a78bfa" : C.muted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        borderRadius: 12,
        border: roi.isStrongROI
          ? "1px solid rgba(34,197,94,0.2)"
          : isOpportunity
          ? "1px solid rgba(139,92,246,0.18)"
          : `1px solid ${C.border}`,
        backgroundColor: roi.isStrongROI
          ? "rgba(34,197,94,0.04)"
          : isOpportunity
          ? "rgba(139,92,246,0.04)"
          : "rgba(255,255,255,0.02)",
        padding: "11px 13px",
        display: "flex",
        flexDirection: "column" as const,
        gap: 7,
      }}
    >
      {/* Header: ROI label + cost */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: roiColor }}>
          ROI-Schätzung
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[10px]" style={{ color: C.muted }}>{t("boost.cost_approx", { defaultValue: "Approx. Cost" })}</span>
          <span className="text-[10px] font-bold" style={{ color: C.text }}>{"\u20AC"}{roi.cost.toFixed(1)}</span>
        </div>
      </div>

      {/* Metrics rows */}
      {rows.map(row => (
        <div key={row.label} className="flex items-center justify-between gap-2">
          <span className="text-[11px]" style={{ color: C.muted }}>{row.label}</span>
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: row.highlight ? C.active : C.text }}>
            {row.value}
          </span>
        </div>
      ))}

      {/* ROI multiplier bar */}
      {roi.roiMultiple >= 2 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px]" style={{ color: C.muted }}>{t("boost.cost_vs_return", { defaultValue: "Cost / Return" })}</span>
            <span className="text-[10px] font-bold" style={{ color: roiColor }}>~{roi.roiMultiple.toFixed(0)}×</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, roi.roiMultiple * 8)}%` }}
              transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
              style={{ background: roi.isStrongROI ? "linear-gradient(90deg,#22C55E,#4ade80)" : C.grad }}
            />
          </div>
        </div>
      )}

      {/* Confidence notice */}
      <p className="text-[10px]" style={{ color: "rgba(156,163,175,0.65)" }}>
        {"\u2139\uFE0F"} {roi.confidence === "confidence_base" ? t("boost.confidence_base") : t("boost.confidence_your")} {"\u00B7"} Konservative Schätzung
      </p>
    </motion.div>
  );
}

// ── Smart Revenue Trigger Panel ───────────────────────────────────────────────

function SmartRevenueTrigger({
  pricing, suggestions, hasActiveWindow, inactiveCount, onLaunchSuggested, canLaunch,
}: {
  pricing: PricingData | undefined;
  suggestions: SmartSuggestion[];
  hasActiveWindow: boolean;
  inactiveCount: number;
  onLaunchSuggested: () => void;
  canLaunch: boolean;
}) {
  const { t } = useTranslation();
  if (!pricing) return null;

  const isHighDemand   = pricing.demandLevel === "high" || pricing.demandLevel === "very_high";
  const isLowCompete   = pricing.competingBoosts < 3;
  const hasOpportunity = isHighDemand || isLowCompete || hasActiveWindow;

  if (!hasOpportunity || inactiveCount === 0) return null;

  // Pick the right tone
  const urgent = isHighDemand && hasActiveWindow;
  const topSuggestion = suggestions.find(s => s.priority === "high") ?? suggestions[0];

  const triggerTitle = urgent
    ? t("boost.demand_very_high") + " — " + t("boost.action_recommended_now")
    : isHighDemand
    ? "Erh\u00F6hte Nachfrage erkannt"
    : isLowCompete
    ? t("boost.low_competition", { defaultValue: "Low competition currently active" })
    : "Aktives Zeitfenster f\u00FCr Ihren Boost";

  const triggerDesc = urgent
    ? "Jetzt aktivieren f\u00FCr maximale Sichtbarkeit \u2014 Kunden suchen gerade aktiv."
    : isHighDemand
    ? `Nachfrage ${pricing.demandLevel === "very_high" ? "sehr hoch" : "hoch"} \u00B7 ${pricing.competingBoosts} Mitbewerber aktiv. G\u00FCnstige Konstellation.`
    : isLowCompete
    ? `Nur ${pricing.competingBoosts} konkurrierende Boosts aktiv \u2014 g\u00FCnstiger Einstiegszeitpunkt.`
    : `Optimales Zeitfenster: ${pricing.bestBoostWindow}`;

  const ctaLabel = urgent ? t("boost.action_recommended_now") : t("boost.launch");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35 }}
        style={{
          borderRadius: 16,
          border: urgent ? "1px solid rgba(245,158,11,0.35)" : "1px solid rgba(139,92,246,0.25)",
          background: urgent
            ? "linear-gradient(135deg,rgba(245,158,11,0.08),rgba(249,115,22,0.06))"
            : "linear-gradient(135deg,rgba(139,92,246,0.08),rgba(123,92,255,0.06))",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column" as const,
          gap: 14,
        }}
      >
        {/* Header row */}
        <div className="flex items-start gap-3">
          <motion.div
            animate={urgent ? { scale: [1, 1.1, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: urgent ? C.gradAmber : C.grad,
              boxShadow: urgent ? "0 4px 16px rgba(245,158,11,0.3)" : "0 4px 16px rgba(139,92,246,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {urgent
              ? <Flame style={{ width: 18, height: 18, color: "#fff" }} />
              : <Target style={{ width: 18, height: 18, color: "#fff" }} />
            }
          </motion.div>

          <div style={{ flex: 1 }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold" style={{ color: C.text }}>{triggerTitle}</span>
              {isHighDemand && <DemandChip level={pricing.demandLevel} />}
              {urgent && (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1.4 }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(245,158,11,0.2)", color: C.paused, border: "1px solid rgba(245,158,11,0.35)" }}
                >
                  LIVE
                </motion.span>
              )}
            </div>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>{triggerDesc}</p>
          </div>
        </div>

        {/* Metrics strip */}
        <div className="flex items-center gap-4 flex-wrap text-xs" style={{ color: C.muted }}>
          <span className="flex items-center gap-1.5">
            <Clock style={{ width: 12, height: 12 }} />
            Beste Zeit: <strong style={{ color: C.text }}>{pricing.bestBoostWindow}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <Users style={{ width: 12, height: 12 }} />
            <strong style={{ color: C.text }}>{pricing.competingBoosts}</strong> Mitbewerber aktiv
          </span>
          <span className="flex items-center gap-1.5">
            <BarChart3 style={{ width: 12, height: 12 }} />
            <strong style={{ color: C.text }}>{"\u20AC"}{pricing.pricePer1000.toFixed(2)}</strong> / 1.000 Einbl.
          </span>
        </div>

        {/* Top AI suggestion */}
        {topSuggestion && (
          <div className="flex items-start gap-2.5 text-[11px] rounded-xl px-3 py-2.5"
            style={{ backgroundColor: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}` }}>
            <BrainCircuit style={{ width: 13, height: 13, color: "#a78bfa", flexShrink: 0, marginTop: 1 }} />
            <span style={{ color: C.muted }}>
              <strong style={{ color: C.text }}>{topSuggestion.title}: </strong>
              {topSuggestion.description}
            </span>
          </div>
        )}

        {/* CTA */}
        {canLaunch && (
          <GradBtn onClick={onLaunchSuggested} urgent={urgent}>
            <Zap style={{ width: 14, height: 14 }} />
            {ctaLabel}
            <ArrowRight style={{ width: 13, height: 13, marginLeft: 2 }} />
          </GradBtn>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ── AI Timing Strip ───────────────────────────────────────────────────────────

function AITimingStrip({ pricing }: { pricing: PricingData }) {
  const { t } = useTranslation();
  const items = [
    { icon: Clock,    label: t("boost.stat_best_time"), value: pricing.bestBoostWindow },
    { icon: Activity, label: t("boost.stat_demand"), value: pricing.demandLevel === "very_high" ? t("boost.demand_very_high") : pricing.demandLevel === "high" ? t("boost.demand_high") : pricing.demandLevel === "normal" ? t("boost.demand_normal") : t("boost.demand_low") },
    { icon: Users, label: t("boost.competitors_active", { defaultValue: "Competitors active" }), value: String(pricing.competingBoosts) },
    { icon: BarChart3,label: "Preis / 1.000 Einbl.", value: `\u20AC${pricing.pricePer1000.toFixed(2)}` },
  ];

  return (
    <div style={{
      borderRadius: 12, border: `1px solid ${C.border}`,
      backgroundColor: "rgba(255,255,255,0.02)",
      padding: "10px 16px",
      display: "flex", alignItems: "center", gap: 0, overflowX: "auto" as const,
    }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", flex: "0 0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px" }}>
            <item.icon style={{ width: 12, height: 12, color: "#a78bfa", flexShrink: 0 }} />
            <div>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: C.muted }}>{item.label}</div>
              <div className="text-xs font-bold" style={{ color: C.text }}>{item.value}</div>
            </div>
          </div>
          {i < items.length - 1 && (
            <div style={{ width: 1, height: 28, backgroundColor: C.border, flexShrink: 0 }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PromotionTools() {
  const { t } = useTranslation();
  const { csrfToken } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [launching, setLaunching]     = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState<number | null>(null);
  const [budgetInput, setBudgetInput] = useState<Record<number, string>>({});
  const [showWallet, setShowWallet]   = useState(false);

  // ── Promotions data ─────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<MyPromotionsData>({
    queryKey: ["promotions-my"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/promotions/my`);
      if (!res.ok) return { restaurantId: null, restaurantName: "", businessType: "restaurant", promotions: [] };
      return res.json();
    },
    staleTime: 60000,
  });

  const restaurantId = data?.restaurantId ?? null;
  const localBizType = typeof window !== "undefined" ? localStorage.getItem("restosmart_owner_business_type") : null;
  const businessType = localBizType || data?.businessType || "restaurant";
  const promotions   = data?.promotions ?? [];

  // ── Real-time pricing — same cache key as SmartPricingDashboard ─────────────
  const { data: pricing } = useQuery<PricingData>({
    queryKey: ["pricing-current", businessType],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/pricing/current`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  // ── AI suggestions — same cache key as SmartPricingDashboard ───────────────
  const { data: suggestionsData } = useQuery<{ suggestions: SmartSuggestion[] }>({
    queryKey: ["pricing-suggestions", businessType],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/pricing/suggestions`);
      if (!res.ok) return { suggestions: [] };
      return res.json();
    },
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  // ── Budget ──────────────────────────────────────────────────────────────────
  const { data: budgetData } = useQuery<{ restaurantId: number; budgets: BudgetState[] }>({
    queryKey: ["promotions-budget", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return { restaurantId: 0, budgets: [] };
      const res = await fetch(`${API_BASE}/api/promotions/budget?restaurantId=${restaurantId}`);
      if (!res.ok) return { restaurantId: restaurantId ?? 0, budgets: [] };
      return res.json();
    },
    enabled: !!restaurantId,
    staleTime: 30000,
  });
  const budgets = budgetData?.budgets ?? [];

  // ── Mutations ───────────────────────────────────────────────────────────────
  const budgetMutation = useMutation({
    mutationFn: async ({ promoId, dailyBudget }: { promoId: number; dailyBudget: number }) => {
      const res = await fetch(`${API_BASE}/api/promotions/${promoId}/budget`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) },
        body: JSON.stringify({ dailyBudget }),
      });
      if (!res.ok) throw new Error("Fehler");
      return res.json();
    },
    onSuccess: (_, { dailyBudget }) => {
      const label = dailyBudget === 0 ? "unbegrenzt" : `\u20AC${dailyBudget}/Tag`;
      toast({ title: `Tagesbudget gesetzt: ${label}` });
      setEditingBudget(null);
      queryClient.invalidateQueries({ queryKey: ["promotions-budget"] });
    },
    onError: () => toast({ title: "Budget konnte nicht gespeichert werden", variant: "destructive" }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["promotions-my"] });

  const launchMutation = useMutation({
    mutationFn: async (type: string) => {
      if (!restaurantId) throw new Error("Kein Restaurant");
      const res = await fetch(`${API_BASE}/api/promotions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) },
        body: JSON.stringify({ restaurantId, type }),
      });
      if (res.status === 402) {
        const body = await res.json();
        const err = new Error("insufficient_balance") as Error & { walletError: typeof body };
        err.walletError = body;
        throw err;
      }
      if (res.status === 409) {
        throw new Error("duplicate_activation");
      }
      if (!res.ok) throw new Error("Fehler");
      return res.json();
    },
    onSuccess: (data, type) => {
      const cfg = BOOST_CONFIGS.find(b => b.type === type);
      toast({
        title: `${cfg?.emoji ?? "\uD83D\uDE80"} ${cfg?.label ?? type} gestartet!`,
        description: data.walletDeducted
          ? `\u20AC${data.walletDeducted.toFixed(2)} Guthaben verwendet \u00B7 Restguthaben: \u20AC${data.walletBalance?.toFixed(2)}`
          : t("boost.visibility_rising"),
      });
      setLaunching(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (err: Error & { walletError?: { required?: number; current?: number; shortfall?: number } }) => {
      if (err.message === "insufficient_balance" && err.walletError) {
        const { required = 0, current = 0 } = err.walletError;
        toast({
          title: "Nicht gen\u00FCgend Guthaben",
          description: `Ben\u00F6tigt: \u20AC${required.toFixed(2)} \u00B7 Aktuell: \u20AC${current.toFixed(2)}. Lade dein Guthaben auf.`,
          variant: "destructive",
        });
        setShowWallet(true);
      } else if (err.message === "duplicate_activation") {
        toast({
          title: t("boost.boost_already_started"),
          description: t("boost.boost_already_started_desc"),
          variant: "destructive",
        });
      } else {
        toast({ title: t("boost.boost_start_error"), variant: "destructive" });
      }
      setLaunching(null);
    },
  });

  const promoAuthHdr: Record<string, string> = csrfToken ? { "X-CSRF-Token": csrfToken } : {};
  const pauseMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API_BASE}/api/promotions/${id}/pause`, { method: "PUT", credentials: "include", headers: promoAuthHdr });
      if (!r.ok) throw new Error("Fehler");
      return r.json();
    },
    onSuccess: () => { toast({ title: t("boost.boost_paused") }); invalidate(); },
    onError: () => toast({ title: t("boost.boost_action_error"), variant: "destructive" }),
  });
  const resumeMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API_BASE}/api/promotions/${id}/resume`, { method: "PUT", credentials: "include", headers: promoAuthHdr });
      if (!r.ok) throw new Error("Fehler");
      return r.json();
    },
    onSuccess: () => { toast({ title: t("boost.boost_resumed") }); invalidate(); },
    onError: () => toast({ title: t("boost.boost_action_error"), variant: "destructive" }),
  });
  const stopMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API_BASE}/api/promotions/${id}/stop`, { method: "PUT", credentials: "include", headers: promoAuthHdr });
      if (!r.ok) throw new Error("Fehler");
      return r.json();
    },
    onSuccess: () => { toast({ title: t("boost.boost_stopped") }); invalidate(); },
    onError: () => toast({ title: t("boost.boost_action_error"), variant: "destructive" }),
  });

  // ── Wallet ──────────────────────────────────────────────────────────────────
  const { data: walletData } = useQuery<{ restaurantId: number; balance: number; isLow: boolean; isEmpty: boolean; transactions: unknown[] }>({
    queryKey: ["wallet", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return { restaurantId: 0, balance: 0, isLow: false, isEmpty: true, transactions: [] };
      const res = await fetch(`${API_BASE}/api/wallet?restaurantId=${restaurantId}`, {
        credentials: "include",
      });
      if (!res.ok) return { restaurantId: restaurantId ?? 0, balance: 0, isLow: false, isEmpty: true, transactions: [] };
      return res.json();
    },
    enabled: !!restaurantId,
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const walletBalance = walletData?.balance ?? 0;

  const hasSufficientBalance = (boostType: string): boolean => {
    const cost = clientBoostCost(boostType, pricing);
    return walletBalance >= cost;
  };

  // ── Derived opportunity signals ─────────────────────────────────────────────
  const relevantBoosts   = BOOST_CONFIGS.filter(b => b.bizTypes.includes(businessType));
  const getActivePromo   = (type: string) => promotions.find(p => p.type === type && (p.status === "active" || p.status === "paused"));
  const activeCount      = promotions.filter(p => p.status === "active").length;
  const suggestions      = suggestionsData?.suggestions ?? [];
  const isHighDemand     = pricing?.demandLevel === "high" || pricing?.demandLevel === "very_high";
  const hasActiveWindow  = relevantBoosts.some(b => isBoostCurrentlyActive(b.type));
  const inactiveBoosts   = relevantBoosts.filter(b => !getActivePromo(b.type));
  const firstInactiveCfg = inactiveBoosts[0];

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ backgroundColor: C.card, borderRadius: 20, padding: 24, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3 mb-6">
          <div style={{ background: C.grad, borderRadius: 12, width: 36, height: 36 }} className="flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-base font-bold" style={{ color: C.text }}>{t("boost.title")}</div>
            <div className="text-xs" style={{ color: C.muted }}>{"L\u00E4dt..."}</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-56 rounded-2xl animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: C.card, borderRadius: 20, border: `1px solid ${C.border}`, overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ padding: "24px 24px 16px" }} className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            style={{ background: C.grad, borderRadius: 12, width: 40, height: 40, flexShrink: 0, boxShadow: "0 4px 16px rgba(139,92,246,0.25)" }}
            className="flex items-center justify-center"
          >
            <Zap style={{ width: 18, height: 18, color: "#fff" }} />
          </motion.div>
          <div>
            <div className="text-lg font-bold" style={{ color: C.text }}>{t("boost.title")}</div>
            <div className="text-xs mt-0.5" style={{ color: C.muted }}>
              {"Erh\u00F6hen Sie Ihre Sichtbarkeit \u2014 pr\u00E4zise und messbar."}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Wallet balance chip */}
          <motion.button
            onClick={() => setShowWallet(v => !v)}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 999,
              backgroundColor: walletBalance <= 0 ? "rgba(239,68,68,0.1)" : walletData?.isLow ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.08)",
              border: `1px solid ${walletBalance <= 0 ? "rgba(239,68,68,0.3)" : walletData?.isLow ? "rgba(245,158,11,0.3)" : "rgba(34,197,94,0.25)"}`,
              background: "none", cursor: "pointer",
            }}
          >
            <Wallet style={{ width: 13, height: 13, color: walletBalance <= 0 ? C.danger : walletData?.isLow ? C.paused : C.active }} />
            <span className="text-xs font-bold tabular-nums" style={{ color: walletBalance <= 0 ? C.danger : walletData?.isLow ? C.paused : C.active }}>
              {"\u20AC"}{walletBalance.toFixed(2)}
            </span>
          </motion.button>

          {activeCount > 0 && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ color: C.active, backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.22)" }}
            >
              <motion.span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.active }}
                animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }} />
              {activeCount === 1 ? t("boost.boosts_active_one", { count: 1 }) : t("boost.boosts_active_other", { count: activeCount })}
            </motion.div>
          )}
        </div>
      </div>

      <div style={{ padding: "0 24px 24px" }} className="space-y-5">

        {/* ── Wallet Panel (collapsible) ── */}
        <AnimatePresence>
          {showWallet && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28 }}
              style={{ overflow: "hidden" }}
            >
              <WalletPanel restaurantId={restaurantId} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Smart Revenue Trigger ── */}
        <SmartRevenueTrigger
          pricing={pricing}
          suggestions={suggestions}
          hasActiveWindow={hasActiveWindow}
          inactiveCount={inactiveBoosts.length}
          canLaunch={!!restaurantId && !!firstInactiveCfg}
          onLaunchSuggested={() => {
            if (!firstInactiveCfg) return;
            setLaunching(firstInactiveCfg.type);
            launchMutation.mutate(firstInactiveCfg.type);
          }}
        />

        {/* ── AI Timing Strip (when pricing available, no active opportunity panel) ── */}
        {pricing && !((pricing.demandLevel === "high" || pricing.demandLevel === "very_high") && inactiveBoosts.length > 0) && (
          <AITimingStrip pricing={pricing} />
        )}

        {/* ── Boost Cards Grid ── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {relevantBoosts.map((cfg, idx) => {
            const promo     = getActivePromo(cfg.type);
            const isLive    = promo?.status === "active";
            const isPaused  = promo?.status === "paused";
            const nowActive = isBoostCurrentlyActive(cfg.type);
            const cardOppty = !promo && nowActive && isHighDemand;
            const cardBorder = isLive
              ? `1px solid ${C.borderAct}`
              : isPaused
              ? `1px solid ${C.borderPau}`
              : cardOppty
              ? "1px solid rgba(139,92,246,0.25)"
              : `1px solid ${C.border}`;
            const cardShadow = isLive
              ? C.glowAct
              : cardOppty
              ? "0 10px 30px rgba(0,0,0,0.35),0 0 20px rgba(139,92,246,0.12)"
              : C.shadow;

            return (
              <motion.div
                key={cfg.type}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06, duration: 0.3 }}
                whileHover={{
                  y: -3,
                  boxShadow: isLive
                    ? "0 16px 40px rgba(0,0,0,0.45),0 0 28px rgba(34,197,94,0.18)"
                    : cardOppty
                    ? "0 16px 40px rgba(0,0,0,0.45),0 0 28px rgba(139,92,246,0.25)"
                    : "0 16px 40px rgba(0,0,0,0.45)",
                }}
                style={{
                  backgroundColor: C.card,
                  borderRadius: 16, padding: 20,
                  display: "flex", flexDirection: "column", gap: 16,
                  border: cardBorder, boxShadow: cardShadow,
                  transition: "box-shadow 0.2s, border-color 0.2s",
                  cursor: "default",
                }}
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none mt-0.5 select-none">{cfg.emoji}</span>
                    <div>
                      <div className="font-semibold text-sm leading-snug" style={{ color: C.text }}>{cfg.label}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>
                        {cfg.hours[0]}:00 – {cfg.hours[1] < cfg.hours[0] ? "0" : ""}{cfg.hours[1]}:00 Uhr
                      </div>
                    </div>
                  </div>
                  {promo && <BoostStatusBadge status={promo.status} />}
                </div>

                {/* Description */}
                <p className="text-xs leading-relaxed flex-1" style={{ color: C.muted }}>
                  {cfg.businessCopy[businessType] ?? cfg.description}
                </p>

                {/* Opportunity / demand badges */}
                <AnimatePresence>
                  {!promo && nowActive && isHighDemand && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-xs font-bold w-fit px-3 py-1.5 rounded-full"
                      style={{ color: "#FF9D3D", backgroundColor: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)" }}
                    >
                      <motion.span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#FF9D3D" }}
                        animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} />
                      {"\uD83D\uDD25"} Hohe Nachfrage jetzt
                    </motion.div>
                  )}
                  {!promo && nowActive && !isHighDemand && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-xs font-semibold w-fit px-3 py-1.5 rounded-full"
                      style={{ color: C.paused, backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}
                    >
                      <motion.span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.paused }}
                        animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} />
                      Jetzt aktive Zeit
                    </motion.div>
                  )}
                  {!promo && !nowActive && isHighDemand && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 text-[10px] font-semibold w-fit px-2.5 py-1 rounded-full"
                      style={{ color: "#a78bfa", backgroundColor: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}
                    >
                      <TrendingUp style={{ width: 10, height: 10 }} />
                      Top Sichtbarkeit jetzt
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Metrics */}
                {promo && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="grid grid-cols-4 gap-2 pt-3"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <MiniStat icon={Eye}           value={promo.impressions}         label={t("boost.impressions_short")} />
                    <MiniStat icon={MousePointer}  value={promo.clicks}              label={t("boost.clicks_short")} />
                    <MiniStat icon={CalendarCheck} value={promo.bookings_attributed} label={t("boost.bookings_short")} />
                    <MiniStat icon={Flame}         value={promo.heat_exposure}       label={t("boost.heat_short")} />
                  </motion.div>
                )}

                {/* ROI Revenue Engine — inactive cards only */}
                {!promo && (() => {
                  const roi = calcROI(businessType, pricing, promotions.filter(p => p.type === cfg.type));
                  if (!roi) return null;
                  return <BoostROIEstimate roi={roi} isOpportunity={cardOppty} />;
                })()}

                {/* CTA buttons */}
                <div className="flex gap-2 mt-auto flex-col">
                  {!promo && (() => {
                    const cost = clientBoostCost(cfg.type, pricing);
                    const canAfford = hasSufficientBalance(cfg.type);
                    if (!canAfford && restaurantId) {
                      return (
                        <div className="space-y-2">
                          <motion.button
                            onClick={() => setShowWallet(true)}
                            whileHover={{ boxShadow: "0 0 18px rgba(245,158,11,0.35)" }}
                            whileTap={{ scale: 0.97 }}
                            style={{
                              width: "100%", height: 44, borderRadius: 12,
                              background: "linear-gradient(135deg,#F59E0B,#f97316)",
                              border: "none", color: "#fff", fontWeight: 600, fontSize: 13,
                              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            }}
                          >
                            <Wallet style={{ width: 14, height: 14 }} />
                            Guthaben aufladen ({"\u20AC"}{cost.toFixed(2)} ben\u00F6tigt)
                          </motion.button>
                          <p className="text-center text-[10px]" style={{ color: C.muted }}>
                            Aktuelles Guthaben: {"\u20AC"}{walletBalance.toFixed(2)}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-1.5">
                        <GradBtn
                          onClick={() => { setLaunching(cfg.type); launchMutation.mutate(cfg.type); }}
                          disabled={launching === cfg.type || !restaurantId}
                          urgent={cardOppty}
                        >
                          <Zap style={{ width: 14, height: 14 }} />
                          {launching === cfg.type
                            ? "Startet\u2026"
                            : cardOppty
                            ? "Empfohlen: Jetzt aktivieren"
                            : "Jetzt aktivieren"
                          }
                        </GradBtn>
                        {restaurantId && (
                          <p className="text-center text-[10px]" style={{ color: C.muted }}>
                            Kosten: {"\u20AC"}{cost.toFixed(2)} \u00B7 Guthaben: {"\u20AC"}{walletBalance.toFixed(2)}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  {isLive && (
                    <>
                      <SecBtn onClick={() => pauseMutation.mutate(promo!.id)}>
                        <Pause style={{ width: 13, height: 13 }} /> Pause
                      </SecBtn>
                      <SecBtn onClick={() => stopMutation.mutate(promo!.id)} danger>
                        <Square style={{ width: 13, height: 13 }} /> Stop
                      </SecBtn>
                    </>
                  )}
                  {isPaused && (
                    <>
                      <GradBtn onClick={() => resumeMutation.mutate(promo!.id)} full={false}>
                        <Play style={{ width: 14, height: 14 }} /> Fortsetzen
                      </GradBtn>
                      <SecBtn onClick={() => stopMutation.mutate(promo!.id)} danger>
                        <Square style={{ width: 13, height: 13 }} />
                      </SecBtn>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Smart Pricing Dashboard ── */}
        <SmartPricingDashboard businessType={businessType} restaurantId={restaurantId} />

        {/* ── Daily Budget ── */}
        {budgets.length > 0 && (
          <div style={{ backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }} className="space-y-4">
            <div className="flex items-center gap-2.5">
              <Wallet style={{ width: 16, height: 16, color: "#a78bfa" }} />
              <span className="font-semibold text-sm" style={{ color: C.text }}>{t("boost.daily_budget", { defaultValue: "Daily Budget" })}</span>
              <span className="text-xs ml-auto flex items-center gap-1" style={{ color: C.muted }}>
                <Info style={{ width: 12, height: 12 }} />
                Boost stoppt automatisch bei Limit
              </span>
            </div>

            <div className="space-y-3">
              {budgets.map((b) => {
                const cfg = BOOST_CONFIGS.find(c => c.type === b.type);
                const spentPct = b.dailyBudget > 0 ? Math.min(100, (b.spentToday / b.dailyBudget) * 100) : 0;
                const isEditing = editingBudget === b.id;

                return (
                  <div key={b.id} style={{ borderRadius: 12, border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.02)", padding: 16 }} className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium flex items-center gap-2" style={{ color: C.text }}>
                        {cfg?.emoji} {cfg?.label ?? b.type}
                        {b.budgetExhausted && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "rgba(239,68,68,0.12)", color: C.danger, border: "1px solid rgba(239,68,68,0.22)" }}>
                            Budget aufgebraucht
                          </span>
                        )}
                      </span>
                      <button
                        className="text-[11px] font-semibold"
                        style={{ color: "#a78bfa", background: "none", border: "none", cursor: "pointer" }}
                        onClick={() => {
                          setEditingBudget(isEditing ? null : b.id);
                          setBudgetInput(prev => ({ ...prev, [b.id]: String(b.dailyBudget) }));
                        }}
                      >
                        {isEditing ? t("common.cancel") : t("common.edit")}
                      </button>
                    </div>

                    {b.dailyBudget > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px]" style={{ color: C.muted }}>
                          <span>{"\u20AC"}{b.spentToday.toFixed(2)} ausgegeben</span>
                          <span>{"\u20AC"}{b.dailyBudget.toFixed(2)}/Tag</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                          <motion.div className="h-full rounded-full"
                            initial={{ width: 0 }} animate={{ width: `${spentPct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            style={{ backgroundColor: spentPct >= 100 ? C.danger : spentPct > 70 ? C.paused : C.active }} />
                        </div>
                      </div>
                    )}
                    {b.dailyBudget === 0 && (
                      <p className="text-[11px]" style={{ color: C.muted }}>{"Kein Tagesbudget \u2014 Boost l\u00E4uft unbegrenzt"}</p>
                    )}

                    {isEditing && (
                      <div className="pt-3 space-y-3" style={{ borderTop: `1px solid ${C.border}` }}>
                        <p className="text-[11px]" style={{ color: C.muted }}>{t("boost.budget_set_hint", { defaultValue: "Set daily budget (0 = unlimited)" })}</p>
                        <div className="flex gap-2 flex-wrap">
                          {[0, 5, 10, 20, 50].map(amount => (
                            <motion.button
                              key={amount}
                              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                              onClick={() => setBudgetInput(prev => ({ ...prev, [b.id]: String(amount) }))}
                              style={{
                                fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8,
                                border: budgetInput[b.id] === String(amount) ? "none" : `1px solid ${C.border}`,
                                background: budgetInput[b.id] === String(amount) ? C.grad : "rgba(255,255,255,0.04)",
                                color: budgetInput[b.id] === String(amount) ? "#fff" : C.muted, cursor: "pointer",
                              }}
                            >
                              {amount === 0 ? "Unbegrenzt" : `\u20AC${amount}/Tag`}
                            </motion.button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number" min={0} max={500}
                            value={budgetInput[b.id] ?? ""}
                            onChange={e => setBudgetInput(prev => ({ ...prev, [b.id]: e.target.value }))}
                            style={{ flex: 1, fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", backgroundColor: "rgba(255,255,255,0.04)", color: C.text, outline: "none" }}
                            placeholder={`Eigener Betrag (\u20AC)`}
                          />
                          <motion.button
                            whileHover={{ boxShadow: "0 0 16px rgba(139,92,246,0.35)" }} whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              const val = parseFloat(budgetInput[b.id] ?? "0") || 0;
                              budgetMutation.mutate({ promoId: b.id, dailyBudget: val });
                            }}
                            disabled={budgetMutation.isPending}
                            style={{ background: C.grad, border: "none", borderRadius: 10, padding: "0 16px", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: budgetMutation.isPending ? 0.6 : 1 }}
                          >
                            Speichern
                          </motion.button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-start gap-2.5 text-[11px] rounded-xl px-3 py-2.5"
              style={{ color: C.muted, backgroundColor: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.14)" }}>
              <span className="text-sm mt-0.5">{"\u2139\uFE0F"}</span>
              <span>
                {"Boosted Lokale erhalten das Label "}
                <strong style={{ color: C.text }}>{"\u201EGesponsert\u201C"}</strong>
                {" in der Kunden-App \u2014 transparent und vertrauensw\u00FCrdig."}
              </span>
            </div>
          </div>
        )}

        {/* ── Total Performance ── */}
        {promotions.length > 0 && (
          <div className="pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold flex items-center gap-2" style={{ color: C.text }}>
                <TrendingUp style={{ width: 15, height: 15, color: "#a78bfa" }} />
                Gesamtperformance
              </span>
              <span className="text-xs" style={{ color: C.muted }}>Alle Boosts kombiniert</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Eye,           label: "Einblendungen", val: promotions.reduce((s, p) => s + (p.impressions || 0), 0) },
                { icon: MousePointer,  label: "Klicks",        val: promotions.reduce((s, p) => s + (p.clicks || 0), 0) },
                { icon: CalendarCheck, label: "Buchungen",     val: promotions.reduce((s, p) => s + (p.bookings_attributed || 0), 0) },
                { icon: Flame,         label: "Heat-Expo.",    val: promotions.reduce((s, p) => s + (p.heat_exposure || 0), 0) },
              ].map(({ icon: Ic, label, val }, i) => (
                <motion.div key={label}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }} whileHover={{ y: -2 }}
                  style={{ borderRadius: 12, border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.02)", padding: 16, textAlign: "center" }}
                >
                  <Ic style={{ width: 15, height: 15, color: C.muted, margin: "0 auto 8px" }} />
                  <div className="text-xl font-extrabold tabular-nums" style={{ color: C.text }}>{val.toLocaleString("de")}</div>
                  <div className="text-xs mt-1" style={{ color: C.muted }}>{label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Smart Pricing Dashboard ────────────────────────────────────────────────────

function SuggestionIcon({ type }: { type: string }) {
  const iconMap: Record<string, React.ElementType> = { timing: Clock, budget: BarChart3, opportunity: Sparkles, savings: Shield };
  const Icon = iconMap[type] ?? Lightbulb;
  return <Icon style={{ width: 14, height: 14, color: "#a78bfa", flexShrink: 0, marginTop: 1 }} />;
}

function SmartPricingDashboard({ businessType, restaurantId }: { businessType: string; restaurantId: number | null }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { csrfToken: pricingCsrfToken } = useSession();
  const pricingCsrfHdr: Record<string, string> = pricingCsrfToken ? { "X-CSRF-Token": pricingCsrfToken } : {};

  const { data: pricing, isLoading: pricingLoading } = useQuery<PricingData>({
    queryKey: ["pricing-current", businessType],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/pricing/current`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const { data: suggestionsData } = useQuery<{ suggestions: SmartSuggestion[] }>({
    queryKey: ["pricing-suggestions", businessType],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/pricing/suggestions`);
      if (!res.ok) return { suggestions: [] };
      return res.json();
    },
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  const { data: autoOptData } = useQuery<{ enabled: boolean }>({
    queryKey: ["auto-optimize", restaurantId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/pricing/auto-optimize?restaurantId=${restaurantId ?? 1}`);
      if (!res.ok) return { enabled: false };
      return res.json();
    },
    enabled: !!restaurantId,
  });

  const autoOptMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch(`${API_BASE}/api/pricing/auto-optimize`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...pricingCsrfHdr },
        body: JSON.stringify({ restaurantId: restaurantId ?? 1, enabled }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.enabled ? "Automatische Optimierung aktiviert" : "Automatische Optimierung deaktiviert" });
      queryClient.invalidateQueries({ queryKey: ["auto-optimize"] });
    },
  });

  const suggestions    = suggestionsData?.suggestions ?? [];
  const autoOptEnabled = autoOptData?.enabled ?? false;

  if (pricingLoading) {
    return (
      <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.02)", padding: 20 }} className="animate-pulse space-y-3">
        <div className="h-4 w-40 rounded" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />)}
        </div>
      </div>
    );
  }

  if (!pricing) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ borderRadius: 16, border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.015)", overflow: "hidden" }}>
      <div style={{ padding: 20 }} className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Activity style={{ width: 15, height: 15, color: "#a78bfa" }} />
            <span className="font-semibold text-sm" style={{ color: C.text }}>Smart Pricing</span>
            <DemandChip level={pricing.demandLevel} />
          </div>
          <span className="text-xs" style={{ color: C.muted }}>{"Echtzeit \u00B7 alle 2 Min."}</span>
        </div>

        {/* Pricing grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Aktueller Preis", main: `\u20AC${pricing.pricePer1000.toFixed(2)}`, sub: "pro 1.000 Einbl." },
            { label: "Nachfrage",       main: null,                                        sub: `${pricing.totalActivePlatformBoosts} Boosts aktiv`, chip: pricing.demandLevel },
            { label: "Konkurrenz",      main: String(pricing.competingBoosts),             sub: "Mitbewerber" },
            { label: "Top-Zeit",        main: pricing.bestBoostWindow,                     sub: "Bestes Fenster", small: true },
          ].map((item, i) => (
            <motion.div key={i} whileHover={{ y: -1 }}
              style={{ borderRadius: 12, border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.03)", padding: 12, textAlign: "center" }}>
              <p className="text-[10px] mb-1.5" style={{ color: C.muted }}>{item.label}</p>
              {item.chip
                ? <div className="flex justify-center mb-1"><DemandChip level={item.chip as PricingData["demandLevel"]} /></div>
                : <p className={`font-bold ${item.small ? "text-sm" : "text-lg"} leading-snug`} style={{ color: C.text }}>{item.main}</p>
              }
              <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{item.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Context */}
        <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.02)", padding: "12px 14px" }} className="space-y-1.5">
          <p className="text-xs font-medium" style={{ color: C.text }}>{pricing.pricingContext}</p>
          <p className="text-[11px]" style={{ color: C.muted }}>{pricing.timeSignal}</p>
          {pricing.locationSignal && (
            <p className="text-[11px] flex items-center gap-1" style={{ color: C.muted }}>
              <MapPin style={{ width: 11, height: 11 }} /> {pricing.locationSignal}
            </p>
          )}
        </div>

        {/* AI suggestion */}
        <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
          style={{ backgroundColor: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.15)" }}>
          <Zap style={{ width: 13, height: 13, color: "#a78bfa", flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs leading-relaxed" style={{ color: "#a5b4fc" }}>{pricing.suggestion}</p>
        </div>

        {/* Slot tiers */}
        {pricing.slotTiers && pricing.slotTiers.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: C.muted }}>
              <BarChart3 style={{ width: 13, height: 13 }} /> Slot-Preise
            </p>
            <div className="grid grid-cols-3 gap-2">
              {pricing.slotTiers.map((slot, idx) => (
                <div key={slot.tier} style={{
                  borderRadius: 12, padding: 10, textAlign: "center",
                  border: idx === 0 ? "1px solid rgba(245,158,11,0.28)" : idx === 1 ? "1px solid rgba(139,92,246,0.22)" : `1px solid ${C.border}`,
                  backgroundColor: idx === 0 ? "rgba(245,158,11,0.06)" : idx === 1 ? "rgba(139,92,246,0.05)" : "rgba(255,255,255,0.02)",
                }}>
                  <p className="text-[10px] font-medium mb-1" style={{ color: C.muted }}>{slot.label.split(" — ")[0]}</p>
                  <p className="text-sm font-bold" style={{ color: idx === 0 ? C.paused : idx === 1 ? "#a78bfa" : C.text }}>
                    {"\u20AC"}{slot.pricePer1000.toFixed(2)}
                  </p>
                  <p className="text-[9px] mt-0.5" style={{ color: C.muted }}>{slot.label.split(" — ")[1]}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI recommendations */}
        {suggestions.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: C.muted }}>
              <Sparkles style={{ width: 13, height: 13, color: "#a78bfa" }} /> KI-Empfehlungen
            </p>
            <div className="space-y-2">
              {suggestions.slice(0, 3).map((s, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  style={{
                    borderRadius: 12, padding: "10px 14px",
                    display: "flex", alignItems: "flex-start", gap: 10,
                    border: s.priority === "high" ? "1px solid rgba(245,158,11,0.22)" : s.priority === "medium" ? "1px solid rgba(139,92,246,0.18)" : `1px solid ${C.border}`,
                    backgroundColor: s.priority === "high" ? "rgba(245,158,11,0.05)" : s.priority === "medium" ? "rgba(139,92,246,0.04)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <SuggestionIcon type={s.type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="text-xs font-semibold" style={{ color: C.text }}>{s.title}</p>
                    <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: C.muted }}>{s.description}</p>
                  </div>
                  {s.priority === "high" && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: "rgba(245,158,11,0.12)", color: C.paused, border: "1px solid rgba(245,158,11,0.22)" }}>
                      Top
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Auto-optimize toggle */}
        <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.02)", padding: "12px 14px" }} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {autoOptEnabled
              ? <ToggleRight style={{ width: 20, height: 20, color: C.active, flexShrink: 0 }} />
              : <ToggleLeft  style={{ width: 20, height: 20, color: C.muted,  flexShrink: 0 }} />
            }
            <div>
              <p className="text-xs font-semibold" style={{ color: C.text }}>Automatisch optimieren</p>
              <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>
                {autoOptEnabled
                  ? "System optimiert Timing & Budget automatisch"
                  : "System passt Ausgaben und Timing automatisch an"
                }
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ boxShadow: autoOptEnabled ? undefined : "0 0 16px rgba(139,92,246,0.25)", scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => autoOptMutation.mutate(!autoOptEnabled)}
            disabled={autoOptMutation.isPending}
            style={{
              background: autoOptEnabled ? "rgba(255,255,255,0.06)" : C.grad,
              border: autoOptEnabled ? `1px solid ${C.border}` : "none",
              borderRadius: 10, padding: "7px 14px",
              color: autoOptEnabled ? C.muted : "#fff",
              fontWeight: 600, fontSize: 12, cursor: "pointer",
              opacity: autoOptMutation.isPending ? 0.6 : 1, flexShrink: 0,
            }}
          >
            {autoOptEnabled ? t("common.disable") : t("common.enable")}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
