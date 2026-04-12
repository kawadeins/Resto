/**
 * Smart notification endpoints + Predictive Engine.
 *
 * GET    /api/smart-notifications?userType=customer&email=...             → list
 * GET    /api/smart-notifications/unread-count?userType=...&email=...     → count
 * PATCH  /api/smart-notifications/:id/read                                → mark one read
 * PATCH  /api/smart-notifications/read-all                                → mark all read
 * POST   /api/smart-notifications/predict/customer                        → generate customer predictions
 * POST   /api/smart-notifications/predict/business                        → generate business predictions
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { smartNotificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildWhere(userType: string, email?: string, restaurantId?: number) {
  const conditions = [eq(smartNotificationsTable.userType, userType)];
  if (userType === "customer" && email) {
    conditions.push(eq(smartNotificationsTable.recipientEmail, email));
  } else if (userType === "business" && restaurantId) {
    conditions.push(eq(smartNotificationsTable.restaurantId, restaurantId));
  }
  return and(...conditions);
}

// ── GET list ──────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { userType, email, restaurantId } = req.query as Record<string, string>;
    if (!userType) return res.status(400).json({ error: "userType required" });
    const rid = restaurantId ? parseInt(restaurantId) : undefined;
    const rows = await db
      .select()
      .from(smartNotificationsTable)
      .where(buildWhere(userType, email, rid))
      .orderBy(desc(smartNotificationsTable.createdAt))
      .limit(60);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Benachrichtigungen" });
  }
});

// ── GET unread count ──────────────────────────────────────────────────────────
router.get("/unread-count", async (req, res) => {
  try {
    const { userType, email, restaurantId } = req.query as Record<string, string>;
    if (!userType) return res.json({ count: 0 });
    const rid = restaurantId ? parseInt(restaurantId) : undefined;
    const rows = await db
      .select({ id: smartNotificationsTable.id })
      .from(smartNotificationsTable)
      .where(and(buildWhere(userType, email, rid), eq(smartNotificationsTable.isRead, false)));
    res.json({ count: rows.length });
  } catch {
    res.json({ count: 0 });
  }
});

// ── PATCH mark one read ───────────────────────────────────────────────────────
router.patch("/:id/read", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Ungültige ID" });
    await db
      .update(smartNotificationsTable)
      .set({ isRead: true })
      .where(eq(smartNotificationsTable.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Fehler" });
  }
});

// ── PATCH mark all read ───────────────────────────────────────────────────────
router.patch("/read-all", async (req, res) => {
  try {
    const { userType, email, restaurantId } = req.body as Record<string, string>;
    if (!userType) return res.status(400).json({ error: "userType required" });
    const rid = restaurantId ? parseInt(restaurantId) : undefined;
    await db
      .update(smartNotificationsTable)
      .set({ isRead: true })
      .where(and(buildWhere(userType, email, rid), eq(smartNotificationsTable.isRead, false)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Fehler" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PREDICTIVE ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const pgDb = () => (db as any).$client;

type Priority = "critical" | "important" | "informational" | "suggestion";

interface NotifPayload {
  userType: "customer" | "business";
  recipientEmail?: string;
  restaurantId?: number;
  type: string;
  priority: Priority;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

// Anti-spam: dedup window per priority
const DEDUP_HOURS: Record<Priority, number> = {
  critical:      6,
  important:    24,
  informational: 48,
  suggestion:   72,
};

/**
 * Insert a notification if no similar one was sent within the dedup window.
 * Returns true if inserted, false if suppressed.
 */
