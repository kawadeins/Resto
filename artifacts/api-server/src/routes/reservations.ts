import { Router } from "express";
import { db } from "@workspace/db";
import { reservationsTable, loyaltyPointsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { createNotification } from "../lib/notify";
import { sendBookingConfirmation, sendLoyaltyTierUnlock } from "../services/email";
import { requireManagerOrAbove } from "../middleware/role-guard";
import {
  CreateReservationBody,
  UpdateReservationBody,
  GetReservationParams,
  UpdateReservationParams,
  DeleteReservationParams,
  ListReservationsParams,
} from "@workspace/api-zod";

const router = Router();

function mapReservation(r: typeof reservationsTable.$inferSelect) {
  return {
    id: r.id,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    date: r.date,
    time: r.time,
    partySize: r.partySize,
    status: r.status,
    tableNumber: r.tableNumber ?? null,
    notes: r.notes ?? null,
    source: r.source,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/today", requireManagerOrAbove(), async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const rows = await db
      .select()
      .from(reservationsTable)
      .where(eq(reservationsTable.date, today))
      .orderBy(reservationsTable.time);
    res.json(rows.map(mapReservation));
  } catch (err) {
    req.log.error({ err }, "Failed to get today reservations");
    res.status(500).json({ error: "Failed to get today reservations" });
  }
});

router.get("/stats", requireManagerOrAbove(), async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const all = await db.select().from(reservationsTable);
    const todayRows = all.filter((r) => r.date === today);
    const weekRows = all.filter((r) => r.date >= weekAgo);
    const cancelled = all.filter((r) => r.status === "cancelled");

    const totalCovers = todayRows.reduce((sum, r) => sum + r.partySize, 0);
    const avgPartySize = all.length > 0
      ? all.reduce((sum, r) => sum + r.partySize, 0) / all.length
      : 0;
    const cancellationRate = all.length > 0
      ? (cancelled.length / all.length) * 100
      : 0;

    res.json({
      todayTotal: todayRows.length,
      todayConfirmed: todayRows.filter((r) => r.status === "confirmed").length,
      todayPending: todayRows.filter((r) => r.status === "pending").length,
      todaySeated: todayRows.filter((r) => r.status === "seated").length,
      totalCovers,
      weekTotal: weekRows.length,
      cancellationRate: Math.round(cancellationRate * 10) / 10,
      avgPartySize: Math.round(avgPartySize * 10) / 10,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get reservation stats");
    res.status(500).json({ error: "Failed to get reservation stats" });
  }
});

router.get("/", requireManagerOrAbove(), async (req, res) => {
  try {
    const { date, status } = req.query as { date?: string; status?: string };
    let rows = await db
      .select()
      .from(reservationsTable)
      .orderBy(reservationsTable.date, reservationsTable.time);

    if (date) rows = rows.filter((r) => r.date === date);
    if (status && status !== "all") rows = rows.filter((r) => r.status === status);

    res.json(rows.map(mapReservation));
  } catch (err) {
    req.log.error({ err }, "Failed to list reservations");
    res.status(500).json({ error: "Failed to list reservations" });
  }
});

router.post("/", requireManagerOrAbove(), async (req, res) => {
  try {
    const body = CreateReservationBody.parse(req.body);
    const [row] = await db.insert(reservationsTable).values({
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      date: body.date,
      time: body.time,
      partySize: body.partySize,
      status: "pending",
      tableNumber: body.tableNumber ?? null,
      notes: body.notes ?? null,
      source: body.source,
    }).returning();
    res.status(201).json(mapReservation(row));
    // Notify business of new reservation (fire-and-forget)
    void createNotification({
      userType: "business",
      restaurantId: (row as any).restaurantId ?? 1,
      type: "new_reservation",
      priority: "important",
      title: "Neue Reservierung",
      message: `${body.customerName} – ${body.partySize} Personen am ${body.date} um ${body.time} Uhr.`,
      link: "/reservations",
      metadata: { reservationId: row.id },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create reservation");
    res.status(400).json({ error: "Invalid reservation data" });
  }
});

router.get("/:id", requireManagerOrAbove(), async (req, res) => {
  try {
    const { id } = GetReservationParams.parse({ id: parseInt(req.params.id) });
    const [row] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, id));
    if (!row) return void res.status(404).json({ error: "Not found" });
    res.json(mapReservation(row));
  } catch (err) {
    req.log.error({ err }, "Failed to get reservation");
    res.status(500).json({ error: "Failed to get reservation" });
  }
});

router.patch("/:id/status", requireManagerOrAbove(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = z.object({
      status: z.enum(["pending", "confirmed", "rejected", "arrived", "cancelled"]),
    }).parse(req.body);
    const [row] = await db.update(reservationsTable)
      .set({ status })
      .where(eq(reservationsTable.id, id))
      .returning();
    if (!row) return void res.status(404).json({ error: "Not found" });

    // Award 10 loyalty points when booking is marked as arrived
    if (status === "arrived" && row.customerEmail) {
      try {
        const existing = await db.select().from(loyaltyPointsTable)
          .where(eq(loyaltyPointsTable.customerEmail, row.customerEmail));
        if (existing.length === 0) {
          await db.insert(loyaltyPointsTable).values({
            customerEmail: row.customerEmail,
            customerName: row.customerName,
            points: 10,
            totalEarned: 10,
          });
        } else {
          await db.update(loyaltyPointsTable).set({
            customerName: row.customerName,
            points: existing[0].points + 10,
            totalEarned: existing[0].totalEarned + 10,
            updatedAt: new Date(),
          }).where(eq(loyaltyPointsTable.customerEmail, row.customerEmail));
        }
      } catch (_) {}
    }

    res.json(mapReservation(row));
  } catch (err) {
    req.log.error({ err }, "Failed to update reservation status");
    res.status(400).json({ error: "Invalid status" });
  }
});

router.put("/:id", requireManagerOrAbove(), async (req, res) => {
  try {
    const { id } = UpdateReservationParams.parse({ id: parseInt(req.params.id) });
    const body = UpdateReservationBody.parse(req.body);
    const [row] = await db.update(reservationsTable).set({
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      date: body.date,
      time: body.time,
      partySize: body.partySize,
      status: body.status,
      tableNumber: body.tableNumber ?? null,
      notes: body.notes ?? null,
      source: body.source,
    }).where(eq(reservationsTable.id, id)).returning();
    if (!row) return void res.status(404).json({ error: "Not found" });
    res.json(mapReservation(row));
  } catch (err) {
    req.log.error({ err }, "Failed to update reservation");
    res.status(400).json({ error: "Invalid data" });
  }
});

router.delete("/:id", requireManagerOrAbove(), async (req, res) => {
  try {
    const { id } = DeleteReservationParams.parse({ id: parseInt(req.params.id) });
    await db.delete(reservationsTable).where(eq(reservationsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete reservation");
    res.status(500).json({ error: "Failed to delete reservation" });
  }
});

export default router;
