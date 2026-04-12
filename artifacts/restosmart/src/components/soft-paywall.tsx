/**
 * SoftPaywall — high-conversion locked-feature overlay.
 *
 * Shows a blurred ghost preview of real content, a countdown offer,
 * success stats, and a one-tap upgrade CTA.
 *
 * Usage:
 *   <SoftPaywall title="Analysen & Intelligenz" onUpgrade={handleUpgrade} />
 */

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Lock, Zap, TrendingUp, Users, BarChart3, Check, Clock } from "lucide-react";

// ── Countdown hook ─────────────────────────────────────────────────────────────

const OFFER_KEY = "rs_offer_start";
const OFFER_DURATION_MS = 24 * 60 * 60 * 1000;

function getOrInitOfferStart(): number {
  try {
    let start = parseInt(localStorage.getItem(OFFER_KEY) ?? "0", 10);
    if (!start || Date.now() - start > OFFER_DURATION_MS) {
      start = Date.now();
      localStorage.setItem(OFFER_KEY, String(start));
    }
    return start;
  } catch {
    return Date.now();
  }
}

function useCountdown() {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, getOrInitOfferStart() + OFFER_DURATION_MS - Date.now())
  );

  useEffect(() => {
    const start = getOrInitOfferStart();
    const tick = () => setRemaining(Math.max(0, start + OFFER_DURATION_MS - Date.now()));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Ghost chart (blurred preview) ────────────────────────────────────────────

function GhostChart() {
  const PTS = [28, 42, 35, 58, 52, 69, 63, 80, 74, 88, 82, 94];
  const W = 400;
  const H = 100;
  const max = Math.max(...PTS);
  const coordPts = PTS.map((v, i) =>
    `${(i / (PTS.length - 1)) * W},${H - (v / max) * (H - 8) - 4}`
  ).join(" ");
  const areaClose = `${W},${H} 0,${H}`;

  return (
    <div className="w-full overflow-hidden rounded-xl" style={{ filter: "blur(3px) brightness(0.65)", userSelect: "none" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 96 }}>
        <defs>
          <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(263,70%,52%)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(263,70%,52%)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${H} ${coordPts} ${areaClose}`} fill="url(#spGrad)" />
        <polyline points={coordPts} fill="none" stroke="hsl(263,70%,52%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {PTS.map((v, i) => (
          i % 3 === 0 ? (
            <circle
              key={i}
              cx={(i / (PTS.length - 1)) * W}
              cy={H - (v / max) * (H - 8) - 4}
              r="3.5"
              fill="hsl(263,70%,52%)"
            />
          ) : null
        ))}
      </svg>
      <div className="flex justify-between px-1 mt-1 gap-2">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So", "Mo", "Di", "Mi", "Do", "Fr"].map(d => (
          <span key={d} className="text-[9px] text-muted-foreground font-semibold flex-1 text-center">{d}</span>
        ))}
      </div>
    </div>
  );
}

function GhostBar() {
  const bars = [45, 72, 58, 88, 65, 94, 52];
  const max = Math.max(...bars);
  const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  return (
    <div className="overflow-hidden rounded-xl" style={{ filter: "blur(3px) brightness(0.65)", userSelect: "none" }}>
      <div className="flex items-end gap-1.5 h-20 px-1">
        {bars.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-sm"
              style={{ height: `${(v / max) * 64}px`, background: "hsl(330,85%,58%)" }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 px-1 mt-1">
        {days.map(d => (
          <span key={d} className="flex-1 text-center text-[9px] text-muted-foreground font-semibold">{d}</span>
        ))}
      </div>
    </div>
  );
}

// ── Success stats ──────────────────────────────────────────────────────────────

const SUCCESS_STATS = [
  { icon: TrendingUp, value: "+40%", label: "mehr Buchungen", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { icon: Users, value: "+25%", label: "mehr Umsatz", color: "text-violet-400", bg: "bg-violet-500/10" },
  { icon: BarChart3, value: "3×", label: "mehr Sichtbarkeit", color: "text-amber-400", bg: "bg-amber-500/10" },
];

// ── Feature list ──────────────────────────────────────────────────────────────

const FEATURES = [
  "30-Tage-Umsatztrends",
  "Stoßzeiten-Heatmap",
  "Gerichts-Rentabilität",
  "Reservierungsquellen-Analyse",
];

// ── One-tap upgrade ────────────────────────────────────────────────────────────

function triggerUpgrade() {
  try {
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem("restosmart_owner_premium", "trial");
    localStorage.setItem("restosmart_trial_end", trialEnd);
    window.location.reload();
  } catch {}
}

// ── Main component ─────────────────────────────────────────────────────────────

interface SoftPaywallProps {
  title?: string;
  subtitle?: string;
  onUpgrade?: () => void;
}

export function SoftPaywall({
  title = "Analysen & Intelligenz",
  subtitle = "Daten, die deinen Betrieb täglich voranbringen.",
  onUpgrade,
}: SoftPaywallProps) {
  const countdown = useCountdown();
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = useCallback(() => {
    setUpgrading(true);
    setTimeout(() => {
      (onUpgrade ?? triggerUpgrade)();
    }, 180);
  }, [onUpgrade]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-2xl mx-auto px-4 py-8 space-y-6"
    >
      {/* ── Ghost preview layer ── */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-card/60">
        <div className="p-4 space-y-4">
          <GhostChart />
          <div className="grid grid-cols-2 gap-3">
            <GhostBar />
            <GhostBar />
          </div>
        </div>

        {/* Blur overlay */}
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]" />

        {/* Lock badge */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-card border border-border shadow-xl flex items-center justify-center">
            <Lock className="w-7 h-7 text-muted-foreground" />
          </div>
          <span className="text-xs font-bold text-muted-foreground bg-card border border-border px-3 py-1 rounded-full shadow-sm">
            Mit Premium freischalten
          </span>
        </div>
      </div>

      {/* ── Countdown offer ── */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/8">
        <Clock className="w-4 h-4 text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-amber-400">
            {"Nur heute: 14 Tage kostenlos testen"}
          </p>
          <p className="text-[11px] text-amber-400/60 mt-0.5">
            {"Angebot endet in "}<span className="font-black tabular-nums">{countdown}</span>
          </p>
        </div>
        <div className="shrink-0 font-black tabular-nums text-sm text-amber-400 bg-amber-500/15 px-3 py-1 rounded-lg border border-amber-500/20">
          {countdown}
        </div>
      </div>

      {/* ── Success stats ── */}
      <div className="grid grid-cols-3 gap-3">
        {SUCCESS_STATS.map(({ icon: Icon, value, label, color, bg }) => (
          <div key={label} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border ${bg}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg}`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-center text-muted-foreground font-semibold leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Feature preview list ── */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <h3 className="font-extrabold text-lg leading-tight">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          {FEATURES.map(f => (
            <div key={f} className="flex items-center gap-2.5 text-sm">
              <div className="w-5 h-5 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-violet-400" strokeWidth={3} />
              </div>
              <span className="text-muted-foreground">{f}</span>
            </div>
          ))}
        </div>

        {/* One-tap CTA */}
        <button
          onClick={handleUpgrade}
          disabled={upgrading}
          className="w-full h-12 rounded-xl font-extrabold text-sm text-white flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-70 cursor-pointer"
          style={{ background: "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))", boxShadow: "0 4px 20px hsl(263,70%,52%,0.4)" }}
        >
          <Zap className="w-4 h-4" />
          {upgrading ? "Wird freigeschaltet…" : "Jetzt kostenlos starten — kein Risiko"}
        </button>

        {/* Trust signals */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground/60 font-semibold">
          <span>{"✓ Jederzeit kündbar"}</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <span>{"✓ Keine Kreditkarte nötig"}</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <span>{"✓ 14 Tage gratis"}</span>
        </div>
      </div>

      {/* Social proof note */}
      <p className="text-center text-[11px] text-muted-foreground/50 leading-relaxed">
        {"Restaurants mit Premium erhalten im Ø 40% mehr Buchungen im ersten Monat."}
      </p>
    </motion.div>
  );
}

export default SoftPaywall;