async function insertIfFresh(n: NotifPayload): Promise<boolean> {
  const pg = pgDb();
  const hours = DEDUP_HOURS[n.priority];
  const recipientCond = n.userType === "customer"
    ? "recipient_email = $1 AND restaurant_id IS NULL"
    : "restaurant_id = $1";
  const recipientVal = n.userType === "customer" ? n.recipientEmail : n.restaurantId;

  const { rows: existing } = await pg.query(
    `SELECT id FROM smart_notifications
      WHERE user_type = $2
        AND type = $3
        AND ${recipientCond}
        AND created_at > NOW() - INTERVAL '${hours} hours'
      LIMIT 1`,
    [recipientVal, n.userType, n.type]
  );
  if (existing.length > 0) return false; // suppressed

  await pg.query(
    `INSERT INTO smart_notifications
      (user_type, recipient_email, restaurant_id, type, priority, title, message, link, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      n.userType,
      n.recipientEmail ?? null,
      n.restaurantId ?? null,
      n.type,
      n.priority,
      n.title,
      n.message,
      n.link ?? null,
      n.metadata ? JSON.stringify(n.metadata) : null,
    ]
  );
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER PREDICTION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

async function runCustomerPredictions(email: string): Promise<number> {
  const pg = pgDb();
  let generated = 0;

  // ── 1. Reservation reminder 24h ──────────────────────────────────────────
  try {
    const { rows: res24 } = await pg.query<{
      id: number; date: string; time: string; restaurant_id: number; restaurant_name?: string;
    }>(
      `SELECT r.id, r.date::text, r.time, r.restaurant_id,
              rs.name as restaurant_name
         FROM reservations r
         LEFT JOIN restaurants rs ON rs.id = r.restaurant_id
        WHERE r.customer_email = $1
          AND r.status IN ('confirmed', 'pending')
          AND r.date = (CURRENT_DATE + INTERVAL '1 day')::date`,
      [email]
    );
    for (const res of res24) {
      const ok = await insertIfFresh({
        userType: "customer",
        recipientEmail: email,
        type: "reservation_reminder",
        priority: "important",
        title: "Erinnerung: Morgen bist du dabei",
        message: `Dein Tisch bei ${res.restaurant_name ?? "deinem Restaurant"} ist morgen um ${res.time} Uhr reserviert.`,
        link: `/restaurant/${res.restaurant_id}`,
        metadata: { reservationId: res.id },
      });
      if (ok) generated++;
    }
  } catch { /* continue */ }

  // ── 2. Reservation reminder 2h ───────────────────────────────────────────
  try {
    const { rows: res2h } = await pg.query<{
      id: number; date: string; time: string; restaurant_id: number; restaurant_name?: string;
    }>(
      `SELECT r.id, r.date::text, r.time, r.restaurant_id,
              rs.name as restaurant_name
         FROM reservations r
         LEFT JOIN restaurants rs ON rs.id = r.restaurant_id
        WHERE r.customer_email = $1
          AND r.status IN ('confirmed', 'pending')
          AND r.date = CURRENT_DATE
          AND (
            (r.time::time - CURRENT_TIME) BETWEEN INTERVAL '1 hour 30 min' AND INTERVAL '2 hours 30 min'
          )`,
      [email]
    );
    for (const res of res2h) {
      const ok = await insertIfFresh({
        userType: "customer",
        recipientEmail: email,
        type: "reservation_soon",
        priority: "critical",
        title: "Dein Tisch ist in 2 Stunden",
        message: `Vergiss nicht: Reservierung bei ${res.restaurant_name ?? "deinem Restaurant"} um ${res.time} Uhr heute.`,
        link: `/restaurant/${res.restaurant_id}`,
        metadata: { reservationId: res.id },
      });
      if (ok) generated++;
    }
  } catch { /* continue */ }

  // ── 3. Review prompt (completed booking, no review yet) ──────────────────
  try {
    const { rows: noReview } = await pg.query<{
      id: number; restaurant_id: number; restaurant_name?: string; date: string;
    }>(
      `SELECT r.id, r.restaurant_id, rs.name as restaurant_name, r.date::text
         FROM reservations r
         LEFT JOIN restaurants rs ON rs.id = r.restaurant_id
        WHERE r.customer_email = $1
          AND r.status = 'confirmed'
          AND r.date BETWEEN (CURRENT_DATE - INTERVAL '7 days') AND (CURRENT_DATE - INTERVAL '1 day')
          AND NOT EXISTS (
            SELECT 1 FROM reviews rv
             WHERE rv.customer_email = $1
               AND rv.restaurant_id = r.restaurant_id
               AND rv.created_at > r.date::timestamp
          )
        LIMIT 3`,
      [email]
    );
    for (const res of noReview) {
      const ok = await insertIfFresh({
        userType: "customer",
        recipientEmail: email,
        type: "review_prompt",
        priority: "informational",
        title: "Wie war dein Besuch?",
        message: `Du warst kürzlich bei ${res.restaurant_name ?? "einem Restaurant"}. Teile deine Erfahrung!`,
        link: `/restaurant/${res.restaurant_id}`,
        metadata: { reservationId: res.id },
      });
      if (ok) generated++;
    }
  } catch { /* continue */ }

  // ── 4. Group plan reminder tomorrow ──────────────────────────────────────
  try {
    const { rows: gpTomorrow } = await pg.query<{
      id: number; title: string; date: string; time: string;
    }>(
      `SELECT gp.id, gp.title, gp.date::text, gp.time
         FROM group_plans gp
        WHERE gp.organizer_email = $1
          AND gp.date = (CURRENT_DATE + INTERVAL '1 day')::date
        LIMIT 2`,
      [email]
    );
    for (const gp of gpTomorrow) {
      const ok = await insertIfFresh({
        userType: "customer",
        recipientEmail: email,
        type: "group_plan_reminder",
        priority: "important",
        title: "Gruppenplan morgen",
        message: `"${gp.title}" ist morgen um ${gp.time} Uhr geplant. Alles bereit?`,
        link: `/meal-plan`,
        metadata: { groupPlanId: gp.id },
      });
      if (ok) generated++;
    }
  } catch { /* continue */ }

  // ── 5. Trending suggestion (personalized or popular) ─────────────────────
  try {
    const hour = new Date().getHours();
    const isEvening = hour >= 17 && hour <= 23;
    const isMorning = hour >= 8 && hour <= 11;

    // Pick a top restaurant matching user taste (or just top rated)
    const { rows: trending } = await pg.query<{
      id: number; name: string; cuisine: string;
    }>(
      `SELECT DISTINCT r.id, r.name, r.cuisine
         FROM restaurants r
        WHERE r.is_active = true
          AND r.rating >= 4.5
          AND r.id NOT IN (
            SELECT COALESCE(restaurant_id, 0) FROM reservations
             WHERE customer_email = $1
               AND date >= CURRENT_DATE - INTERVAL '14 days'
          )
        ORDER BY r.rating DESC, r.review_count DESC
        LIMIT 1`,
      [email]
    );
    if (trending.length > 0 && (isEvening || isMorning)) {
      const r = trending[0];
      const timeLabel = isEvening ? "Heute Abend" : "Heute Morgen";
      const ok = await insertIfFresh({
        userType: "customer",
        recipientEmail: email,
        type: "trending_suggestion",
        priority: "suggestion",
        title: `${timeLabel} besonders passend`,
        message: `${r.name} könnte heute perfekt für dich sein. Hoch bewertet und beliebt.`,
        link: `/restaurant/${r.id}`,
        metadata: { restaurantId: r.id, cuisine: r.cuisine },
      });
      if (ok) generated++;
    }
  } catch { /* continue */ }

  return generated;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS PREDICTION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

async function runBusinessPredictions(restaurantId: number): Promise<number> {
  const pg = pgDb();
  let generated = 0;

  // ── 1. Low wallet balance ─────────────────────────────────────────────────
  try {
    const { rows: wallet } = await pg.query<{ balance_after: string }>(
      `SELECT balance_after FROM wallet_transactions
        WHERE restaurant_id = $1
        ORDER BY created_at DESC LIMIT 1`,
      [restaurantId]
    );
    if (wallet.length > 0) {
      const balance = parseFloat(wallet[0].balance_after);
      if (balance < 20) {
        const ok = await insertIfFresh({
          userType: "business",
          restaurantId,
          type: "wallet_low",
          priority: balance < 5 ? "critical" : "important",
          title: balance < 5 ? "Guthaben fast aufgebraucht" : "Guthaben wird knapp",
          message: `Aktuelles Guthaben: €${balance.toFixed(2)}. Lade dein Konto auf, um Boosts & Kampagnen fortzuführen.`,
          link: "/wallet",
          metadata: { balance },
        });
        if (ok) generated++;
      }
    }
  } catch { /* continue */ }

  // ── 2. Reservation load tomorrow ─────────────────────────────────────────
  try {
    const { rows: resTomorrow } = await pg.query<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM reservations
        WHERE restaurant_id = $1
          AND date = (CURRENT_DATE + INTERVAL '1 day')::date
          AND status IN ('confirmed','pending')`,
      [restaurantId]
    );
    const count = parseInt(resTomorrow[0]?.cnt ?? "0");
    if (count >= 3) {
      const ok = await insertIfFresh({
        userType: "business",
        restaurantId,
        type: "reservation_load",
        priority: count >= 8 ? "important" : "informational",
        title: `${count} Reservierungen morgen`,
        message: count >= 8
          ? `Du hast morgen ${count} Reservierungen — hohe Auslastung. Bereite dich frühzeitig vor.`
          : `Du hast morgen ${count} Reservierungen. Ein guter Tag zum Vorbereiten.`,
        link: "/reservations",
        metadata: { count },
      });
      if (ok) generated++;
    }
  } catch { /* continue */ }

  // ── 3. Pending group requests ─────────────────────────────────────────────
  try {
    const { rows: pending } = await pg.query<{ cnt: string; organizer_name: string }>(
      `SELECT COUNT(*) as cnt, MIN(organizer_name) as organizer_name
         FROM group_reservation_requests
        WHERE restaurant_id = $1
          AND status = 'planned'
          AND sent_at IS NULL`,
      [restaurantId]
    );
    const cnt = parseInt(pending[0]?.cnt ?? "0");
    if (cnt > 0) {
      const ok = await insertIfFresh({
        userType: "business",
        restaurantId,
        type: "new_group_request",
        priority: "important",
        title: cnt === 1
          ? `Neue Gruppenanfrage von ${pending[0].organizer_name}`
          : `${cnt} Gruppenanfragen warten`,
        message: `${cnt} Gruppenreservierungsanfrage${cnt > 1 ? "n warten" : " wartet"} auf deine Bestätigung.`,
        link: "/reservations",
        metadata: { pendingCount: cnt },
      });
      if (ok) generated++;
    }
  } catch { /* continue */ }

  // ── 4. Critical reviews without reply ────────────────────────────────────
  try {
    const { rows: critReviews } = await pg.query<{ id: number; rating: number; customer_name: string }>(
      `SELECT id, rating, customer_name FROM reviews
        WHERE restaurant_id = $1
          AND rating <= 2
          AND (owner_reply IS NULL OR owner_reply = '')
          AND created_at > NOW() - INTERVAL '30 days'
        ORDER BY rating ASC
        LIMIT 3`,
      [restaurantId]
    );
    if (critReviews.length > 0) {
      const r = critReviews[0];
      const ok = await insertIfFresh({
        userType: "business",
        restaurantId,
        type: "critical_review",
        priority: "critical",
        title: "Kritische Bewertung ohne Antwort",
        message: `${r.customer_name} hat ${r.rating} ⭐ gegeben und noch keine Antwort erhalten. Antworte jetzt, um das Vertrauen zu stärken.`,
        link: "/reviews",
        metadata: { reviewId: r.id, rating: r.rating },
      });
      if (ok) generated++;
    }
  } catch { /* continue */ }

  // ── 5. Evening boost suggestion ──────────────────────────────────────────
  try {
    const hour = new Date().getHours();
    const isEveningWindow = hour >= 16 && hour <= 21;
    if (isEveningWindow) {
      const { rows: recentBoost } = await pg.query<{ cnt: string }>(
        `SELECT COUNT(*) as cnt FROM wallet_transactions
          WHERE restaurant_id = $1
            AND type = 'boost_spend'
            AND created_at > NOW() - INTERVAL '48 hours'`,
        [restaurantId]
      );
      const hasRecentBoost = parseInt(recentBoost[0]?.cnt ?? "0") > 0;
      if (!hasRecentBoost) {
        const ok = await insertIfFresh({
          userType: "business",
          restaurantId,
          type: "boost_suggestion",
          priority: "suggestion",
          title: "Abend-Boost könnte helfen",
          message: "Heute Abend ist eine gute Zeit für einen kurzen Sichtbarkeits-Boost. Erreiche mehr Gäste jetzt.",
          link: "/wallet",
          metadata: { hour },
        });
        if (ok) generated++;
      }
    }
  } catch { /* continue */ }

  // ── 6. Unreviewed campaign performance ───────────────────────────────────
  try {
    const { rows: campaigns } = await pg.query<{ id: number; name: string; clicks: number; sends: number }>(
      `SELECT id, name,
              COALESCE((metadata->>'clicks')::int, 0) as clicks,
              COALESCE((metadata->>'sends')::int, 0) as sends
         FROM campaigns
        WHERE restaurant_id = $1
          AND status = 'active'
          AND created_at > NOW() - INTERVAL '7 days'
        LIMIT 1`,
      [restaurantId]
    );
    for (const c of campaigns) {
      const ctr = c.sends > 0 ? c.clicks / c.sends : 0;
      if (c.sends > 50 && ctr < 0.02) {
        const ok = await insertIfFresh({
          userType: "business",
          restaurantId,
          type: "campaign_underperforming",
          priority: "informational",
          title: "Kampagne unter Erwartung",
          message: `"${c.name}" hat eine niedrige Klickrate. Passe den Inhalt an oder wähle ein neues Ziel.`,
          link: "/campaigns",
          metadata: { campaignId: c.id, ctr },
        });
        if (ok) generated++;
      }
    }
  } catch { /* continue */ }

  return generated;
}

