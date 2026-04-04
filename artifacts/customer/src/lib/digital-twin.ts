/**
 * Digital Twin Engine — lightweight behavioral model for each user.
 *
 * Learns from real interactions: views, bookings, plan choices, social actions,
 * time patterns, and dismissals. Stored in localStorage, zero server calls.
 *
 * No fake ML. Pure exponential-moving-average preference scoring + rule-based
 * pattern detection. Feels smart because it ACTUALLY remembers real behavior.
 */

// ─── Storage key ──────────────────────────────────────────────────────────────

const TWIN_KEY = "restosmart_twin";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InteractionType =
  | "restaurant_view"
  | "restaurant_book"
  | "plan_start"
  | "plan_accept"
  | "plan_dismiss"
  | "offer_click"
  | "offer_dismiss"
  | "search_perform"
  | "map_open"
  | "friend_invite"
  | "solo_plan"
  | "group_plan"
  | "home_scroll"
  | "mood_morning"
  | "mood_lunch"
  | "mood_evening"
  | "mood_night"
  | "meal_plan_view";

export interface TwinInteraction {
  type: InteractionType;
  ts: number;
  hour: number;
  dow: number;                  // 0=Sun … 6=Sat
  payload?: {
    businessType?: string;
    cuisine?: string;
    priceRange?: number;
    planMode?: string;
    restaurantId?: number;
    groupSize?: number;
    [key: string]: unknown;
  };
}

export interface TwinPreferences {
  // Affinity scores 0–1 (EMA updated on each interaction)
  businessTypes: Record<string, number>;    // "cafe": 0.82, "restaurant": 0.65
  cuisines:      Record<string, number>;    // "Italienisch": 0.70
  priceRanges:   Record<string, number>;    // "1": 0.3, "2": 0.7, "3": 0.5
  timeSlots:     Record<string, number>;    // "morning": 0.8, "evening": 0.4

  soloScore:     number;  // 0=always solo … 1=always group
  outingFrequency: number; // interactions per day (rolling)
  planAcceptRate:  number; // ratio accepted/(accepted+dismissed)
  offerClickRate:  number;
}

export interface TwinRoutines {
  morningCoffee:    boolean;  // regularly opens app 7–10am
  lunchOut:         boolean;  // regularly books/views 11am–2pm
  eveningSocial:    boolean;  // friend invites, evening plans
  weekendExplorer:  boolean;  // weekend outing patterns
  habitualCuisines: string[]; // top 3 cuisines by frequency
  preferredBizType: string;   // strongest business type affinity
  peakHours:        number[]; // most-active hours (up to 3)
}

export interface MicroMomentState {
  signal: "interested" | "uncertain" | "bored" | "satisfied" | "exploring" | "idle";
  confidence: number;   // 0–1
  lastUpdated: number;
}

export interface DigitalTwin {
  version: number;
  preferences: TwinPreferences;
  routines: TwinRoutines;
  microMoment: MicroMomentState;
  recentInteractions: TwinInteraction[]; // last 100
  createdAt: number;
  lastUpdated: number;
  totalInteractions: number;
}

// ─── Default twin ─────────────────────────────────────────────────────────────

