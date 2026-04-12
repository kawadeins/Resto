/**
 * Owner-facing group reservation request endpoints.
 * GET  /api/group-reservations         — all requests for the owner's restaurant (status != planned)
 * PUT  /api/group-reservations/:id/status — approve / reject / cancel (owner only)
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { groupReservationRequestsTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { createNotification } from "../lib/notify";

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

    // Load the request before update so we have organizer info
    const [existing] = await db
      .select()
      .from(groupReservationRequestsTable)
      .where(eq(groupReservationRequestsTable.id, id));

    if (!existing) return res.status(404).json({ error: "Anfrage nicht gefunden" });

    // Ownership check: if session has restaurantId, verify it matches
    const sessionRestaurantId: number | undefined = req.session.restaurantId;
    if (sessionRestaurantId && existing.restaurantId !== sessionRestaurantId) {
      return res.status(403).json({ error: "Keine Berechtigung für diese Anfrage" });
    }

    const [updated] = await db
      .update(groupReservationRequestsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(groupReservationRequestsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Anfrage nicht gefunden" });
    res.json(updated);

    // ── Notification hooks (fire-and-forget after response) ─────────────────
    const dateStr = new Date(existing.requestedDate).toLocaleDateString("de-DE", {
      weekday: "short", day: "numeric", month: "short",
    });

    if (status === "confirmed") {
      // Notify the group organizer (customer side)
      void createNotification({
        userType: "customer",
        recipientEmail: existing.organizerEmail,
        type: "group_reservation_confirmed",
        priority: "important",
        title: "Gruppenanfrage bestätigt",
        message: `${existing.restaurantName} hat deine Anfrage für ${dateStr} bestätigt.`,
        link: "/meal-plan",
        metadata: { groupPlanId: existing.groupPlanId, requestId: id },
      });
    } else if (status === "rejected") {
      void createNotification({
        userType: "customer",
        recipientEmail: existing.organizerEmail,
        type: "group_reservation_rejected",
        priority: "important",
        title: "Gruppenanfrage abgelehnt",
        message: `${existing.restaurantName} kann deine Anfrage für ${dateStr} leider nicht annehmen.`,
        link: "/meal-plan",
        metadata: { groupPlanId: existing.groupPlanId, requestId: id },
      });
    }
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Aktualisieren des Status" });
  }
});

export default router;
