import { Router } from "express";
import { db } from "@workspace/db";
import { bookingPlansTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { requireManagerOrAbove } from "../middleware/role-guard";

const router = Router();

function mapPlan(p: typeof bookingPlansTable.$inferSelect) {
  return {
    id: p.id,
    restaurantId: p.restaurantId,
    title: p.title,
    description: p.description ?? null,
    date: p.date,
    startTime: p.startTime,
    endTime: p.endTime,
    targetAudience: p.targetAudience,
    status: p.status,
    visibility: p.visibility,
    minCovers: p.minCovers ?? null,
    maxCovers: p.maxCovers ?? null,
    notes: p.notes ?? null,
    tags: p.tags ? JSON.parse(p.tags) : [],
    createdBy: p.createdBy,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

const PlanBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  date: z.string().min(1),
  startTime: z.string().optional().default("18:00"),
  endTime: z.string().optional().default("23:00"),
  targetAudience: z.string().optional().default("General"),
  status: z.enum(["draft", "active", "finalized", "archived"]).optional().default("draft"),
  visibility: z.enum(["private", "team", "public"]).optional().default("team"),
  minCovers: z.number().int().optional(),
  maxCovers: z.number().int().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  createdBy: z.string().optional().default("Manager"),
  restaurantId: z.number().int().optional().default(1),
});

// GET /api/booking-plans?restaurantId=1
router.get("/", async (req, res) => {
  try {
    const restaurantId = parseInt((req.query.restaurantId as string) ?? "1") || 1;
    const rows = await db
      .select()
      .from(bookingPlansTable)
      .where(eq(bookingPlansTable.restaurantId, restaurantId))
      .orderBy(desc(bookingPlansTable.createdAt));
    res.json(rows.map(mapPlan));
  } catch (err) {
    req.log.error({ err }, "Failed to list booking plans");
    res.status(500).json({ error: "Failed to list booking plans" });
  }
});

// GET /api/booking-plans/:id
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [plan] = await db.select().from(bookingPlansTable).where(eq(bookingPlansTable.id, id));
    if (!plan) return void res.status(404).json({ error: "Plan not found" });
    res.json(mapPlan(plan));
  } catch (err) {
    req.log.error({ err }, "Failed to get booking plan");
    res.status(500).json({ error: "Failed to get booking plan" });
  }
});

// POST /api/booking-plans
router.post("/", requireManagerOrAbove(), async (req, res) => {
  try {
    const body = PlanBody.parse(req.body);
    const [plan] = await db
      .insert(bookingPlansTable)
      .values({
        restaurantId: body.restaurantId ?? 1,
        title: body.title,
        description: body.description ?? null,
        date: body.date,
        startTime: body.startTime ?? "18:00",
        endTime: body.endTime ?? "23:00",
        targetAudience: body.targetAudience ?? "General",
        status: body.status ?? "draft",
        visibility: body.visibility ?? "team",
        minCovers: body.minCovers ?? null,
        maxCovers: body.maxCovers ?? null,
        notes: body.notes ?? null,
        tags: body.tags ? JSON.stringify(body.tags) : "[]",
        createdBy: body.createdBy ?? "Manager",
      })
      .returning();
    res.status(201).json(mapPlan(plan));
  } catch (err) {
    req.log.error({ err }, "Failed to create booking plan");
    res.status(500).json({ error: "Failed to create booking plan" });
  }
});

// PATCH /api/booking-plans/:id
router.patch("/:id", requireManagerOrAbove(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = PlanBody.partial().parse(req.body);
    const updateData: Partial<typeof bookingPlansTable.$inferInsert> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.date !== undefined) updateData.date = body.date;
    if (body.startTime !== undefined) updateData.startTime = body.startTime;
    if (body.endTime !== undefined) updateData.endTime = body.endTime;
    if (body.targetAudience !== undefined) updateData.targetAudience = body.targetAudience;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.visibility !== undefined) updateData.visibility = body.visibility;
    if (body.minCovers !== undefined) updateData.minCovers = body.minCovers;
    if (body.maxCovers !== undefined) updateData.maxCovers = body.maxCovers;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.tags !== undefined) updateData.tags = JSON.stringify(body.tags);
    if (body.createdBy !== undefined) updateData.createdBy = body.createdBy;

    const [updated] = await db
      .update(bookingPlansTable)
      .set(updateData)
      .where(eq(bookingPlansTable.id, id))
      .returning();
    if (!updated) return void res.status(404).json({ error: "Plan not found" });
    res.json(mapPlan(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update booking plan");
    res.status(500).json({ error: "Failed to update booking plan" });
  }
});

// POST /api/booking-plans/:id/duplicate
router.post("/:id/duplicate", requireManagerOrAbove(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [original] = await db.select().from(bookingPlansTable).where(eq(bookingPlansTable.id, id));
    if (!original) return void res.status(404).json({ error: "Plan not found" });

    const [copy] = await db
      .insert(bookingPlansTable)
      .values({
        restaurantId: original.restaurantId,
        title: `${original.title} (Kopie)`,
        description: original.description,
        date: original.date,
        startTime: original.startTime,
        endTime: original.endTime,
        targetAudience: original.targetAudience,
        status: "draft",
        visibility: original.visibility,
        minCovers: original.minCovers,
        maxCovers: original.maxCovers,
        notes: original.notes,
        tags: original.tags,
        createdBy: original.createdBy,
      })
      .returning();
    res.status(201).json(mapPlan(copy));
  } catch (err) {
    req.log.error({ err }, "Failed to duplicate booking plan");
    res.status(500).json({ error: "Failed to duplicate booking plan" });
  }
});

// DELETE /api/booking-plans/:id
router.delete("/:id", requireManagerOrAbove(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(bookingPlansTable).where(eq(bookingPlansTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete booking plan");
    res.status(500).json({ error: "Failed to delete booking plan" });
  }
});

export default router;
