/**
 * Return Triggers — contextual suggestions that appear after key interactions.
 *
 * - PostBookingTrigger: "Lade Freunde ein" slide-up card after a successful booking
 * - PostScrollTrigger: "Noch mehr entdecken →" prompt after reaching page bottom
 * - PostLikeTrigger: "Noch mehr entdecken" inline chip after liking
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Users, Compass, X, ChevronRight } from "lucide-react";

// ── Post-booking: "Lade Freunde ein" ─────────────────────────────────────────

interface PostBookingTriggerProps {
  restaurantName?: string;
  onDismiss?: () => void;
}

export function PostBookingTrigger({ restaurantName, onDismiss }: PostBookingTriggerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
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
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed bottom-6 left-4 right-4 z-[150] max-w-md mx-auto"
        >
          <div className="relative overflow-hidden rounded-2xl bg-card border border-border shadow-2xl shadow-black/15 p-4 flex items-start gap-3">
            {/* Icon */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-foreground leading-tight">
                {"Lade Freunde ein!"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {restaurantName
                  ? `Teile deinen Tisch bei ${restaurantName} mit Freunden.`
                  : "Teile dieses Erlebnis mit Freunden."}
              </p>
              <Link
                href="/friends"
                className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-primary hover:underline"
              >
                {"Freunde einladen"}
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="shrink-0 w-6 h-6 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Post-scroll: "Noch mehr entdecken" ───────────────────────────────────────

export function PostScrollTrigger() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const handleScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total    = document.documentElement.scrollHeight;
      if (scrolled > total * 0.88 && !show) setShow(true);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [show, dismissed]);

  if (dismissed || !show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="flex justify-center py-6"
      >
        <Link
          href="/explore"
          onClick={() => setDismissed(true)}
          className="inline-flex items-center gap-2 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/15 px-5 py-2.5 rounded-full transition-colors press-scale"
        >
          <Compass className="w-4 h-4" />
          {"Noch mehr entdecken"}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Post-like: "Folge diesem Nutzer" / discover chip ─────────────────────────

interface PostLikeChipProps {
  onDismiss?: () => void;
}

export function PostLikeChip({ onDismiss }: PostLikeChipProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.25 }}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 cursor-pointer hover:bg-primary/15 transition-colors"
          onClick={() => {
            setVisible(false);
            onDismiss?.();
          }}
        >
          <Compass className="w-3 h-3" />
          {"Mehr entdecken"}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
