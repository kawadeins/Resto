/**
 * Owner-facing group reservation request endpoints.
 * GET  /api/group-reservations         — all requests for the restaurant (status != planned)
 * PUT  /api/group-reservations/:id/status — approve / reject / cancel
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { groupReservationRequestsTable, restaurantsTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";

const router = Router();

// ── GET all group reservation requests visible to owner ───────────────────────
router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(groupReservationRequestsTable)
      .orderBy(groupReservationRequestsTable.createdAt);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Gruppenanfragen" });
  }
});

// ── PUT status: confirmed / rejected / cancelled ──────────────────────────────
router.put("/:id/status", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Ungültige ID" });
    const { status } = req.body;
    if (!["confirmed", "rejected", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Ungültiger Status" });
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