function defaultTwin(): DigitalTwin {
  return {
    version: 2,
    preferences: {
      businessTypes: { restaurant: 0.5, cafe: 0.5, bar: 0.3 },
      cuisines: {},
      priceRanges: { "1": 0.3, "2": 0.6, "3": 0.3, "4": 0.1 },
      timeSlots: { morning: 0.3, lunch: 0.5, afternoon: 0.3, evening: 0.6, night: 0.3 },
      soloScore: 0.3,
      outingFrequency: 0,
      planAcceptRate: 0.5,
      offerClickRate: 0.3,
    },
    routines: {
      morningCoffee: false,
      lunchOut: false,
      eveningSocial: false,
      weekendExplorer: false,
      habitualCuisines: [],
      preferredBizType: "restaurant",
      peakHours: [],
    },
    microMoment: { signal: "idle", confidence: 0, lastUpdated: 0 },
    recentInteractions: [],
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    totalInteractions: 0,
  };
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export function loadTwin(): DigitalTwin {
  try {
    const raw = localStorage.getItem(TWIN_KEY);
    if (!raw) return defaultTwin();
    const parsed: DigitalTwin = JSON.parse(raw);
    // Migrate old versions
    if (!parsed.version || parsed.version < 2) return defaultTwin();
    return parsed;
  } catch { return defaultTwin(); }
}

function saveTwin(twin: DigitalTwin): void {
  try {
    twin.lastUpdated = Date.now();
    localStorage.setItem(TWIN_KEY, JSON.stringify(twin));
  } catch {}
}

// ─── EMA update (α = 0.15 → slow but steady learning) ────────────────────────

const α = 0.15;

function emaUpdate(current: number, signal: number): number {
  return Math.min(1, Math.max(0, current * (1 - α) + signal * α));
}

function bumpKey<T extends Record<string, number>>(
  map: T, key: string, signal: number,
): T {
  const cur = map[key] ?? 0.3;
  return { ...map, [key]: emaUpdate(cur, signal) };
}

// ─── Rebuild derived routines from interaction history ────────────────────────

function rebuildRoutines(twin: DigitalTwin): TwinRoutines {
  const hist = twin.recentInteractions;
  if (hist.length < 5) return twin.routines;

  // Morning coffee: views/books a cafe 7–10am at least 3 times
  const morningCafe = hist.filter(
    i => i.hour >= 7 && i.hour <= 10 && i.payload?.businessType === "cafe",
  ).length;

  // Lunch out: views/books restaurant 11–14h at least 3 times
  const lunchActivity = hist.filter(
    i => i.hour >= 11 && i.hour <= 14 && (i.type === "restaurant_view" || i.type === "restaurant_book"),
  ).length;

  // Evening social: friend_invite or group_plan in 17–22h
  const eveningSocial = hist.filter(
    i => i.hour >= 17 && i.hour <= 22 && (i.type === "friend_invite" || i.type === "group_plan"),
  ).length;

  // Weekend explorer: weekend activity ratio
  const weekendInteractions = hist.filter(i => i.dow === 0 || i.dow === 6).length;
  const weekendExplorer = weekendInteractions > hist.length * 0.3;

  // Peak hours: top 3 most frequent hours
  const hourCounts: Record<number, number> = {};
  hist.forEach(i => { hourCounts[i.hour] = (hourCounts[i.hour] ?? 0) + 1; });
  const peakHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h]) => parseInt(h));

  // Habitual cuisines: top 3
  const cuisineCounts: Record<string, number> = {};
  hist.forEach(i => {
    if (i.payload?.cuisine) {
      cuisineCounts[i.payload.cuisine] = (cuisineCounts[i.payload.cuisine] ?? 0) + 1;
    }
  });
  const habitualCuisines = Object.entries(cuisineCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);

  // Preferred biz type: highest affinity
  const prefs = twin.preferences.businessTypes;
  const preferredBizType = Object.entries(prefs)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "restaurant";

  return {
    morningCoffee:    morningCafe >= 3,
    lunchOut:         lunchActivity >= 3,
    eveningSocial:    eveningSocial >= 2,
    weekendExplorer,
    habitualCuisines,
    preferredBizType,
    peakHours,
  };
}

// ─── Micro-moment detection ───────────────────────────────────────────────────