// ─────────────────────────────────────────────────────────────────────────────
// PREDICT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// POST /predict/customer
router.post("/predict/customer", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: "email required" });
  try {
    const count = await runCustomerPredictions(email);
    res.json({ ok: true, generated: count });
  } catch (err: any) {
    console.error("[predict/customer]", err?.message);
    res.status(500).json({ error: "Prediction failed" });
  }
});

// POST /predict/business
router.post("/predict/business", async (req, res) => {
  const { restaurantId } = req.body as { restaurantId?: number };
  if (!restaurantId) return res.status(400).json({ error: "restaurantId required" });
  try {
    const count = await runBusinessPredictions(restaurantId);
    res.json({ ok: true, generated: count });
  } catch (err: any) {
    console.error("[predict/business]", err?.message);
    res.status(500).json({ error: "Prediction failed" });
  }
});

// POST /predict/all — called by scheduler / ops
router.post("/predict/all", async (req, res) => {
  const pg = pgDb();
  let totalGenerated = 0;
  try {
    // Run business predictions for all active restaurants
    const { rows: restaurants } = await pg.query<{ id: number }>(
      `SELECT id FROM restaurants WHERE is_active = true LIMIT 50`
    );
    for (const r of restaurants) {
      try {
        const n = await runBusinessPredictions(r.id);
        totalGenerated += n;
      } catch { /* continue */ }
    }

    // Customer predictions are user-triggered — no bulk run for privacy
    res.json({ ok: true, generated: totalGenerated, restaurantsProcessed: restaurants.length });
  } catch (err: any) {
    res.status(500).json({ error: "Bulk prediction failed" });
  }
});

export default router;
