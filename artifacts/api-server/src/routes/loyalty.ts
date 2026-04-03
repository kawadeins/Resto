import { Router } from "express";
import { db } from "@workspace/db";
import { loyaltyPointsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function mapPoints(p: typeof loyaltyPointsTable.$inferSelect) {
  return {
    id: p.id,
    customerEmail: p.customerEmail,
    customerName: p.customerName,
    points: p.points,
    totalEarned: p.totalEarned,
    updatedAt: p.updatedAt.toISOString(),
  };
}

// GET /api/loyalty/:email
router.get("/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const rows = await db.select().from(loyaltyPointsTable).where(eq(loyaltyPointsTable.customerEmail, email));
    if (rows.length === 0) {
      return void res.json({ customerEmail: email, points: 0, totalEarned: 0, tier: "Bronze" });
    }
    const p = rows[0];
    const tier = p.points >= 500 ? "Gold" : p.points >= 200 ? "Silver" : "Bronze";
    res.json({ ...mapPoints(p), tier });
  } catch (err) {
    req.log.error({ err }, "Failed to get loyalty points");
    res.status(500).json({ error: "Failed to get loyalty points" });
  }
});

// GET /api/loyalty - leaderboard
router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(loyaltyPointsTable).orderBy(desc(loyaltyPointsTable.points)).limit(20);
    res.json(rows.map(p => {
      const tier = p.points >= 500 ? "Gold" : p.points >= 200 ? "Silver" : "Bronze";
      return { ...mapPoints(p), tier };
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to get leaderboard");
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

export default router;
