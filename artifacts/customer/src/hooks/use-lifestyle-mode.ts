import { useEffect, useState, useCallback } from "react";

// ─── Mode Definitions ─────────────────────────────────────────────────────────

export type LifestyleMode = "morning" | "lunch" | "afternoon" | "evening" | "night";
export type BusinessTypePriority = "cafe" | "restaurant" | "bar" | "mixed";

export interface LifestyleModeConfig {
  mode: LifestyleMode;
  label: string;
  emoji: string;
  badgeLabel: string;

  // Hero copy
  headline: string;
  subline: string;
  searchPlaceholder: string;

  // Visual tone — tailwind gradient tokens
  heroFrom: string;
  heroTo: string;
  blobPrimary: string;
  blobAccent: string;
  accentColor: string;

  // Discovery priority
  primaryType: BusinessTypePriority;
  sections: ModeSection[];

  // CTA bottom copy
  ctaEmoji: string;
  ctaTitle: string;
  ctaSubtitle: string;
}

export interface ModeSection {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  businessType?: string;
  openNow?: boolean;
  featured?: boolean;
  maxItems: number;
  exploreLink: string;
  accent: "primary" | "amber" | "rose" | "violet" | "emerald";
}

// ─── Mode resolver ─────────────────────────────────────────────────────────────

