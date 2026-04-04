/**
 * Monetization Engine — boost configs and value propositions for admin UI.
 * Mirrors the customer-side engine; server stays the single source of truth.
 */

// ─── Unified Premium Package ───────────────────────────────────────────────────
export const PREMIUM_PRICE = 39.90;
export const PREMIUM_PLAN_NAME = "RestoSmart Business Premium";
export const PREMIUM_PRICE_DISPLAY = "€39,90";
export const PREMIUM_PRICE_LABEL = "€39,90 / Monat";

/** Feature tiers: free | premium | boost */
export const FEATURE_TIERS = {
  free: [
    "Basis-Listing auf der Plattform",
    "Karten-Eintrag & Grundprofil",
    "Buchungsannahme",
    "Basis-Bewertungsanzeige",
  ],
  premium: [
    "Prioritätsplatzierung im Entdecken-Feed",
    "Premium-Vertrauens-Badge",
    "Vollständiges Analytics-Dashboard",
    "Revenue Optimizer mit KI-Empfehlungen",
    "Boost-Sichtbarkeit (Zeitfenster-Werbung)",
    "Gruppen-Empfehlungs-Priorität",
    "Smart Offers & Flash Deals",
    "Marketing-Kampagnen & E-Mail-Tools",
    "Buchungs- & Tischmanagement",
    "Personal- & Schichtplanung",
    "Angebots- & Menü-Editor",
    "Kassenterminal (POS)",
    "Treue-Programme & Punkte",
  ],
  boostOnly: [
    "Frühstücks-Boost (6–10 Uhr)",
    "Mittags-Boost (11–14 Uhr)",
    "Happy Hour Boost (15–19 Uhr)",
    "Nachtleben-Boost (ab 19 Uhr)",
    "Local Spotlight (ganztägig)",
    "Heat-Map Boost",
  ],
} as const;

export interface BoostConfig {
  type: string;
  label: string;
  emoji: string;
  description: string;
  hours: [number, number];
  multiplier: number;
  bizTypes: string[];
  businessCopy: Record<string, string>;
}

export const BOOST_CONFIGS: BoostConfig[] = [
  {
    type: "breakfast_boost",
    label: "Frühstücks-Boost",
    emoji: "☕",
    description: "Sichtbarkeit 6–10 Uhr für Frühstücksgäste maximieren",
    hours: [6, 10],
    multiplier: 1.25,
    bizTypes: ["cafe", "restaurant"],
    businessCopy: {
      cafe: "Mehr Gäste in Ihrer ruhigsten Morgenstunde — erscheinen Sie ganz oben im Entdecken-Feed.",
      restaurant: "Frühstücksangebote sichtbarer machen — mehr Tischbuchungen am Morgen.",
    },
  },
  {
    type: "lunch_boost",
    label: "Mittags-Boost",
    emoji: "🍽️",
    description: "Priorität in der Mittagszeit 11–14 Uhr",
    hours: [11, 14],
    multiplier: 1.30,
    bizTypes: ["cafe", "restaurant"],
    businessCopy: {
      cafe: "Mittagsgäste anziehen — Cafés mit Mittagsangeboten erreichen 3× mehr Klicks.",
      restaurant: "Zum beliebtesten Mittagsziel in Ihrer Gegend werden — mehr Laufkundschaft.",
    },
  },
  {
    type: "happy_hour_boost",
    label: "Happy Hour Boost",
    emoji: "🍹",
    description: "Erhöhte Sichtbarkeit 15–19 Uhr",
    hours: [15, 19],
    multiplier: 1.28,
    bizTypes: ["bar", "restaurant"],
    businessCopy: {
      bar: "Ihre Happy Hour wird zur meistbesuchten — Sichtbarkeit genau dann, wenn Gäste planen.",
      restaurant: "Nachmittags-Lücken füllen — Aperitif-Gäste und frühe Abendessen anziehen.",
    },
  },
  {
    type: "nightlife_boost",
    label: "Nachtleben-Boost",
    emoji: "🌙",
    description: "Maximale Sichtbarkeit ab 19 Uhr bis spät in die Nacht",
    hours: [19, 2],
    multiplier: 1.35,
    bizTypes: ["bar"],
    businessCopy: {
      bar: "Werden Sie die erste Wahl für Abendgäste — erscheinen Sie in der Karte, im Heat-Map und in Gruppen-Vorschlägen.",
    },
  },
  {
    type: "local_spotlight",
    label: "Local Spotlight",
    emoji: "⭐",
    description: "Ganztägige Premium-Platzierung im Entdecken-Feed und auf der Karte",
    hours: [0, 24],
    multiplier: 1.20,
    bizTypes: ["restaurant", "cafe", "bar"],
    businessCopy: {
      restaurant: "24/7 auf Seite 1 — mehr Sichtbarkeit, mehr Vertrauen, mehr Buchungen.",
      cafe: "Ihr Café im Mittelpunkt — Featured-Badge und Top-Platzierung im ganzen Tag.",
      bar: "Immer sichtbar für Abend- und Wochenendgäste — lokale Bekanntheit maximieren.",
    },
  },
  {
    type: "local_heat_boost",
    label: "Heat-Map Boost",
    emoji: "🔥",
    description: "Priorisierte Darstellung in der Live-Karte und im Heat-Map-Layer",
    hours: [0, 24],
    multiplier: 1.22,
    bizTypes: ["restaurant", "cafe", "bar"],
    businessCopy: {
      restaurant: "Im Heat-Map als aktiver Hotspot gezeigt — Gäste sehen Sie genau dann, wenn sie in der Nähe sind.",
      cafe: "Live auf der Karte als belebter Treffpunkt — organische Laufkundschaft verdreifachen.",
      bar: "Im Nachtleben-Layer der Karte prominent — Gäste auf dem Weg finden Sie zuerst.",
    },
  },
];

