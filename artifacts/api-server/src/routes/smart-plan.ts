/**
 * Smart Plan Generator API
 * POST /api/smart-plan/generate
 *
 * Inputs: email, planType, date, time, groupSize, vibe
 * Outputs: a structured plan with primary + alternative restaurant
 */
import { Router } from "express";
import { db } from "@workspace/db";

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────
type PlanType = "dinner" | "brunch" | "nightlife" | "date" | "cafe" | "group";

interface RestaurantRow {
  id: number;
  name: string;
  cuisine: string;
  cuisine_emoji: string;
  rating: string;
  price_range: number;
  hero_image: string | null;
  address: string;
  tags: string[];
  is_featured: boolean;
  review_count: number;
}

interface PlanPlace {
  id: number;
  name: string;
  cuisine: string;
  cuisineEmoji: string;
  address: string;
  rating: number;
  priceRange: number;
  heroImage: string | null;
  reason: string;
  fitLabel: string;
  isFeatured: boolean;
}

// ── German plan titles ────────────────────────────────────────────────────────
const PLAN_TITLES: Record<PlanType, (date: string, time: string, groupSize: number) => string> = {
  dinner: (d, t, g) => g > 3 ? `Gruppenabendessen${d ? ` · ${d}` : ""}` : `Abendessen${d ? ` · ${d}` : ""}`,
  brunch: (d) => `Brunch-Vorschlag${d ? ` · ${d}` : " für das Wochenende"}`,
  nightlife: (d, t, g) => g > 3 ? `Gemeinsame Nacht${d ? ` · ${d}` : ""}` : `Nightlife-Plan${d ? ` · ${d}` : ""}`,
  date: (d) => `Date Night${d ? ` · ${d}` : " Empfehlung"}`,
  cafe: (d) => `Café-Vorschlag${d ? ` · ${d}` : ""}`,
  group: (d, t, g) => `Gruppenplan für ${g} Personen${d ? ` · ${d}` : ""}`,
};

const PLAN_SUBTITLES: Record<PlanType, (g: number) => string> = {
  dinner: (g) => g > 1 ? `Perfekter Abend für ${g} Personen` : "Ein unvergessliches Abendessen",
  brunch: (g) => g > 1 ? `Gemütlicher Brunch für ${g}` : "Entspannter Start in den Tag",
  nightlife: (g) => `Unvergessliche Nacht für ${g} Personen`,
  date: () => "Romantisch, persönlich, unvergesslich",
  cafe: (g) => g > 1 ? `Kaffeepause zu ${g}` : "Zeit zum Entschleunigen",
  group: (g) => `Gruppenfreundlich · ${g} Personen`,
};

const FOLLOW_UP: Record<PlanType, string> = {
  dinner: "🍸 Für danach empfehlen wir einen Cocktail in der Innenstadt",
  brunch: "☀️ Danach: Spaziergang im Prater oder entlang des Donaukanals",
  nightlife: "🎵 Weiter geht's in den umliegenden Bars & Clubs",
  date: "🌙 Romantischer Abschluss: Spaziergang über den Graben",
  cafe: "📖 Genieße deinen Kaffee — kein Stress, kein Zeitdruck",
  group: "🎉 Für danach: Gruppenaktivitäten in der Nähe",
};

const FIT_LABELS: Record<PlanType, string[]> = {
  dinner: ["Perfekt zum Abendessen", "Ausgezeichnete Küche", "Tolle Abendatmosphäre"],
  brunch: ["Ideal zum Brunchen", "Gemütliche Atmosphäre", "Perfekt am Morgen"],
  nightlife: ["Tolle Nachtleben-Location", "Lebhafte Atmosphäre", "Perfekt für die Nacht"],
  date: ["Romantisch & intim", "Ideale Date-Atmosphäre", "Besonderes Erlebnis"],
  cafe: ["Ruhige Kaffeeatmosphäre", "Gemütliches Café", "Perfekt zum Verweilen"],
  group: ["Gruppenfreundlich", "Platz für alle", "Ideal für große Runden"],
};

