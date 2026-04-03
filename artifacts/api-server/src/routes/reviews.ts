import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable, loyaltyPointsTable } from "@workspace/db";
import { eq, desc, avg, count } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function mapReview(r: typeof reviewsTable.$inferSelect) {
  return {
    id: r.id,
    restaurantId: r.restaurantId,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    bookingId: r.bookingId ?? null,
    rating: r.rating,
    comment: r.comment,
    ownerReply: r.ownerReply ?? null,
    ownerRepliedAt: r.ownerRepliedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

// GET /api/reviews?restaurantId=1
router.get("/", async (req, res) => {
  try {
    const restaurantId = parseInt((req.query.restaurantId as string) ?? "1") || 1;
    const rows = await db.select().from(reviewsTable)
      .where(eq(reviewsTable.restaurantId, restaurantId))
      .orderBy(desc(reviewsTable.createdAt));
    res.json(rows.map(mapReview));
  } catch (err) {
    req.log.error({ err }, "Failed to list reviews");
    res.status(500).json({ error: "Failed to list reviews" });
  }
});

// GET /api/reviews/stats?restaurantId=1
router.get("/stats", async (req, res) => {
  try {
    const restaurantId = parseInt((req.query.restaurantId as string) ?? "1") || 1;
    const rows = await db.select({
      averageRating: avg(reviewsTable.rating),
      totalCount: count(reviewsTable.id),
    }).from(reviewsTable).where(eq(reviewsTable.restaurantId, restaurantId));

    const all = await db.select({ rating: reviewsTable.rating }).from(reviewsTable).where(eq(reviewsTable.restaurantId, restaurantId));
    const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    for (const r of all) distribution[String(r.rating)] = (distribution[String(r.rating)] || 0) + 1;

    res.json({
      averageRating: rows[0]?.averageRating ? parseFloat(rows[0].averageRating) : null,
      totalCount: Number(rows[0]?.totalCount ?? 0),
      distribution,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get review stats");
    res.status(500).json({ error: "Failed to get review stats" });
  }
});

const CreateReviewBody = z.object({
  restaurantId: z.number().optional(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  bookingId: z.number().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(3),
});

// POST /api/reviews
router.post("/", async (req, res) => {
  try {
    const body = CreateReviewBody.parse(req.body);
    const [review] = await db.insert(reviewsTable).values({
      restaurantId: body.restaurantId ?? 1,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      bookingId: body.bookingId ?? null,
      rating: body.rating,
      comment: body.comment,
    }).returning();

    // Award loyalty points for leaving a review (5 points)
    try {
      const existing = await db.select().from(loyaltyPointsTable).where(eq(loyaltyPointsTable.customerEmail, body.customerEmail));
      if (existing.length === 0) {
        await db.insert(loyaltyPointsTable).values({
          customerEmail: body.customerEmail,
          customerName: body.customerName,
          points: 5,
          totalEarned: 5,
        });
      } else {
        await db.update(loyaltyPointsTable).set({
          points: existing[0].points + 5,
          totalEarned: existing[0].totalEarned + 5,
          updatedAt: new Date(),
        }).where(eq(loyaltyPointsTable.customerEmail, body.customerEmail));
      }
    } catch (_) {}

    res.status(201).json(mapReview(review));
  } catch (err) {
    req.log.error({ err }, "Failed to create review");
    res.status(500).json({ error: "Failed to create review" });
  }
});

const ReplyBody = z.object({ reply: z.string().min(1) });

// POST /api/reviews/:id/reply
router.post("/:id/reply", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reply } = ReplyBody.parse(req.body);
    const [updated] = await db.update(reviewsTable)
      .set({ ownerReply: reply, ownerRepliedAt: new Date() })
      .where(eq(reviewsTable.id, id))
      .returning();
    if (!updated) return void res.status(404).json({ error: "Review not found" });
    res.json(mapReview(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to reply to review");
    res.status(500).json({ error: "Failed to reply to review" });
  }
});

export default router;
