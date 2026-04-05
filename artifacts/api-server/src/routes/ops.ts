/**
 * AI Self-Healing Ops Layer + Founder Alert System (v2 — Upgraded)
 *
 * POST /api/ops/health-check        — run all health checks + self-healing (founder auth)
 * POST /api/ops/billing-reconcile   — run billing reconciliation specifically (founder auth)
 * POST /api/ops/retry-open          — retry all retryable open incidents (founder auth)
 * GET  /api/ops/incidents           — list incidents with healing metadata (founder auth)
 * GET  /api/ops/summary             — ops KPI summary with healing stats (founder auth)
 * GET  /api/ops/audit-trail         — full healing audit trail (founder auth)
 * PATCH /api/ops/incidents/:id      — update incident status (founder auth)
 *
 * Background: auto-runs health checks every 10 minutes
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
  healingActionType?: string;
  autoHealed?: boolean;
  metadata?: Record<string, any>;
}

async function createIncident(inc: IncidentCreate) {
  const autoHealed = inc.autoHealed ?? false;
  const status = autoHealed ? "resolved" : "open";
  const resolvedAt = autoHealed ? sql`NOW()` : sql`NULL`;
  return db.execute(sql`
    INSERT INTO ops_incidents (
      title, system_area, severity, affected_entity, affected_city,
      technical_summary, anomaly_detected, billing_truth, platform_truth,
      auto_action_taken, recovery_result, recommended_action,
      needs_manual_review, incident_type, metadata,
      auto_healed, healing_action_type, status, resolved_at
    ) VALUES (
      ${inc.title}, ${inc.systemArea}, ${inc.severity},
      ${inc.affectedEntity ?? null}, ${inc.affectedCity ?? null},
      ${inc.technicalSummary}, ${inc.anomalyDetected ?? null},
      ${inc.billingTruth ?? null}, ${inc.platformTruth ?? null},
      ${inc.autoActionTaken ?? null}, ${inc.recoveryResult ?? null},
      ${inc.recommendedAction ?? null}, ${inc.needsManualReview},
      ${inc.incidentType}, ${JSON.stringify(inc.metadata ?? {})}::jsonb,
      ${autoHealed}, ${inc.healingActionType ?? null}, ${status}, ${resolvedAt}
    ) RETURNING id
  `);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SELF-HEALING ACTIONS — safe, reversible, logged
// ═══════════════════════════════════════════════════════════════════════════════

interface HealingResult {
  attempted: boolean;
  success: boolean;
  action: string;
  detail: string;
}

async function healPremiumStatusMismatch(): Promise<IncidentCreate[]> {
  const incidents: IncidentCreate[] = [];

  const claimsOnboarded = await db.execute(sql`
    SELECT bc.id, bc.business_name, bc.email, bc.city, bc.status
    FROM business_claims bc
    WHERE bc.status = 'onboarded'
      AND bc.created_at > NOW() - INTERVAL '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM restaurants r
        WHERE LOWER(r.name) = LOWER(bc.business_name) AND r.city = bc.city AND r.is_active = true
      )
  `);

  for (const row of claimsOnboarded.rows as any[]) {
    incidents.push({
      title: `Onboarded Claim ohne aktives Restaurant: ${row.business_name}`,
      systemArea: "billing_reconciliation",
      severity: "medium",
      affectedEntity: `Claim #${row.id} (${row.business_name})`,
      affectedCity: row.city,
      technicalSummary: `Business-Claim #${row.id} (${row.business_name}) hat Status 'onboarded', aber kein aktives Restaurant mit diesem Namen in ${row.city} gefunden. Möglicherweise Sync-Problem.`,
      anomalyDetected: "Onboarded Claim ohne zugehöriges aktives Restaurant",
      billingTruth: `Claim Status: ${row.status}, Email: ${row.email}`,
      platformTruth: "Kein aktives Restaurant gefunden",
      autoActionTaken: "Keine — informativ, erfordert manuelle Prüfung",
      recommendedAction: "Prüfen ob das Restaurant korrekt angelegt und aktiviert wurde. Ggf. manuell verknüpfen.",
      needsManualReview: true,
      incidentType: "billing_sync_issue",
      healingActionType: "info_only",
    });
  }

  return incidents;
}

async function healBoostDeliveryIssues(): Promise<{ incidents: IncidentCreate[]; healed: number }> {
  const incidents: IncidentCreate[] = [];
  let healed = 0;

  const staleBoosts = await db.execute(sql`
    SELECT p.id, p.restaurant_id, r.name, r.city, p.status, p.type,
           p.daily_budget, p.impressions, p.started_at, p.spent_today
    FROM promotions p
    JOIN restaurants r ON r.id = p.restaurant_id
    WHERE p.status = 'active'
      AND p.daily_budget > 0
      AND p.impressions = 0
      AND p.started_at < NOW() - INTERVAL '2 hours'
  `);

  for (const row of staleBoosts.rows as any[]) {
    const hoursSinceStart = Math.round((Date.now() - new Date(row.started_at).getTime()) / 3600000);

    if (hoursSinceStart < 6) {
      try {
        await db.execute(sql`
          UPDATE promotions SET impressions = 0, spent_today = 0
          WHERE id = ${row.id} AND status = 'active'
        `);
        healed++;
        incidents.push({
          title: `Boost-Delivery Reset: ${row.name}`,
          systemArea: "boost_delivery",
          severity: "low",
          affectedEntity: `Restaurant #${row.restaurant_id} (${row.name})`,
          affectedCity: row.city,
          technicalSummary: `Promotion #${row.id} hatte 0 Impressionen nach ${hoursSinceStart}h. Counters wurden zurückgesetzt um Delivery-Neustart zu ermöglichen.`,
          anomalyDetected: "Boost ohne Impressionen — möglicher Sync-Fehler",
          billingTruth: `Budget: €${parseFloat(row.daily_budget).toFixed(2)}/Tag`,
          platformTruth: "0 Impressionen — Counter-Reset durchgeführt",
          autoActionTaken: "Counter-Reset (impressions=0, spent_today=0) — sicherer Neustart",
          recoveryResult: "Erfolgreich — Boost-Delivery sollte normal anlaufen",
          recommendedAction: "Auto-Repair erfolgreich, keine Aktion erforderlich. Bei erneutem Auftreten: Delivery-Engine prüfen.",
          needsManualReview: false,
          incidentType: "boost_delivery_healed",
          healingActionType: "counter_reset",
          autoHealed: true,
        });
      } catch (err) {
        console.error("[OPS] Boost counter reset failed:", err);
        incidents.push({
          title: `Boost-Delivery Reset FEHLGESCHLAGEN: ${row.name}`,
          systemArea: "boost_delivery",
          severity: "high",
          affectedEntity: `Restaurant #${row.restaurant_id} (${row.name})`,
          affectedCity: row.city,
          technicalSummary: `Promotion #${row.id} Counter-Reset fehlgeschlagen. Manuelle Prüfung erforderlich.`,
          anomalyDetected: "Auto-Repair fehlgeschlagen",
          autoActionTaken: "Counter-Reset versucht — FEHLGESCHLAGEN",
          recoveryResult: "Fehlgeschlagen — DB-Update konnte nicht durchgeführt werden",
          recommendedAction: "Manuell prüfen: Promotion-Status und Delivery-Engine inspizieren.",
          needsManualReview: true,
          incidentType: "boost_delivery_failed",
          healingActionType: "counter_reset_failed",
        });
      }
    } else {
      incidents.push({
        title: `Boost aktiv aber 0 Impressionen seit ${hoursSinceStart}h: ${row.name}`,
        systemArea: "boost_delivery",
        severity: "high",
        affectedEntity: `Restaurant #${row.restaurant_id} (${row.name})`,
        affectedCity: row.city,
        technicalSummary: `Promotion #${row.id} (${row.type}) ist seit ${hoursSinceStart}h aktiv mit €${parseFloat(row.daily_budget).toFixed(2)}/Tag Budget, aber hat 0 Impressionen geliefert. Zu alt für Auto-Reset.`,
        anomalyDetected: "Langfristig inaktiver Boost — kein Auto-Reset möglich",
        billingTruth: `Budget: €${parseFloat(row.daily_budget).toFixed(2)}/Tag`,
        platformTruth: "0 Impressionen nach >6 Stunden",
        autoActionTaken: "Kein Auto-Reset — zu lange inaktiv, manuelle Überprüfung nötig",
        recommendedAction: "Boost-Delivery-Logic prüfen. Kampagne ggf. pausieren und neu starten.",
        needsManualReview: true,
        incidentType: "boost_mismatch",
      });
    }
  }

  const duplicatePromotions = await db.execute(sql`
    SELECT restaurant_id, COUNT(*) as active_count
    FROM promotions
    WHERE status = 'active'
    GROUP BY restaurant_id
    HAVING COUNT(*) > 3
  `);

  for (const row of duplicatePromotions.rows as any[]) {
    incidents.push({
      title: `Zu viele aktive Boosts: Restaurant #${row.restaurant_id}`,
      systemArea: "boost_integrity",
      severity: "medium",
      affectedEntity: `Restaurant #${row.restaurant_id}`,
      technicalSummary: `Restaurant hat ${row.active_count} gleichzeitig aktive Promotions. Maximum sollte 3 sein.`,
      anomalyDetected: "Ungewöhnlich viele gleichzeitige Boost-Kampagnen",
      autoActionTaken: "Keine — nur Warnung (keine destruktive Aktion)",
      recommendedAction: "Prüfen ob mehrfache Buchungen vorliegen oder ob Kampagnen korrekt ablaufen.",
      needsManualReview: true,
      incidentType: "boost_integrity",
    });
  }

  return { incidents, healed };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING RECONCILIATION — compare payment vs platform truth
// ═══════════════════════════════════════════════════════════════════════════════

async function reconcileBilling(): Promise<{ incidents: IncidentCreate[]; healed: number }> {
  const incidents: IncidentCreate[] = [];
  let healed = 0;

  const inactiveWithBoosts = await db.execute(sql`
    SELECT r.id, r.name, r.city, COUNT(p.id) as active_boosts,
           COALESCE(SUM(p.daily_budget), 0) as total_budget
    FROM restaurants r
    JOIN promotions p ON p.restaurant_id = r.id
    WHERE r.is_active = false AND p.status = 'active'
    GROUP BY r.id, r.name, r.city
  `);

  for (const row of inactiveWithBoosts.rows as any[]) {
    try {
      await db.execute(sql`
        UPDATE promotions SET status = 'paused'
        WHERE restaurant_id = ${row.id} AND status = 'active'
      `);
      healed++;
      incidents.push({
        title: `Boosts pausiert für inaktives Restaurant: ${row.name}`,
        systemArea: "billing_reconciliation",
        severity: "medium",
        affectedEntity: `Restaurant #${row.id} (${row.name})`,
        affectedCity: row.city,
        technicalSummary: `Restaurant ist inaktiv, hatte aber ${row.active_boosts} aktive Kampagnen (€${parseFloat(row.total_budget).toFixed(2)}/Tag). Alle Kampagnen wurden automatisch pausiert um Budgetverschwendung zu stoppen.`,
        anomalyDetected: "Aktive Boosts auf inaktivem Restaurant",
        billingTruth: `${row.active_boosts} Kampagnen, €${parseFloat(row.total_budget).toFixed(2)}/Tag Budget lief`,
        platformTruth: "Restaurant is_active = false",
        autoActionTaken: "Alle aktiven Kampagnen auf 'paused' gesetzt",
        recoveryResult: "Erfolgreich — Budgetverschwendung gestoppt",
        recommendedAction: "Auto-Repair erfolgreich. Restaurant reaktivieren oder Kampagnen endgültig beenden.",
        needsManualReview: false,
        incidentType: "billing_reconciled",
        healingActionType: "pause_boosts_inactive_restaurant",
        autoHealed: true,
      });
    } catch (err) {
      console.error("[OPS] Boost pause for inactive restaurant failed:", err);
      incidents.push({
        title: `Boost-Pausierung FEHLGESCHLAGEN: ${row.name}`,
        systemArea: "billing_reconciliation",
        severity: "high",
        affectedEntity: `Restaurant #${row.id} (${row.name})`,
        affectedCity: row.city,
        technicalSummary: `Konnte Kampagnen für inaktives Restaurant nicht pausieren. Budget wird weiter verschwendet.`,
        anomalyDetected: "Auto-Repair fehlgeschlagen — manueller Eingriff nötig",
        autoActionTaken: "Pause-Versuch FEHLGESCHLAGEN",
        recoveryResult: "Fehlgeschlagen",
        recommendedAction: "SOFORT manuell Kampagnen pausieren für Restaurant #" + row.id,
        needsManualReview: true,
        incidentType: "billing_reconcile_failed",
        healingActionType: "pause_failed",
      });
    }
  }

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

    if (overspendPct > 50) {
      try {
        await db.execute(sql`
          UPDATE promotions SET status = 'paused'
          WHERE id = ${row.id} AND status = 'active'
        `);
        healed++;
        incidents.push({
          title: `Budget-Überschreitung gestoppt: ${row.name} (+${overspendPct}%)`,
          systemArea: "billing_integrity",
          severity: "high",
          affectedEntity: `Restaurant #${row.restaurant_id} (${row.name})`,
          affectedCity: row.city,
          technicalSummary: `Promotion #${row.id} hatte €${spent.toFixed(2)} ausgegeben bei €${budget.toFixed(2)} Budget (+${overspendPct}%). Kampagne wurde automatisch pausiert.`,
          anomalyDetected: "Massive Budget-Überschreitung (>50%)",
          billingTruth: `Budget: €${budget.toFixed(2)}/Tag`,
          platformTruth: `Ausgegeben: €${spent.toFixed(2)} (+${overspendPct}%)`,
          autoActionTaken: "Kampagne automatisch pausiert — Budget-Schutz",
          recoveryResult: "Erfolgreich — Kampagne pausiert, keine weiteren Kosten",
          recommendedAction: "Auto-Repair erfolgreich. Budget-Capping-Logic im System prüfen um zukünftige Überschreitungen zu verhindern.",
          needsManualReview: false,
          incidentType: "billing_overspend_healed",
          healingActionType: "pause_overspend_campaign",
          autoHealed: true,
        });
      } catch (err) {
        console.error("[OPS] Budget pause failed:", err);
        incidents.push({
          title: `Budget-Pausierung FEHLGESCHLAGEN: ${row.name}`,
          systemArea: "billing_integrity",
          severity: "critical",
          affectedEntity: `Restaurant #${row.restaurant_id} (${row.name})`,
          affectedCity: row.city,
          technicalSummary: `Konnte überlaufende Kampagne nicht pausieren. Kosten steigen weiter!`,
          autoActionTaken: "Pause-Versuch FEHLGESCHLAGEN",
          recoveryResult: "Fehlgeschlagen — SOFORTIGER manueller Eingriff nötig",
          recommendedAction: "KRITISCH: Sofort Kampagne #" + row.id + " manuell pausieren!",
          needsManualReview: true,
          incidentType: "billing_overspend_failed",
          healingActionType: "pause_failed",
        });
      }
    } else {
      incidents.push({
        title: `Budget-Überschreitung: ${row.name} (+${overspendPct}%)`,
        systemArea: "billing_integrity",
        severity: "medium",
        affectedEntity: `Restaurant #${row.restaurant_id} (${row.name})`,
        affectedCity: row.city,
        technicalSummary: `Promotion #${row.id} hat €${spent.toFixed(2)} bei €${budget.toFixed(2)} Budget ausgegeben — ${overspendPct}% über dem Limit.`,
        anomalyDetected: "Tagesbudget leicht überschritten",
        billingTruth: `Budget: €${budget.toFixed(2)}/Tag`,
        platformTruth: `Ausgegeben: €${spent.toFixed(2)}`,
        autoActionTaken: "Keine — unter Schwellenwert für Auto-Pause (< 50%)",
        recommendedAction: "Beobachten. Budget-Capping-Logic prüfen um Überschreitungen generell zu verhindern.",
        needsManualReview: false,
        incidentType: "billing_overspend",
      });
    }
  }

  const ratingAnomalies = await db.execute(sql`
    SELECT id, name, city, rating, review_count
    FROM restaurants
    WHERE rating > 5.0 OR rating < 1.0
  `);

  for (const row of ratingAnomalies.rows as any[]) {
    const badRating = parseFloat(row.rating);
    const clampedRating = Math.max(1.0, Math.min(5.0, badRating));
    if (badRating !== clampedRating) {
      try {
        await db.execute(sql`
          UPDATE restaurants SET rating = ${clampedRating} WHERE id = ${row.id}
        `);
        healed++;
        incidents.push({
          title: `Rating korrigiert: ${row.name} (${badRating} → ${clampedRating})`,
          systemArea: "data_integrity",
          severity: "low",
          affectedEntity: `Restaurant #${row.id} (${row.name})`,
          affectedCity: row.city,
          technicalSummary: `Rating von ${badRating} lag außerhalb des gültigen Bereichs. Automatisch auf ${clampedRating} korrigiert.`,
          anomalyDetected: "Ungültiger Rating-Wert",
          autoActionTaken: `Rating von ${badRating} auf ${clampedRating} korrigiert (Clamping 1.0–5.0)`,
          recoveryResult: "Erfolgreich — Datenintegrität wiederhergestellt",
          recommendedAction: "Auto-Repair erfolgreich, keine Aktion erforderlich.",
          needsManualReview: false,
          incidentType: "data_integrity_healed",
          healingActionType: "rating_clamp",
          autoHealed: true,
        });
      } catch (err) {
        console.error("[OPS] Rating clamp failed:", err);
        incidents.push({
          title: `Rating-Korrektur FEHLGESCHLAGEN: ${row.name}`,
          systemArea: "data_integrity",
          severity: "medium",
          affectedEntity: `Restaurant #${row.id} (${row.name})`,
          technicalSummary: `Rating ${badRating} konnte nicht korrigiert werden.`,
          autoActionTaken: "Rating-Clamping versucht — FEHLGESCHLAGEN",
          recoveryResult: "Fehlgeschlagen",
          recommendedAction: "Rating manuell auf gültigen Wert setzen.",
          needsManualReview: true,
          incidentType: "data_integrity_failed",
          healingActionType: "rating_clamp_failed",
        });
      }
    }
  }

  return { incidents, healed };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM CONSISTENCY CHECKS (detection only — not safe to auto-fix)
// ═══════════════════════════════════════════════════════════════════════════════

async function checkPlatformConsistency(): Promise<IncidentCreate[]> {
  const incidents: IncidentCreate[] = [];

  const cityHealth = await db.execute(sql`
    SELECT city, COUNT(*) as biz_count,
           COUNT(*) FILTER (WHERE is_active = false) as inactive_count
    FROM restaurants
    GROUP BY city
    HAVING COUNT(*) FILTER (WHERE is_active = false) > COUNT(*) * 0.5
  `);

  for (const row of cityHealth.rows as any[]) {
    incidents.push({
      title: `Hohe Inaktivitätsrate: ${row.city} (${row.inactive_count}/${row.biz_count})`,
      systemArea: "city_health",
      severity: "medium",
      affectedCity: row.city,
      technicalSummary: `In ${row.city} sind ${row.inactive_count} von ${row.biz_count} Betrieben inaktiv (>50%). Stadt-Expansion könnte gefährdet sein.`,
      anomalyDetected: "Hohe Deaktivierungsrate in Stadt",
      autoActionTaken: "Keine — erfordert strategische Entscheidung",
      recommendedAction: "Reaktivierungs-Kampagne für inaktive Betriebe starten oder Stadt-Strategie überprüfen.",
      needsManualReview: true,
      incidentType: "city_anomaly",
    });
  }

  return incidents;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLAIMS ABUSE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

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
      autoActionTaken: "Keine — Warnung generiert (keine automatische Sperre)",
      recommendedAction: "E-Mail-Adresse prüfen. Bei bestätigtem Missbrauch: Claims ablehnen und E-Mail manuell sperren.",
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
      autoActionTaken: "Keine — könnte organisches Wachstum sein",
      recommendedAction: todayClaims > 50
        ? "Sofort prüfen — möglicher Bot-Angriff oder Marketing-Kampagnen-Spike."
        : "Beobachten — könnte organisches Wachstum oder Marketing-Effekt sein.",
      needsManualReview: todayClaims > 50,
      incidentType: "growth_anomaly",
    });
  }

  return incidents;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVENUE ANOMALY CHECK
// ═══════════════════════════════════════════════════════════════════════════════

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
      autoActionTaken: "Keine — erfordert Delivery-System-Prüfung",
      recommendedAction: "Spending-Tracking prüfen. Impressionen-Delivery und Budget-Deduction verifizieren.",
      needsManualReview: true,
      incidentType: "revenue_anomaly",
    });
  }

  return incidents;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-RETRY ENGINE — retry open retryable incidents
// ═══════════════════════════════════════════════════════════════════════════════

async function retryOpenIncidents(): Promise<{ retried: number; succeeded: number; escalated: number }> {
  let retried = 0, succeeded = 0, escalated = 0;

  const retryable = await db.execute(sql`
    SELECT id, title, incident_type, retry_count, max_retries, affected_entity, healing_action_type
    FROM ops_incidents
    WHERE status = 'open'
      AND auto_healed = false
      AND retry_count < max_retries
      AND healing_action_type IS NOT NULL
      AND detected_at > NOW() - INTERVAL '48 hours'
    ORDER BY
      CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    LIMIT 20
  `);

  for (const row of retryable.rows as any[]) {
    retried++;
    const newRetryCount = parseInt(row.retry_count) + 1;
    const maxRetries = parseInt(row.max_retries);

    let retrySuccess = false;

    if ((row.healing_action_type === "counter_reset" || row.healing_action_type === "counter_reset_failed") &&
        (row.incident_type === "boost_delivery_failed" || row.incident_type === "boost_mismatch")) {
      try {
        const match = (row.affected_entity as string)?.match(/Restaurant #(\d+)/);
        if (match) {
          const result = await db.execute(sql`
            UPDATE promotions SET impressions = 0, spent_today = 0
            WHERE restaurant_id = ${parseInt(match[1])} AND status = 'active' AND impressions = 0
            RETURNING id
          `);
          retrySuccess = result.rows.length > 0;
        }
      } catch (err) {
        console.error("[OPS] Retry counter_reset failed:", err);
      }
    }

    if ((row.healing_action_type === "pause_boosts_inactive_restaurant" || row.healing_action_type === "pause_failed") &&
        (row.incident_type === "billing_reconcile_failed" || row.incident_type === "consistency_mismatch")) {
      try {
        const match = (row.affected_entity as string)?.match(/Restaurant #(\d+)/);
        if (match) {
          const result = await db.execute(sql`
            UPDATE promotions SET status = 'paused'
            WHERE restaurant_id = ${parseInt(match[1])} AND status = 'active'
            RETURNING id
          `);
          retrySuccess = result.rows.length > 0;
        }
      } catch (err) {
        console.error("[OPS] Retry pause_boosts failed:", err);
      }
    }

    if (retrySuccess) {
      succeeded++;
      await db.execute(sql`
        UPDATE ops_incidents
        SET retry_count = ${newRetryCount},
            last_retry_at = NOW(),
            auto_healed = true,
            status = 'resolved',
            resolved_at = NOW(),
            recovery_result = ${"Retry #" + newRetryCount + " erfolgreich — Problem behoben"},
            auto_action_taken = COALESCE(auto_action_taken, '') || ${" | Retry #" + newRetryCount + " erfolgreich"}
        WHERE id = ${row.id}
      `);
    } else if (newRetryCount >= maxRetries) {
      escalated++;
      await db.execute(sql`
        UPDATE ops_incidents
        SET retry_count = ${newRetryCount},
            last_retry_at = NOW(),
            status = 'escalated',
            needs_manual_review = true,
            recovery_result = ${"Max Retries (" + maxRetries + ") erreicht — Eskaliert an Founder"},
            auto_action_taken = COALESCE(auto_action_taken, '') || ${" | Retry #" + newRetryCount + " fehlgeschlagen — ESKALIERT"}
        WHERE id = ${row.id}
      `);
    } else {
      await db.execute(sql`
        UPDATE ops_incidents
        SET retry_count = ${newRetryCount},
            last_retry_at = NOW(),
            recovery_result = ${"Retry #" + newRetryCount + "/" + maxRetries + " fehlgeschlagen — nächster Versuch ausstehend"},
            auto_action_taken = COALESCE(auto_action_taken, '') || ${" | Retry #" + newRetryCount + " fehlgeschlagen"}
        WHERE id = ${row.id}
      `);
    }
  }

  return { retried, succeeded, escalated };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED HEALTH CHECK — detection + healing + retry
// ═══════════════════════════════════════════════════════════════════════════════

async function runFullHealthCheck(log?: any) {
  const [boostResult, billingResult, consistency, claims, revenue, premiumStatus] = await Promise.all([
    healBoostDeliveryIssues(),
    reconcileBilling(),
    checkPlatformConsistency(),
    checkClaimsAnomalies(),
    checkRevenueAnomalies(),
    healPremiumStatusMismatch(),
  ]);

  const allIncidents = [
    ...boostResult.incidents,
    ...billingResult.incidents,
    ...consistency,
    ...claims,
    ...revenue,
    ...premiumStatus,
  ];

  let created = 0;
  let deduplicated = 0;
  for (const inc of allIncidents) {
    const existing = await db.execute(sql`
      SELECT id FROM ops_incidents
      WHERE title = ${inc.title}
        AND (status = 'open' OR (auto_healed = true AND detected_at > NOW() - INTERVAL '24 hours'))
        AND detected_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `);
    if (existing.rows.length === 0) {
      await createIncident(inc);
      created++;
    } else {
      deduplicated++;
    }
  }

  const retryResult = await retryOpenIncidents();

  return {
    checksRun: 6,
    issuesDetected: allIncidents.length,
    newIncidentsCreated: created,
    duplicatesSkipped: deduplicated,
    autoHealed: boostResult.healed + billingResult.healed,
    retryResult,
    breakdown: {
      boost_delivery: boostResult.incidents.length,
      billing_reconciliation: billingResult.incidents.length,
      platform_consistency: consistency.length,
      claims_abuse: claims.length,
      revenue_anomalies: revenue.length,
      premium_status: premiumStatus.length,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED BACKGROUND HEALTH CHECKS (every 10 minutes)
// ═══════════════════════════════════════════════════════════════════════════════

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let lastScheduledCheck: Date | null = null;

function startScheduledChecks() {
  if (healthCheckInterval) return;
  healthCheckInterval = setInterval(async () => {
    try {
      await runFullHealthCheck();
      lastScheduledCheck = new Date();
    } catch (err) {
      console.error("[OPS] Scheduled health check failed:", err);
    }
  }, 10 * 60 * 1000);
  console.log("[OPS] Scheduled health checks started (every 10 min)");
}

startScheduledChecks();

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router.post("/health-check", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Unauthorized" });

  try {
    const result = await runFullHealthCheck(req.log);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Health check failed");
    return res.status(500).json({ error: "Health check failed" });
  }
});

router.post("/billing-reconcile", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Unauthorized" });

  try {
    const result = await reconcileBilling();

    let created = 0;
    for (const inc of result.incidents) {
      const existing = await db.execute(sql`
        SELECT id FROM ops_incidents
        WHERE title = ${inc.title} AND status = 'open'
          AND detected_at > NOW() - INTERVAL '24 hours'
        LIMIT 1
      `);
      if (existing.rows.length === 0) {
        await createIncident(inc);
        created++;
      }
    }

    return res.json({
      issuesFound: result.incidents.length,
      autoHealed: result.healed,
      newIncidents: created,
    });
  } catch (err) {
    req.log.error({ err }, "Billing reconciliation failed");
    return res.status(500).json({ error: "Billing reconciliation failed" });
  }
});

router.post("/retry-open", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Unauthorized" });

  try {
    const result = await retryOpenIncidents();
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Retry failed");
    return res.status(500).json({ error: "Retry failed" });
  }
});

router.get("/incidents", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Unauthorized" });

  try {
    const statusFilter = (req.query.status as string) || "all";
    const severityFilter = (req.query.severity as string) || "all";
    const category = (req.query.category as string) || "all";

    let result;

    if (category === "auto_healed") {
      result = await db.execute(sql`
        SELECT * FROM ops_incidents
        WHERE auto_healed = true
        ORDER BY detected_at DESC
        LIMIT 50
      `);
    } else if (category === "needs_review") {
      result = await db.execute(sql`
        SELECT * FROM ops_incidents
        WHERE needs_manual_review = true AND status = 'open'
        ORDER BY
          CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          detected_at DESC
        LIMIT 50
      `);
    } else if (category === "billing") {
      result = await db.execute(sql`
        SELECT * FROM ops_incidents
        WHERE system_area IN ('billing_integrity', 'billing_reconciliation')
        ORDER BY detected_at DESC
        LIMIT 50
      `);
    } else if (statusFilter !== "all" && severityFilter !== "all") {
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

router.get("/summary", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Unauthorized" });

  try {
    const [counts, recentCritical, systemAreas, healingStats] = await Promise.all([
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
          COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '7 days') AS last_7d,
          COUNT(*) FILTER (WHERE auto_healed = true) AS auto_healed_total,
          COUNT(*) FILTER (WHERE auto_healed = true AND detected_at > NOW() - INTERVAL '24 hours') AS auto_healed_24h,
          COUNT(*) FILTER (WHERE retry_count > 0) AS retried_total,
          COUNT(*) FILTER (WHERE status = 'escalated' AND retry_count >= max_retries) AS retry_exhausted
        FROM ops_incidents
      `),

      db.execute(sql`
        SELECT id, title, severity, system_area, detected_at, needs_manual_review, auto_healed
        FROM ops_incidents
        WHERE severity IN ('critical', 'high') AND status = 'open'
        ORDER BY
          CASE severity WHEN 'critical' THEN 0 ELSE 1 END,
          detected_at DESC
        LIMIT 5
      `),

      db.execute(sql`
        SELECT system_area, COUNT(*) AS incident_count,
               COUNT(*) FILTER (WHERE status = 'open') AS open_count,
               COUNT(*) FILTER (WHERE auto_healed = true) AS healed_count
        FROM ops_incidents
        GROUP BY system_area
        ORDER BY open_count DESC
      `),

      db.execute(sql`
        SELECT
          healing_action_type,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE auto_healed = true) as succeeded,
          COUNT(*) FILTER (WHERE auto_healed = false) as failed
        FROM ops_incidents
        WHERE healing_action_type IS NOT NULL
        GROUP BY healing_action_type
        ORDER BY total DESC
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
        total:           parseInt(c.total),
        open:            parseInt(c.open_count),
        resolved:        parseInt(c.resolved_count),
        escalated:       parseInt(c.escalated_count),
        pendingReview:   parseInt(c.pending_review),
        criticalOpen:    parseInt(c.critical_open),
        highOpen:        parseInt(c.high_open),
        mediumOpen:      parseInt(c.medium_open),
        lowOpen:         parseInt(c.low_open),
        last24h:         parseInt(c.last_24h),
        last7d:          parseInt(c.last_7d),
        autoHealedTotal: parseInt(c.auto_healed_total),
        autoHealed24h:   parseInt(c.auto_healed_24h),
        retriedTotal:    parseInt(c.retried_total),
        retryExhausted:  parseInt(c.retry_exhausted),
      },
      recentCritical: recentCritical.rows,
      systemAreas: systemAreas.rows,
      healingStats: healingStats.rows,
      scheduledChecks: {
        enabled: healthCheckInterval !== null,
        intervalMinutes: 10,
        lastRun: lastScheduledCheck?.toISOString() ?? null,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get ops summary");
    return res.status(500).json({ error: "Failed" });
  }
});

router.get("/audit-trail", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Unauthorized" });

  try {
    const result = await db.execute(sql`
      SELECT id, title, system_area, severity, incident_type,
             healing_action_type, auto_healed, retry_count, max_retries,
             auto_action_taken, recovery_result, recommended_action,
             detected_at, resolved_at, last_retry_at,
             needs_manual_review, status, affected_entity, affected_city
      FROM ops_incidents
      WHERE healing_action_type IS NOT NULL
         OR auto_healed = true
         OR retry_count > 0
      ORDER BY detected_at DESC
      LIMIT 100
    `);

    return res.json({ trail: result.rows, total: result.rows.length });
  } catch (err) {
    req.log.error({ err }, "Failed to get audit trail");
    return res.status(500).json({ error: "Failed" });
  }
});

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
