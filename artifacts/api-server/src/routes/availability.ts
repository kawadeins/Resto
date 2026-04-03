import { Router } from "express";
import { db } from "@workspace/db";
import { restaurantsTable, reservationsTable } from "@workspace/db";
import { eq, gte, lte, and, desc } from "drizzle-orm";
import { z } from "zod";
import { buildSlots } from "../lib/availability";

const router = Router();

// GET /api/availability/settings?restaurantId=1
router.get("/settings", async (req, res) => {
  try {
    const restaurantId = parseInt((req.query.restaurantId as string) ?? "1") || 1;
    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
    if (!r) return void res.status(404).json({ error: "Restaurant not found" });

    res.json({
      tableCapacity: r.tableCapacity ?? 20,
      seatingCapacity: r.seatingCapacity ?? 80,
      slotDurationMinutes: r.slotDurationMinutes ?? 90,
      maxPartySize: r.maxPartySize ?? 8,
      walkInsEnabled: r.walkInsEnabled ?? true,
      availabilityPaused: r.availabilityPaused ?? false,
      availabilityPausedUntil: r.availabilityPausedUntil?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get availability settings");
    res.status(500).json({ error: "Failed to get availability settings" });
  }
});

const SettingsBody = z.object({
  tableCapacity: z.number().int().min(1).max(500).optional(),
  seatingCapacity: z.number().int().min(1).max(2000).optional(),
  slotDurationMinutes: z.number().int().min(30).max(360).optional(),
  maxPartySize: z.number().int().min(1).max(100).optional(),
  walkInsEnabled: z.boolean().optional(),
});

// PUT /api/availability/settings
router.put("/settings", async (req, res) => {
  try {
    const restaurantId = parseInt((req.query.restaurantId as string) ?? "1") || 1;
    const body = SettingsBody.parse(req.body);
    const [updated] = await db.update(restaurantsTable).set(body).where(eq(restaurantsTable.id, restaurantId)).returning();
    if (!updated) return void res.status(404).json({ error: "Restaurant not found" });
    res.json({
      tableCapacity: updated.tableCapacity ?? 20,
      seatingCapacity: updated.seatingCapacity ?? 80,
      slotDurationMinutes: updated.slotDurationMinutes ?? 90,
      maxPartySize: updated.maxPartySize ?? 8,
      walkInsEnabled: updated.walkInsEnabled ?? true,
      availabilityPaused: updated.availabilityPaused ?? false,
      availabilityPausedUntil: updated.availabilityPausedUntil?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to save availability settings");
    res.status(500).json({ error: "Failed to save settings" });
  }
});

const PauseBody = z.object({
  paused: z.boolean(),
  durationMinutes: z.number().int().min(0).optional(),
});

// POST /api/availability/pause
router.post("/pause", async (req, res) => {
  try {
    const restaurantId = parseInt((req.query.restaurantId as string) ?? "1") || 1;
    const { paused, durationMinutes } = PauseBody.parse(req.body);

    let pausedUntil: Date | null = null;
    if (paused && durationMinutes && durationMinutes > 0) {
      pausedUntil = new Date(Date.now() + durationMinutes * 60000);
    }

    await db.update(restaurantsTable).set({
      availabilityPaused: paused,
      availabilityPausedUntil: pausedUntil,
    }).where(eq(restaurantsTable.id, restaurantId));

    res.json({ ok: true, paused, pausedUntil: pausedUntil?.toISOString() ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to toggle availability pause");
    res.status(500).json({ error: "Failed to toggle pause" });
  }
});

// GET /api/availability/overview?date=YYYY-MM-DD
router.get("/overview", async (req, res) => {
  try {
    const restaurantId = parseInt((req.query.restaurantId as string) ?? "1") || 1;
    const date = (req.query.date as string) ?? new Date().toISOString().split("T")[0];

    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
    if (!r) return void res.status(404).json({ error: "Restaurant not found" });

    const dayRes = await db.select({
      time: reservationsTable.time,
      partySize: reservationsTable.partySize,
      status: reservationsTable.status,
    }).from(reservationsTable).where(eq(reservationsTable.date, date));

    const capacity = r.seatingCapacity ?? 80;
    const dur = r.slotDurationMinutes ?? 90;

    const slots = buildSlots(r.openTime, r.closeTime, dur, capacity, dayRes);

    // Weekly busy pattern: reservations grouped by day-of-week for last 4 weeks
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fourWeeksAgoStr = fourWeeksAgo.toISOString().split("T")[0];

    const recentRes = await db.select({
      date: reservationsTable.date,
      partySize: reservationsTable.partySize,
      status: reservationsTable.status,
    }).from(reservationsTable).where(gte(reservationsTable.date, fourWeeksAgoStr));

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const weeklyPattern = dayNames.map((name) => {
      const dayNum = dayNames.indexOf(name);
      const dayBookings = recentRes.filter((rb) => {
        const d = new Date(rb.date + "T00:00:00");
        return d.getDay() === dayNum && !["cancelled", "rejected"].includes(rb.status);
      });
      const totalGuests = dayBookings.reduce((s, b) => s + b.partySize, 0);
      const totalBookings = dayBookings.length;
      return { day: name, short: name.slice(0, 3), totalBookings, totalGuests, avgGuests: totalBookings > 0 ? Math.round(totalGuests / 4) : 0 };
    });

    // Fastest-filling slots (those with most bookings historically)
    const timePattern: Record<string, number> = {};
    recentRes
      .filter((rb) => !["cancelled", "rejected"].includes(rb.status))
      .forEach((rb) => {
        if (!rb.time) return;
        const [h] = rb.time.split(":").map(Number);
        const key = `${String(h).padStart(2, "0")}:00`;
        timePattern[key] = (timePattern[key] || 0) + rb.partySize;
      });

    const fastestSlots = Object.entries(timePattern)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([time, guests]) => ({ time, guests }));

    // Today's summary
    const activeToday = dayRes.filter((r) => !["cancelled", "rejected"].includes(r.status));
    const totalGuestsToday = activeToday.reduce((s, r) => s + r.partySize, 0);
    const peakSlot = slots.reduce((max, s) => (s.bookedGuests > (max?.bookedGuests ?? 0) ? s : max), slots[0] ?? null);

    res.json({
      date,
      seatingCapacity: capacity,
      slotDurationMinutes: dur,
      tableCapacity: r.tableCapacity ?? 20,
      slots,
      summary: {
        totalReservations: activeToday.length,
        totalGuests: totalGuestsToday,
        peakSlot: peakSlot?.time ?? null,
        peakOccupancy: peakSlot?.percentage ?? 0,
        remainingCapacity: Math.max(0, capacity - totalGuestsToday),
      },
      weeklyPattern,
      fastestSlots,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get availability overview");
    res.status(500).json({ error: "Failed to get overview" });
  }
});

export default router;
