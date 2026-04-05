import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const FOUNDER_KEY = process.env.FOUNDER_KEY ?? "rs_founder_2026";

function founderAuth(req: any, res: any, next: any) {
  const key = req.headers["x-founder-key"] as string | undefined;
  if (!key || key !== FOUNDER_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// POST /api/conversion/event — fire-and-forget, no auth required
router.post("/event", async (req, res) => {
  try {
    const {
      eventType,
      businessType,
      restaurantId,
      city,
      sessionId,
      ctaLabel,
      messageLabel,
      metadata,
    } = req.body;

    if (!eventType || typeof eventType !== "string") {
      return res.status(400).json({ error: "eventType required" });
    }

    await db.execute(sql`
      INSERT INTO conversion_events
        (event_type, business_type, restaurant_id, city, session_id, cta_label, message_label, metadata)
      VALUES
        (${eventType}, ${businessType ?? null}, ${restaurantId ?? null},
         ${city ?? null}, ${sessionId ?? null}, ${ctaLabel ?? null},
         ${messageLabel ?? null}, ${JSON.stringify(metadata ?? {})}::jsonb)
    `);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to log event" });
  }
});

// GET /api/conversion/analytics — founder auth required
router.get("/analytics", founderAuth, async (_req, res) => {
  try {
    const since30d = sql`NOW() - INTERVAL '30 days'`;

    // -- Funnel counts (all time for context, last 30d for main)
    const funnelOrder = [
      "premium_gate_viewed",
      "trial_expired_viewed",
      "premium_page_opened",
      "trial_started",
      "dashboard_accessed",
      "analytics_locked_viewed",
      "marketing_tools_viewed",
      "trial_banner_viewed",
      "trial_conversion_banner_viewed",
      "upgrade_cta_clicked",
      "checkout_started",
      "payment_completed",
    ];

    const funnelRows = await db.execute(sql`
      SELECT event_type, COUNT(*)::int as count
      FROM conversion_events
      WHERE created_at > ${since30d}
      GROUP BY event_type
    `);

    const funnelMap: Record<string, number> = {};
    for (const r of funnelRows.rows as any[]) {
      funnelMap[r.event_type] = Number(r.count);
    }

    const funnel = funnelOrder.map((event, idx) => {
      const count = funnelMap[event] ?? 0;
      const prev = idx === 0 ? count : (funnelMap[funnelOrder[idx - 1]] ?? count);
      const dropoffRate = prev > 0 && idx > 0 ? Math.round(((prev - count) / prev) * 100) : 0;
      return { event, count, dropoffRate };
    });

    // -- By business type
    const bizRows = await db.execute(sql`
      SELECT business_type,
        COUNT(*) FILTER (WHERE event_type = 'premium_gate_viewed')::int as page_views,
        COUNT(*) FILTER (WHERE event_type = 'trial_started')::int as trials,
        COUNT(*) FILTER (WHERE event_type = 'upgrade_cta_clicked')::int as cta_clicks,
        COUNT(*) FILTER (WHERE event_type = 'payment_completed')::int as paid
      FROM conversion_events
      WHERE created_at > ${since30d}
        AND business_type IS NOT NULL
      GROUP BY business_type
      ORDER BY trials DESC
    `);

    const byBusinessType = (bizRows.rows as any[]).map((r) => ({
      type: r.business_type,
      pageViews: Number(r.page_views),
      trials: Number(r.trials),
      ctaClicks: Number(r.cta_clicks),
      paid: Number(r.paid),
      conversionRate:
        r.page_views > 0
          ? Math.round((Number(r.trials) / Number(r.page_views)) * 100)
          : 0,
    }));

    // -- Top CTAs
    const ctaRows = await db.execute(sql`
      SELECT cta_label,
        COUNT(*) FILTER (WHERE event_type = 'upgrade_cta_clicked')::int as clicks
      FROM conversion_events
      WHERE created_at > ${since30d} AND cta_label IS NOT NULL
      GROUP BY cta_label
      ORDER BY clicks DESC
      LIMIT 8
    `);
    const topCtas = (ctaRows.rows as any[]).map((r) => ({
      label: r.cta_label,
      clicks: Number(r.clicks),
    }));

    // -- Top messages
    const msgRows = await db.execute(sql`
      SELECT message_label,
        COUNT(*)::int as views
      FROM conversion_events
      WHERE created_at > ${since30d} AND message_label IS NOT NULL
      GROUP BY message_label
      ORDER BY views DESC
      LIMIT 8
    `);
    const topMessages = (msgRows.rows as any[]).map((r) => ({
      label: r.message_label,
      views: Number(r.views),
    }));

    // -- By city
    const cityRows = await db.execute(sql`
      SELECT city,
        COUNT(*) FILTER (WHERE event_type = 'premium_gate_viewed')::int as views,
        COUNT(*) FILTER (WHERE event_type = 'trial_started')::int as trials,
        COUNT(*) FILTER (WHERE event_type = 'payment_completed')::int as paid
      FROM conversion_events
      WHERE created_at > ${since30d} AND city IS NOT NULL
      GROUP BY city
      ORDER BY trials DESC
      LIMIT 10
    `);
    const byCity = (cityRows.rows as any[]).map((r) => ({
      city: r.city,
      views: Number(r.views),
      trials: Number(r.trials),
      paid: Number(r.paid),
      conversionRate: r.views > 0 ? Math.round((Number(r.trials) / Number(r.views)) * 100) : 0,
    }));

    // -- Recent events
    const recentRows = await db.execute(sql`
      SELECT event_type, business_type, city, cta_label, created_at
      FROM conversion_events
      ORDER BY created_at DESC
      LIMIT 20
    `);
    const recentEvents = recentRows.rows;

    // -- Total events
    const totalRow = await db.execute(sql`
      SELECT COUNT(*)::int as total FROM conversion_events
      WHERE created_at > ${since30d}
    `);
    const totalEvents = Number((totalRow.rows[0] as any)?.total ?? 0);

    // -- Unique sessions in funnel
    const sessionsRow = await db.execute(sql`
      SELECT
        COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'premium_gate_viewed')::int as gate_sessions,
        COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'trial_started')::int as trial_sessions,
        COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'upgrade_cta_clicked')::int as cta_sessions
      FROM conversion_events
      WHERE created_at > ${since30d}
    `);
    const sessions = sessionsRow.rows[0] as any;

    // -- Actionable insights (derived)
    const insights: string[] = [];
    const gateViews = funnelMap["premium_gate_viewed"] ?? 0;
    const trialStarts = funnelMap["trial_started"] ?? 0;
    const ctaClicks = funnelMap["upgrade_cta_clicked"] ?? 0;
    const checkouts = funnelMap["checkout_started"] ?? 0;

    if (gateViews > 0 && trialStarts / gateViews < 0.2) {
      insights.push("Wenige Besucher starten die Testphase — die Premium-Seite könnte überzeugender sein.");
    }
    if (trialStarts > 0 && ctaClicks / trialStarts < 0.3) {
      insights.push("Trial-Nutzer klicken selten auf Upgrade — stärkere In-Dashboard-Prompts könnten helfen.");
    }
    if (ctaClicks > 0 && checkouts / ctaClicks < 0.5) {
      insights.push("Viele CTA-Klicks führen nicht zum Checkout — mögliche Reibung im Zahlungsflow.");
    }
    if (byBusinessType.length > 1) {
      const sorted = [...byBusinessType].sort((a, b) => b.conversionRate - a.conversionRate);
      if (sorted[0]) {
        const typeLabel = sorted[0].type === "cafe" ? "Cafés" : sorted[0].type === "bar" ? "Bars" : "Restaurants";
        insights.push(`${typeLabel} konvertieren am häufigsten zur Testphase (${sorted[0].conversionRate}% Rate).`);
      }
    }
    if (funnelMap["analytics_locked_viewed"] ?? 0 > 0) {
      insights.push("Trial-Nutzer öffnen häufig Analytics — ein starker Moment für Upgrade-Prompts.");
    }
    if (insights.length === 0) {
      insights.push("Noch keine Muster erkennbar — mehr Traffic nötig für belastbare Erkenntnisse.");
    }

    res.json({
      funnel,
      byBusinessType,
      topCtas,
      topMessages,
      byCity,
      recentEvents,
      totalEvents,
      sessions: {
        gateViews: Number(sessions?.gate_sessions ?? 0),
        trialStarts: Number(sessions?.trial_sessions ?? 0),
        ctaClicks: Number(sessions?.cta_sessions ?? 0),
      },
      insights,
    });
  } catch (err) {
    console.error("Conversion analytics error:", err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

export default router;