export const PREMIUM_VALUE_BY_TYPE: Record<string, {
  headline: string;
  subline: string;
  benefits: { icon: string; text: string }[];
  socialProof: string;
}> = {
  restaurant: {
    headline: "Mehr Buchungen. Mehr Wachstum.",
    subline: "Premium macht Ihr Restaurant zur ersten Wahl für hungrige Gäste.",
    benefits: [
      { icon: "🔝", text: "Priorisierte Platzierung im Entdecken-Feed" },
      { icon: "🔥", text: "Heat-Map & Live-Zones Sichtbarkeit" },
      { icon: "📊", text: "Vollständige Analytics & Buchungseinblicke" },
      { icon: "🎯", text: "Smart Offers & Kampagnen-Tools" },
      { icon: "👥", text: "Gruppen-Vorschlag Priorität für große Tische" },
      { icon: "✅", text: "Verifiziertes Restaurant-Badge" },
    ],
    socialProof: "Premium-Restaurants erhalten durchschnittlich 3,2× mehr Profilaufrufe.",
  },
  cafe: {
    headline: "Ihr Café. Überall sichtbar.",
    subline: "Von der Morgendämmerung bis zum Nachmittag — stets die erste Wahl.",
    benefits: [
      { icon: "☕", text: "Frühstücks- & Mittags-Boost genau zur richtigen Zeit" },
      { icon: "🗺️", text: "Prominente Platzierung auf der Live-Karte" },
      { icon: "⭐", text: "Featured-Café-Badge im Entdecken-Feed" },
      { icon: "📈", text: "Impressionen, Klicks & Buchungsanalysen" },
      { icon: "🎁", text: "Flash Deals & Smart Offers selbst gestalten" },
      { icon: "✅", text: "Verifiziertes Café-Badge" },
    ],
    socialProof: "Premium-Cafés verzeichnen im Schnitt 2,8× mehr Morgengäste.",
  },
  bar: {
    headline: "Die Nacht gehört Ihnen.",
    subline: "Werden Sie zum Anlaufpunkt für jeden Abend in Ihrer Stadt.",
    benefits: [
      { icon: "🌙", text: "Nachtleben- & Happy Hour Boost ab 15 Uhr" },
      { icon: "🔥", text: "Heat-Map Hotspot — sichtbar wenn es zählt" },
      { icon: "👥", text: "Gruppen-Outings & Instant Plan Priorität" },
      { icon: "🎯", text: "Gezielte Abend-Kampagnen & Promotions" },
      { icon: "📊", text: "Abend-Analytics & Conversion-Tracking" },
      { icon: "✅", text: "Verifiziertes Bar-Badge" },
    ],
    socialProof: "Premium-Bars erhalten 4× mehr Gruppen-Buchungsanfragen.",
  },
};

export function isBoostCurrentlyActive(boostType: string): boolean {
  const cfg = BOOST_CONFIGS.find(b => b.type === boostType);
  if (!cfg) return false;
  const hour = new Date().getHours();
  const [start, end] = cfg.hours;
  if (end < start) return hour >= start || hour <= end;
  return hour >= start && hour <= end;
}
