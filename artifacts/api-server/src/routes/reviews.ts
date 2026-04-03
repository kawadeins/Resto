import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable, loyaltyPointsTable, reservationsTable, restaurantsTable } from "@workspace/db";
import { eq, desc, avg, count, and, isNotNull, isNull, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { sendEmail } from "../lib/email.js";

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

// GET /api/reviews/insights?restaurantId=1
// Returns rich review analytics: avg rating, reply rate, trend, needs-attention list
router.get("/insights", async (req, res) => {
  try {
    const restaurantId = parseInt((req.query.restaurantId as string) ?? "1") || 1;

    const allReviews = await db.select().from(reviewsTable)
      .where(eq(reviewsTable.restaurantId, restaurantId))
      .orderBy(desc(reviewsTable.createdAt));

    const totalCount = allReviews.length;
    const avgRating = totalCount > 0
      ? allReviews.reduce((s, r) => s + r.rating, 0) / totalCount
      : null;

    const repliedCount = allReviews.filter(r => r.ownerReply).length;
    const replyRate = totalCount > 0 ? Math.round((repliedCount / totalCount) * 100) : 0;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recent = allReviews.filter(r => r.createdAt >= thirtyDaysAgo);
    const previous = allReviews.filter(r => r.createdAt >= sixtyDaysAgo && r.createdAt < thirtyDaysAgo);

    const recentAvg = recent.length > 0 ? recent.reduce((s, r) => s + r.rating, 0) / recent.length : null;
    const previousAvg = previous.length > 0 ? previous.reduce((s, r) => s + r.rating, 0) / previous.length : null;

    let trend: "up" | "down" | "stable" | "new" = "stable";
    if (recentAvg !== null && previousAvg !== null) {
      if (recentAvg > previousAvg + 0.2) trend = "up";
      else if (recentAvg < previousAvg - 0.2) trend = "down";
    } else if (recentAvg !== null && previousAvg === null) {
      trend = "new";
    }

    // Needs attention: low rating (<=3) with no reply
    const needsAttention = allReviews
      .filter(r => r.rating <= 3 && !r.ownerReply)
      .slice(0, 10)
      .map(mapReview);

    const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    for (const r of allReviews) distribution[String(r.rating)] = (distribution[String(r.rating)] || 0) + 1;

    res.json({
      totalCount,
      averageRating: avgRating ? parseFloat(avgRating.toFixed(2)) : null,
      replyRate,
      repliedCount,
      unrepliedCount: totalCount - repliedCount,
      recentCount: recent.length,
      recentAvg: recentAvg ? parseFloat(recentAvg.toFixed(2)) : null,
      previousAvg: previousAvg ? parseFloat(previousAvg.toFixed(2)) : null,
      trend,
      distribution,
      needsAttention,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get review insights");
    res.status(500).json({ error: "Failed to get review insights" });
  }
});

// GET /api/reviews/pending-requests?restaurantId=1
// Returns completed reservations that haven't yet had a review request sent
router.get("/pending-requests", async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Completed reservations with no review request sent, within last 7 days
    const reservations = await db.select().from(reservationsTable)
      .where(
        and(
          eq(reservationsTable.status, "completed"),
          isNull(reservationsTable.reviewRequestSentAt)
        )
      )
      .orderBy(desc(reservationsTable.createdAt))
      .limit(50);

    // Filter to recent ones (last 7 days based on date)
    const pending = reservations.filter(r => {
      const rDate = new Date(r.date);
      return rDate >= sevenDaysAgo;
    });

    res.json(pending.map(r => ({
      id: r.id,
      customerName: r.customerName,
      customerEmail: r.customerEmail,
      date: r.date,
      time: r.time,
      partySize: r.partySize,
      status: r.status,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get pending review requests");
    res.status(500).json({ error: "Failed to get pending review requests" });
  }
});

const SendRequestBody = z.object({
  reservationId: z.number(),
  restaurantId: z.number().optional(),
});

// POST /api/reviews/send-request
// Sends a review request email to the customer of a given reservation
router.post("/send-request", async (req, res) => {
  try {
    const { reservationId, restaurantId = 1 } = SendRequestBody.parse(req.body);

    const [reservation] = await db.select().from(reservationsTable)
      .where(eq(reservationsTable.id, reservationId));

    if (!reservation) {
      return void res.status(404).json({ error: "Reservation not found" });
    }

    const [restaurant] = await db.select().from(restaurantsTable)
      .where(eq(restaurantsTable.id, restaurantId));

    const restaurantName = restaurant?.name ?? "our restaurant";

    await sendEmail({
      to: reservation.customerEmail,
      subject: `How was your visit to ${restaurantName}?`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a1a1a">Hi ${reservation.customerName},</h2>
          <p>Thank you for dining with us at <strong>${restaurantName}</strong> on ${reservation.date}.</p>
          <p>We'd love to hear about your experience! Your feedback helps us improve and helps other diners make great choices.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${process.env.CUSTOMER_APP_URL ?? "https://restosmart.replit.app"}/my-bookings?review=${reservationId}"
               style="background:#e85d04;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
              Leave a Review
            </a>
          </div>
          <p style="color:#666;font-size:13px">This only takes 30 seconds and means a lot to us.</p>
        </div>
      `,
    });

    await db.update(reservationsTable)
      .set({ reviewRequestSentAt: new Date() })
      .where(eq(reservationsTable.id, reservationId));

    res.json({ success: true, sentTo: reservation.customerEmail });
  } catch (err) {
    req.log.error({ err }, "Failed to send review request");
    res.status(500).json({ error: "Failed to send review request" });
  }
});

// POST /api/reviews/rating-sync?restaurantId=1
// Recalculates avg rating from reviews table and writes back to restaurants table
router.post("/rating-sync", async (req, res) => {
  try {
    const restaurantId = parseInt((req.query.restaurantId as string) ?? "1") || 1;

    const [stats] = await db.select({
      averageRating: avg(reviewsTable.rating),
      totalCount: count(reviewsTable.id),
    }).from(reviewsTable).where(eq(reviewsTable.restaurantId, restaurantId));

    if (!stats || Number(stats.totalCount) === 0) {
      return void res.json({ skipped: true, reason: "No reviews" });
    }

    const newRating = parseFloat(parseFloat(stats.averageRating ?? "0").toFixed(2));
    const newCount = Number(stats.totalCount);

    await db.update(restaurantsTable)
      .set({ rating: String(newRating), reviewCount: newCount })
      .where(eq(restaurantsTable.id, restaurantId));

    res.json({ success: true, averageRating: newRating, totalCount: newCount });
  } catch (err) {
    req.log.error({ err }, "Failed to sync rating");
    res.status(500).json({ error: "Failed to sync rating" });
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
    const restaurantId = body.restaurantId ?? 1;

    const [review] = await db.insert(reviewsTable).values({
      restaurantId,
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

    // Auto-sync rating
    try {
      const [stats] = await db.select({
        averageRating: avg(reviewsTable.rating),
        totalCount: count(reviewsTable.id),
      }).from(reviewsTable).where(eq(reviewsTable.restaurantId, restaurantId));
      if (stats && Number(stats.totalCount) > 0) {
        const newRating = parseFloat(parseFloat(stats.averageRating ?? "0").toFixed(2));
        await db.update(restaurantsTable)
          .set({ rating: String(newRating), reviewCount: Number(stats.totalCount) })
          .where(eq(restaurantsTable.id, restaurantId));
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
