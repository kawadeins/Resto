/**
 * LevelUpModal — celebration when user reaches a new tier
 *
 * Usage: <LevelUpModal tier="Silver" onClose={() => ...} />
 * Check localStorage key "rs_tier_celebrated" to avoid repeat shows.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star } from "lucide-react";

type Tier = "Bronze" | "Silver" | "Gold" | "Elite";

const TIER_CONFIG: Record<Tier, {
  emoji: string;
  title: string;
  subline: string;
  gradient: string;
  shadow: string;
  badgeCls: string;
}> = {
  Bronze: {
    emoji: "🥉",
    title: "Willkommen, Bronze-Mitglied!",
    subline: "Du hast deinen ersten Meilenstein erreicht. Buche weiter und sammle Punkte.",
    gradient: "from-amber-700 to-amber-500",
    shadow: "shadow-amber-300/50",
    badgeCls: "bg-amber-100 text-amber-800 border-amber-300",
  },
  Silver: {
    emoji: "🥈",
    title: "Du bist jetzt Silver-Mitglied!",
    subline: "Exklusive Angebote und früher Zugang zu Deals warten auf dich.",
    gradient: "from-slate-600 to-slate-400",
    shadow: "shadow-slate-300/50",
    badgeCls: "bg-slate-100 text-slate-700 border-slate-300",
  },
  Gold: {
    emoji: "🥇",
    title: "Gold-Status erreicht!",
    subline: "Du gehörst zur Elite der RestoSmart-Community. Genieße Premium-Vorteile.",
    gradient: "from-yellow-500 to-amber-400",
    shadow: "shadow-yellow-300/50",
    badgeCls: "bg-yellow-100 text-yellow-800 border-yellow-400",
  },
  Elite: {
    emoji: "👑",
    title: "Elite-Status freigeschaltet!",
    subline: "Du bist auf dem höchsten Level. Featured-Profil, Bonus-Sichtbarkeit und mehr.",
    gradient: "from-primary to-accent",
    shadow: "shadow-primary/40",
    badgeCls: "bg-primary/10 text-primary border-primary/30",
  },
};

// ── Confetti dots ─────────────────────────────────────────────────────────────

const DOTS = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: Math.cos((i / 12) * Math.PI * 2) * 120,
  y: Math.sin((i / 12) * Math.PI * 2) * 120,
  color: ["bg-primary", "bg-accent", "bg-amber-400", "bg-emerald-400", "bg-rose-400"][i % 5],
  size: [2.5, 3, 2, 3.5, 2][i % 5],
}));

// ── Component ─────────────────────────────────────────────────────────────────

interface LevelUpModalProps {
  tier: Tier;
  onClose: () => void;
}

export function LevelUpModal({ tier, onClose }: LevelUpModalProps) {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.Bronze;

  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        key="level-up-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center px-4"
        onClick={onClose}
      >
        <motion.div
          key="level-up-card"
          initial={{ scale: 0.7, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="relative bg-card rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Dismiss */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Confetti dots */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {DOTS.map(dot => (
              <motion.div
                key={dot.id}
                initial={{ x: "50%", y: "50%", opacity: 0, scale: 0 }}
                animate={{
                  x: `calc(50% + ${dot.x}px)`,
                  y: `calc(50% + ${dot.y}px)`,
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                }}
                transition={{ duration: 1.2, delay: 0.1 + dot.id * 0.04, ease: "easeOut" }}
                className={`absolute w-${Math.round(dot.size)} h-${Math.round(dot.size)} rounded-full ${dot.color}`}
                style={{ width: `${dot.size * 4}px`, height: `${dot.size * 4}px` }}
              />
            ))}
          </div>

          {/* Badge icon */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.15 }}
            className={`mx-auto mb-5 w-20 h-20 rounded-3xl bg-gradient-to-br ${cfg.gradient} ${cfg.shadow} shadow-xl flex items-center justify-center`}
          >
            <span className="text-4xl leading-none">{cfg.emoji}</span>
          </motion.div>

          {/* Stars burst */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex justify-center gap-1 mb-4"
          >
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.35 + i * 0.08 }}
              >
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              </motion.div>
            ))}
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-xl font-extrabold text-foreground mb-2"
          >
            {cfg.title}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-sm text-muted-foreground leading-relaxed mb-6"
          >
            {cfg.subline}
          </motion.p>

          {/* Tier badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45 }}
            className="inline-flex items-center gap-1.5 mb-6"
          >
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${cfg.badgeCls}`}>
              {tier} Mitglied
            </span>
          </motion.div>

          {/* CTA */}
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-extrabold text-[15px] hover:opacity-90 active:scale-[0.98] transition-all"
          >
            {"Los geht's \uD83D\uDE80"}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Hook to manage level-up state ─────────────────────────────────────────────

export function checkAndShowLevelUp(currentTier: string): string | null {
  const key = "rs_tier_celebrated";
  const celebrated = localStorage.getItem(key);
  if (celebrated === currentTier) return null;
  if (!celebrated && currentTier === "Bronze") return null; // don't show on first load
  localStorage.setItem(key, currentTier);
  return currentTier;
}
