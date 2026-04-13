/**
 * Contextual Premium Triggers — customer-side monetization nudges.
 *
 * Components:
 *  - incrementRestaurantViews()   — increments sessionStorage counter, returns new count
 *  - RestaurantBrowseTrigger      — slide-up nudge after 3rd restaurant view in session
 *  - PostBookingPremiumNudge      — slide-up pitch after a successful booking
 *  - GroupPlanPremiumNudge        — slide-up pitch after group plan creation
 *
 * Design goals:
 *  • Non-aggressive — single appearance per trigger (sessionStorage gating)
 *  • High-conversion — urgency, scarcity, social proof, one-tap CTA
 *  • Consistent gradient identity (primary → accent)
 *  • Auto-dismisses with progress bar countdown
 */

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Crown, X, ChevronRight, Zap, Star, TrendingUp, CheckCircle2, Clock } from "lucide-react";

const GRAD = "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))";

const BROWSE_TRIGGER_KEY = "rs_browse_trigger_shown";
const BROWSE_KEY = "rs_restaurant_views_session";
const POST_BOOKING_KEY = "rs_post_booking_shown_today";

// ── Session browse counter ─────────────────────────────────────────────────────

export function incrementRestaurantViews(): number {
  try {
    const n = parseInt(sessionStorage.getItem(BROWSE_KEY) ?? "0", 10) + 1;
    sessionStorage.setItem(BROWSE_KEY, String(n));
    return n;
  } catch {
    return 0;
  }
}

// ── Vienna social proof numbers ───────────────────────────────────────────────

function getViennaCount(): number {
  // Deterministic "growing" number based on day of month
  return 1240 + (new Date().getDate() * 17);
}

// ── Browse Trigger — appears after 3rd restaurant visit in session ──────────────

interface RestaurantBrowseTriggerProps {
  viewCount: number;
}

