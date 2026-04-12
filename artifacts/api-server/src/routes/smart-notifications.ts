/**
 * Smart notification endpoints.
 * GET    /api/smart-notifications?userType=customer&email=... → list
 * GET    /api/smart-notifications/unread-count?userType=...&email=...&restaurantId=... → count
 * PATCH  /api/smart-notifications/:id/read → mark one read
 * PATCH  /api/smart-notifications/read-all → mark all read for user
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { smartNotificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

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

export default router;
