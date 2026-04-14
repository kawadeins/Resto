import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

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

// ─── Section ID → i18n key helper ────────────────────────────────────────────

function secKey(id: string, field: "title" | "sub"): string {
  return `home.sec_${id.replace(/-/g, "_")}_${field}`;
}

// ─── Mode configs factory ─────────────────────────────────────────────────────

function getModeConfigs(t: (key: string) => string): Record<LifestyleMode, LifestyleModeConfig> {
  return {
    morning: {
      mode: "morning",
      label: t("home.mode_morning_label"),
      emoji: "☀️",
      badgeLabel: t("home.mode_morning_badge"),
      headline: t("home.mode_morning_headline"),
      subline: t("home.mode_morning_subline"),
      searchPlaceholder: t("home.mode_morning_search"),
      heroFrom: "from-amber-500/15",
      heroTo: "to-orange-400/8",
      blobPrimary: "from-amber-400/25 to-orange-300/12",
      blobAccent: "from-yellow-400/15 to-amber-300/8",
      accentColor: "amber",
      primaryType: "cafe",
      sections: [
        { id: "cafes-now",    title: t(secKey("cafes-now","title")),    subtitle: t(secKey("cafes-now","sub")),    icon: "☕", businessType: "cafe", openNow: true, maxItems: 4, exploreLink: "/explore?businessType=cafe&openNow=true", accent: "amber" },
        { id: "breakfast",   title: t(secKey("breakfast","title")),     subtitle: t(secKey("breakfast","sub")),     icon: "🥐", businessType: "cafe", maxItems: 3, exploreLink: "/explore?businessType=cafe", accent: "amber" },
        { id: "featured-all",title: t(secKey("featured-all","title")),  subtitle: t(secKey("featured-all","sub")),  icon: "⭐", featured: true, maxItems: 3, exploreLink: "/explore?featured=true", accent: "primary" },
      ],
      ctaEmoji: "☕",
      ctaTitle: t("home.mode_morning_cta_title"),
      ctaSubtitle: t("home.mode_morning_cta_sub"),
    },

    lunch: {
      mode: "lunch",
      label: t("home.mode_lunch_label"),
      emoji: "🍽️",
      badgeLabel: t("home.mode_lunch_badge"),
      headline: t("home.mode_lunch_headline"),
      subline: t("home.mode_lunch_subline"),
      searchPlaceholder: t("home.mode_lunch_search"),
      heroFrom: "from-emerald-500/12",
      heroTo: "to-teal-400/6",
      blobPrimary: "from-primary/20 to-emerald-400/10",
      blobAccent: "from-teal-400/15 to-primary/8",
      accentColor: "emerald",
      primaryType: "restaurant",
      sections: [
        { id: "open-now",          title: t(secKey("open-now","title")),          subtitle: t(secKey("open-now","sub")),          icon: "🟢", openNow: true, maxItems: 4, exploreLink: "/explore?openNow=true", accent: "emerald" },
        { id: "restaurants-lunch", title: t(secKey("restaurants-lunch","title")), subtitle: t(secKey("restaurants-lunch","sub")), icon: "🍽️", businessType: "restaurant", maxItems: 3, exploreLink: "/explore?businessType=restaurant", accent: "primary" },
        { id: "featured-lunch",    title: t(secKey("featured-lunch","title")),    subtitle: t(secKey("featured-lunch","sub")),    icon: "⭐", featured: true, maxItems: 3, exploreLink: "/explore?featured=true", accent: "primary" },
      ],
      ctaEmoji: "🍽️",
      ctaTitle: t("home.mode_lunch_cta_title"),
      ctaSubtitle: t("home.mode_lunch_cta_sub"),
    },

    afternoon: {
      mode: "afternoon",
      label: t("home.mode_afternoon_label"),
      emoji: "🌅",
      badgeLabel: t("home.mode_afternoon_badge"),
      headline: t("home.mode_afternoon_headline"),
      subline: t("home.mode_afternoon_subline"),
      searchPlaceholder: t("home.mode_afternoon_search"),
      heroFrom: "from-violet-500/12",
      heroTo: "to-primary/6",
      blobPrimary: "from-primary/20 to-accent/12",
      blobAccent: "from-violet-400/15 to-accent/10",
      accentColor: "violet",
      primaryType: "mixed",
      sections: [
        { id: "cafes-afternoon", title: t(secKey("cafes-afternoon","title")), subtitle: t(secKey("cafes-afternoon","sub")), icon: "☕", businessType: "cafe", maxItems: 4, exploreLink: "/explore?businessType=cafe", accent: "amber" },
        { id: "featured-pm",     title: t(secKey("featured-pm","title")),     subtitle: t(secKey("featured-pm","sub")),     icon: "⭐", featured: true, maxItems: 3, exploreLink: "/explore?featured=true", accent: "primary" },
        { id: "open-pm",         title: t(secKey("open-pm","title")),         subtitle: t(secKey("open-pm","sub")),         icon: "🟢", openNow: true, maxItems: 4, exploreLink: "/explore?openNow=true", accent: "emerald" },
      ],
      ctaEmoji: "🌅",
      ctaTitle: t("home.mode_afternoon_cta_title"),
      ctaSubtitle: t("home.mode_afternoon_cta_sub"),
    },

    evening: {
      mode: "evening",
      label: t("home.mode_evening_label"),
      emoji: "🌆",
      badgeLabel: t("home.mode_evening_badge"),
      headline: t("home.mode_evening_headline"),
      subline: t("home.mode_evening_subline"),
      searchPlaceholder: t("home.mode_evening_search"),
      heroFrom: "from-primary/16",
      heroTo: "to-accent/10",
      blobPrimary: "from-primary/22 to-violet-500/14",
      blobAccent: "from-accent/18 to-rose-400/10",
      accentColor: "violet",
      primaryType: "mixed",
      sections: [
        { id: "restaurants-eve", title: t(secKey("restaurants-eve","title")), subtitle: t(secKey("restaurants-eve","sub")), icon: "🍽️", businessType: "restaurant", maxItems: 3, exploreLink: "/explore?businessType=restaurant&openNow=true", accent: "primary" },
        { id: "bars-eve",        title: t(secKey("bars-eve","title")),        subtitle: t(secKey("bars-eve","sub")),        icon: "🍸", businessType: "bar", maxItems: 3, exploreLink: "/explore?businessType=bar", accent: "rose" },
        { id: "open-eve",        title: t(secKey("open-eve","title")),        subtitle: t(secKey("open-eve","sub")),        icon: "🟢", openNow: true, maxItems: 4, exploreLink: "/explore?openNow=true", accent: "emerald" },
      ],
      ctaEmoji: "🌆",
      ctaTitle: t("home.mode_evening_cta_title"),
      ctaSubtitle: t("home.mode_evening_cta_sub"),
    },

    night: {
      mode: "night",
      label: t("home.mode_night_label"),
      emoji: "🌙",
      badgeLabel: t("home.mode_night_badge"),
      headline: t("home.mode_night_headline"),
      subline: t("home.mode_night_subline"),
      searchPlaceholder: t("home.mode_night_search"),
      heroFrom: "from-indigo-600/18",
      heroTo: "to-violet-700/12",
      blobPrimary: "from-violet-600/25 to-indigo-500/16",
      blobAccent: "from-rose-500/20 to-accent/14",
      accentColor: "rose",
      primaryType: "bar",
      sections: [
        { id: "bars-night",  title: t(secKey("bars-night","title")),  subtitle: t(secKey("bars-night","sub")),  icon: "🍸", businessType: "bar", openNow: true, maxItems: 4, exploreLink: "/explore?businessType=bar&openNow=true", accent: "rose" },
        { id: "happy-hour",  title: t(secKey("happy-hour","title")),  subtitle: t(secKey("happy-hour","sub")),  icon: "⚡", featured: true, maxItems: 3, exploreLink: "/explore?featured=true", accent: "violet" },
        { id: "open-late",   title: t(secKey("open-late","title")),   subtitle: t(secKey("open-late","sub")),   icon: "🌃", openNow: true, maxItems: 4, exploreLink: "/explore?openNow=true", accent: "primary" },
      ],
      ctaEmoji: "🌙",
      ctaTitle: t("home.mode_night_cta_title"),
      ctaSubtitle: t("home.mode_night_cta_sub"),
    },
  };
}

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
    const validKeys: ReadonlyArray<string> = ["cafe", "restaurant", "bar"];
    if (validKeys.includes(type)) {
      (data as any)[type] = ((data as any)[type] ?? 0) + 1;
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
  const { t } = useTranslation();
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

  const configs = getModeConfigs(t);
  const config = configs[mode];
  const boostedType = getBoostedPrimaryType(config.primaryType, interactions);

  return {
    mode,
    config,
    boostedPrimaryType: boostedType,
    interactions,
    track,
  };
}
