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
    headline: "Mehr Sichtbarkeit. Mehr Kunden.",
    subline: "Mit Premium wirst du deutlich h\u00e4ufiger entdeckt \u2014 genau von den Menschen in deiner N\u00e4he.",
    benefits: [
      { icon: "\uD83D\uDD1D", text: "Bevorzugte Platzierung in Suche & Empfehlungen" },
      { icon: "\uD83D\uDD25", text: "Heat-Map & Live-Zones Sichtbarkeit" },
      { icon: "\uD83D\uDCCA", text: "Vollst\u00e4ndige Analytics & Buchungseinblicke" },
      { icon: "\uD83C\uDFAF", text: "Smart Offers & Kampagnen-Tools" },
      { icon: "\uD83D\uDC65", text: "Gruppen-Vorschlag Priorit\u00e4t f\u00fcr gro\u00dfe Tische" },
      { icon: "\u2705", text: "Verifiziertes Restaurant-Badge" },
    ],
    socialProof: "Premium-Betriebe werden bevorzugt angezeigt und wirken vertrauensw\u00fcrdiger.",
  },
  cafe: {
    headline: "Dein Caf\u00e9 \u2014 \u00fcberall sichtbar.",
    subline: "Kunden in deiner Umgebung suchen genau jetzt nach Angeboten wie deinem.",
    benefits: [
      { icon: "\u2615", text: "Fr\u00fchst\u00fccks- & Mittags-Boost genau zur richtigen Zeit" },
      { icon: "\uD83D\uDDFA\uFE0F", text: "Prominente Platzierung auf der Live-Karte" },
      { icon: "\u2B50", text: "Featured-Caf\u00e9-Badge im Entdecken-Feed" },
      { icon: "\uD83D\uDCC8", text: "Impressionen, Klicks & Buchungsanalysen" },
      { icon: "\uD83C\uDF81", text: "Flash Deals & Smart Offers selbst gestalten" },
      { icon: "\u2705", text: "Verifiziertes Caf\u00e9-Badge" },
    ],
    socialProof: "Premium-Betriebe werden bevorzugt angezeigt und wirken vertrauensw\u00fcrdiger.",
  },
  bar: {
    headline: "Mehr Aufmerksamkeit am Abend.",
    subline: "Kunden in deiner Umgebung suchen genau jetzt nach Angeboten wie deinem.",
    benefits: [
      { icon: "\uD83C\uDF19", text: "Nachtleben- & Happy Hour Boost ab 15 Uhr" },
      { icon: "\uD83D\uDD25", text: "Heat-Map Hotspot \u2014 sichtbar wenn es z\u00e4hlt" },
      { icon: "\uD83D\uDC65", text: "Gruppen-Outings & Instant Plan Priorit\u00e4t" },
      { icon: "\uD83C\uDFAF", text: "Gezielte Abend-Kampagnen & Promotions" },
      { icon: "\uD83D\uDCCA", text: "Abend-Analytics & Conversion-Tracking" },
      { icon: "\u2705", text: "Verifiziertes Bar-Badge" },
    ],
    socialProof: "Premium-Betriebe werden bevorzugt angezeigt und wirken vertrauensw\u00fcrdiger.",
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
