/**
 * Smart Recommendation Engine
 * Scores restaurants using real user signals:
 * reservations, post_likes, saved_posts, reviews.
 * Falls back to top-rated restaurants for new users.
 */
import { Router } from "express";
import { db } from "@workspace/db";

const router = Router();
function pg() { return (db as any).$client; }

// ── German cuisine names ───────────────────────────────────────────────────────
const CUISINE_DE: Record<string, string> = {
  Austrian: "Österreichisch", Burgers: "Burger", French: "Französisch",
  Indian: "Indisch", International: "International", Italian: "Italienisch",
  Japanese: "Japanisch", Vegetarian: "Vegetarisch", Cocktails: "Cocktails",
  Mexican: "Mexikanisch", American: "Amerikanisch", Thai: "Thail.", Chinese: "Chinesisch",
  Spanish: "Spanisch", Greek: "Griechisch", Cafe: "Café", Bar: "Bar",
};
const deCuisine = (c: string) => CUISINE_DE[c] ?? c;

// ── Taste identities ───────────────────────────────────────────────────────────
const TASTE_IDENTITIES: Record<string, { label: string; emoji: string }> = {
  Japanese:     { label: "Sushi-Fan",        emoji: "🍣" },
  Italian:      { label: "Pasta-Liebhaber",  emoji: "🍝" },
  French:       { label: "Fine-Dining-Fan",  emoji: "🥐" },
  Cafe:         { label: "Café-Hopper",      emoji: "☕" },
  Bar:          { label: "Nachtleben-Fan",   emoji: "🍸" },
  Vegetarian:   { label: "Veggie-Fan",       emoji: "🌿" },
  Indian:       { label: "Gewürz-Fan",       emoji: "🍛" },
  Mexican:      { label: "Taco-Fan",         emoji: "🌮" },
  Austrian:     { label: "Wien-Kenner",      emoji: "🥩" },
  Burgers:      { label: "Burger-Fan",       emoji: "🍔" },
};

// ── Reason generators ──────────────────────────────────────────────────────────
function buildReason(signals: {
  reserved: boolean; liked: boolean; saved: boolean; reviewed: boolean;
  cuisineMatch: boolean; topCuisine: string | null; isTrending: boolean;
}): string {
  if (signals.reserved) return "Passend zu deinen letzten Besuchen";
  if (signals.saved)    return "Ähnlich zu Orten, die du gespeichert hast";
  if (signals.liked)    return "Basierend auf deinen Likes";
  if (signals.reviewed) return "Weil du ähnliche Orte bewertet hast";
  if (signals.cuisineMatch && signals.topCuisine)
    return `Passend zu deinen ${deCuisine(signals.topCuisine)}-Vorlieben`;
  if (signals.isTrending) return "Beliebt in Wien";
  return "Hochbewertet in deiner Nähe";
}

// ── Category label ────────────────────────────────────────────────────────────
function buildCategory(score: number, hasPersonal: boolean): string {
  if (!hasPersonal) return "Beliebt heute";
  if (score >= 12) return "Für dich";
  if (score >= 6)  return "Passend zu deinem Geschmack";
  return "Vielleicht für dich";
}