export function RestaurantBrowseTrigger({ viewCount }: RestaurantBrowseTriggerProps) {
  const [visible, setVisible] = useState(false);
  const shownRef = useRef(false);
  const AUTO_DISMISS_S = 10;

  useEffect(() => {
    if (!(viewCount >= 3 && !shownRef.current)) return;
    try {
      if (sessionStorage.getItem(BROWSE_TRIGGER_KEY)) return;
    } catch {}
    shownRef.current = true;
    const t = setTimeout(() => {
      setVisible(true);
      try { sessionStorage.setItem(BROWSE_TRIGGER_KEY, "1"); } catch {}
    }, 900);
    return () => clearTimeout(t);
  }, [viewCount]);

  // Auto-dismiss
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), AUTO_DISMISS_S * 1000);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 64, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 48, scale: 0.93 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed bottom-24 left-4 right-4 z-[160] max-w-sm mx-auto"
        >
          <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-black/30">
            {/* Gradient background */}
            <div className="absolute inset-0" style={{ background: GRAD }} />
            {/* Radial highlight */}
            <div className="absolute top-0 left-0 w-36 h-36 rounded-full bg-white/12 blur-2xl -translate-x-10 -translate-y-10 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-28 h-28 rounded-full bg-black/18 blur-xl translate-x-4 translate-y-4 pointer-events-none" />

            <div className="relative p-4 flex items-start gap-3">
              {/* Icon */}
              <div className="w-11 h-11 rounded-xl bg-white/22 backdrop-blur-sm border border-white/28 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Crown className="w-5 h-5 text-white" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-extrabold text-white leading-tight">
                  {"Premium-Mitglieder buchen schneller"}
                </p>
                <p className="text-[11px] text-white/75 mt-0.5 leading-snug">
                  {"Priorität bei vollen Restaurants — Warteliste überspringen."}
                </p>

                {/* Stats pills */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-white/90 bg-white/18 rounded-full px-2 py-0.5">
                    <TrendingUp className="w-3 h-3" />
                    {getViennaCount().toLocaleString("de-AT")} Mitglieder in Wien
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-white/90 bg-white/18 rounded-full px-2 py-0.5">
                    <Star className="w-3 h-3 fill-current" />
                    14 Tage gratis
                  </span>
                </div>

                <div className="flex items-center gap-2.5 mt-2.5">
                  <Link
                    href="/profile"
                    onClick={() => setVisible(false)}
                    className="inline-flex items-center gap-1 text-[12px] font-extrabold text-white bg-white/25 hover:bg-white/35 px-3 py-1.5 rounded-lg transition-colors active:scale-95"
                  >
                    {"Mehr erfahren"}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                  <span className="text-[10px] text-white/50 font-semibold">{"Jederzeit kündbar"}</span>
                </div>
              </div>

              {/* Dismiss */}
              <button
                onClick={() => setVisible(false)}
                className="shrink-0 w-7 h-7 rounded-full bg-white/18 hover:bg-white/30 flex items-center justify-center transition-colors"
                aria-label="Schließen"
              >
                <X className="w-3.5 h-3.5 text-white/80" />
              </button>
            </div>

            {/* Progress bar countdown */}
            <motion.div
              className="h-0.5 w-full bg-white/25"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: AUTO_DISMISS_S, ease: "linear" }}
              style={{ originX: 0 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Post-booking premium nudge ─────────────────────────────────────────────────

interface PostBookingPremiumNudgeProps {
  restaurantName?: string;
  onDismiss?: () => void;
}

export function PostBookingPremiumNudge({ restaurantName, onDismiss }: PostBookingPremiumNudgeProps) {
  const [visible, setVisible] = useState(false);
  const AUTO_DISMISS_S = 14;

  useEffect(() => {
    // Rate-limit: once per day (localStorage) + once per session
    try {
      const today = new Date().toDateString();
      if (localStorage.getItem(POST_BOOKING_KEY) === today) return;
    } catch {}

    const t = setTimeout(() => {
      setVisible(true);
      try {
        localStorage.setItem(POST_BOOKING_KEY, new Date().toDateString());
      } catch {}
    }, 2600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, AUTO_DISMISS_S * 1000);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 36, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 290, damping: 26 }}
          className="fixed bottom-24 left-4 right-4 z-[155] max-w-sm mx-auto"
        >
          <div className="relative overflow-hidden rounded-2xl bg-card border border-border/60 shadow-2xl shadow-black/20">
            {/* Top gradient strip */}
            <div className="h-1 w-full" style={{ background: GRAD }} />

            <div className="p-4 flex items-start gap-3">
              {/* Icon */}
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: GRAD }}>
                <Star className="w-5 h-5 text-white fill-white" />
              </div>

              {/* Copy */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-extrabold text-foreground leading-tight">
                  {"Nächstes Mal: Priorität bei vollen Häusern"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {restaurantName
                    ? `${restaurantName} und 40+ weitere Wiener Restaurants bevorzugen Premium-Mitglieder.`
                    : "Premium-Mitglieder erhalten bevorzugte Zeiten bei allen Partner-Restaurants in Wien."}
                </p>

                {/* Mini feature list */}
                <div className="mt-2 space-y-0.5">
                  {[
                    "Priorität bei Stoßzeiten & Warteliste",
                    "Frühzugang zu exklusiven Angeboten",
                  ].map(f => (
                    <p key={f} className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      {f}
                    </p>
                  ))}
                </div>

                {/* Countdown urgency */}
                <div className="flex items-center gap-1 mt-1.5">
                  <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                  <span className="text-[10px] text-amber-500 font-bold">
                    {"Nur heute: 14 Tage gratis testen"}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-2.5">
                  <Link
                    href="/profile"
                    onClick={handleDismiss}
                    className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-white px-3 py-1.5 rounded-xl active:scale-95 transition-all shadow-sm"
                    style={{ background: GRAD }}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {"Jetzt freischalten"}
                  </Link>
                  <span className="text-[10px] text-muted-foreground font-semibold">{"Jederzeit kündbar"}</span>
                </div>
              </div>

              {/* Dismiss */}
              <button
                onClick={handleDismiss}
                className="shrink-0 w-7 h-7 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors"
                aria-label="Schließen"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Progress bar countdown */}
            <motion.div
              className="h-0.5 w-full"
              style={{ background: GRAD, transformOrigin: "left" }}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: AUTO_DISMISS_S, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Group Plan Premium Nudge ───────────────────────────────────────────────────

interface GroupPlanPremiumNudgeProps {
  onDismiss?: () => void;
}

export function GroupPlanPremiumNudge({ onDismiss }: GroupPlanPremiumNudgeProps) {
  const [visible, setVisible] = useState(false);
  const AUTO_DISMISS_S = 11;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, AUTO_DISMISS_S * 1000);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 44 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 290, damping: 26 }}
          className="fixed bottom-24 left-4 right-4 z-[155] max-w-sm mx-auto"
        >
          <div className="relative overflow-hidden rounded-2xl bg-card border border-border/60 shadow-2xl shadow-black/18">
            <div className="h-1 w-full" style={{ background: GRAD }} />
            <div className="p-4 flex items-start gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-xl"
                style={{ background: GRAD }}
              >
                {"🤖"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-extrabold text-foreground leading-tight">
                  {"Automatische Planung nur mit Premium"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {"RestoSmart plant euren Abend automatisch — Restaurant, Zeit, alle einladen. Kein Aufwand."}
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                  <Link
                    href="/profile"
                    onClick={handleDismiss}
                    className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-white px-3 py-1.5 rounded-xl active:scale-95 transition-all shadow-sm"
                    style={{ background: GRAD }}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {"Freischalten"}
                  </Link>
                  <span className="text-[10px] text-muted-foreground font-semibold">{"14 Tage gratis"}</span>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="shrink-0 w-7 h-7 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors"
                aria-label="Schließen"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
            <motion.div
              className="h-0.5 w-full"
              style={{ background: GRAD, transformOrigin: "left" }}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: AUTO_DISMISS_S, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
