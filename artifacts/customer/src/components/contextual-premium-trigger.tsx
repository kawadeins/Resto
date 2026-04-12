/**
 * Contextual Premium Triggers — customer-side monetization nudges.
 *
 * - RestaurantBrowseTrigger: shows after visiting 3+ restaurants in a session
 * - PostBookingPremiumNudge: shows after a successful booking
 * - GroupPlanPremiumNudge: shows after creating a group plan
 *
 * All are non-aggressive slide-up toasts with clear dismiss.
 * CTA: /for-business (or /profile for customer-facing premium)
 */

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Crown, X, ChevronRight, Zap, Star } from "lucide-react";

const GRAD = "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))";
const BROWSE_KEY = "rs_restaurant_views_session";

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

// ── Browse Trigger ─────────────────────────────────────────────────────────────

interface RestaurantBrowseTriggerProps {
  viewCount: number;
}

/**
 * Show after 3rd restaurant browse in session.
 * Only once per session.
 */
export function RestaurantBrowseTrigger({ viewCount }: RestaurantBrowseTriggerProps) {
  const [visible, setVisible] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (viewCount >= 3 && !shownRef.current) {
      shownRef.current = true;
      const t = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(t);
    }
  }, [viewCount]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 56, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.94 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="fixed bottom-24 left-4 right-4 z-[160] max-w-sm mx-auto"
        >
          <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-black/20">
            <div className="absolute inset-0" style={{ background: GRAD }} />
            <div className="absolute inset-0 bg-black/10" />
            <div className="relative p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-white leading-tight">
                  {"Premium-Mitglieder buchen schneller"}
                </p>
                <p className="text-[11px] text-white/70 mt-0.5 leading-snug">
                  {"Priorität bei beliebten Restaurants — nie mehr Warteschlange."}
                </p>
                <div className="flex items-center gap-3 mt-2.5">
                  <Link
                    href="/profile"
                    onClick={() => setVisible(false)}
                    className="inline-flex items-center gap-1 text-[12px] font-extrabold text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {"Mehr erfahren"}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                  <span className="text-[10px] text-white/50 font-semibold">{"14 Tage gratis"}</span>
                </div>
              </div>
              <button
                onClick={() => setVisible(false)}
                className="shrink-0 w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors mt-0.5"
              >
                <X className="w-3 h-3 text-white/80" />
              </button>
            </div>
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

/**
 * Shows after a successful booking.
 * Highlights premium priority booking feature.
 */
export function PostBookingPremiumNudge({ restaurantName, onDismiss }: PostBookingPremiumNudgeProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 2200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 9000);
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
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className="fixed bottom-24 left-4 right-4 z-[155] max-w-sm mx-auto"
        >
          <div className="relative overflow-hidden rounded-2xl bg-card border border-border shadow-2xl shadow-black/15">
            {/* Top accent strip */}
            <div className="h-1 w-full" style={{ background: GRAD }} />

            <div className="p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: GRAD }}>
                <Star className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-foreground leading-tight">
                  {"Nächstes Mal: Priorität bei vollen Häusern"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {restaurantName
                    ? `${restaurantName} und 40+ weitere Restaurants bevorzugen Premium-Mitglieder.`
                    : "Premium-Mitglieder erhalten bevorzugte Buchungszeiten bei allen Restaurants."}
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                  <Link
                    href="/profile"
                    onClick={handleDismiss}
                    className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-white px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                    style={{ background: GRAD }}
                  >
                    <Zap className="w-3 h-3" />
                    {"14 Tage gratis"}
                  </Link>
                  <span className="text-[10px] text-muted-foreground font-semibold">{"Jederzeit kündbar"}</span>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="shrink-0 w-6 h-6 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors mt-0.5"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
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

/**
 * Shows after creating a group plan.
 * Highlights automatic planning as a premium feature.
 */
export function GroupPlanPremiumNudge({ onDismiss }: GroupPlanPremiumNudgeProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 10000);
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
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className="fixed bottom-24 left-4 right-4 z-[155] max-w-sm mx-auto"
        >
          <div className="relative overflow-hidden rounded-2xl bg-card border border-border shadow-2xl shadow-black/15">
            <div className="h-1 w-full" style={{ background: GRAD }} />
            <div className="p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl" style={{ background: GRAD }}>
                {"🤖"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-foreground leading-tight">
                  {"Automatische Planung nur mit Premium"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {"Lass RestoSmart euren nächsten Abend automatisch planen — Restaurant, Zeit, alle einladen."}
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                  <Link
                    href="/profile"
                    onClick={handleDismiss}
                    className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-white px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                    style={{ background: GRAD }}
                  >
                    <Zap className="w-3 h-3" />
                    {"Freischalten"}
                  </Link>
                  <span className="text-[10px] text-muted-foreground font-semibold">{"14 Tage gratis"}</span>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="shrink-0 w-6 h-6 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors mt-0.5"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
