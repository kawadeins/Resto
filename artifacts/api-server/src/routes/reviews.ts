import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable, loyaltyPointsTable, reservationsTable, restaurantsTable } from "@workspace/db";
import { eq, desc, avg, count, and, isNull, or, ne } from "drizzle-orm";
import { z } from "zod";
import { sendEmail } from "../lib/email.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireManagerOrAbove } from "../middleware/role-guard";
import { aiLimiter, reviewSubmitLimiter } from "../middleware/rate-limiters";

const router = Router();

function parseId(raw: unknown): number | null {
  const n = parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type ReviewRow = typeof reviewsTable.$inferSelect;

function mapReview(r: ReviewRow) {
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
    recoveryStatus: r.recoveryStatus ?? null,
    recoveryMessage: r.recoveryMessage ?? null,
    businessResponse: r.businessResponse ?? null,
    businessRespondedAt: r.businessRespondedAt?.toISOString() ?? null,
    aiReplySuggestion: r.aiReplySuggestion ?? null,
    initialRating: r.initialRating ?? null,
    aiUsed: r.aiUsed ?? false,
    responseTimeHours: r.responseTimeHours !== null && r.responseTimeHours !== undefined ? parseFloat(String(r.responseTimeHours)) : null,
  };
}

function mapPublicReview(r: ReviewRow) {
  return {
    id: r.id,
    restaurantId: r.restaurantId,
    customerName: r.customerName,
    rating: r.rating,
    comment: r.comment,
    ownerReply: r.ownerReply ?? null,
    ownerRepliedAt: r.ownerRepliedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    businessResponse: r.businessResponse ?? null,
    businessRespondedAt: r.businessRespondedAt?.toISOString() ?? null,
  };
}

// Publicly visible: exclude reviews that are "In Klärung" (pending recovery, not yet published)
function isPubliclyVisible(r: ReviewRow) {
  return r.recoveryStatus === null || r.recoveryStatus === "published";
}

// GET /api/reviews?restaurantId=1  — public endpoint, strips PII
router.get("/", async (req, res) => {
  try {
    const restaurantId = parseInt((req.query.restaurantId as string) ?? "1") || 1;
    const rows = await db.select().from(reviewsTable)
      .where(eq(reviewsTable.restaurantId, restaurantId))
      .orderBy(desc(reviewsTable.createdAt));
    res.json(rows.filter(isPubliclyVisible).map(mapPublicReview));
  } catch (err) {
    req.log.error({ err }, "Failed to list reviews");
    res.status(500).json({ error: "Failed to list reviews" });
  }
});

