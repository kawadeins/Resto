import { Router } from "express";
import { db } from "@workspace/db";
import { discountsTable, notificationsTable } from "@workspace/db";
import { z } from "zod";
import { eq } from "drizzle-orm";

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

router.post("/flash", async (req, res) => {
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

router.post("/scheduled", async (req, res) => {
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

router.patch("/:id/toggle", async (req, res) => {
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

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(discountsTable).where(eq(discountsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete deal");
    res.status(500).json({ error: "Failed to delete deal" });
  }
});

router.post("/blast", async (req, res) => {
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

export default router;