function detectMicroMoment(hist: TwinInteraction[]): MicroMomentState {
  const recent = hist.filter(i => Date.now() - i.ts < 5 * 60 * 1000); // last 5 min
  if (recent.length === 0) return { signal: "idle", confidence: 0.5, lastUpdated: Date.now() };

  const dismissCount = recent.filter(i => i.type === "plan_dismiss" || i.type === "offer_dismiss").length;
  const viewCount    = recent.filter(i => i.type === "restaurant_view").length;
  const bookCount    = recent.filter(i => i.type === "restaurant_book" || i.type === "plan_accept").length;
  const scrollCount  = recent.filter(i => i.type === "home_scroll").length;
  const mapOpen      = recent.some(i => i.type === "map_open");
  const searchCount  = recent.filter(i => i.type === "search_perform").length;

  if (bookCount >= 1) return { signal: "satisfied", confidence: 0.9, lastUpdated: Date.now() };
  if (viewCount >= 3 || searchCount >= 2) return { signal: "interested", confidence: 0.8, lastUpdated: Date.now() };
  if (mapOpen || scrollCount >= 3) return { signal: "exploring", confidence: 0.7, lastUpdated: Date.now() };
  if (dismissCount >= 2) return { signal: "uncertain", confidence: 0.75, lastUpdated: Date.now() };
  if (scrollCount >= 5 && viewCount === 0) return { signal: "bored", confidence: 0.65, lastUpdated: Date.now() };

  return { signal: "idle", confidence: 0.4, lastUpdated: Date.now() };
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/** Record a user interaction and update the twin model. */
export function recordTwinInteraction(event: Omit<TwinInteraction, "ts" | "hour" | "dow">): void {
  try {
    const now = new Date();
    const interaction: TwinInteraction = {
      ...event,
      ts: Date.now(),
      hour: now.getHours(),
      dow: now.getDay(),
    };

    const twin = loadTwin();

    // Update recent interactions (keep last 100)
    twin.recentInteractions = [interaction, ...twin.recentInteractions].slice(0, 100);
    twin.totalInteractions += 1;

    // ── Update preference scores based on event type ──────────────────────────
    const p = twin.payload ?? {};
    const biz = interaction.payload?.businessType;
    const cuisine = interaction.payload?.cuisine;
    const price = interaction.payload?.priceRange;
    const h = interaction.hour;

    // Time slot signals
    const timeSlot = h >= 7 && h <= 10 ? "morning"
      : h >= 11 && h <= 14 ? "lunch"
      : h >= 15 && h <= 17 ? "afternoon"
      : h >= 18 && h <= 21 ? "evening"
      : "night";

    switch (interaction.type) {
      case "restaurant_book":
        // Strongest signal — they committed
        if (biz) twin.preferences.businessTypes = bumpKey(twin.preferences.businessTypes, biz, 1.0);
        if (cuisine) twin.preferences.cuisines = bumpKey(twin.preferences.cuisines, cuisine, 1.0);
        if (price) twin.preferences.priceRanges = bumpKey(twin.preferences.priceRanges, String(price), 1.0);
        twin.preferences.timeSlots = bumpKey(twin.preferences.timeSlots, timeSlot, 1.0);
        // Update plan acceptance
        twin.preferences.planAcceptRate = emaUpdate(twin.preferences.planAcceptRate, 1.0);
        break;

      case "restaurant_view":
        // Medium signal — interest shown
        if (biz) twin.preferences.businessTypes = bumpKey(twin.preferences.businessTypes, biz, 0.6);
        if (cuisine) twin.preferences.cuisines = bumpKey(twin.preferences.cuisines, cuisine, 0.5);
        if (price) twin.preferences.priceRanges = bumpKey(twin.preferences.priceRanges, String(price), 0.4);
        twin.preferences.timeSlots = bumpKey(twin.preferences.timeSlots, timeSlot, 0.5);
        break;

      case "plan_accept":
        twin.preferences.planAcceptRate = emaUpdate(twin.preferences.planAcceptRate, 1.0);
        if (biz) twin.preferences.businessTypes = bumpKey(twin.preferences.businessTypes, biz, 0.9);
        twin.preferences.timeSlots = bumpKey(twin.preferences.timeSlots, timeSlot, 0.8);
        break;

      case "plan_dismiss":
        twin.preferences.planAcceptRate = emaUpdate(twin.preferences.planAcceptRate, 0.0);
        if (biz) twin.preferences.businessTypes = bumpKey(twin.preferences.businessTypes, biz, 0.2);
        twin.preferences.timeSlots = bumpKey(twin.preferences.timeSlots, timeSlot, 0.3);
        break;

      case "offer_click":
        twin.preferences.offerClickRate = emaUpdate(twin.preferences.offerClickRate, 1.0);
        if (biz) twin.preferences.businessTypes = bumpKey(twin.preferences.businessTypes, biz, 0.5);
        break;

      case "offer_dismiss":
        twin.preferences.offerClickRate = emaUpdate(twin.preferences.offerClickRate, 0.0);
        break;

      case "group_plan":
      case "friend_invite":
        twin.preferences.soloScore = emaUpdate(twin.preferences.soloScore, 1.0);
        break;

      case "solo_plan":
        twin.preferences.soloScore = emaUpdate(twin.preferences.soloScore, 0.0);
        break;

      case "home_scroll":
        // Passive signal — app is open
        twin.preferences.timeSlots = bumpKey(twin.preferences.timeSlots, timeSlot, 0.2);
        break;

      case "search_perform":
        twin.preferences.timeSlots = bumpKey(twin.preferences.timeSlots, timeSlot, 0.35);
        break;
    }

    // ── Rebuild derived routines ──────────────────────────────────────────────
    twin.routines = rebuildRoutines(twin);

    // ── Update micro-moment ───────────────────────────────────────────────────
    twin.microMoment = detectMicroMoment(twin.recentInteractions);

    // ── Rolling outing frequency (interactions per day) ───────────────────────
    const dayAgo = Date.now() - 86400000;
    const todayCount = twin.recentInteractions.filter(i => i.ts > dayAgo).length;
    twin.preferences.outingFrequency = emaUpdate(twin.preferences.outingFrequency, todayCount / 10);

    saveTwin(twin);
  } catch {}
}

/** Get the current digital twin. Never throws. */
export function getTwin(): DigitalTwin {
  return loadTwin();
}

/**
 * Compute how well a restaurant matches this twin's preferences.
 * Returns a score 0–100 (higher = better fit).
 */
export function computeTwinAffinity(
  restaurant: {
    businessType?: string;
    cuisine?: string;
    priceRange?: number;
    rating?: number;
  },
  twin: DigitalTwin,
): number {
  let score = 50; // base

  const biz = restaurant.businessType ?? "restaurant";
  const bizAffinity = twin.preferences.businessTypes[biz] ?? 0.5;
  score += (bizAffinity - 0.5) * 40;

  if (restaurant.cuisine) {
    const cuisineAffinity = twin.preferences.cuisines[restaurant.cuisine] ?? 0.4;
    score += (cuisineAffinity - 0.4) * 25;
  }

  if (restaurant.priceRange) {
    const priceAffinity = twin.preferences.priceRanges[String(restaurant.priceRange)] ?? 0.4;
    score += (priceAffinity - 0.4) * 15;
  }

  if (restaurant.rating) {
    score += (restaurant.rating - 3.5) * 5;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Get a human-readable twin insight label for a restaurant.
 * Returns null when the twin doesn't have enough data yet.
 */
export function getTwinInsightLabel(
  restaurant: { businessType?: string; cuisine?: string; priceRange?: number },
  twin: DigitalTwin,
): string | null {
  if (twin.totalInteractions < 5) return null;

  const biz = restaurant.businessType ?? "restaurant";
  const bizAff = twin.preferences.businessTypes[biz] ?? 0.5;
  const cuisine = restaurant.cuisine;
  const cuisineAff = cuisine ? (twin.preferences.cuisines[cuisine] ?? 0) : 0;

  if (biz === twin.routines.preferredBizType && bizAff > 0.7) {
    const labels = ["Dein Typ", "Passt zu dir", "Dein Stil"];
    return labels[Math.floor(Math.random() * labels.length)];
  }
  if (cuisine && cuisineAff > 0.65) {
    return `Du liebst ${cuisine}`;
  }
  if (twin.routines.morningCoffee && biz === "cafe") {
    return "Dein Morgenritual";
  }
  return null;
}

/** Reset the twin (for testing / logout). */
export function resetTwin(): void {
  try { localStorage.removeItem(TWIN_KEY); } catch {}
}
