/**
 * SoftPaywall — high-conversion locked-feature overlay.
 *
 * Features:
 *  • Blurred ghost preview — real chart shapes visible behind a blur/darken layer
 *    so the user can "almost" see the data (proven high-intent tease pattern)
 *  • 24 h countdown offer stored in localStorage — urgency without spam
 *  • Success stats row: +40 % Buchungen · +25 % Umsatz · 3× Sichtbarkeit
 *  • One-tap upgrade CTA with pulse animation + trust signals
 *  • Social proof footer
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Zap, TrendingUp, Users, BarChart3, Check, Clock, Star, Shield, ArrowRight } from "lucide-react";

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
  const fmt = (n: number) => String(n).padStart(2, "0");
  return { h, m, s, fmt, total: remaining };
}

// ── Ghost charts ───────────────────────────────────────────────────────────────

function GhostAreaChart() {
  const PTS = [28, 42, 35, 58, 52, 69, 63, 80, 74, 88, 82, 94];
  const W = 400, H = 96;
  const max = Math.max(...PTS);
  const coords = PTS.map((v, i) =>
    `${(i / (PTS.length - 1)) * W},${H - (v / max) * (H - 8) - 4}`
  );
  const areaClose = `${W},${H} 0,${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
      <defs>
        <linearGradient id="spArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(263,70%,52%)" stopOpacity="0.40" />
          <stop offset="100%" stopColor="hsl(263,70%,52%)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${coords.join(" ")} ${areaClose}`} fill="url(#spArea)" />
      <polyline points={coords.join(" ")} fill="none" stroke="hsl(263,70%,52%)" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
      {PTS.map((v, i) => i % 3 === 0 ? (
        <circle key={i}
          cx={(i / (PTS.length - 1)) * W}
          cy={H - (v / max) * (H - 8) - 4}
          r="3.5" fill="hsl(263,70%,52%)" />
      ) : null)}
    </svg>
  );
}

function GhostBars({ accent = false }: { accent?: boolean }) {
  const bars = [45, 72, 58, 88, 65, 94, 52];
  const max = Math.max(...bars);
  const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const color = accent ? "hsl(330,85%,58%)" : "hsl(263,70%,52%)";
  return (
    <div>
      <div className="flex items-end gap-1.5 h-16">
        {bars.map((v, i) => (
          <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${(v / max) * 58}px`, background: color, opacity: 0.7 }} />
        ))}
      </div>
      <div className="flex gap-1.5 mt-1">
        {days.map(d => (
          <span key={d} className="flex-1 text-center text-[9px] text-muted-foreground font-semibold">{d}</span>
        ))}
      </div>
    </div>
  );
}

function GhostMetrics() {
  const metrics = [
    { label: "Umsatz", val: "€4.2k", color: "text-emerald-500" },
    { label: "Gewinn", val: "€1.8k", color: "text-indigo-500" },
    { label: "Ø-Wert", val: "€38", color: "text-violet-500" },
    { label: "Marge", val: "42%", color: "text-amber-500" },
  ];
  return (
    <div className="grid grid-cols-4 gap-2 mb-3">
      {metrics.map(m => (
        <div key={m.label} className="bg-muted/30 border border-border/30 rounded-lg p-2 text-center">
          <p className="text-[9px] text-muted-foreground/60 mb-0.5 font-semibold uppercase tracking-wide">{m.label}</p>
          <p className={`text-sm font-black ${m.color}`}>{m.val}</p>
        </div>
      ))}
    </div>
  );
}

// ── Gradient fade teaser ──────────────────────────────────────────────────────

function GhostPreviewPane() {
  return (
    <div className="relative rounded-xl overflow-hidden border border-border bg-card/80">
      {/* Ghost content */}
      <div className="p-4 space-y-3 select-none pointer-events-none" aria-hidden>
        <GhostMetrics />
        <GhostAreaChart />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <GhostBars />
          <GhostBars accent />
        </div>
      </div>

      {/* Progressive blur: bottom is fully opaque, top is translucent */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, hsl(var(--background)/0.10) 0%, hsl(var(--background)/0.72) 55%, hsl(var(--background)/0.97) 100%)",
          backdropFilter: "blur(4px) saturate(0.6)",
          WebkitBackdropFilter: "blur(4px) saturate(0.6)",
        }}
      />

      {/* Lock badge centred */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.1 }}
          className="w-14 h-14 rounded-2xl bg-card border-2 border-primary/30 shadow-xl flex items-center justify-center"
          style={{ boxShadow: "0 0 24px hsl(263 70% 52% / 0.25)" }}
        >
          <Lock className="w-7 h-7 text-primary" />
        </motion.div>
        <motion.span
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="text-xs font-bold text-muted-foreground bg-card border border-border px-3 py-1 rounded-full shadow-sm"
        >
          Mit Premium freischalten
        </motion.span>
      </div>
    </div>
  );
}

// ── Countdown digit block ─────────────────────────────────────────────────────

