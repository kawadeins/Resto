/**
 * Owner-facing group reservation request endpoints.
 * GET  /api/group-reservations         — all requests for the owner's restaurant (status != planned)
 * PUT  /api/group-reservations/:id/status — approve / reject / cancel (owner only)
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { groupReservationRequestsTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";

const router = Router();

// ── GET all group reservation requests for the owner's restaurant ─────────────
router.get("/", async (req, res) => {
  try {
    const sessionRestaurantId: number | undefined = req.session.restaurantId;
    let rows;
    if (sessionRestaurantId) {
      rows = await db
        .select()
        .from(groupReservationRequestsTable)
        .where(
          and(
            eq(groupReservationRequestsTable.restaurantId, sessionRestaurantId),
            ne(groupReservationRequestsTable.status, "planned")
          )
        )
        .orderBy(groupReservationRequestsTable.createdAt);
    } else {
      // Fallback: return all non-planned requests (single-tenant / dev mode)
      rows = await db
        .select()
        .from(groupReservationRequestsTable)
        .where(ne(groupReservationRequestsTable.status, "planned"))
        .orderBy(groupReservationRequestsTable.createdAt);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Gruppenanfragen" });
  }
});

// ── PUT status: confirmed / rejected / cancelled ──────────────────────────────
router.put("/:id/status", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Ungültige ID" });

    const { status } = req.body;
    if (!["confirmed", "rejected", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Ungültiger Status" });
    }

    // Ownership check: if session has restaurantId, verify it matches the request
    const sessionRestaurantId: number | undefined = req.session.restaurantId;
    if (sessionRestaurantId) {
      const [existing] = await db
        .select()
        .from(groupReservationRequestsTable)
        .where(eq(groupReservationRequestsTable.id, id));
      if (!existing) return res.status(404).json({ error: "Anfrage nicht gefunden" });
      if (existing.restaurantId !== sessionRestaurantId) {
        return res.status(403).json({ error: "Keine Berechtigung für diese Anfrage" });
      }
    }

    const [updated] = await db
      .update(groupReservationRequestsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(groupReservationRequestsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Anfrage nicht gefunden" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Aktualisieren des Status" });
  }
});

export default router;
