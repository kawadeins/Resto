import { Router } from "express";
import { db } from "@workspace/db";
import { discountsTable } from "@workspace/db";
import { UpdateDiscountBody } from "@workspace/api-zod";

const router = Router();

function mapDiscount(d: typeof discountsTable.$inferSelect) {
  return {
    id: d.id,
    enabled: d.enabled,
    percentage: parseFloat(d.percentage),
    startTime: d.startTime,
    endTime: d.endTime,
    days: d.days ?? [],
  };
}

async function ensureDiscount() {
  const existing = await db.select().from(discountsTable).limit(1);
  if (existing.length === 0) {
    const [discount] = await db.insert(discountsTable).values({
      enabled: false,
      percentage: "15",
      startTime: "15:00",
      endTime: "17:00",
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    }).returning();
    return discount;
  }
  return existing[0];
}

router.get("/", async (req, res) => {
  try {
    const discount = await ensureDiscount();
    res.json(mapDiscount(discount));
  } catch (err) {
    req.log.error({ err }, "Failed to get discount");
    res.status(500).json({ error: "Failed to get discount" });
  }
});

router.put("/", async (req, res) => {
  try {
    const existing = await ensureDiscount();
    const body = UpdateDiscountBody.parse(req.body);
    const [updated] = await db.update(discountsTable).set({
      enabled: body.enabled,
      percentage: String(body.percentage),
      startTime: body.startTime,
      endTime: body.endTime,
      days: body.days,
    }).returning();
    res.json(mapDiscount(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update discount");
    res.status(400).json({ error: "Invalid discount data" });
  }
});

export default router;