// ── GET /api/recommendations/:email ──────────────────────────────────────────
router.get("/:email", async (req, res) => {
  const email = decodeURIComponent(req.params.email || "").toLowerCase().trim();
  if (!email) return void res.status(400).json({ error: "Fehlende E-Mail." });

  try {
    const pgDb = pg();

    // ── 1. Gather all restaurants ────────────────────────────────────────────
    const { rows: restaurants } = await pgDb.query<{
      id: number; name: string; cuisine: string; cuisine_emoji: string;
      rating: string; price_range: number; hero_image: string | null;
      address: string; tags: string[]; is_featured: boolean;
    }>(`SELECT id, name, cuisine, cuisine_emoji, rating, price_range,
              hero_image, address, tags, is_featured
         FROM restaurants
         WHERE is_active = true
         ORDER BY rating DESC, review_count DESC`);

    if (restaurants.length === 0) return void res.json({ recommendations: [], hasPersonal: false });

    // ── 2. User signals ──────────────────────────────────────────────────────

    // 2a. Reservations → restaurant ids
    const { rows: resRows } = await pgDb.query<{ restaurant_id: number; cnt: string }>(
      `SELECT restaurant_id, COUNT(*) as cnt FROM reservations
       WHERE customer_email = $1 GROUP BY restaurant_id`, [email]
    );
    const reservedMap = new Map<number, number>(resRows.map(r => [r.restaurant_id, parseInt(r.cnt)]));

    // 2b. Post likes → restaurant ids (via social_posts)
    const { rows: likedRows } = await pgDb.query<{ restaurant_id: number; cnt: string }>(
      `SELECT sp.restaurant_id, COUNT(*) as cnt
       FROM post_likes pl
       JOIN social_posts sp ON sp.id = pl.post_id
       WHERE pl.user_email = $1 AND sp.restaurant_id IS NOT NULL
       GROUP BY sp.restaurant_id`, [email]
    );
    const likedMap = new Map<number, number>(likedRows.map(r => [r.restaurant_id, parseInt(r.cnt)]));

    // 2c. Saved posts → restaurant ids
    const { rows: savedRows } = await pgDb.query<{ restaurant_id: number; cnt: string }>(
      `SELECT sp.restaurant_id, COUNT(*) as cnt
       FROM saved_posts sv
       JOIN social_posts sp ON sp.id = sv.post_id
       WHERE sv.user_email = $1 AND sp.restaurant_id IS NOT NULL
       GROUP BY sp.restaurant_id`, [email]
    );
    const savedMap = new Map<number, number>(savedRows.map(r => [r.restaurant_id, parseInt(r.cnt)]));

    // 2d. Reviews → restaurant ids
    const { rows: reviewRows } = await pgDb.query<{ restaurant_id: number; avg_rating: string }>(
      `SELECT restaurant_id, AVG(rating) as avg_rating FROM reviews
       WHERE customer_email = $1 GROUP BY restaurant_id`, [email]
    );
    const reviewedMap = new Map<number, number>(reviewRows.map(r => [r.restaurant_id, parseFloat(r.avg_rating)]));

    // ── 3. Build cuisine preference scores ────────────────────────────────────
    const cuisineScore = new Map<string, number>();
    const addCuisine = (restaurantId: number, weight: number) => {
      const r = restaurants.find(x => x.id === restaurantId);
      if (!r) return;
      cuisineScore.set(r.cuisine, (cuisineScore.get(r.cuisine) ?? 0) + weight);
    };
    for (const [id, cnt] of reservedMap) addCuisine(id, cnt * 3);
    for (const [id, cnt] of likedMap)    addCuisine(id, cnt * 2);
    for (const [id, cnt] of savedMap)    addCuisine(id, cnt * 2);
    for (const [id]      of reviewedMap) addCuisine(id, 1);

    // Top cuisine
    let topCuisine: string | null = null;
    let topCuisineScore = 0;
    for (const [c, s] of cuisineScore) {
      if (s > topCuisineScore) { topCuisineScore = s; topCuisine = c; }
    }

    const hasPersonal = reservedMap.size > 0 || likedMap.size > 0 ||
                        savedMap.size > 0 || reviewedMap.size > 0;

    // ── 4. Score each restaurant ──────────────────────────────────────────────
    const visitedIds = new Set([...reservedMap.keys(), ...reviewedMap.keys()]);

    const scored = restaurants.map(r => {
      const reserved  = reservedMap.get(r.id) ?? 0;
      const liked     = likedMap.get(r.id) ?? 0;
      const saved     = savedMap.get(r.id) ?? 0;
      const reviewed  = reviewedMap.has(r.id);
      const cScore    = cuisineScore.get(r.cuisine) ?? 0;
      const rating    = parseFloat(r.rating as unknown as string);

      // Score formula
      let score = 0;
      score += reserved * 5;     // strongest signal — they've been there
      score += liked    * 3;
      score += saved    * 3;
      score += (reviewed ? 2 : 0);
      score += cScore   * 1.5;   // cuisine preference bonus
      score += rating   * 1.5;   // quality baseline
      score += r.is_featured ? 1 : 0;

      const cuisineMatch = cScore > 0;
      const isTrending = !hasPersonal;

      const reason = buildReason({
        reserved: reserved > 0, liked: liked > 0, saved: saved > 0,
        reviewed, cuisineMatch, topCuisine, isTrending,
      });
      const category = buildCategory(score, hasPersonal);

      return { ...r, score, reason, category, rating };
    });

    // ── 5. Sort & deduplicate ─────────────────────────────────────────────────
    // Exclude places the user has already visited (unless very highly rated)
    const primary: typeof scored = [];
    const secondary: typeof scored = [];
    for (const r of scored.sort((a, b) => b.score - a.score)) {
      if (visitedIds.has(r.id) && r.rating < 4.8) secondary.push(r);
      else primary.push(r);
    }

    // Up to 8 recommendations: prefer novel, sprinkle in revisits
    const finalList = [...primary.slice(0, 7), ...secondary.slice(0, 1)].slice(0, 8);

    // ── 6. Build taste profile ────────────────────────────────────────────────
    const identity = topCuisine ? TASTE_IDENTITIES[topCuisine] ?? null : null;

    res.json({
      recommendations: finalList,
      hasPersonal,
      tasteProfile: {
        topCuisine,
        topCuisineDE: topCuisine ? deCuisine(topCuisine) : null,
        identity,
        signalCount: reservedMap.size + likedMap.size + savedMap.size + reviewedMap.size,
      },
    });
  } catch (err) {
    console.error("[recommendations] error:", err);
    res.status(500).json({ error: "Empfehlungen konnten nicht geladen werden." });
  }
});

export default router;
