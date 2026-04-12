/**
 * Moderation Admin Routes — for owner/founder dashboard use
 * GET /api/moderation/logs — paginated violation log
 * GET /api/moderation/offenders — top repeat offenders
 * GET /api/moderation/stats — summary stats
 */
import { Router } from "express";
import { db } from "@workspace/db";

const router = Router();

function pg() { return (db as any).$client; }

// GET /api/moderation/logs?limit=50&offset=0&severity=2
router.get("/logs", async (req, res) => {
  try {
    const pgDb = pg();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const severity = req.query.severity ? Number(req.query.severity) : null;

    const params: any[] = [limit, offset];
    let where = "";
    if (severity !== null) {
      params.push(severity);
      where = `WHERE severity >= $${params.length}`;
    }

    const { rows } = await pgDb.query(
      `SELECT * FROM moderation_logs ${where}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    const { rows: total } = await pgDb.query(
      `SELECT COUNT(*) as count FROM moderation_logs ${where}`,
      severity !== null ? [severity] : []
    );

    res.json({ logs: rows, total: parseInt(total[0].count, 10) });
  } catch (err) {
    console.error("[moderation-admin] logs error:", err);
    res.status(500).json({ error: "Failed to load moderation logs" });
  }
});

// GET /api/moderation/offenders
router.get("/offenders", async (req, res) => {
  try {
    const pgDb = pg();
    const { rows } = await pgDb.query(
      `SELECT us.*, 
              (SELECT COUNT(*) FROM moderation_logs ml WHERE ml.user_email = us.user_email) as total_violations,
              (SELECT MAX(created_at) FROM moderation_logs ml WHERE ml.user_email = us.user_email) as last_violation_at
       FROM user_strikes us
       ORDER BY strike_count DESC, last_strike_at DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error("[moderation-admin] offenders error:", err);
    res.status(500).json({ error: "Failed to load offenders" });
  }
});

// GET /api/moderation/stats
router.get("/stats", async (req, res) => {
  try {
    const pgDb = pg();

    const [totalLogs, bySeverity, byType, recentCount, strikeStats] = await Promise.all([
      pgDb.query(`SELECT COUNT(*) as total FROM moderation_logs`),
      pgDb.query(`SELECT severity, COUNT(*) as count FROM moderation_logs GROUP BY severity ORDER BY severity`),
      pgDb.query(`SELECT content_type, COUNT(*) as count FROM moderation_logs GROUP BY content_type ORDER BY count DESC`),
      pgDb.query(`SELECT COUNT(*) as count FROM moderation_logs WHERE created_at > now() - interval '24 hours'`),
      pgDb.query(`SELECT status, COUNT(*) as count FROM user_strikes GROUP BY status`),
    ]);

    res.json({
      totalViolations: parseInt(totalLogs.rows[0].total, 10),
      last24h: parseInt(recentCount.rows[0].count, 10),
      bySeverity: bySeverity.rows,
      byType: byType.rows,
      userStrikes: strikeStats.rows,
    });
  } catch (err) {
    console.error("[moderation-admin] stats error:", err);
    res.status(500).json({ error: "Failed to load moderation stats" });
  }
});

// PATCH /api/moderation/users/:email/status — manually update user status
router.patch("/users/:email/status", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const { status } = req.body;
    if (!["active", "warned", "restricted", "suspended"].includes(status)) {
      return void res.status(400).json({ error: "Invalid status" });
    }
    const pgDb = pg();
    await pgDb.query(
      `INSERT INTO user_strikes (user_email, status, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_email) DO UPDATE SET status=$2, updated_at=now()`,
      [email, status]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[moderation-admin] update status error:", err);
    res.status(500).json({ error: "Failed to update user status" });
  }
});

export default router;
