import { Router } from "express";
import { db } from "@workspace/db";
import { discountsTable, notificationsTable } from "@workspace/db";
import { reservationsTable } from "@workspace/db";
import { z } from "zod";
import { eq, gte, and } from "drizzle-orm";
import { requireManagerOrAbove } from "../middleware/role-guard";

const router = Router();

function mapDeal(d: typeof discountsTable.$inferSelect) {
  const now = new Date();
  const isFlashActive =
    d.type === "flash" &&
    d.enabled &&
    d.flashExpiresAt != null &&
    new Date(d.flashExpiresAt) > now;

  const flashMinutesRemaining = isFlashActive
    ? Math.max(0, Math.round((new Date(d.flashExpiresAt!).getTime() - now.getTime()) / 60000))
    : null;

  return {
    id: d.id,
    type: d.type,
    enabled: d.enabled,
    percentage: parseFloat(d.percentage),
    startTime: d.startTime,
    endTime: d.endTime,
    days: d.days ?? [],
    label: d.label,
    targetType: d.targetType,
    notes: d.notes ?? null,
    flashExpiresAt: d.flashExpiresAt ? d.flashExpiresAt.toISOString() : null,
    flashMinutesRemaining,
    isFlashActive,
    createdAt: d.createdAt.toISOString(),
  };
}

const CreateScheduledBody = z.object({
  label: z.string().min(1),
  percentage: z.number().min(1).max(100),
  startTime: z.string(),
  endTime: z.string(),
  days: z.array(z.string()),
  notes: z.string().nullable().optional(),
});

router.get("/all", async (req, res) => {
  try {
    const rows = await db.select().from(discountsTable).orderBy(discountsTable.createdAt);
    res.json(rows.map(mapDeal));
  } catch (err) {
    req.log.error({ err }, "Failed to list deals");
    res.status(500).json({ error: "Failed to list deals" });
  }
});

