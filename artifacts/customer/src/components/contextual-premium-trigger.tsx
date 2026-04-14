/**
 * Contextual Premium Triggers — shown at high-intent moments.
 *
 * - RestaurantBrowseTrigger: tracks restaurant page views in sessionStorage;
 *   at the 3rd view shows a slide-up premium nudge.
 * - PostBookingPremiumNudge: shown after a successful booking to pitch
 *   priority seating & exclusive offers with Premium.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Sparkles, X, ChevronRight, Star, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

// ── sessionStorage helpers ────────────────────────────────────────────────────

const VIEW_KEY = "rs_restaurant_views";

function getViewCount(): number {
  try {
    return parseInt(sessionStorage.getItem(VIEW_KEY) ?? "0", 10);
  } catch {
    return 0;
  }
}

function incrementViewCount(): number {
  try {
    const next = getViewCount() + 1;
    sessionStorage.setItem(VIEW_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}

const SHOWN_KEY = "rs_browse_nudge_shown";

function markNudgeShown() {
  try {
    sessionStorage.setItem(SHOWN_KEY, "1");
  } catch {
    /* ignore */
  }
}

function wasNudgeShown(): boolean {
  try {
    return sessionStorage.getItem(SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

// ── RestaurantBrowseTrigger ───────────────────────────────────────────────────

export function RestaurantBrowseTrigger() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!wasNudgeShown()) {
      const count = incrementViewCount();
      if (count >= 3) {
        timer = setTimeout(() => setVisible(true), 1800);
      }
    }
    return () => { if (timer !== undefined) clearTimeout(timer); };
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    markNudgeShown();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 56 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 48 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className="fixed bottom-6 left-4 right-4 z-[160] max-w-md mx-auto"
        >
          <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-black/20">
            {/* Gradient background */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))",
              }}
            />
            {/* Shimmer sweep */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.12) 50%,transparent 65%)",
              }}
              animate={{ x: ["-100%", "200%"] }}
              transition={{
                repeat: Infinity,
                duration: 2.8,
                ease: "linear",
                repeatDelay: 1.8,
              }}
            />

            <div className="relative p-4 flex items-start gap-3">
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 border border-white/25">
                <Star className="w-5 h-5 text-white fill-white/80" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-white leading-tight">
                  {t("home.browse_trigger_title")}
                </p>
                <p className="text-xs text-white/70 mt-0.5 leading-snug">
                  {t("home.browse_trigger_desc")}
                </p>
                <Link
                  href="/profile"
                  onClick={handleDismiss}
                  className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-white hover:text-white/80 transition-colors"
                >
                  {t("home.browse_trigger_cta")}
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {/* Dismiss */}
              <button
                onClick={handleDismiss}
                className="shrink-0 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors border border-white/20"
                aria-label={t("home.browse_trigger_dismiss")}
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── PostBookingPremiumNudge ───────────────────────────────────────────────────

interface PostBookingPremiumNudgeProps {
  onDismiss?: () => void;
}

export function PostBookingPremiumNudge({
  onDismiss,
}: PostBookingPremiumNudgeProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(timer);
  }, []);

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
          exit={{ opacity: 0, y: 32 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed bottom-6 left-4 right-4 z-[155] max-w-md mx-auto"
        >
          <div className="relative overflow-hidden rounded-2xl bg-card border border-border shadow-2xl shadow-black/15">
            {/* Top accent bar */}
            <div
              className="absolute top-0 left-0 right-0 h-0.5"
              style={{
                background:
                  "linear-gradient(90deg,hsl(263,70%,52%),hsl(330,85%,58%))",
              }}
            />

            <div className="p-4 flex items-start gap-3 pt-5">
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))",
                }}
              >
                <Zap className="w-5 h-5 text-white" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <p className="text-sm font-extrabold text-foreground leading-tight">
                    {t("restaurant.premium_nudge_title")}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  {t("restaurant.premium_nudge_desc")}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <Link
                    href="/profile"
                    onClick={handleDismiss}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                  >
                    {t("restaurant.premium_nudge_cta")}
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                  <button
                    onClick={handleDismiss}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t("restaurant.premium_nudge_dismiss")}
                  </button>
                </div>
              </div>

              {/* Dismiss X */}
              <button
                onClick={handleDismiss}
                className="shrink-0 w-6 h-6 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                aria-label={t("restaurant.premium_nudge_dismiss")}
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
