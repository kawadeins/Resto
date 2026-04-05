/**
 * AI Self-Healing Ops Layer + Founder Alert System
 *
 * POST /api/ops/health-check     — run all health checks, create incidents (founder auth)
 * GET  /api/ops/incidents        — list incidents (founder auth)
 * GET  /api/ops/summary          — ops KPI summary (founder auth)
 * PATCH /api/ops/incidents/:id   — update incident status (founder auth)
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();
const FOUNDER_KEY = "rs_founder_2026";

function isFounder(req: any) {
  return req.headers["x-founder-key"] === FOUNDER_KEY;
}

type Severity = "low" | "medium" | "high" | "critical";

interface IncidentCreate {
  title: string;
  systemArea: string;
  severity: Severity;
  affectedEntity?: string;
  affectedCity?: string;
  technicalSummary: string;
  anomalyDetected?: string;
  billingTruth?: string;
  platformTruth?: string;
  autoActionTaken?: string;
  recoveryResult?: string;
  recommendedAction?: string;
  needsManualReview: boolean;
  incidentType: string;
  metadata?: Record<string, any>;
}

async function createIncident(inc: IncidentCreate) {
  return db.execute(sql`
    INSERT INTO ops_incidents (
      title, system_area, severity, affected_entity, affected_city,
      technical_summary, anomaly_detected, billing_truth, platform_truth,
      auto_action_taken, recovery_result, recommended_action,
      needs_manual_review, incident_type, metadata
    ) VALUES (
      ${inc.title}, ${inc.systemArea}, ${inc.severity},
      ${inc.affectedEntity ?? null}, ${inc.affectedCity ?? null},
      ${inc.technicalSummary}, ${inc.anomalyDetected ?? null},
      ${inc.billingTruth ?? null}, ${inc.platformTruth ?? null},
      ${inc.autoActionTaken ?? null}, ${inc.recoveryResult ?? null},
      ${inc.recommendedAction ?? null}, ${inc.needsManualReview},
      ${inc.incidentType}, ${JSON.stringify(inc.metadata ?? {})}::jsonb
    ) RETURNING id
  `);
}

// ─── Health Check: Premium Billing Mismatch ─────────────────────────────────

async function checkPremiumBillingMismatch(): Promise<IncidentCreate[]> {
  const incidents: IncidentCreate[] = [];

  const [promoWithoutActive, duplicatePromotions] = await Promise.all([
    db.execute(sql`
      SELECT p.id, p.restaurant_id, r.name, r.city, p.status, p.type,
             p.daily_budget, p.impressions, p.started_at
      FROM promotions p
      JOIN restaurants r ON r.id = p.restaurant_id
      WHERE p.status = 'active'
        AND p.daily_budget > 0
        AND p.impressions = 0
        AND p.started_at < NOW() - INTERVAL '2 hours'
    `),
    db.execute(sql`
      SELECT restaurant_id, COUNT(*) as active_count
      FROM promotions
      WHERE status = 'active'
      GROUP BY restaurant_id
      HAVING COUNT(*) > 3
    `),
  ]);

  for (const row of promoWithoutActive.rows as any[]) {
    incidents.push({
      title: `Boost aktiv aber 0 Impressionen: ${row.name}`,
      systemArea: "boost_delivery",
      severity: "high",
      affectedEntity: `Restaurant #${row.restaurant_id} (${row.name})`,
      affectedCity: row.city,
      technicalSummary: `Promotion #${row.id} (${row.type}) ist seit ${new Date(row.started_at).toLocaleDateString("de-AT")} aktiv mit €${parseFloat(row.daily_budget).toFixed(2)}/Tag Budget, aber hat 0 Impressionen geliefert.`,
      anomalyDetected: "Boost-Kampagne aktiv ohne Impressionen-Auslieferung",
      billingTruth: `Budget: €${parseFloat(row.daily_budget).toFixed(2)}/Tag`,
      platformTruth: "0 Impressionen nach >2 Stunden",
      autoActionTaken: "Keine — manuelle Überprüfung empfohlen",
      recoveryResult: null,
      recommendedAction: "Boost-Delivery-Logic prüfen. Impressionen-Zähler und Sichtbarkeitsalgorithmus überprüfen.",
      needsManualReview: true,
      incidentType: "boost_mismatch",
    });
  }

  for (const row of duplicatePromotions.rows as any[]) {
    incidents.push({
      title: `Zu viele aktive Boosts: Restaurant #${row.restaurant_id}`,
      systemArea: "boost_integrity",
      severity: "medium",
      affectedEntity: `Restaurant #${row.restaurant_id}`,
      technicalSummary: `Restaurant hat ${row.active_count} gleichzeitig aktive Promotions. Maximum sollte 3 sein.`,
      anomalyDetected: "Ungewöhnlich viele gleichzeitige Boost-Kampagnen",
      autoActionTaken: "Keine — nur Warnung",
      recommendedAction: "Prüfen ob mehrfache Buchungen vorliegen oder ob Kampagnen korrekt ablaufen.",
      needsManualReview: true,
      incidentType: "boost_integrity",
    });
  }

  return incidents;
}

// ─── Health Check: Promotion Budget Anomalies ────────────────────────────────

async function checkBudgetAnomalies(): Promise<IncidentCreate[]> {
  const incidents: IncidentCreate[] = [];

  const overspend = await db.execute(sql`
    SELECT p.id, p.restaurant_id, r.name, r.city,
           p.daily_budget, p.spent_today, p.type
    FROM promotions p
    JOIN restaurants r ON r.id = p.restaurant_id
    WHERE p.status = 'active'
      AND p.spent_today > p.daily_budget * 1.2
  `);

  for (const row of overspend.rows as any[]) {
    const budget = parseFloat(row.daily_budget);
    const spent = parseFloat(row.spent_today);
    const overspendPct = Math.round(((spent - budget) / budget) * 100);

    incidents.push({
      title: `Budget-Überschreitung: ${row.name} (+${overspendPct}%)`,
      systemArea: "billing_integrity",
      severity: overspendPct > 50 ? "high" : "medium",
      affectedEntity: `Restaurant #${row.restaurant_id} (${row.name})`,
      affectedCity: row.city,
      technicalSummary: `Promotion #${row.id} hat €${spent.toFixed(2)} ausgegeben bei einem Tagesbudget von €${budget.toFixed(2)} — das sind ${overspendPct}% über dem Limit.`,
      anomalyDetected: "Tagesbudget überschritten",
      billingTruth: `Budget: €${budget.toFixed(2)}/Tag`,
      platformTruth: `Ausgegeben: €${spent.toFixed(2)}`,
      autoActionTaken: "Keine — Billing-Cap-Logic prüfen",
      recommendedAction: "Budget-Capping-Logic im Promotion-System verifizieren. Ggf. Kampagne pausieren.",
      needsManualReview: true,
      incidentType: "billing_overspend",
    });
  }

  return incidents;
}

// ─── Health Check: Platform Consistency ──────────────────────────────────────

async function checkPlatformConsistency(): Promise<IncidentCreate[]> {
  const incidents: IncidentCreate[] = [];

  const [inactiveWithBoosts, ratingAnomalies, cityHealth] = await Promise.all([
    db.execute(sql`
      SELECT r.id, r.name, r.city, COUNT(p.id) as active_boosts
      FROM restaurants r
      JOIN promotions p ON p.restaurant_id = r.id
      WHERE r.is_active = false AND p.status = 'active'
      GROUP BY r.id, r.name, r.city
    `),

    db.execute(sql`
      SELECT id, name, city, rating, review_count
      FROM restaurants
      WHERE rating > 5.0 OR rating < 1.0 OR (review_count = 0 AND rating != 4.5)
    `),

    db.execute(sql`
      SELECT city, COUNT(*) as biz_count,
             COUNT(*) FILTER (WHERE is_active = false) as inactive_count
      FROM restaurants
      GROUP BY city
      HAVING COUNT(*) FILTER (WHERE is_active = false) > COUNT(*) * 0.5
    `),
  ]);

  for (const row of inactiveWithBoosts.rows as any[]) {
    incidents.push({
      title: `Inaktives Restaurant mit aktiven Boosts: ${row.name}`,
      systemArea: "platform_consistency",
      severity: "high",
      affectedEntity: `Restaurant #${row.id} (${row.name})`,
      affectedCity: row.city,
      technicalSummary: `Restaurant ist als inaktiv markiert, hat aber ${row.active_boosts} aktive Boost-Kampagnen die Budget verbrauchen.`,
      anomalyDetected: "Aktive Boosts auf inaktivem Restaurant",
      platformTruth: "Restaurant is_active = false",
      billingTruth: `${row.active_boosts} aktive Kampagnen laufen`,
      autoActionTaken: "Keine — erfordert Entscheidung ob Restaurant reaktiviert oder Kampagnen gestoppt werden",
      recommendedAction: "Restaurant reaktivieren ODER alle aktiven Kampagnen pausieren um Budgetverschwendung zu stoppen.",
      needsManualReview: true,
      incidentType: "consistency_mismatch",
    });
  }

  for (const row of ratingAnomalies.rows as any[]) {
    incidents.push({
      title: `Rating-Anomalie: ${row.name} (${row.rating})`,
      systemArea: "data_integrity",
      severity: "low",
      affectedEntity: `Restaurant #${row.id} (${row.name})`,
      affectedCity: row.city,
      technicalSummary: `Rating von ${row.rating} liegt außerhalb des erwarteten Bereichs (1.0–5.0) oder Reviews stimmen nicht überein (${row.review_count} Reviews).`,
      anomalyDetected: "Ungültiger oder inkonsistenter Rating-Wert",
      autoActionTaken: "Keine",
      recommendedAction: "Rating und Review-Zähler manuell prüfen und korrigieren.",
      needsManualReview: false,
      incidentType: "data_anomaly",
    });
  }

  for (const row of cityHealth.rows as any[]) {
    incidents.push({
      title: `Hohe Inaktivitätsrate: ${row.city} (${row.inactive_count}/${row.biz_count})`,
      systemArea: "city_health",
      severity: "medium",
      affectedCity: row.city,
      technicalSummary: `In ${row.city} sind ${row.inactive_count} von ${row.biz_count} Betrieben inaktiv (>50%). Stadt-Expansion könnte gefährdet sein.`,
      anomalyDetected: "Hohe Deaktivierungsrate in Stadt",
      recommendedAction: "Reaktivierungs-Kampagne für inaktive Betriebe starten oder Stadt-Strategie überprüfen.",
      needsManualReview: true,
      incidentType: "city_anomaly",
    });
  }

  return incidents;
}

// ─── Health Check: Business Claims Anomalies ─────────────────────────────────

async function checkClaimsAnomalies(): Promise<IncidentCreate[]> {
  const incidents: IncidentCreate[] = [];

  const [duplicateEmails, highVolume] = await Promise.all([
    db.execute(sql`
      SELECT email, COUNT(*) as claim_count
      FROM business_claims
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY email
      HAVING COUNT(*) > 3
    `),

    db.execute(sql`
      SELECT COUNT(*) as today_claims
      FROM business_claims
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `),
  ]);

  for (const row of duplicateEmails.rows as any[]) {
    incidents.push({
      title: `Verdächtige Mehrfach-Anmeldungen: ${row.email}`,
      systemArea: "abuse_detection",
      severity: "medium",
      affectedEntity: row.email,
      technicalSummary: `${row.claim_count} Business-Claims von derselben E-Mail in 7 Tagen. Möglicher Trial-Missbrauch oder Spam.`,
      anomalyDetected: "Mehrfache Business-Claims vom selben Account",
      autoActionTaken: "Keine — Warnung generiert",
      recommendedAction: "E-Mail-Adresse prüfen. Bei Missbrauch: Claims ablehnen und E-Mail sperren.",
      needsManualReview: true,
      incidentType: "abuse_suspicion",
    });
  }

  const todayClaims = parseInt((highVolume.rows[0] as any)?.today_claims ?? "0");
  if (todayClaims > 20) {
    incidents.push({
      title: `Ungewöhnlich hohe Claim-Rate: ${todayClaims} in 24h`,
      systemArea: "growth_anomaly",
      severity: todayClaims > 50 ? "high" : "medium",
      technicalSummary: `${todayClaims} neue Business-Claims in den letzten 24 Stunden. Normal sind 0–5 pro Tag.`,
      anomalyDetected: "Spike in Business-Claims",
      autoActionTaken: "Keine",
      recommendedAction: todayClaims > 50
        ? "Sofort prüfen — möglicher Bot-Angriff oder Marketing-Kampagnen-Spike."
        : "Beobachten — könnte organisches Wachstum oder Marketing-Effekt sein.",
      needsManualReview: todayClaims > 50,
      incidentType: "growth_anomaly",
    });
  }

  return incidents;
}

// ─── Health Check: Conversion & Revenue Anomalies ────────────────────────────

async function checkRevenueAnomalies(): Promise<IncidentCreate[]> {
  const incidents: IncidentCreate[] = [];

  const zeroRevenueBoosts = await db.execute(sql`
    SELECT r.city,
           COUNT(p.id) as active_campaigns,
           COALESCE(SUM(p.daily_budget), 0) as total_budget,
           COALESCE(SUM(p.spent_today), 0) as total_spent
    FROM promotions p
    JOIN restaurants r ON r.id = p.restaurant_id
    WHERE p.status = 'active'
    GROUP BY r.city
    HAVING COALESCE(SUM(p.spent_today), 0) = 0 AND COUNT(p.id) > 0
  `);

  for (const row of zeroRevenueBoosts.rows as any[]) {
    incidents.push({
      title: `Keine Boost-Einnahmen in ${row.city} heute`,
      systemArea: "revenue_monitoring",
      severity: "medium",
      affectedCity: row.city,
      technicalSummary: `${row.active_campaigns} aktive Kampagnen mit €${parseFloat(row.total_budget).toFixed(2)} Gesamtbudget in ${row.city}, aber €0.00 heute ausgegeben.`,
      anomalyDetected: "Aktive Kampagnen ohne Tagesumsatz",
      billingTruth: `${row.active_campaigns} Kampagnen, €${parseFloat(row.total_budget).toFixed(2)}/Tag Budget`,
      platformTruth: "€0.00 spent_today",
      autoActionTaken: "Keine",
      recommendedAction: "Spending-Tracking prüfen. Impressionen-Delivery und Budget-Deduction verifizieren.",
      needsManualReview: true,
      incidentType: "revenue_anomaly",
    });
  }

  return incidents;
}

// ─── POST /api/ops/health-check — Run all checks ────────────────────────────

router.post("/health-check", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Unauthorized" });

  try {
    const [premium, budget, consistency, claims, revenue] = await Promise.all([
      checkPremiumBillingMismatch(),
      checkBudgetAnomalies(),
      checkPlatformConsistency(),
      checkClaimsAnomalies(),
      checkRevenueAnomalies(),
    ]);

    const allIncidents = [...premium, ...budget, ...consistency, ...claims, ...revenue];

    let created = 0;
    for (const inc of allIncidents) {
      const existing = await db.execute(sql`
        SELECT id FROM ops_incidents
        WHERE title = ${inc.title}
          AND status = 'open'
          AND detected_at > NOW() - INTERVAL '24 hours'
        LIMIT 1
      `);
      if (existing.rows.length === 0) {
        await createIncident(inc);
        created++;
      }
    }

    return res.json({
      checksRun: 5,
      issuesDetected: allIncidents.length,
      newIncidentsCreated: created,
      duplicatesSkipped: allIncidents.length - created,
      breakdown: {
        boost_delivery: premium.length,
        budget_anomalies: budget.length,
        platform_consistency: consistency.length,
        claims_abuse: claims.length,
        revenue_anomalies: revenue.length,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Health check failed");
    return res.status(500).json({ error: "Health check failed" });
  }
});

// ─── GET /api/ops/incidents ──────────────────────────────────────────────────

router.get("/incidents", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Unauthorized" });

  try {
    const statusFilter = (req.query.status as string) || "all";
    const severityFilter = (req.query.severity as string) || "all";

    let result;

    if (statusFilter !== "all" && severityFilter !== "all") {
      result = await db.execute(sql`
        SELECT * FROM ops_incidents
        WHERE status = ${statusFilter} AND severity = ${severityFilter}
        ORDER BY
          CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          detected_at DESC
        LIMIT 50
      `);
    } else if (statusFilter !== "all") {
      result = await db.execute(sql`
        SELECT * FROM ops_incidents
        WHERE status = ${statusFilter}
        ORDER BY
          CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          detected_at DESC
        LIMIT 50
      `);
    } else if (severityFilter !== "all") {
      result = await db.execute(sql`
        SELECT * FROM ops_incidents
        WHERE severity = ${severityFilter}
        ORDER BY
          CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          detected_at DESC
        LIMIT 50
      `);
    } else {
      result = await db.execute(sql`
        SELECT * FROM ops_incidents
        ORDER BY
          CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          detected_at DESC
        LIMIT 50
      `);
    }

    return res.json({ incidents: result.rows, total: result.rows.length });
  } catch (err) {
    req.log.error({ err }, "Failed to get incidents");
    return res.status(500).json({ error: "Failed" });
  }
});

// ─── GET /api/ops/summary ───────────────────────────────────────────────────

router.get("/summary", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Unauthorized" });

  try {
    const [counts, recentCritical, systemAreas] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'open') AS open_count,
          COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_count,
          COUNT(*) FILTER (WHERE status = 'escalated') AS escalated_count,
          COUNT(*) FILTER (WHERE needs_manual_review AND status = 'open') AS pending_review,
          COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'open') AS critical_open,
          COUNT(*) FILTER (WHERE severity = 'high' AND status = 'open') AS high_open,
          COUNT(*) FILTER (WHERE severity = 'medium' AND status = 'open') AS medium_open,
          COUNT(*) FILTER (WHERE severity = 'low' AND status = 'open') AS low_open,
          COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '24 hours') AS last_24h,
          COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '7 days') AS last_7d
        FROM ops_incidents
      `),

      db.execute(sql`
        SELECT id, title, severity, system_area, detected_at, needs_manual_review
        FROM ops_incidents
        WHERE severity IN ('critical', 'high') AND status = 'open'
        ORDER BY
          CASE severity WHEN 'critical' THEN 0 ELSE 1 END,
          detected_at DESC
        LIMIT 5
      `),

      db.execute(sql`
        SELECT system_area, COUNT(*) AS incident_count,
               COUNT(*) FILTER (WHERE status = 'open') AS open_count
        FROM ops_incidents
        GROUP BY system_area
        ORDER BY open_count DESC
      `),
    ]);

    const c = counts.rows[0] as any;

    const healthStatus =
      parseInt(c.critical_open) > 0 ? "critical"
      : parseInt(c.high_open) > 0 ? "degraded"
      : parseInt(c.medium_open) > 3 ? "warning"
      : "healthy";

    return res.json({
      health: healthStatus,
      counts: {
        total:         parseInt(c.total),
        open:          parseInt(c.open_count),
        resolved:      parseInt(c.resolved_count),
        escalated:     parseInt(c.escalated_count),
        pendingReview: parseInt(c.pending_review),
        criticalOpen:  parseInt(c.critical_open),
        highOpen:      parseInt(c.high_open),
        mediumOpen:    parseInt(c.medium_open),
        lowOpen:       parseInt(c.low_open),
        last24h:       parseInt(c.last_24h),
        last7d:        parseInt(c.last_7d),
      },
      recentCritical: recentCritical.rows,
      systemAreas:    systemAreas.rows,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get ops summary");
    return res.status(500).json({ error: "Failed" });
  }
});

// ─── PATCH /api/ops/incidents/:id — Update incident ─────────────────────────

router.patch("/incidents/:id", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Unauthorized" });

  try {
    const id = parseInt(req.params.id);
    const { status, recoveryResult, autoActionTaken } = req.body;

    if (!status || !["open", "resolved", "escalated", "dismissed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const resolvedAt = status === "resolved" ? sql`NOW()` : sql`NULL`;

    await db.execute(sql`
      UPDATE ops_incidents
      SET status = ${status},
          resolved_at = ${resolvedAt},
          recovery_result = COALESCE(${recoveryResult ?? null}, recovery_result),
          auto_action_taken = COALESCE(${autoActionTaken ?? null}, auto_action_taken)
      WHERE id = ${id}
    `);

    return res.json({ success: true, id, status });
  } catch (err) {
    req.log.error({ err }, "Failed to update incident");
    return res.status(500).json({ error: "Failed" });
  }
});

export default router;
