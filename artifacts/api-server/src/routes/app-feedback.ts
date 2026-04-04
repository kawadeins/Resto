import { Router } from "express";
import { db } from "@workspace/db";
import { appFeedbackTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// POST /api/app-feedback
router.post("/", async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email().optional().nullable(),
      rating: z.number().int().min(1).max(5),
      feedbackText: z.string().max(2000).optional().nullable(),
      source: z.enum(["prompt", "profile"]).default("prompt"),
    });
    const body = schema.parse(req.body);
    const [record] = await db
      .insert(appFeedbackTable)
      .values({
        email: body.email ?? null,
        rating: body.rating,
        feedbackText: body.feedbackText ?? null,
        source: body.source,
      })
      .returning();
    res.json({ success: true, id: record.id });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// GET /api/app-feedback/check?email=
router.get("/check", async (req, res) => {
  try {
    const email = typeof req.query.email === "string" ? req.query.email : undefined;
    if (!email) return res.json({ lastSubmitted: null, daysSince: null });
    const [last] = await db
      .select({ createdAt: appFeedbackTable.createdAt })
      .from(appFeedbackTable)
      .where(eq(appFeedbackTable.email, email))
      .orderBy(desc(appFeedbackTable.createdAt))
      .limit(1);
    if (!last) return res.json({ lastSubmitted: null, daysSince: null });
    const daysSince = Math.floor(
      (Date.now() - new Date(last.createdAt).getTime()) / 86_400_000
    );
    res.json({ lastSubmitted: last.createdAt, daysSince });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