// ── Vibe to tag mapping ───────────────────────────────────────────────────────
const VIBE_TAGS: Record<string, string[]> = {
  cozy: ["gemütlich", "casual", "kaffehaus"],
  romantic: ["fine_dining", "rooftop", "premium"],
  lively: ["nightlife", "bar", "trendy"],
  healthy: ["vegan", "vegetarisch", "salat"],
  traditional: ["heuriger", "beisl", "austrian", "wiener_küche"],
  exotic: ["sushi", "asian", "oriental", "mexican"],
  premium: ["fine_dining", "rooftop", "featured"],
};

// ── Score a restaurant for given plan type + vibe ─────────────────────────────
function scoreForPlan(
  r: RestaurantRow,
  planType: PlanType,
  groupSize: number,
  vibe: string,
  cuisinePreferences: Map<string, number>
): number {
  const tags = (r.tags ?? []).map((t: string) => t.toLowerCase());
  const rating = parseFloat(r.rating ?? "0");
  let score = rating * 2; // base: 0–10
  score += r.is_featured ? 1.5 : 0;
  score += Math.min(r.review_count / 20, 2); // up to +2 for popularity

  // Cuisine preference bonus
  const cPref = cuisinePreferences.get(r.cuisine) ?? 0;
  score += cPref * 1.5;

  // Plan type scoring
  if (planType === "nightlife") {
    if (tags.some(t => ["nightlife", "bar", "cocktails", "nachtbetrieb"].includes(t))) score += 3;
    if (r.price_range <= 2) score += 0.5;
  }
  if (planType === "date") {
    if (tags.some(t => ["fine_dining", "rooftop", "romantic", "premium"].includes(t))) score += 3;
    if (r.price_range >= 2) score += 1;
    if (r.is_featured) score += 1;
  }
  if (planType === "brunch" || planType === "cafe") {
    if (tags.some(t => ["café", "cafe", "kaffehaus", "brunch", "frühstück"].includes(t))) score += 3;
    const bCuisines = ["austrian", "cafe", "café", "bakery"];
    if (bCuisines.some(c => r.cuisine.toLowerCase().includes(c))) score += 1.5;
  }
  if (planType === "group") {
    if (tags.some(t => ["gruppenfreundlich", "gruppe", "events", "bankett"].includes(t))) score += 3;
    if (r.price_range <= 3) score += 0.5; // affordable for groups
  }
  if (planType === "dinner") {
    score += 0.5; // all restaurants are dinner candidates
    if (tags.some(t => ["restaurant", "abendessen", "dinner"].includes(t))) score += 1;
  }

  // Vibe bonus
  const vibeTags = VIBE_TAGS[vibe] ?? [];
  if (vibeTags.some(vt => tags.some(t => t.includes(vt)))) score += 2;

  return score;
}

// ── Reason generator ──────────────────────────────────────────────────────────
function generateReason(
  r: RestaurantRow,
  planType: PlanType,
  groupSize: number,
  hasCuisineMatch: boolean
): string {
  const rating = parseFloat(r.rating ?? "0");
  if (hasCuisineMatch) return `Passt zu deinem Geschmack · ${rating.toFixed(1)} ⭐`;
  const tags = (r.tags ?? []).map((t: string) => t.toLowerCase());
  if (planType === "date" && tags.some(t => ["fine_dining", "rooftop", "romantic"].includes(t)))
    return "Romantische Atmosphäre · Perfekt fürs Date";
  if (planType === "nightlife" && tags.some(t => ["nightlife", "bar", "cocktails"].includes(t)))
    return "Lebhafte Abendatmosphäre";
  if (planType === "brunch" && tags.some(t => ["café", "cafe", "brunch"].includes(t)))
    return "Beliebt zum Brunchen";
  if (planType === "group" && groupSize >= 4)
    return "Gruppenfreundlich · Viel Platz";
  if (r.is_featured) return "Von unseren Redakteuren empfohlen";
  return `${rating.toFixed(1)} ⭐ · Sehr beliebt`;
}

