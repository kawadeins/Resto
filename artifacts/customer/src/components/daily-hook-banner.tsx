/**
 * DailyHookBanner — "daily reason to open the app"
 *
 * Shows a time-of-day personalised banner with:
 *  - A warm greeting + context-aware message
 *  - Three rotating content-type chips that update daily
 *  - Dismissible per session
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { X, Flame, TrendingUp, Tag, Compass } from "lucide-react";

// ── Time slot config ──────────────────────────────────────────────────────────

type Slot = "morning" | "lunch" | "afternoon" | "evening" | "night";

function getSlot(): Slot {
  const h = new Date().getHours();
  if (h >= 6  && h < 11) return "morning";
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 15 && h < 18) return "afternoon";
  if (h >= 18 && h < 22) return "evening";
  return "night";
}

const SLOT_CONFIG: Record<Slot, {
  greeting: string;
  emoji: string;
  subline: string;
  gradient: string;
  chipBg: string;
}> = {
  morning: {
    greeting: "Guten Morgen",
    emoji: "☕",
    subline: "Die besten Frühstücks-Spots warten auf dich",
    gradient: "from-amber-500/10 via-orange-400/6 to-transparent",
    chipBg: "bg-amber-50 text-amber-700 border-amber-200",
  },
  lunch: {
    greeting: "Mittagszeit",
    emoji: "🍜",
    subline: "Jetzt schnell reservieren — Tische füllen sich",
    gradient: "from-primary/8 via-accent/5 to-transparent",
    chipBg: "bg-primary/10 text-primary border-primary/20",
  },
  afternoon: {
    greeting: "Guter Nachmittag",
    emoji: "🎯",
    subline: "Entdecke neue Cafés und Spots in deiner Nähe",
    gradient: "from-violet-500/8 via-purple-400/5 to-transparent",
    chipBg: "bg-violet-50 text-violet-700 border-violet-200",
  },
  evening: {
    greeting: "Guten Abend",
    emoji: "🌆",
    subline: "Wiens beste Restaurants — heute Abend noch verfügbar",
    gradient: "from-rose-500/8 via-pink-400/5 to-transparent",
    chipBg: "bg-rose-50 text-rose-700 border-rose-200",
  },
  night: {
    greeting: "Die Nacht gehört dir",
    emoji: "🌙",
    subline: "Entdecke Wiens beste Bars und Nachtleben",
    gradient: "from-slate-700/10 via-violet-500/6 to-transparent",
    chipBg: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

// ── Daily content chips ────────────────────────────────────────────────────────

const CHIPS: Array<{
  label: string;
  icon: typeof Flame;
  href: string;
  slot?: Slot[];
}> = [
  { label: "Top Spots heute",         icon: TrendingUp, href: "/explore?rating=4" },
  { label: "Nur heute Rabatte",       icon: Tag,        href: "/explore?flash=true" },
  { label: "Trending in Wien",        icon: Flame,      href: "/explore?trending=true" },
  { label: "Jetzt geöffnet",          icon: Compass,    href: "/explore?open=true" },
  { label: "Frühstücks-Spots",        icon: Compass,    href: "/explore?businessType=cafe", slot: ["morning"] },
  { label: "Lunch-Deals",             icon: Tag,        href: "/explore?businessType=restaurant", slot: ["lunch"] },
  { label: "Happy Hour",              icon: Flame,      href: "/explore?businessType=bar", slot: ["afternoon", "evening"] },
  { label: "Nachtleben",              icon: TrendingUp, href: "/explore?businessType=bar", slot: ["night"] },
];

function getDailyChips(slot: Slot): typeof CHIPS {
  const today = new Date().toISOString().slice(0, 10);
  const seed = [...today].reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const slotChips = CHIPS.filter(c => !c.slot || c.slot.includes(slot));
  const general   = slotChips.filter(c => !c.slot);
  const specific  = slotChips.filter(c => c.slot);

  const shuffled = [...specific, ...general.sort((a, b) => {
    const ha = [...(a.label + seed)].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hb = [...(b.label + seed)].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return ha - hb;
  })];

  return shuffled.slice(0, 3);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DailyHookBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [slot, setSlot] = useState<Slot>("morning");

  useEffect(() => {
    setSlot(getSlot());
    const wasDismissed = sessionStorage.getItem("rs_daily_hook_dismissed") === "1";
    if (wasDismissed) setDismissed(true);
  }, []);

  if (dismissed) return null;

  const cfg   = SLOT_CONFIG[slot];
  const chips = getDailyChips(slot);

  return (
    <AnimatePresence>
      <motion.section
        key="daily-hook"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`bg-gradient-to-r ${cfg.gradient} border-b border-border/30`}
      >
        <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">

          {/* Greeting */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl leading-none">{cfg.emoji}</span>
            <div className="hidden sm:block">
              <p className="text-sm font-extrabold text-foreground leading-tight">{cfg.greeting}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{cfg.subline}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-7 bg-border/50 shrink-0" />

          {/* Chips */}
          <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide">
            {chips.map((chip) => {
              const Icon = chip.icon;
              return (
                <Link
                  key={chip.label}
                  href={chip.href}
                  className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all hover:scale-[1.03] active:scale-[0.97] press-scale ${cfg.chipBg}`}
                >
                  <Icon className="w-3 h-3" />
                  {chip.label}
                </Link>
              );
            })}
          </div>

          {/* Dismiss */}
          <button
            onClick={() => {
              sessionStorage.setItem("rs_daily_hook_dismissed", "1");
              setDismissed(true);
            }}
            className="shrink-0 w-6 h-6 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
            aria-label="Schließen"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </motion.section>
    </AnimatePresence>
  );
}