router.get("/active-status", async (req, res) => {
  try {
    const now = new Date();
    const allDeals = await db.select().from(discountsTable);

    const flashDeal = allDeals.find(
      (d) =>
        d.type === "flash" &&
        d.enabled &&
        d.flashExpiresAt != null &&
        new Date(d.flashExpiresAt) > now
    );

    if (flashDeal) {
      const minutesRemaining = Math.max(
        0,
        Math.round((new Date(flashDeal.flashExpiresAt!).getTime() - now.getTime()) / 60000)
      );
      return void res.json({
        active: true,
        type: "flash",
        label: flashDeal.label,
        percentage: parseFloat(flashDeal.percentage),
        minutesRemaining,
        expiresAt: flashDeal.flashExpiresAt!.toISOString(),
      });
    }

    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const currentDay = days[now.getDay()];
    const currentMin = now.getHours() * 60 + now.getMinutes();

    const scheduledActive = allDeals.find((d) => {
      if (d.type !== "scheduled" || !d.enabled) return false;
      if (!d.days.includes(currentDay)) return false;
      const [sh, sm] = d.startTime.split(":").map(Number);
      const [eh, em] = d.endTime.split(":").map(Number);
      const startMin = sh * 60 + (sm || 0);
      const endMin = eh * 60 + (em || 0);
      return currentMin >= startMin && currentMin < endMin;
    });

    if (scheduledActive) {
      const [eh, em] = scheduledActive.endTime.split(":").map(Number);
      const endMin = eh * 60 + (em || 0);
      const minutesRemaining = Math.max(0, endMin - currentMin);
      return void res.json({
        active: true,
        type: "scheduled",
        label: scheduledActive.label,
        percentage: parseFloat(scheduledActive.percentage),
        minutesRemaining,
        expiresAt: null,
      });
    }

    return void res.json({
      active: false,
      type: null,
      label: null,
      percentage: null,
      minutesRemaining: null,
      expiresAt: null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get active status");
    res.status(500).json({ error: "Failed to get active status" });
  }
});

router.post("/flash", requireManagerOrAbove(), async (req, res) => {
  try {
    const { label, percentage } = z.object({
      label: z.string().default("Flash Deal"),
      percentage: z.number().default(25),
    }).parse(req.body);

    const flashExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await db.update(discountsTable)
      .set({ enabled: false })
      .where(eq(discountsTable.type, "flash"));

    const [deal] = await db.insert(discountsTable).values({
      type: "flash",
      enabled: true,
      label,
      percentage: String(percentage),
      startTime: "00:00",
      endTime: "23:59",
      days: [],
      flashExpiresAt,
    }).returning();

    res.status(201).json(mapDeal(deal));
  } catch (err) {
    req.log.error({ err }, "Failed to create flash deal");
    res.status(400).json({ error: "Failed to create flash deal" });
  }
});

router.post("/scheduled", requireManagerOrAbove(), async (req, res) => {
  try {
    const body = CreateScheduledBody.parse(req.body);
    const [deal] = await db.insert(discountsTable).values({
      type: "scheduled",
      enabled: true,
      label: body.label,
      percentage: String(body.percentage),
      startTime: body.startTime,
      endTime: body.endTime,
      days: body.days,
      notes: body.notes ?? null,
    }).returning();
    res.status(201).json(mapDeal(deal));
  } catch (err) {
    req.log.error({ err }, "Failed to create scheduled deal");
    res.status(400).json({ error: "Invalid deal data" });
  }
});

router.patch("/:id/toggle", requireManagerOrAbove(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    const [updated] = await db.update(discountsTable)
      .set({ enabled })
      .where(eq(discountsTable.id, id))
      .returning();
    if (!updated) return void res.status(404).json({ error: "Not found" });
    res.json(mapDeal(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to toggle deal");
    res.status(400).json({ error: "Failed to toggle deal" });
  }
});

router.delete("/:id", requireManagerOrAbove(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(discountsTable).where(eq(discountsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete deal");
    res.status(500).json({ error: "Failed to delete deal" });
  }
});

router.post("/blast", requireManagerOrAbove(), async (req, res) => {
  try {
    const body = z.object({
      title: z.string(),
      message: z.string(),
      targetCount: z.number().default(0),
    }).parse(req.body);

    const [notification] = await db.insert(notificationsTable).values({
      type: "discount_blast",
      title: body.title,
      message: body.message,
      targetCount: body.targetCount,
    }).returning();

    res.status(201).json({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      targetCount: notification.targetCount,
      sentAt: notification.sentAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to send blast");
    res.status(400).json({ error: "Failed to send blast" });
  }
});

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(discountsTable).orderBy(discountsTable.createdAt);
    res.json(rows.map(mapDeal));
  } catch (err) {
    res.status(500).json({ error: "Failed to list deals" });
  }
});

router.get("/local-reach", async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [allDiscounts, recentBookings] = await Promise.all([
      db.select().from(discountsTable).orderBy(discountsTable.createdAt),
      db.select().from(reservationsTable).where(gte(reservationsTable.createdAt, thirtyDaysAgo)),
    ]);

    const mappedDeals = allDiscounts.map(mapDeal);
    const activeDeals = mappedDeals.filter((d) => d.isFlashActive || (d.enabled && d.type === "scheduled"));
    const flashDeals = mappedDeals.filter((d) => d.type === "flash");

    // For flash deals: count bookings made during the deal's active window
    const dealPerformance = flashDeals.map((deal) => {
      const dealCreatedAt = new Date(deal.createdAt);
      const dealExpiry = deal.flashExpiresAt ? new Date(deal.flashExpiresAt) : new Date(dealCreatedAt.getTime() + 4 * 60 * 60 * 1000);

      const bookingsDuringDeal = recentBookings.filter((b) => {
        const bTime = new Date(b.createdAt);
        return bTime >= dealCreatedAt && bTime <= dealExpiry;
      }).length;

      // Estimate impressions: 50/hour × hours active
      const hoursActive = Math.max(1, (dealExpiry.getTime() - dealCreatedAt.getTime()) / (1000 * 60 * 60));
      const estimatedImpressions = Math.round(hoursActive * 25);

      return {
        id: deal.id,
        label: deal.label || `${deal.percentage}% Flash Deal`,
        percentage: deal.percentage,
        isActive: deal.isFlashActive,
        type: deal.type,
        bookingsDuringPeriod: bookingsDuringDeal,
        estimatedImpressions,
        conversionRate: estimatedImpressions > 0 ? parseFloat(((bookingsDuringDeal / estimatedImpressions) * 100).toFixed(1)) : 0,
        flashExpiresAt: deal.flashExpiresAt,
        flashMinutesRemaining: deal.flashMinutesRemaining,
        createdAt: deal.createdAt,
      };
    });

    // Scheduled deal reach
    const scheduledDeals = mappedDeals.filter((d) => d.type === "scheduled" && d.enabled);
    const scheduledPerformance = scheduledDeals.map((deal) => {
      // Bookings made during the deal's time window (rough: time of day)
      const [startH, startM] = (deal.startTime || "00:00").split(":").map(Number);
      const [endH, endM] = (deal.endTime || "23:59").split(":").map(Number);
      const startMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;

      const bookingsDuringWindow = recentBookings.filter((b) => {
        const bDate = new Date(b.createdAt);
        const bMins = bDate.getHours() * 60 + bDate.getMinutes();
        const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][bDate.getDay()];
        const dayMatch = deal.days.length === 0 || deal.days.some((d: string) => d.toLowerCase() === dayName);
        return dayMatch && bMins >= startMins && bMins <= endMins;
      }).length;

      const windowHours = Math.max(0.5, (endMins - startMins) / 60);
      const estimatedDailyImpressions = Math.round(windowHours * 20);
      const daysRunning = Math.max(1, Math.round((now.getTime() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
      const estimatedImpressions = estimatedDailyImpressions * Math.min(daysRunning, 30);

      return {
        id: deal.id,
        label: deal.label || `${deal.percentage}% Scheduled Deal`,
        percentage: deal.percentage,
        isActive: deal.enabled,
        type: deal.type,
        bookingsDuringPeriod: bookingsDuringWindow,
        estimatedImpressions,
        conversionRate: estimatedImpressions > 0 ? parseFloat(((bookingsDuringWindow / estimatedImpressions) * 100).toFixed(1)) : 0,
        startTime: deal.startTime,
        endTime: deal.endTime,
        days: deal.days,
        createdAt: deal.createdAt,
      };
    });

    const allDealPerformance = [...dealPerformance, ...scheduledPerformance]
      .sort((a, b) => b.bookingsDuringPeriod - a.bookingsDuringPeriod);

    const topDeal = allDealPerformance[0] ?? null;

    const recentWeekBookings = recentBookings.filter((b) => new Date(b.createdAt) >= sevenDaysAgo).length;
    const totalBookingsDuringDeals = allDealPerformance.reduce((s, d) => s + d.bookingsDuringPeriod, 0);
    const totalEstimatedImpressions = allDealPerformance.reduce((s, d) => s + d.estimatedImpressions, 0);

    res.json({
      activeDeals: activeDeals.length,
      totalDeals: allDiscounts.length,
      deals: allDealPerformance,
      topDeal,
      bookingsThisWeek: recentWeekBookings,
      totalBookingsDuringDeals,
      totalEstimatedImpressions,
      overallConversionRate:
        totalEstimatedImpressions > 0
          ? parseFloat(((totalBookingsDuringDeals / totalEstimatedImpressions) * 100).toFixed(1))
          : 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to compute local reach");
    res.status(500).json({ error: "Failed to compute local reach" });
  }
});

export default router;