function resolveMode(hour: number): LifestyleMode {
  if (hour >= 6 && hour < 11)  return "morning";
  if (hour >= 11 && hour < 14) return "lunch";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

// ─── Mode configs ─────────────────────────────────────────────────────────────

const MODE_CONFIGS: Record<LifestyleMode, LifestyleModeConfig> = {
  morning: {
    mode: "morning",
    label: "Guten Morgen",
    emoji: "☀️",
    badgeLabel: "Morgen-Modus",
    headline: "Starten Sie Ihren\nTag mit dem",
    subline: "Frühstück, Kaffee, Work-Spots — die besten Cafés der Stadt warten auf Sie.",
    searchPlaceholder: "Café, Kaffee oder Frühstücksort...",
    heroFrom: "from-amber-500/15",
    heroTo: "to-orange-400/8",
    blobPrimary: "from-amber-400/25 to-orange-300/12",
    blobAccent: "from-yellow-400/15 to-amber-300/8",
    accentColor: "amber",
    primaryType: "cafe",
    sections: [
      { id: "cafes-now", title: "Cafés jetzt geöffnet", subtitle: "Frisch gebrühter Kaffee wartet auf Sie", icon: "☕", businessType: "cafe", openNow: true, maxItems: 4, exploreLink: "/explore?businessType=cafe&openNow=true", accent: "amber" },
      { id: "breakfast", title: "Frühstückorte", subtitle: "Der perfekte Start in den Tag", icon: "🥐", businessType: "cafe", maxItems: 3, exploreLink: "/explore?businessType=cafe", accent: "amber" },
      { id: "featured-all", title: "Top Empfehlungen", subtitle: "Die meistdiskutierten Lokale der Stadt", icon: "⭐", featured: true, maxItems: 3, exploreLink: "/explore?featured=true", accent: "primary" },
    ],
    ctaEmoji: "☕",
    ctaTitle: "Alle Cafés entdecken",
    ctaSubtitle: "Kaffee, Frühstück, Work-friendly — finden Sie Ihren Morgenplatz.",
  },

  lunch: {
    mode: "lunch",
    label: "Mittagszeit",
    emoji: "🍽️",
    badgeLabel: "Mittags-Modus",
    headline: "Zeit für eine\nperfekte",
    subline: "Mittagspause, schnelle Gerichte, Top-bewertet — wählen Sie Ihr Lieblingslokal.",
    searchPlaceholder: "Restaurant, Gericht oder Küche...",
    heroFrom: "from-emerald-500/12",
    heroTo: "to-teal-400/6",
    blobPrimary: "from-primary/20 to-emerald-400/10",
    blobAccent: "from-teal-400/15 to-primary/8",
    accentColor: "emerald",
    primaryType: "restaurant",
    sections: [
      { id: "open-now", title: "Jetzt geöffnet", subtitle: "Hunger jetzt? Diese Lokale warten auf Sie", icon: "🟢", openNow: true, maxItems: 4, exploreLink: "/explore?openNow=true", accent: "emerald" },
      { id: "restaurants-lunch", title: "Restaurants in der Nähe", subtitle: "Beliebte Mittagsküchen", icon: "🍽️", businessType: "restaurant", maxItems: 3, exploreLink: "/explore?businessType=restaurant", accent: "primary" },
      { id: "featured-lunch", title: "Empfehlenswert", subtitle: "Von Gästen hoch bewertet", icon: "⭐", featured: true, maxItems: 3, exploreLink: "/explore?featured=true", accent: "primary" },
    ],
    ctaEmoji: "🍽️",
    ctaTitle: "Alle Restaurants entdecken",
    ctaSubtitle: "Filtern nach Küche, Preis, Bewertung und Verfügbarkeit.",
  },

  afternoon: {
    mode: "afternoon",
    label: "Guten Nachmittag",
    emoji: "🌅",
    badgeLabel: "Nachmittags-Modus",
    headline: "Machen Sie eine\nPause beim",
    subline: "Kaffee, Kuchen, entspannte Nachmittagsplätze — laden Sie Ihre Energie auf.",
    searchPlaceholder: "Café, Restaurant oder Lokal...",
    heroFrom: "from-violet-500/12",
    heroTo: "to-primary/6",
    blobPrimary: "from-primary/20 to-accent/12",
    blobAccent: "from-violet-400/15 to-accent/10",
    accentColor: "violet",
    primaryType: "mixed",
    sections: [
      { id: "cafes-afternoon", title: "Nachmittags-Cafés", subtitle: "Kaffee & Kuchen — der perfekte Stopp", icon: "☕", businessType: "cafe", maxItems: 4, exploreLink: "/explore?businessType=cafe", accent: "amber" },
      { id: "featured-pm", title: "Top Empfehlungen", subtitle: "Die meistdiskutierten Lokale der Stadt", icon: "⭐", featured: true, maxItems: 3, exploreLink: "/explore?featured=true", accent: "primary" },
      { id: "open-pm", title: "Jetzt geöffnet", subtitle: "Alles was Sie heute brauchen", icon: "🟢", openNow: true, maxItems: 4, exploreLink: "/explore?openNow=true", accent: "emerald" },
    ],
    ctaEmoji: "🌅",
    ctaTitle: "Lokal für den Nachmittag finden",
    ctaSubtitle: "Cafés, Restaurants, Bars — entdecken Sie Ihren Platz.",
  },

  evening: {
    mode: "evening",
    label: "Guten Abend",
    emoji: "🌆",
    badgeLabel: "Abend-Modus",
    headline: "Ihr perfekter\nAbend beginnt",
    subline: "Abendessen, Cocktails, Chill-Spots — machen Sie den Abend unvergesslich.",
    searchPlaceholder: "Restaurant, Bar oder Lokal...",
    heroFrom: "from-primary/16",
    heroTo: "to-accent/10",
    blobPrimary: "from-primary/22 to-violet-500/14",
    blobAccent: "from-accent/18 to-rose-400/10",
    accentColor: "violet",
    primaryType: "mixed",
    sections: [
      { id: "restaurants-eve", title: "Abendessen", subtitle: "Top Restaurants für den Abend", icon: "🍽️", businessType: "restaurant", maxItems: 3, exploreLink: "/explore?businessType=restaurant&openNow=true", accent: "primary" },
      { id: "bars-eve", title: "Bars & Cocktails", subtitle: "Entspannen Sie mit einem Drink", icon: "🍸", businessType: "bar", maxItems: 3, exploreLink: "/explore?businessType=bar", accent: "rose" },
      { id: "open-eve", title: "Jetzt geöffnet", subtitle: "Alles was heute Abend wartet", icon: "🟢", openNow: true, maxItems: 4, exploreLink: "/explore?openNow=true", accent: "emerald" },
    ],
    ctaEmoji: "🌆",
    ctaTitle: "Abendprogramm entdecken",
    ctaSubtitle: "Restaurants, Bars, Cafés — alles für einen unvergesslichen Abend.",
  },

  night: {
    mode: "night",
    label: "Gute Nacht",
    emoji: "🌙",
    badgeLabel: "Nacht-Modus",
    headline: "Die Nacht\ngehört Ihnen",
    subline: "Bars, Nightlife, Happy Hour — erleben Sie London nach Einbruch der Dunkelheit.",
    searchPlaceholder: "Bar, Club oder Late-Night-Spot...",
    heroFrom: "from-indigo-600/18",
    heroTo: "to-violet-700/12",
    blobPrimary: "from-violet-600/25 to-indigo-500/16",
    blobAccent: "from-rose-500/20 to-accent/14",
    accentColor: "rose",
    primaryType: "bar",
    sections: [
      { id: "bars-night", title: "Bars & Nightlife", subtitle: "Die angesagtesten Spots heute Nacht", icon: "🍸", businessType: "bar", openNow: true, maxItems: 4, exploreLink: "/explore?businessType=bar&openNow=true", accent: "rose" },
      { id: "happy-hour", title: "Happy Hour & Angebote", subtitle: "Flash-Deals und Sonderangebote", icon: "⚡", featured: true, maxItems: 3, exploreLink: "/explore?featured=true", accent: "violet" },
      { id: "open-late", title: "Nachtbetrieb", subtitle: "Auch spät noch geöffnet", icon: "🌃", openNow: true, maxItems: 4, exploreLink: "/explore?openNow=true", accent: "primary" },
    ],
    ctaEmoji: "🌙",
    ctaTitle: "Nightlife entdecken",
    ctaSubtitle: "Bars, Cocktails, Late-Night — die besten Spots der Stadt.",
  },
};

// ─── Behavior tracking ─────────────────────────────────────────────────────────

const BEHAVIOR_KEY = "restosmart_lifestyle_interactions";

export interface LifestyleInteractions {
  cafe: number;
  restaurant: number;
  bar: number;
  lastUpdated: number;
}

function readInteractions(): LifestyleInteractions {
  try {
    const raw = localStorage.getItem(BEHAVIOR_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return { cafe: 0, restaurant: 0, bar: 0, lastUpdated: Date.now() };
}

export function trackBusinessTypeInteraction(type: string) {
  try {
    const data = readInteractions();
    const key = type as keyof Omit<LifestyleInteractions, "lastUpdated">;
    if (key in data && key !== "lastUpdated") {
      (data as any)[key] = ((data as any)[key] ?? 0) + 1;
      data.lastUpdated = Date.now();
      localStorage.setItem(BEHAVIOR_KEY, JSON.stringify(data));
    }
  } catch { /* */ }
}

// ─── Priority boosting based on behavior ──────────────────────────────────────

function getBoostedPrimaryType(
  baseType: BusinessTypePriority,
  interactions: LifestyleInteractions
): BusinessTypePriority {
  if (baseType !== "mixed") return baseType;

  const { cafe, restaurant, bar } = interactions;
  const total = cafe + restaurant + bar;
  if (total < 5) return "mixed";

  if (cafe / total > 0.5) return "cafe";
  if (bar / total > 0.4) return "bar";
  if (restaurant / total > 0.5) return "restaurant";
  return "mixed";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLifestyleMode() {
  const [mode, setMode] = useState<LifestyleMode>(() => resolveMode(new Date().getHours()));
  const [interactions, setInteractions] = useState<LifestyleInteractions>(() => readInteractions());

  // Re-check every 5 minutes for mode transitions
  useEffect(() => {
    const id = setInterval(() => {
      setMode(resolveMode(new Date().getHours()));
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const track = useCallback((type: string) => {
    trackBusinessTypeInteraction(type);
    setInteractions(readInteractions());
  }, []);

  const config = MODE_CONFIGS[mode];
  const boostedType = getBoostedPrimaryType(config.primaryType, interactions);

  return {
    mode,
    config,
    boostedPrimaryType: boostedType,
    interactions,
    track,
  };
}