// ── POST /generate ────────────────────────────────────────────────────────────
router.post("/generate", async (req, res) => {
  const {
    email = "",
    planType = "dinner",
    date = "",
    time = "",
    groupSize = 2,
    vibe = "cozy",
  } = req.body as {
    email?: string; planType?: PlanType; date?: string;
    time?: string; groupSize?: number; vibe?: string;
  };

  try {
    const pgDb = (db as any).$client;

    // ── 1. Fetch all restaurants ──
    const { rows: allResto } = await pgDb.query<RestaurantRow>(
      `SELECT id, name, cuisine, cuisine_emoji, rating, price_range,
              hero_image, address, tags, is_featured,
              COALESCE(review_count, 0) as review_count
         FROM restaurants
        WHERE is_active = true
        ORDER BY rating DESC`
    );

    // ── 2. Build user cuisine preferences (if email given) ────────────────────
    const cuisinePreferences = new Map<string, number>();
    if (email) {
      try {
        const { rows: resRows } = await pgDb.query<{ cuisine: string }>(
          `SELECT r.cuisine FROM reservations res
             JOIN restaurants r ON r.id = res.restaurant_id
            WHERE res.customer_email = $1 AND res.status != 'cancelled'`,
          [email]
        );
        for (const row of resRows) {
          cuisinePreferences.set(row.cuisine, (cuisinePreferences.get(row.cuisine) ?? 0) + 2);
        }
        const { rows: likeRows } = await pgDb.query<{ cuisine: string }>(
          `SELECT r.cuisine FROM post_likes pl
             JOIN posts p ON p.id = pl.post_id
             JOIN restaurants r ON r.id = p.restaurant_id
            WHERE pl.user_email = $1 AND r.id IS NOT NULL`,
          [email]
        );
        for (const row of likeRows) {
          cuisinePreferences.set(row.cuisine, (cuisinePreferences.get(row.cuisine) ?? 0) + 1);
        }
      } catch { /* signals unavailable */ }
    }

    const topCuisine = cuisinePreferences.size > 0
      ? [...cuisinePreferences.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null;

    // ── 3. Score + sort ───────────────────────────────────────────────────────
    const scored = allResto
      .map(r => ({
        r,
        score: scoreForPlan(r, planType as PlanType, groupSize, vibe, cuisinePreferences),
      }))
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return res.status(404).json({ error: "Keine Restaurants verfügbar" });
    }

    // ── 4. Pick primary + alternative (different from primary) ────────────────
    const primaryRow = scored[0].r;
    const altRow = scored.find(s => s.r.id !== primaryRow.id)?.r ?? null;

    // ── 5. Build plan place objects ───────────────────────────────────────────
    function buildPlace(r: RestaurantRow): PlanPlace {
      const hasCuisineMatch = topCuisine === r.cuisine;
      const fitLabels = FIT_LABELS[planType as PlanType] ?? ["Empfohlen"];
      return {
        id: r.id,
        name: r.name,
        cuisine: r.cuisine,
        cuisineEmoji: r.cuisine_emoji,
        address: r.address,
        rating: parseFloat(r.rating ?? "0"),
        priceRange: r.price_range,
        heroImage: r.hero_image,
        reason: generateReason(r, planType as PlanType, groupSize, hasCuisineMatch),
        fitLabel: fitLabels[Math.floor(Math.random() * fitLabels.length)],
        isFeatured: r.is_featured,
      };
    }

    const pt = planType as PlanType;
    const dateLabel = date
      ? new Date(date).toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long" })
      : "";

    const plan = {
      title: PLAN_TITLES[pt]?.(dateLabel, time, groupSize) ?? "Dein Plan",
      subtitle: PLAN_SUBTITLES[pt]?.(groupSize) ?? "Empfohlen für dich",
      planType: pt,
      date: date || null,
      time: time || null,
      groupSize,
      vibe,
      followUp: FOLLOW_UP[pt] ?? "",
      mainPlace: buildPlace(primaryRow),
      alternativePlace: altRow ? buildPlace(altRow) : null,
      tags: [
        groupSize >= 4 ? "Für Gruppen geeignet" : null,
        pt === "date" ? "Romantisch" : null,
        pt === "nightlife" ? "Nachtleben" : null,
        topCuisine ? "Personalisiert" : "Beliebt",
      ].filter(Boolean) as string[],
      isGroupFriendly: groupSize >= 4 || pt === "group",
    };

    res.json({ plan, hasPersonal: !!email && cuisinePreferences.size > 0 });
  } catch (err: any) {
    console.error("[smart-plan] generate error:", err);
    res.status(500).json({ error: "Planerstellung fehlgeschlagen" });
  }
});

export default router;