// GET /api/reviews/stats?restaurantId=1
router.get("/stats", async (req, res) => {
  try {
    const restaurantId = parseInt((req.query.restaurantId as string) ?? "1") || 1;
    const all = await db.select({ rating: reviewsTable.rating, recoveryStatus: reviewsTable.recoveryStatus })
      .from(reviewsTable).where(eq(reviewsTable.restaurantId, restaurantId));
    const visible = all.filter(r => r.recoveryStatus === null || r.recoveryStatus === "published");
    const totalCount = visible.length;
    const avgRating = totalCount > 0 ? visible.reduce((s, r) => s + r.rating, 0) / totalCount : null;
    const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    for (const r of visible) distribution[String(r.rating)] = (distribution[String(r.rating)] || 0) + 1;
    res.json({
      averageRating: avgRating ? parseFloat(avgRating.toFixed(2)) : null,
      totalCount,
      distribution,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get review stats");
    res.status(500).json({ error: "Failed to get review stats" });
  }
});

// GET /api/reviews/insights?restaurantId=1
router.get("/insights", async (req, res) => {
  try {
    const restaurantId = parseInt((req.query.restaurantId as string) ?? "1") || 1;
    const allReviews = await db.select().from(reviewsTable)
      .where(eq(reviewsTable.restaurantId, restaurantId))
      .orderBy(desc(reviewsTable.createdAt));

    const publicReviews = allReviews.filter(isPubliclyVisible);
    const totalCount = publicReviews.length;
    const avgRating = totalCount > 0 ? publicReviews.reduce((s, r) => s + r.rating, 0) / totalCount : null;
    const repliedCount = publicReviews.filter(r => r.ownerReply).length;
    const replyRate = totalCount > 0 ? Math.round((repliedCount / totalCount) * 100) : 0;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const recent = publicReviews.filter(r => r.createdAt >= thirtyDaysAgo);
    const previous = publicReviews.filter(r => r.createdAt >= sixtyDaysAgo && r.createdAt < thirtyDaysAgo);
    const recentAvg = recent.length > 0 ? recent.reduce((s, r) => s + r.rating, 0) / recent.length : null;
    const previousAvg = previous.length > 0 ? previous.reduce((s, r) => s + r.rating, 0) / previous.length : null;

    let trend: "up" | "down" | "stable" | "new" = "stable";
    if (recentAvg !== null && previousAvg !== null) {
      if (recentAvg > previousAvg + 0.2) trend = "up";
      else if (recentAvg < previousAvg - 0.2) trend = "down";
    } else if (recentAvg !== null && previousAvg === null) {
      trend = "new";
    }

    const needsAttention = publicReviews
      .filter(r => r.rating <= 3 && !r.ownerReply)
      .slice(0, 10)
      .map(mapReview);

    const pendingRecovery = allReviews
      .filter(r => r.recoveryStatus === "pending")
      .map(mapReview);

    const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    for (const r of publicReviews) distribution[String(r.rating)] = (distribution[String(r.rating)] || 0) + 1;

    // ── Recovery Analytics ──────────────────────────────────────────────────────
    const recoveryReviews = allReviews.filter(r => r.recoveryStatus !== null);
    const totalRecovery = recoveryReviews.length;
    const resolvedRecovery = recoveryReviews.filter(r => ["resolved", "published", "closed"].includes(r.recoveryStatus ?? ""));
    const publishedRecovery = recoveryReviews.filter(r => r.recoveryStatus === "published" && r.initialRating !== null);
    const resolvedRate = totalRecovery > 0 ? Math.round((resolvedRecovery.length / totalRecovery) * 100) : 0;

    // Average rating improvement for published recovery reviews
    const ratingImprovements = publishedRecovery
      .filter(r => r.initialRating !== null)
      .map(r => r.rating - (r.initialRating ?? r.rating));
    const avgRatingImprovement = ratingImprovements.length > 0
      ? parseFloat((ratingImprovements.reduce((s, v) => s + v, 0) / ratingImprovements.length).toFixed(2))
      : null;

    // Average response time
    const responseTimes = recoveryReviews
      .filter(r => r.responseTimeHours !== null)
      .map(r => parseFloat(String(r.responseTimeHours)));
    const avgResponseTimeHours = responseTimes.length > 0
      ? parseFloat((responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length).toFixed(1))
      : null;

    // AI metrics
    const aiUsedReviews = recoveryReviews.filter(r => r.aiUsed === true);
    const aiUsageRate = totalRecovery > 0 ? Math.round((aiUsedReviews.length / totalRecovery) * 100) : 0;
    const aiPublishedWithImprovement = aiUsedReviews.filter(r =>
      r.recoveryStatus === "published" && r.initialRating !== null && r.rating > (r.initialRating ?? r.rating)
    );
    const aiSuccessRate = aiUsedReviews.filter(r => r.recoveryStatus === "published").length > 0
      ? Math.round((aiPublishedWithImprovement.length / aiUsedReviews.filter(r => r.recoveryStatus === "published").length) * 100)
      : null;

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
      pendingRecovery,
      pendingRecoveryCount: pendingRecovery.length,
      // Recovery analytics
      recovery: {
        totalCases: totalRecovery,
        resolvedRate,
        avgRatingImprovement,
        avgResponseTimeHours,
        aiUsageRate,
        aiSuccessRate,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get review insights");
    res.status(500).json({ error: "Failed to get review insights" });
  }
});

// GET /api/reviews/pending-requests?restaurantId=1
router.get("/pending-requests", async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const reservations = await db.select().from(reservationsTable)
      .where(and(eq(reservationsTable.status, "completed"), isNull(reservationsTable.reviewRequestSentAt)))
      .orderBy(desc(reservationsTable.createdAt))
      .limit(50);
    const pending = reservations.filter(r => new Date(r.date) >= sevenDaysAgo);
    res.json(pending.map(r => ({
      id: r.id, customerName: r.customerName, customerEmail: r.customerEmail,
      date: r.date, time: r.time, partySize: r.partySize, status: r.status,
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
router.post("/send-request", async (req, res) => {
  try {
    const { reservationId, restaurantId = 1 } = SendRequestBody.parse(req.body);
    const [reservation] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, reservationId));
    if (!reservation) return void res.status(404).json({ error: "Reservation not found" });
    const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
    const restaurantName = restaurant?.name ?? "unserem Restaurant";
    await sendEmail({
      to: reservation.customerEmail,
      subject: `Wie war Ihr Besuch bei ${restaurantName}?`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f0eef8;padding:24px 0">
          <div style="background:#fff;border-radius:16px;overflow:hidden;max-width:560px;margin:0 auto;box-shadow:0 2px 16px rgba(99,60,180,0.10)">
            <div style="background:linear-gradient(135deg,#7c3aed,#db2777);padding:28px 36px;text-align:center">
              <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px">RestoSmart</span>
            </div>
            <div style="padding:36px">
              <h2 style="color:#1a0a2e;margin:0 0 16px">Hallo ${reservation.customerName},</h2>
              <p style="color:#444;line-height:1.6;margin:0 0 12px">Vielen Dank, dass Sie bei <strong>${restaurantName}</strong> am ${reservation.date} gespeist haben.</p>
              <p style="color:#444;line-height:1.6;margin:0 0 28px">Wir würden uns sehr freuen, von Ihren Eindrücken zu hören!</p>
              <div style="text-align:center;margin:0 0 28px">
                <a href="${process.env.CUSTOMER_APP_URL ?? "https://restosmart.replit.app"}/my-bookings?review=${reservationId}"
                   style="background:linear-gradient(135deg,#7c3aed,#db2777);color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px">
                  Bewertung schreiben
                </a>
              </div>
            </div>
          </div>
        </div>
      `,
    });
    await db.update(reservationsTable).set({ reviewRequestSentAt: new Date() }).where(eq(reservationsTable.id, reservationId));
    res.json({ success: true, sentTo: reservation.customerEmail });
  } catch (err) {
    req.log.error({ err }, "Failed to send review request");
    res.status(500).json({ error: "Failed to send review request" });
  }
});

// POST /api/reviews/rating-sync?restaurantId=1
router.post("/rating-sync", async (req, res) => {
  try {
    const restaurantId = parseInt((req.query.restaurantId as string) ?? "1") || 1;
    const rows = await db.select().from(reviewsTable).where(eq(reviewsTable.restaurantId, restaurantId));
    const visible = rows.filter(isPubliclyVisible);
    if (visible.length === 0) return void res.json({ skipped: true, reason: "No visible reviews" });
    const newRating = parseFloat((visible.reduce((s, r) => s + r.rating, 0) / visible.length).toFixed(2));
    await db.update(restaurantsTable).set({ rating: String(newRating), reviewCount: visible.length }).where(eq(restaurantsTable.id, restaurantId));
    res.json({ success: true, averageRating: newRating, totalCount: visible.length });
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
  startRecovery: z.boolean().optional(),
});

// POST /api/reviews — rate limited to prevent spam
router.post("/", reviewSubmitLimiter, async (req, res) => {
  try {
    const body = CreateReviewBody.parse(req.body);
    const restaurantId = body.restaurantId ?? 1;

    const isLowRating = body.rating <= 3;
    const startRecovery = body.startRecovery === true && isLowRating;

    const [review] = await db.insert(reviewsTable).values({
      restaurantId,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      bookingId: body.bookingId ?? null,
      rating: body.rating,
      comment: body.comment,
      recoveryStatus: startRecovery ? "pending" : null,
      recoveryMessage: startRecovery ? body.comment : null,
      initialRating: startRecovery ? body.rating : null,
    }).returning();

    // Award loyalty points
    try {
      const existing = await db.select().from(loyaltyPointsTable).where(eq(loyaltyPointsTable.customerEmail, body.customerEmail));
      if (existing.length === 0) {
        await db.insert(loyaltyPointsTable).values({ customerEmail: body.customerEmail, customerName: body.customerName, points: 5, totalEarned: 5 });
      } else {
        await db.update(loyaltyPointsTable).set({ points: existing[0].points + 5, totalEarned: existing[0].totalEarned + 5, updatedAt: new Date() }).where(eq(loyaltyPointsTable.customerEmail, body.customerEmail));
      }
    } catch (_) {}

    // Auto-sync rating (only from visible reviews)
    if (!startRecovery) {
      try {
        const rows = await db.select().from(reviewsTable).where(eq(reviewsTable.restaurantId, restaurantId));
        const visible = rows.filter(isPubliclyVisible);
        if (visible.length > 0) {
          const newRating = parseFloat((visible.reduce((s, r) => s + r.rating, 0) / visible.length).toFixed(2));
          await db.update(restaurantsTable).set({ rating: String(newRating), reviewCount: visible.length }).where(eq(restaurantsTable.id, restaurantId));
        }
      } catch (_) {}
    }

    res.status(201).json({ ...mapReview(review), requiresRecovery: isLowRating && !startRecovery });
  } catch (err) {
    req.log.error({ err }, "Failed to create review");
    res.status(500).json({ error: "Failed to create review" });
  }
});

const ReplyBody = z.object({ reply: z.string().min(1) });

// POST /api/reviews/:id/reply
router.post("/:id/reply", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return void res.status(400).json({ error: "Invalid review id" });
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

// POST /api/reviews/:id/recover — customer chooses "Problem klären" for an already-submitted review
router.post("/:id/recover", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return void res.status(400).json({ error: "Invalid review id" });
    const [existing] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    if (!existing) return void res.status(404).json({ error: "Review not found" });
    if (existing.recoveryStatus !== null) return void res.json(mapReview(existing));
    const [updated] = await db.update(reviewsTable)
      .set({ recoveryStatus: "pending", recoveryMessage: existing.comment })
      .where(eq(reviewsTable.id, id))
      .returning();
    res.json(mapReview(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to start recovery");
    res.status(500).json({ error: "Failed to start recovery" });
  }
});

const BusinessResponseBody = z.object({ response: z.string().min(1) });

// POST /api/reviews/:id/business-response — business sends their response to the customer
router.post("/:id/business-response", requireManagerOrAbove(), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return void res.status(400).json({ error: "Invalid review id" });
    const { response } = BusinessResponseBody.parse(req.body);
    const [existing] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    if (!existing) return void res.status(404).json({ error: "Review not found" });
    const respondedAt = new Date();
    const responseTimeHours = parseFloat(((respondedAt.getTime() - existing.createdAt.getTime()) / 3_600_000).toFixed(2));
    const [updated] = await db.update(reviewsTable)
      .set({ businessResponse: response, businessRespondedAt: respondedAt, recoveryStatus: "resolved", ownerReply: response, ownerRepliedAt: respondedAt, responseTimeHours: String(responseTimeHours) })
      .where(eq(reviewsTable.id, id))
      .returning();
    res.json(mapReview(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to save business response");
    res.status(500).json({ error: "Failed to save business response" });
  }
});

// POST /api/reviews/:id/publish — customer publishes review after recovery
router.post("/:id/publish", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return void res.status(400).json({ error: "Invalid review id" });
    const body = z.object({ rating: z.number().int().min(1).max(5).optional(), comment: z.string().min(1).optional() }).parse(req.body ?? {});
    const [existing] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    if (!existing) return void res.status(404).json({ error: "Review not found" });
    const [updated] = await db.update(reviewsTable)
      .set({
        recoveryStatus: "published",
        rating: body.rating ?? existing.rating,
        comment: body.comment ?? existing.comment,
      })
      .where(eq(reviewsTable.id, id))
      .returning();
    // Sync rating now that review is public
    try {
      const rows = await db.select().from(reviewsTable).where(eq(reviewsTable.restaurantId, existing.restaurantId));
      const visible = rows.filter(isPubliclyVisible);
      if (visible.length > 0) {
        const newRating = parseFloat((visible.reduce((s, r) => s + r.rating, 0) / visible.length).toFixed(2));
        await db.update(restaurantsTable).set({ rating: String(newRating), reviewCount: visible.length }).where(eq(restaurantsTable.id, existing.restaurantId));
      }
    } catch (_) {}
    res.json(mapReview(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to publish review");
    res.status(500).json({ error: "Failed to publish review" });
  }
});

// POST /api/reviews/:id/close — customer closes issue without publishing
router.post("/:id/close", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return void res.status(400).json({ error: "Invalid review id" });
    const [updated] = await db.update(reviewsTable)
      .set({ recoveryStatus: "closed" })
      .where(eq(reviewsTable.id, id))
      .returning();
    if (!updated) return void res.status(404).json({ error: "Review not found" });
    res.json(mapReview(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to close review");
    res.status(500).json({ error: "Failed to close review" });
  }
});

// POST /api/reviews/:id/ai-suggest — AI generates a professional German reply suggestion
// Rate-limited: 30 calls/hour per user; requires manager or owner role
router.post("/:id/ai-suggest", aiLimiter, requireManagerOrAbove(), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return void res.status(400).json({ error: "Invalid review id" });
    const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    if (!review) return void res.status(404).json({ error: "Review not found" });

    const stars = review.rating;
    const comment = review.comment;

    const prompt = `Du bist der Inhaber eines Restaurants in Wien. Ein Gast hat folgende Bewertung hinterlassen:

Bewertung: ${stars} von 5 Sternen
Kommentar: "${comment}"

Schreibe eine professionelle, einfühlsame und lösungsorientierte Antwort auf Deutsch. Die Antwort soll:
- Höflich und entschuldigend sein
- Konkret auf das Feedback eingehen
- Eine Lösung oder nächsten Schritt anbieten
- Nicht mehr als 3-4 Sätze lang sein
- Den Gast zur Kontaktaufnahme oder zu einem erneuten Besuch einladen
- KEINE falschen Versprechen machen
- NICHT aggressiv oder defensiv klingen
- NICHT den Gast beschuldigen

Antworte NUR mit dem Text der Antwort, ohne Einleitung oder Erklärung.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "Du bist ein professioneller Restaurant-Manager in Wien. Antworte immer auf Deutsch mit einem freundlichen, entschuldigenden und lösungsorientierten Ton. Keine Einleitung, keine Erklärung — nur die Antwort selbst.",
        },
        { role: "user", content: prompt }
      ],
    });

    const suggestion = (completion.choices[0]?.message?.content ?? "").trim();

    // Cache the suggestion and mark AI was used
    await db.update(reviewsTable).set({ aiReplySuggestion: suggestion, aiUsed: true }).where(eq(reviewsTable.id, id));

    res.json({ suggestion });
  } catch (err) {
    req.log.error({ err }, "Failed to generate AI suggestion");
    res.status(500).json({ error: "Failed to generate AI suggestion" });
  }
});

export default router;
