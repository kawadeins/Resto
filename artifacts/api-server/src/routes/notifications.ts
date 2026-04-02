import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .orderBy(desc(notificationsTable.sentAt))
      .limit(50);
    res.json(
      rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        targetCount: n.targetCount,
        sentAt: n.sentAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get notifications");
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

export default router;