function CountdownDigit({ val, label }: { val: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
        <span className="font-black text-amber-500 text-xl tabular-nums leading-none">{val}</span>
      </div>
      <span className="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest">{label}</span>
    </div>
  );
}

// ── Success stat pill ─────────────────────────────────────────────────────────

const SUCCESS_STATS = [
  { icon: TrendingUp, value: "+40%", label: "Buchungen", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
  { icon: Users, value: "+25%", label: "Umsatz", color: "text-violet-500", bg: "bg-violet-500/10 border-violet-500/20" },
  { icon: BarChart3, value: "3×", label: "Sichtbarkeit", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" },
];

const FEATURES = [
  "30-Tage-Umsatz & Gewinntrends",
  "Stoßzeiten-Heatmap (Ø Gedecke/h)",
  "Gerichts-Rentabilität im Detail",
  "Reservierungsquellen-Analyse",
  "Promotion Engine & Boost-Tools",
  "KI-Bewertungsantworten",
];

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
  const { h, m, s, fmt, total } = useCountdown();
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = useCallback(() => {
    setUpgrading(true);
    setTimeout(() => {
      if (onUpgrade) {
        onUpgrade();
      } else {
        window.location.href = "/billing";
      }
    }, 160);
  }, [onUpgrade]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-2xl mx-auto px-4 py-8 space-y-5"
    >
      {/* ── Ghost preview ── */}
      <GhostPreviewPane />

      {/* ── Urgency banner (24 h countdown) ── */}
      {total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-amber-500/25 bg-amber-500/6"
        >
          <div className="shrink-0">
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-amber-500 leading-tight">
              {"Heute: 14 Tage gratis testen"}
            </p>
            <p className="text-[11px] text-amber-500/60 mt-0.5">
              {"Angebot endet in"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <CountdownDigit val={fmt(h)} label="Std" />
            <span className="text-amber-500/50 font-black text-lg mb-4">:</span>
            <CountdownDigit val={fmt(m)} label="Min" />
            <span className="text-amber-500/50 font-black text-lg mb-4">:</span>
            <CountdownDigit val={fmt(s)} label="Sek" />
          </div>
        </motion.div>
      )}

      {/* ── Success stats ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="grid grid-cols-3 gap-3"
      >
        {SUCCESS_STATS.map(({ icon: Icon, value, label, color, bg }) => (
          <div key={label} className={`flex flex-col items-center gap-1.5 p-3.5 rounded-2xl border ${bg}`}>
            <Icon className={`w-5 h-5 ${color}`} />
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-center text-muted-foreground font-bold leading-tight">{label}</p>
          </div>
        ))}
      </motion.div>

      {/* ── Feature card + CTA ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24 }}
        className="rounded-2xl border border-border bg-card shadow-sm p-6 space-y-5"
      >
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))" }}>
              <Star className="w-4 h-4 text-white fill-white" />
            </div>
            <h3 className="font-extrabold text-lg leading-tight">{title}</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-2.5">
          {FEATURES.map(f => (
            <div key={f} className="flex items-center gap-2.5 text-sm">
              <div className="w-5 h-5 rounded-full bg-primary/12 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-primary" strokeWidth={3} />
              </div>
              <span className="text-muted-foreground">{f}</span>
            </div>
          ))}
        </div>

        {/* CTA — pulsing glow on the button */}
        <div className="space-y-3">
          <motion.button
            onClick={handleUpgrade}
            disabled={upgrading}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.975 }}
            className="w-full h-13 rounded-xl font-extrabold text-sm text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-70 cursor-pointer relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))",
              boxShadow: "0 4px 24px hsl(263,70%,52%,0.42), 0 1px 4px hsl(0 0% 0% / 0.15)",
              height: 52,
            }}
          >
            {/* Shimmer */}
            {!upgrading && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-12"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ repeat: Infinity, duration: 2.8, ease: "linear", repeatDelay: 1.2 }}
              />
            )}
            <Zap className="w-4 h-4 relative z-10" />
            <span className="relative z-10">
              {upgrading ? "Wird weitergeleitet…" : "Jetzt kostenlos starten — kein Risiko"}
            </span>
            {!upgrading && <ArrowRight className="w-4 h-4 relative z-10 opacity-70" />}
          </motion.button>

          {/* Trust signals */}
          <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground/60 font-semibold flex-wrap">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-500" />
              Jederzeit kündbar
            </span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-500" />
              Keine Kreditkarte nötig
            </span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-current" />
              14 Tage gratis
            </span>
          </div>
        </div>
      </motion.div>

      {/* Social proof */}
      <p className="text-center text-[11px] text-muted-foreground/50 leading-relaxed">
        {"Über 80 Wiener Restaurants nutzen bereits RestoSmart Premium — "}
        {"und erhalten im Ø 40 % mehr Buchungen im ersten Monat."}
      </p>
    </motion.div>
  );
}

export default SoftPaywall;
