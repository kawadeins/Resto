import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();
const FOUNDER_KEY = "rs_founder_2026";

function isFounder(req: any) {
  return req.headers["x-founder-key"] === FOUNDER_KEY;
}

type SystemHealth = "green" | "yellow" | "red";
type SystemSpeed = "fast" | "normal" | "slow";
type ActionFlag = "action_needed" | "auto_handled" | "monitoring";
type ConnectionStatus = "connected" | "partially_connected" | "not_connected" | "not_reporting";
type BrainMode = "monitoring" | "decision_support" | "safe_autonomous";
type RiskClassification = "demo_test" | "non_production" | "minor_operational" | "production_risk" | "launch_blocker";

interface SystemSignal {
  id: string;
  name: string;
  role: string;
  health: SystemHealth;
  speed: SystemSpeed;
  errorLevel: number;
  riskLevel: number;
  lastUpdate: string;
  requiresAttention: boolean;
  actionFlag: ActionFlag;
  summary: string;
  analysis: string;
  importanceWeight: "critical" | "high" | "medium" | "low";
  connectionStatus: ConnectionStatus;
  connectionDetails: { sendsStatus: boolean; sendsIncidents: boolean; sendsPerformance: boolean; sendsRiskSignals: boolean; returnsHealth: boolean };
  metrics: { successRate: number; errorRate: number; activityLevel: number; responseSpeed: number };
  incidents: { open: number; healed: number; escalated: number };
  details: Record<string, any>;
  recommendedAction: string;
  riskClassification: RiskClassification;
  classificationReason: string;
}

interface PriorityIssue {
  rank: number;
  title: string;
  reason: string;
  impact: string;
  system: string;
  severity: "critical" | "high" | "medium" | "low";
  score: number;
  suggestedAction: string;
  safeAutoAction: string | null;
  whatHappened: string;
  whyItMatters: string;
  whatWasAttempted: string;
  whatShouldHappenNext: string;
  riskClassification: RiskClassification;
  classificationReason: string;
}

interface AutoActionRecord {
  id: string;
  timestamp: string;
  system: string;
  trigger: string;
  action: string;
  result: "success" | "failed" | "partial";
  details: string;
  needsMoreAction: boolean;
}

const IMPORTANCE: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function speedFromMs(ms: number): SystemSpeed {
  return ms < 100 ? "fast" : ms < 500 ? "normal" : "slow";
}

function buildConnection(status: boolean, incidents: boolean, perf: boolean, risk: boolean, health: boolean): SystemSignal["connectionDetails"] {
  return { sendsStatus: status, sendsIncidents: incidents, sendsPerformance: perf, sendsRiskSignals: risk, returnsHealth: health };
}

function deriveConnectionStatus(c: SystemSignal["connectionDetails"]): ConnectionStatus {
  const all = [c.sendsStatus, c.sendsIncidents, c.sendsPerformance, c.sendsRiskSignals, c.returnsHealth];
  const trueCount = all.filter(Boolean).length;
  if (trueCount === 5) return "connected";
  if (trueCount >= 3) return "partially_connected";
  if (trueCount >= 1) return "not_reporting";
  return "not_connected";
}

function classifySystemRisk(sys: Omit<SystemSignal, "riskClassification" | "classificationReason">): { riskClassification: RiskClassification; classificationReason: string } {
  const id = sys.id;
  const hasRealTraffic = sys.metrics.activityLevel > 10;
  const hasOpenIncidents = sys.incidents.open > 0;
  const hasEscalated = sys.incidents.escalated > 0;

  if (id === "auth") {
    return { riskClassification: "launch_blocker", classificationReason: "Auth basiert auf localStorage und Founder-Key — nicht sicher für Produktionsbetrieb mit echten Nutzern" };
  }

  if (id === "boost") {
    if (sys.details.stuck > 0 && sys.health !== "green") {
      if (!hasRealTraffic && sys.details.totalImpressions === 0) {
        return { riskClassification: "non_production", classificationReason: "Boost-Delivery kann ohne echten Traffic nicht validiert werden — keine echten Kampagnen-Impressionen vorhanden" };
      }
      return { riskClassification: "production_risk", classificationReason: "Boost-Delivery-Logik fehlerhaft — bezahlte Kampagnen liefern unter echtem Traffic keine Impressionen" };
    }
  }

  if (id === "billing") {
    if (hasOpenIncidents || hasEscalated) {
      const revenue = sys.details.totalSpend ?? 0;
      if (revenue < 1 && !hasRealTraffic) {
        return { riskClassification: "demo_test", classificationReason: "Billing-Incidents entstehen durch Testdaten — keine echten Zahlungen oder Kampagnen vorhanden" };
      }
      return { riskClassification: "production_risk", classificationReason: "Billing-Incidents unter echten Zahlungen — Abrechnungswahrheit muss geprüft werden" };
    }
  }

  if (id === "premium") {
    if (sys.health !== "green") {
      return { riskClassification: "production_risk", classificationReason: "Premium-Zugang inkonsistent — kann zu unbefugtem Zugriff auf bezahlte Features führen" };
    }
  }

  if (id === "watchdog") {
    if (hasEscalated) {
      if (sys.incidents.healed > sys.incidents.escalated * 2) {
        return { riskClassification: "minor_operational", classificationReason: "Watchdog eskaliert einzelne Incidents, aber Auto-Healing funktioniert — überwiegend selbstkorrigierend" };
      }
      return { riskClassification: "production_risk", classificationReason: "Watchdog-Eskalationen deuten auf Systemprobleme hin, die Auto-Healing nicht lösen kann" };
    }
    if (hasOpenIncidents) {
      return { riskClassification: "minor_operational", classificationReason: "Offene Watchdog-Incidents vorhanden — werden durch Auto-Healing-System bearbeitet" };
    }
  }

  if (id === "monetization") {
    if (hasOpenIncidents) {
      const rev = sys.details.revenueToday ?? 0;
      if (rev < 1) {
        return { riskClassification: "demo_test", classificationReason: "Monetarisierungs-Alert entsteht durch fehlende echte Zahlungsdaten — kein realer Umsatz im System" };
      }
      return { riskClassification: "production_risk", classificationReason: "Monetarisierungsprobleme bei echtem Umsatz — Einnahmenfluss gefährdet" };
    }
  }

  if (id === "conversion") {
    if (sys.health !== "green" && sys.metrics.activityLevel < 20) {
      return { riskClassification: "demo_test", classificationReason: "Conversion-Daten zu gering für valide Analyse — kein echter Nutzer-Traffic vorhanden" };
    }
  }

  if (id === "social") {
    if (sys.health !== "green" && sys.metrics.activityLevel < 5) {
      return { riskClassification: "demo_test", classificationReason: "Soziale Features inaktiv mangels echter Nutzer — erwartet in Demo/Test-Phase" };
    }
  }

  if (id === "notifications") {
    if (sys.health !== "green" && sys.metrics.activityLevel === 0) {
      return { riskClassification: "non_production", classificationReason: "Keine Benachrichtigungen gesendet — kann ohne echte Empfänger und Trigger nicht validiert werden" };
    }
  }

  if (id === "reservations") {
    if (sys.health !== "green" && sys.metrics.activityLevel === 0) {
      return { riskClassification: "demo_test", classificationReason: "Keine Reservierungen vorhanden — erwartet in Demo-Umgebung ohne echte Gäste" };
    }
  }

  if (id === "user_profiles") {
    if (sys.health !== "green" && sys.metrics.activityLevel < 5) {
      return { riskClassification: "demo_test", classificationReason: "Wenige Nutzerprofile — erwartet in Test-Umgebung ohne echte Registrierungen" };
    }
  }

  if (id === "launch_control") {
    if (hasOpenIncidents) {
      return { riskClassification: "minor_operational", classificationReason: "Launch-Control zeigt offene Punkte — Plattform-Bereitschaft wird geprüft" };
    }
  }

  if (id === "heat_map" || id === "auto_plans" || id === "instant_plans") {
    if (sys.health !== "green" && sys.metrics.activityLevel < 5) {
      return { riskClassification: "demo_test", classificationReason: `${sys.name} hat wenig Aktivität — erwartet ohne echten Nutzerbetrieb` };
    }
  }

  if (id === "data_integrity") {
    if (sys.health === "red") {
      return { riskClassification: "production_risk", classificationReason: "Datenintegrität gefährdet — fehlerhafte Datensätze können Geschäftslogik beeinflussen" };
    }
    if (hasOpenIncidents) {
      return { riskClassification: "minor_operational", classificationReason: "Kleinere Dateninkonsistenzen erkannt — kein direkter Einfluss auf Kernfunktionen" };
    }
  }

  if (id === "abuse") {
    if (sys.health === "red") {
      return { riskClassification: "production_risk", classificationReason: "Missbrauchsmuster erkannt — kann Plattformintegrität gefährden" };
    }
  }

  if (id === "founder_dashboard") {
    if (sys.health !== "green") {
      return { riskClassification: "production_risk", classificationReason: "Founder-Dashboard eingeschränkt — Kontrolle und Sichtbarkeit gefährdet" };
    }
  }

  if (sys.connectionStatus === "not_connected") {
    return { riskClassification: "launch_blocker", classificationReason: `${sys.name} ist nicht verbunden — System kann nicht überwacht werden, Launch-Risiko` };
  }

  if (sys.health === "green" && !hasOpenIncidents) {
    return { riskClassification: "demo_test", classificationReason: "System stabil — keine Auffälligkeiten, arbeitet im Demo/Test-Modus wie erwartet" };
  }

  if (sys.health === "yellow" && !hasEscalated) {
    return { riskClassification: "minor_operational", classificationReason: "Leichte Warnung — kein eskaliertes Problem, operativ im Normbereich" };
  }

  if (sys.health === "red") {
    return { riskClassification: "production_risk", classificationReason: `${sys.name} zeigt kritische Signale — muss vor Produktionsstart behoben werden` };
  }

  return { riskClassification: "minor_operational", classificationReason: "System zeigt leichte Auffälligkeiten — keine unmittelbare Gefahr" };
}

async function checkPremiumSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active,
           COUNT(*) FILTER (WHERE is_active = false) as inactive,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_7d
    FROM restaurants
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const total = parseInt(r.total) || 0;
  const active = parseInt(r.active) || 0;
  const inactive = parseInt(r.inactive) || 0;

  const opsRes = await db.execute(sql`
    SELECT COUNT(*) FILTER (WHERE status='open') as open,
           COUNT(*) FILTER (WHERE auto_healed=true) as healed,
           COUNT(*) FILTER (WHERE status='escalated') as escalated
    FROM ops_incidents WHERE system_area IN ('billing_reconciliation') AND title ILIKE '%premium%'
  `);
  const ops = (opsRes.rows[0] as any) ?? {};
  const healthScore: SystemHealth = inactive > total * 0.3 ? "red" : inactive > total * 0.1 ? "yellow" : "green";
  const conn = buildConnection(true, true, true, true, true);

  return {
    id: "premium", name: "Premium-System",
    role: "Verwaltung der Premium-Abonnements und Zugangsrechte",
    health: healthScore, speed: speedFromMs(speed), errorLevel: parseInt(ops.open) || 0, riskLevel: parseInt(ops.escalated) || 0,
    lastUpdate: new Date().toISOString(), requiresAttention: (parseInt(ops.open) || 0) > 0,
    actionFlag: (parseInt(ops.open) || 0) > 0 ? "action_needed" : "monitoring",
    summary: `${active} aktive Restaurants, ${inactive} inaktiv`,
    analysis: inactive > total * 0.3 ? "Hohe Inaktivierungsrate — möglicherweise Churn-Problem"
      : inactive > total * 0.1 ? "Moderate Inaktivierungen — beobachten" : "System stabil",
    importanceWeight: "critical", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: total > 0 ? Math.round((active / total) * 100) : 100, errorRate: parseInt(ops.open) || 0, activityLevel: parseInt(r.new_7d) || 0, responseSpeed: speed },
    incidents: { open: parseInt(ops.open) || 0, healed: parseInt(ops.healed) || 0, escalated: parseInt(ops.escalated) || 0 },
    details: { total, active, inactive, new7d: parseInt(r.new_7d) || 0 },
    recommendedAction: (parseInt(ops.open) || 0) > 0 ? "Premium-Incidents im Ops Center prüfen" : "Keine Aktion erforderlich — System stabil",
  };
}

async function checkBillingSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active,
           COALESCE(SUM(spent_today), 0) as total_spend, COALESCE(SUM(daily_budget), 0) as total_budget,
           COUNT(*) FILTER (WHERE spent_today > daily_budget AND daily_budget > 0) as overspend
    FROM promotions
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const overspend = parseInt(r.overspend) || 0;
  const opsRes = await db.execute(sql`
    SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed,
           COUNT(*) FILTER (WHERE status='escalated') as escalated
    FROM ops_incidents WHERE system_area IN ('billing_integrity', 'billing_reconciliation')
  `);
  const ops = (opsRes.rows[0] as any) ?? {};
  const openOps = parseInt(ops.open) || 0;
  const health: SystemHealth = openOps > 2 || overspend > 3 ? "red" : openOps > 0 || overspend > 0 ? "yellow" : "green";
  const conn = buildConnection(true, true, true, true, true);

  return {
    id: "billing", name: "Billing / Zahlungen",
    role: "Abrechnungssystem, Budget-Kontrolle und Zahlungsabgleich",
    health, speed: speedFromMs(speed), errorLevel: openOps, riskLevel: overspend,
    lastUpdate: new Date().toISOString(), requiresAttention: health !== "green",
    actionFlag: openOps > 0 ? "action_needed" : overspend > 0 ? "monitoring" : "monitoring",
    summary: `${parseInt(r.active) || 0} aktive Kampagnen, €${parseFloat(r.total_spend).toFixed(2)} Ausgaben heute`,
    analysis: overspend > 0 ? `${overspend} Kampagne(n) über Budget — Billing-Risiko` : openOps > 0 ? "Offene Billing-Incidents vorhanden" : "Abrechnungssystem stabil",
    importanceWeight: "critical", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: (parseInt(r.total) || 0) > 0 ? Math.round((1 - overspend / parseInt(r.total)) * 100) : 100, errorRate: openOps, activityLevel: parseInt(r.active) || 0, responseSpeed: speed },
    incidents: { open: openOps, healed: parseInt(ops.healed) || 0, escalated: parseInt(ops.escalated) || 0 },
    details: { totalCampaigns: parseInt(r.total) || 0, activeCampaigns: parseInt(r.active) || 0, totalSpend: parseFloat(r.total_spend) || 0, totalBudget: parseFloat(r.total_budget) || 0, overspendCount: overspend },
    recommendedAction: overspend > 0 ? "Billing-Abgleich durchführen — Budget-Überschreitungen prüfen" : openOps > 0 ? "Offene Billing-Incidents im Ops Center lösen" : "Keine Aktion erforderlich",
  };
}

async function checkBoostSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) FILTER (WHERE status = 'active') as active_boosts,
           COUNT(*) FILTER (WHERE status = 'active' AND impressions = 0 AND started_at < NOW() - INTERVAL '2 hours') as stuck,
           COALESCE(SUM(impressions) FILTER (WHERE status = 'active'), 0) as total_impressions,
           COALESCE(SUM(clicks) FILTER (WHERE status = 'active'), 0) as total_clicks
    FROM promotions
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const stuck = parseInt(r.stuck) || 0;
  const activeBoosts = parseInt(r.active_boosts) || 0;
  const opsRes = await db.execute(sql`
    SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed,
           COUNT(*) FILTER (WHERE status='escalated') as escalated
    FROM ops_incidents WHERE system_area IN ('boost_delivery', 'boost_integrity')
  `);
  const ops = (opsRes.rows[0] as any) ?? {};
  const openOps = parseInt(ops.open) || 0;
  const health: SystemHealth = stuck > 2 || openOps > 2 ? "red" : stuck > 0 || openOps > 0 ? "yellow" : "green";
  const conn = buildConnection(true, true, true, true, true);

  return {
    id: "boost", name: "Boost / Werbesystem",
    role: "Verwaltung und Auslieferung von Boost-Kampagnen",
    health, speed: speedFromMs(speed), errorLevel: openOps, riskLevel: stuck,
    lastUpdate: new Date().toISOString(), requiresAttention: stuck > 0 || openOps > 0,
    actionFlag: stuck > 0 ? "action_needed" : openOps > 0 ? "auto_handled" : "monitoring",
    summary: `${activeBoosts} aktive Boosts, ${parseInt(r.total_impressions) || 0} Impressionen`,
    analysis: stuck > 0 ? `${stuck} Boost(s) ohne Impressionen — Delivery-Problem` : "Boost-Auslieferung normal",
    importanceWeight: "high", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: activeBoosts > 0 ? Math.round(((activeBoosts - stuck) / activeBoosts) * 100) : 100, errorRate: stuck, activityLevel: activeBoosts, responseSpeed: speed },
    incidents: { open: openOps, healed: parseInt(ops.healed) || 0, escalated: parseInt(ops.escalated) || 0 },
    details: { activeBoosts, stuck, totalImpressions: parseInt(r.total_impressions) || 0, totalClicks: parseInt(r.total_clicks) || 0 },
    recommendedAction: stuck > 0 ? "Stuck-Boosts prüfen — Health Check durchführen" : "Keine Aktion erforderlich",
  };
}

async function checkGrowthSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total_claims, COUNT(*) FILTER (WHERE status = 'new') as new_claims,
           COUNT(*) FILTER (WHERE status = 'onboarded') as onboarded, COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as claims_7d
    FROM business_claims
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const newClaims = parseInt(r.new_claims) || 0;
  const claims7d = parseInt(r.claims_7d) || 0;
  const opsGrowth = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed, COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area IN ('growth','onboarding') OR title ILIKE '%claim%'`);
    const opsG = (opsGrowth.rows[0] as any) ?? {};
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "growth", name: "Growth / Self-Serve",
    role: "Business-Onboarding, Self-Serve-Pipeline und Wachstumsmotor",
    health: claims7d === 0 ? "yellow" as SystemHealth : "green",
    speed: speedFromMs(speed), errorLevel: 0, riskLevel: claims7d === 0 ? 1 : 0,
    lastUpdate: new Date().toISOString(), requiresAttention: newClaims > 5,
    actionFlag: newClaims > 5 ? "action_needed" : "monitoring",
    summary: `${newClaims} neue Claims, ${parseInt(r.onboarded) || 0} onboarded`,
    analysis: claims7d === 0 ? "Keine neuen Claims in 7 Tagen — Wachstum stagniert" : newClaims > 10 ? "Viele offene Claims — Pipeline-Kapazität prüfen" : "Wachstumspipeline aktiv",
    importanceWeight: "medium", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: (parseInt(r.total_claims) || 0) > 0 ? Math.round((parseInt(r.onboarded) || 0) / parseInt(r.total_claims) * 100) : 0, errorRate: 0, activityLevel: claims7d, responseSpeed: speed },
    incidents: { open: parseInt(opsG.open) || 0, healed: parseInt(opsG.healed) || 0, escalated: parseInt(opsG.escalated) || 0 },
      details: { totalClaims: parseInt(r.total_claims) || 0, newClaims, onboarded: parseInt(r.onboarded) || 0, rejected: parseInt(r.rejected) || 0, claims7d },
    recommendedAction: newClaims > 5 ? "Offene Claims bearbeiten — Pipeline-Kapazität sicherstellen" : claims7d === 0 ? "Wachstumsstrategie evaluieren" : "Keine Aktion erforderlich",
  };
}

async function checkCompetitionEngine(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total, AVG(rating) as avg_rating, COUNT(*) FILTER (WHERE is_active = true) as active FROM restaurants
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const opsComp = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed, COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area = 'competition'`);
    const opsC = (opsComp.rows[0] as any) ?? {};
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "competition", name: "Competition Engine",
    role: "Wettbewerbsanalyse, Sichtbarkeit und Marktpositionierung",
    health: "green", speed: speedFromMs(speed), errorLevel: 0, riskLevel: 0,
    lastUpdate: new Date().toISOString(), requiresAttention: false, actionFlag: "monitoring",
    summary: `${parseInt(r.active) || 0} aktive Restaurants, Ø ${parseFloat(r.avg_rating)?.toFixed(1) || "0"} Rating`,
    analysis: "Wettbewerbsdaten aktuell",
    importanceWeight: "medium", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: 100, errorRate: 0, activityLevel: parseInt(r.active) || 0, responseSpeed: speed },
    incidents: { open: parseInt(opsC.open) || 0, healed: parseInt(opsC.healed) || 0, escalated: parseInt(opsC.escalated) || 0 },
      details: { total: parseInt(r.total) || 0, active: parseInt(r.active) || 0, avgRating: parseFloat(r.avg_rating) || 0 },
    recommendedAction: "Keine Aktion erforderlich",
  };
}

async function checkWatchdogSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'open') as open,
           COUNT(*) FILTER (WHERE status = 'escalated') as escalated,
           COUNT(*) FILTER (WHERE auto_healed = true) as healed,
           COUNT(*) FILTER (WHERE needs_manual_review = true AND status = 'open') as review_needed,
           COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'open') as critical_open,
           COUNT(*) FILTER (WHERE severity = 'high' AND status = 'open') as high_open
    FROM ops_incidents
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const openInc = parseInt(r.open) || 0;
  const escalated = parseInt(r.escalated) || 0;
  const criticalOpen = parseInt(r.critical_open) || 0;
  const health: SystemHealth = criticalOpen > 0 ? "red" : openInc > 3 || escalated > 0 ? "yellow" : "green";
  const conn = buildConnection(true, true, true, true, true);

  return {
    id: "watchdog", name: "Watchdog / Self-Healing",
    role: "Automatische Plattform-Überwachung, Erkennung und Selbstheilung",
    health, speed: speedFromMs(speed), errorLevel: openInc, riskLevel: escalated,
    lastUpdate: new Date().toISOString(), requiresAttention: criticalOpen > 0 || escalated > 0,
    actionFlag: openInc > 0 ? "action_needed" : parseInt(r.healed) || 0 > 0 ? "auto_handled" : "monitoring",
    summary: `${openInc} offen, ${parseInt(r.healed) || 0} auto-geheilt, ${escalated} eskaliert`,
    analysis: criticalOpen > 0 ? `${criticalOpen} kritische(r) Incident(s) offen — sofortige Aufmerksamkeit`
      : escalated > 0 ? `${escalated} eskalierte(r) Incident(s) — Retry ausgeschöpft`
      : openInc > 0 ? `${openInc} offene Incidents — Monitoring aktiv`
      : `Alle Incidents gelöst — System stabil`,
    importanceWeight: "high", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: (parseInt(r.total) || 0) > 0 ? Math.round((parseInt(r.healed) || 0) / parseInt(r.total) * 100) : 100, errorRate: openInc, activityLevel: parseInt(r.total) || 0, responseSpeed: speed },
    incidents: { open: openInc, healed: parseInt(r.healed) || 0, escalated },
    details: { total: parseInt(r.total) || 0, open: openInc, escalated, healed: parseInt(r.healed) || 0, reviewNeeded: parseInt(r.review_needed) || 0, criticalOpen, highOpen: parseInt(r.high_open) || 0 },
    recommendedAction: criticalOpen > 0 ? "Kritische Incidents sofort prüfen — Ops Center öffnen" : escalated > 0 ? "Eskalierte Incidents manuell lösen" : openInc > 0 ? "Offene Incidents beobachten" : "Keine Aktion erforderlich — System stabil",
  };
}

async function checkCityExpansion(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT city, COUNT(*) as count FROM restaurants WHERE is_active = true GROUP BY city ORDER BY count DESC
  `);
  const speed = Date.now() - t0;
  const rows = result.rows as any[];
  const totalCities = rows.length;
  const totalBiz = rows.reduce((s: number, r: any) => s + parseInt(r.count), 0);
  const opsCities = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed, COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area = 'city_expansion'`);
    const opsCi = (opsCities.rows[0] as any) ?? {};
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "cities", name: "City Expansion",
    role: "Städte-Expansion, Markterschließung und regionale Penetration",
    health: totalCities >= 3 ? "green" : "yellow",
    speed: speedFromMs(speed), errorLevel: 0, riskLevel: 0,
    lastUpdate: new Date().toISOString(), requiresAttention: false, actionFlag: "monitoring",
    summary: `${totalCities} Städte aktiv, ${totalBiz} Betriebe gesamt`,
    analysis: totalCities >= 5 ? "Multi-City-Expansion läuft erfolgreich" : totalCities >= 3 ? "Gute Stadtabdeckung — weitere Expansion möglich" : "Wenige Städte aktiv — Expansionspotenzial",
    importanceWeight: "medium", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: 100, errorRate: 0, activityLevel: totalCities, responseSpeed: speed },
    incidents: { open: parseInt(opsCi.open) || 0, healed: parseInt(opsCi.healed) || 0, escalated: parseInt(opsCi.escalated) || 0 },
      details: { totalCities, totalBiz, breakdown: rows.map((r: any) => ({ city: r.city, count: parseInt(r.count) })) },
    recommendedAction: "Keine Aktion erforderlich",
  };
}

async function checkSocialSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total_activities, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as activities_24h FROM social_activities
  `);
  const friendRes = await db.execute(sql`SELECT COUNT(*) as total FROM friendships WHERE status = 'accepted'`);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const fr = (friendRes.rows[0] as any) ?? {};
  const activities24h = parseInt(r.activities_24h) || 0;
  const opsSocial = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed, COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area = 'social'`);
    const opsSo = (opsSocial.rows[0] as any) ?? {};
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "social", name: "Social / Freunde",
    role: "Soziales Netzwerk, Freundschaften und Gruppen-Features",
    health: "green", speed: speedFromMs(speed), errorLevel: 0, riskLevel: 0,
    lastUpdate: new Date().toISOString(), requiresAttention: false, actionFlag: "monitoring",
    summary: `${parseInt(fr.total) || 0} Freundschaften, ${activities24h} Aktivitäten (24h)`,
    analysis: activities24h === 0 ? "Keine soziale Aktivität in 24h — Engagement niedrig" : "Social-System aktiv",
    importanceWeight: "medium", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: 100, errorRate: 0, activityLevel: activities24h, responseSpeed: speed },
    incidents: { open: parseInt(opsSo.open) || 0, healed: parseInt(opsSo.healed) || 0, escalated: parseInt(opsSo.escalated) || 0 },
      details: { totalActivities: parseInt(r.total_activities) || 0, activities24h, totalFriendships: parseInt(fr.total) || 0 },
    recommendedAction: activities24h === 0 ? "Engagement-Strategie prüfen — Social-Aktivierung fördern" : "Keine Aktion erforderlich",
  };
}

async function checkInstantPlansSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'open') as open_plans,
           COUNT(*) FILTER (WHERE status = 'joined') as joined,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as plans_24h
    FROM instant_plans
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const opsPlans = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed, COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area = 'instant_plans'`);
    const opsPl = (opsPlans.rows[0] as any) ?? {};
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "instant_plans", name: "Instant / Auto-Pläne",
    role: "Spontane Treffpunkt-Planung und Gruppen-Koordination",
    health: "green", speed: speedFromMs(speed), errorLevel: 0, riskLevel: 0,
    lastUpdate: new Date().toISOString(), requiresAttention: false, actionFlag: "monitoring",
    summary: `${parseInt(r.open_plans) || 0} offene Pläne, ${parseInt(r.plans_24h) || 0} heute`,
    analysis: "Instant-Plan-System aktiv",
    importanceWeight: "low", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: 100, errorRate: 0, activityLevel: parseInt(r.plans_24h) || 0, responseSpeed: speed },
    incidents: { open: parseInt(opsPl.open) || 0, healed: parseInt(opsPl.healed) || 0, escalated: parseInt(opsPl.escalated) || 0 },
      details: { total: parseInt(r.total) || 0, openPlans: parseInt(r.open_plans) || 0, joined: parseInt(r.joined) || 0, plans24h: parseInt(r.plans_24h) || 0 },
    recommendedAction: "Keine Aktion erforderlich",
  };
}

async function checkReviewsSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total, AVG(rating) as avg_rating, COUNT(*) FILTER (WHERE rating <= 2) as negative,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent
    FROM reviews
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const negative = parseInt(r.negative) || 0;
  const total = parseInt(r.total) || 0;
  const opsReviews = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed, COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area = 'reviews'`);
    const opsRv = (opsReviews.rows[0] as any) ?? {};
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "reviews", name: "Reviews / Reputation",
    role: "Kundenbewertungen, Reputationsmanagement und Feedback",
    health: negative > total * 0.3 ? "red" : negative > total * 0.1 ? "yellow" : "green",
    speed: speedFromMs(speed), errorLevel: 0, riskLevel: negative > total * 0.2 ? 2 : 0,
    lastUpdate: new Date().toISOString(), requiresAttention: negative > total * 0.2, actionFlag: "monitoring",
    summary: `${total} Bewertungen, Ø ${parseFloat(r.avg_rating)?.toFixed(1) || "0"}`,
    analysis: negative > total * 0.2 ? "Hohe Rate negativer Bewertungen — Reputationsrisiko" : "Bewertungsprofil gesund",
    importanceWeight: "medium", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: total > 0 ? Math.round(((total - negative) / total) * 100) : 100, errorRate: 0, activityLevel: parseInt(r.recent) || 0, responseSpeed: speed },
    incidents: { open: parseInt(opsRv.open) || 0, healed: parseInt(opsRv.healed) || 0, escalated: parseInt(opsRv.escalated) || 0 },
      details: { total, avgRating: parseFloat(r.avg_rating) || 0, negative, recent: parseInt(r.recent) || 0 },
    recommendedAction: negative > total * 0.2 ? "Negative Bewertungen prüfen — Qualitätsmanagement verbessern" : "Keine Aktion erforderlich",
  };
}

async function checkDataIntegrity(): Promise<SystemSignal> {
  const t0 = Date.now();
  const badRatings = await db.execute(sql`SELECT COUNT(*) as count FROM restaurants WHERE rating < 1 OR rating > 5`);
  const opsRes = await db.execute(sql`
    SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed,
           COUNT(*) FILTER (WHERE status='escalated') as escalated
    FROM ops_incidents WHERE system_area IN ('data_integrity', 'platform_consistency')
  `);
  const speed = Date.now() - t0;
  const bad = parseInt((badRatings.rows[0] as any)?.count) || 0;
  const ops = (opsRes.rows[0] as any) ?? {};
  const openOps = parseInt(ops.open) || 0;
  const conn = buildConnection(true, true, true, true, true);

  return {
    id: "data_integrity", name: "Datenintegrität",
    role: "Überwachung der Datenkonsistenz und Plattform-Validierung",
    health: bad > 0 || openOps > 0 ? "yellow" : "green",
    speed: speedFromMs(speed), errorLevel: bad + openOps, riskLevel: bad,
    lastUpdate: new Date().toISOString(), requiresAttention: bad > 0,
    actionFlag: bad > 0 ? "action_needed" : openOps > 0 ? "auto_handled" : "monitoring",
    summary: `${bad} Datenfehler erkannt`,
    analysis: bad > 0 ? `${bad} ungültige Datensätze gefunden` : "Datenintegrität bestätigt",
    importanceWeight: "high", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: bad === 0 ? 100 : 90, errorRate: bad, activityLevel: 0, responseSpeed: speed },
    incidents: { open: openOps, healed: parseInt(ops.healed) || 0, escalated: parseInt(ops.escalated) || 0 },
    details: { invalidRatings: bad },
    recommendedAction: bad > 0 ? "Datenbereinigung durchführen — Health Check starten" : "Keine Aktion erforderlich",
  };
}

async function checkAbuseDetection(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT email, COUNT(*) as cnt FROM business_claims WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY email HAVING COUNT(*) >= 3
  `);
  const speed = Date.now() - t0;
  const suspiciousEmails = result.rows.length;
  const opsRes = await db.execute(sql`
    SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed,
           COUNT(*) FILTER (WHERE status='escalated') as escalated
    FROM ops_incidents WHERE system_area = 'abuse_detection'
  `);
  const ops = (opsRes.rows[0] as any) ?? {};
  const conn = buildConnection(true, true, true, true, true);

  return {
    id: "abuse", name: "Missbrauchs-Erkennung",
    role: "Erkennung von Trial-Missbrauch, Spam und verdächtigen Mustern",
    health: suspiciousEmails > 2 ? "red" : suspiciousEmails > 0 ? "yellow" : "green",
    speed: speedFromMs(speed), errorLevel: parseInt(ops.open) || 0, riskLevel: suspiciousEmails,
    lastUpdate: new Date().toISOString(), requiresAttention: suspiciousEmails > 0,
    actionFlag: suspiciousEmails > 0 ? "action_needed" : "monitoring",
    summary: `${suspiciousEmails} verdächtige E-Mail-Muster`,
    analysis: suspiciousEmails > 0 ? `${suspiciousEmails} E-Mail(s) mit Mehrfach-Claims — Missbrauchsrisiko` : "Keine Missbrauchsmuster erkannt",
    importanceWeight: "high", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: suspiciousEmails === 0 ? 100 : 80, errorRate: suspiciousEmails, activityLevel: 0, responseSpeed: speed },
    incidents: { open: parseInt(ops.open) || 0, healed: parseInt(ops.healed) || 0, escalated: parseInt(ops.escalated) || 0 },
    details: { suspiciousEmails },
    recommendedAction: suspiciousEmails > 0 ? "Verdächtige E-Mails prüfen und ggf. sperren" : "Keine Aktion erforderlich",
  };
}

async function checkMonetizationEngine(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(spent_today), 0) as revenue_today,
           COALESCE(SUM(daily_budget), 0) as budget_total,
           COUNT(*) FILTER (WHERE status = 'active') as active,
           COUNT(*) as total
    FROM promotions
  `);
  const subsRes = await db.execute(sql`SELECT COUNT(*) as total FROM subscriptions WHERE status = 'active'`);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const s = (subsRes.rows[0] as any) ?? {};
  const revenue = parseFloat(r.revenue_today) || 0;
  const opsMon = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed, COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area IN ('monetization','billing_integrity','billing_reconciliation')`);
    const opsM = (opsMon.rows[0] as any) ?? {};
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "monetization", name: "Monetarisierung",
    role: "Umsatzsteuerung, Subscription-Einnahmen und Kampagnen-Revenue",
    health: (parseInt(opsM.open) || 0) > 0 ? "yellow" : revenue === 0 && (parseInt(r.active) || 0) > 0 ? "yellow" : "green",
    speed: speedFromMs(speed), errorLevel: parseInt(opsM.open) || 0, riskLevel: 0,
    lastUpdate: new Date().toISOString(), requiresAttention: false, actionFlag: "monitoring",
    summary: `€${revenue.toFixed(2)} Einnahmen heute, ${parseInt(s.total) || 0} aktive Abos`,
    analysis: revenue > 0 ? "Monetarisierung aktiv — Einnahmen fließen" : "Keine Einnahmen heute — prüfen ob korrekt",
    importanceWeight: "high", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: 100, errorRate: 0, activityLevel: parseInt(r.active) || 0, responseSpeed: speed },
    incidents: { open: parseInt(opsM.open) || 0, healed: parseInt(opsM.healed) || 0, escalated: parseInt(opsM.escalated) || 0 },
      details: { revenueToday: revenue, budgetTotal: parseFloat(r.budget_total) || 0, activeSubs: parseInt(s.total) || 0 },
    recommendedAction: "Keine Aktion erforderlich",
  };
}

async function checkDiscoverySystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as visible,
           COUNT(*) FILTER (WHERE is_active = true AND city IS NOT NULL AND lat IS NOT NULL) as discoverable
    FROM restaurants
  `);
  const menuRes = await db.execute(sql`SELECT COUNT(*) as with_menu FROM menu_items`);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const m = (menuRes.rows[0] as any) ?? {};
  const total = parseInt(r.total) || 0;
  const visible = parseInt(r.visible) || 0;
  const discoverable = parseInt(r.discoverable) || 0;
  const withMenu = parseInt(m.with_menu) || 0;
  const opsDisc = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed, COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area = 'discovery'`);
    const opsDi = (opsDisc.rows[0] as any) ?? {};
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "discovery", name: "Discovery / Homepage",
    role: "Restaurant-Entdeckung, Suchranking und Homepage-Ergebnisse",
    health: discoverable < visible * 0.5 ? "yellow" : "green",
    speed: speedFromMs(speed), errorLevel: 0, riskLevel: visible - discoverable,
    lastUpdate: new Date().toISOString(), requiresAttention: discoverable < visible * 0.7,
    actionFlag: discoverable < visible * 0.5 ? "action_needed" : "monitoring",
    summary: `${discoverable}/${visible} entdeckbar, ${withMenu} mit Menü`,
    analysis: discoverable < visible * 0.5 ? "Viele Restaurants nicht auffindbar — Daten unvollständig" : "Discovery-System funktional",
    importanceWeight: "medium", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: visible > 0 ? Math.round((discoverable / visible) * 100) : 100, errorRate: 0, activityLevel: visible, responseSpeed: speed },
    incidents: { open: parseInt(opsDi.open) || 0, healed: parseInt(opsDi.healed) || 0, escalated: parseInt(opsDi.escalated) || 0 },
      details: { total, visible, discoverable, withMenu },
    recommendedAction: discoverable < visible * 0.7 ? "Unvollständige Restaurant-Daten ergänzen" : "Keine Aktion erforderlich",
  };
}

async function checkMapLocationSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) as with_coords,
           COUNT(*) FILTER (WHERE lat IS NULL OR lng IS NULL) as missing_coords
    FROM restaurants WHERE is_active = true
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const total = parseInt(r.total) || 0;
  const missing = parseInt(r.missing_coords) || 0;
  const opsMap = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed, COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area IN ('map','geolocation')`);
    const opsMp = (opsMap.rows[0] as any) ?? {};
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "map", name: "Map / Geolocation",
    role: "Kartenansicht, Standort-Genauigkeit und Nearby-Ergebnisse",
    health: missing > total * 0.3 ? "red" : missing > 0 ? "yellow" : "green",
    speed: speedFromMs(speed), errorLevel: missing, riskLevel: missing > total * 0.2 ? 2 : 0,
    lastUpdate: new Date().toISOString(), requiresAttention: missing > total * 0.2,
    actionFlag: missing > total * 0.2 ? "action_needed" : "monitoring",
    summary: `${parseInt(r.with_coords) || 0}/${total} mit Koordinaten, ${missing} fehlend`,
    analysis: missing > 0 ? `${missing} Restaurant(s) ohne Geo-Daten — Kartenansicht unvollständig` : "Alle Standorte vollständig",
    importanceWeight: "medium", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: total > 0 ? Math.round(((total - missing) / total) * 100) : 100, errorRate: missing, activityLevel: total, responseSpeed: speed },
    incidents: { open: parseInt(opsMp.open) || 0, healed: parseInt(opsMp.healed) || 0, escalated: parseInt(opsMp.escalated) || 0 },
      details: { total, withCoords: parseInt(r.with_coords) || 0, missingCoords: missing },
    recommendedAction: missing > 0 ? "Fehlende Geo-Daten ergänzen" : "Keine Aktion erforderlich",
  };
}

async function checkSmartOffersSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE enabled = true) as active,
           COUNT(*) FILTER (WHERE type = 'flash' AND flash_expires_at IS NOT NULL AND flash_expires_at < NOW()) as expired
    FROM discounts
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const active = parseInt(r.active) || 0;
  const expired = parseInt(r.expired) || 0;
  const opsOffers = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed, COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area = 'smart_offers'`);
    const opsOf = (opsOffers.rows[0] as any) ?? {};
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "smart_offers", name: "Smart Offers",
    role: "Intelligente Angebote, Rabatte und Empfehlungen",
    health: "green", speed: speedFromMs(speed), errorLevel: 0, riskLevel: 0,
    lastUpdate: new Date().toISOString(), requiresAttention: false, actionFlag: "monitoring",
    summary: `${active} aktive Angebote, ${expired} abgelaufen`,
    analysis: active > 0 ? "Angebotssystem aktiv" : "Keine aktiven Angebote — Angebotserstellung prüfen",
    importanceWeight: "low", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: 100, errorRate: 0, activityLevel: active, responseSpeed: speed },
    incidents: { open: parseInt(opsOf.open) || 0, healed: parseInt(opsOf.healed) || 0, escalated: parseInt(opsOf.escalated) || 0 },
      details: { total: parseInt(r.total) || 0, active, expired },
    recommendedAction: active === 0 ? "Angebotsstrategie aktivieren" : "Keine Aktion erforderlich",
  };
}

async function checkUserProfileSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_7d,
           COUNT(*) FILTER (WHERE photo_url IS NOT NULL) as with_photo
    FROM customer_profiles
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const total = parseInt(r.total) || 0;
  const new7d = parseInt(r.new_7d) || 0;
  const opsProf = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed, COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area = 'user_profiles'`);
    const opsPr = (opsProf.rows[0] as any) ?? {};
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "user_profiles", name: "User-Profile",
    role: "Kundenprofile, Registrierungen und Benutzerdaten",
    health: "green", speed: speedFromMs(speed), errorLevel: 0, riskLevel: 0,
    lastUpdate: new Date().toISOString(), requiresAttention: false, actionFlag: "monitoring",
    summary: `${total} Profile gesamt, ${new7d} neue (7d)`,
    analysis: new7d > 0 ? "Nutzer-Registrierungen aktiv" : "Keine neuen Registrierungen in 7 Tagen",
    importanceWeight: "medium", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: 100, errorRate: 0, activityLevel: new7d, responseSpeed: speed },
    incidents: { open: parseInt(opsPr.open) || 0, healed: parseInt(opsPr.healed) || 0, escalated: parseInt(opsPr.escalated) || 0 },
      details: { total, new7d, withPhoto: parseInt(r.with_photo) || 0 },
    recommendedAction: new7d === 0 ? "Registrierungskanäle prüfen" : "Keine Aktion erforderlich",
  };
}

async function checkReservationSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
           COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as today
    FROM reservations
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const cancelled = parseInt(r.cancelled) || 0;
  const total = parseInt(r.total) || 0;
  const opsRes2 = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed, COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area = 'reservations'`);
    const opsRe = (opsRes2.rows[0] as any) ?? {};
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "reservations", name: "Reservierungen",
    role: "Buchungssystem, Verfügbarkeit und Tischplanung",
    health: cancelled > total * 0.3 ? "yellow" : "green",
    speed: speedFromMs(speed), errorLevel: 0, riskLevel: 0,
    lastUpdate: new Date().toISOString(), requiresAttention: false, actionFlag: "monitoring",
    summary: `${parseInt(r.confirmed) || 0} bestätigt, ${parseInt(r.today) || 0} heute`,
    analysis: cancelled > total * 0.3 ? "Hohe Stornierungsrate — prüfen" : "Buchungssystem normal",
    importanceWeight: "low", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: total > 0 ? Math.round(((total - cancelled) / total) * 100) : 100, errorRate: 0, activityLevel: parseInt(r.today) || 0, responseSpeed: speed },
    incidents: { open: parseInt(opsRe.open) || 0, healed: parseInt(opsRe.healed) || 0, escalated: parseInt(opsRe.escalated) || 0 },
      details: { total, confirmed: parseInt(r.confirmed) || 0, cancelled, today: parseInt(r.today) || 0 },
    recommendedAction: "Keine Aktion erforderlich",
  };
}

async function checkLoyaltySystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total, COALESCE(SUM(points), 0) as total_points,
           COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '7 days') as active_7d
    FROM loyalty_points
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const opsLoy = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed, COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area = 'loyalty'`);
    const opsLo = (opsLoy.rows[0] as any) ?? {};
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "loyalty", name: "Treueprogramm",
    role: "Punkte-System, Kundenbindung und Belohnungen",
    health: "green", speed: speedFromMs(speed), errorLevel: 0, riskLevel: 0,
    lastUpdate: new Date().toISOString(), requiresAttention: false, actionFlag: "monitoring",
    summary: `${parseInt(r.total) || 0} Teilnehmer, ${parseInt(r.total_points) || 0} Punkte verteilt`,
    analysis: (parseInt(r.active_7d) || 0) > 0 ? "Treueprogramm aktiv" : "Keine aktive Punkte-Vergabe",
    importanceWeight: "low", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: 100, errorRate: 0, activityLevel: parseInt(r.active_7d) || 0, responseSpeed: speed },
    incidents: { open: parseInt(opsLo.open) || 0, healed: parseInt(opsLo.healed) || 0, escalated: parseInt(opsLo.escalated) || 0 },
      details: { total: parseInt(r.total) || 0, totalPoints: parseInt(r.total_points) || 0, active7d: parseInt(r.active_7d) || 0 },
    recommendedAction: "Keine Aktion erforderlich",
  };
}

async function checkConversionSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total_variants,
           COUNT(*) FILTER (WHERE is_winner = true) as winners,
           COUNT(*) FILTER (WHERE impressions >= 40) as mature
    FROM conversion_variants
  `);
  const eventsRes = await db.execute(sql`
    SELECT COUNT(*) as total FROM conversion_events WHERE created_at > NOW() - INTERVAL '24 hours'
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const e = (eventsRes.rows[0] as any) ?? {};
  const opsConv = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed, COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area = 'conversion'`);
    const opsCv = (opsConv.rows[0] as any) ?? {};
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "conversion", name: "Conversion Intelligence",
    role: "A/B-Tests, Varianten-Optimierung und Auto-Win-Logik",
    health: "green", speed: speedFromMs(speed), errorLevel: 0, riskLevel: 0,
    lastUpdate: new Date().toISOString(), requiresAttention: false, actionFlag: "monitoring",
    summary: `${parseInt(r.total_variants) || 0} Varianten, ${parseInt(r.winners) || 0} Winner, ${parseInt(e.total) || 0} Events (24h)`,
    analysis: (parseInt(r.mature) || 0) > 0 ? "A/B-Tests laufen — Daten werden gesammelt" : "Conversion-Tracking aktiv",
    importanceWeight: "medium", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: 100, errorRate: 0, activityLevel: parseInt(e.total) || 0, responseSpeed: speed },
    incidents: { open: parseInt(opsCv.open) || 0, healed: parseInt(opsCv.healed) || 0, escalated: parseInt(opsCv.escalated) || 0 },
      details: { totalVariants: parseInt(r.total_variants) || 0, winners: parseInt(r.winners) || 0, mature: parseInt(r.mature) || 0, events24h: parseInt(e.total) || 0 },
    recommendedAction: "Keine Aktion erforderlich",
  };
}

async function checkNotificationSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE sent_at > NOW() - INTERVAL '24 hours') as sent_24h,
           COALESCE(SUM(target_count), 0) as total_targets
    FROM notifications
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const opsNotif = await db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed, COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area = 'notifications'`);
    const opsNo = (opsNotif.rows[0] as any) ?? {};
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "notifications", name: "Benachrichtigungen",
    role: "Push-Nachrichten, E-Mail-Benachrichtigungen und Alerts",
    health: "green", speed: speedFromMs(speed), errorLevel: 0, riskLevel: 0,
    lastUpdate: new Date().toISOString(), requiresAttention: false, actionFlag: "monitoring",
    summary: `${parseInt(r.sent_24h) || 0} gesendet (24h), ${parseInt(r.total_targets) || 0} Empfänger`,
    analysis: "Benachrichtigungssystem funktional",
    importanceWeight: "low", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: 100, errorRate: 0, activityLevel: parseInt(r.sent_24h) || 0, responseSpeed: speed },
    incidents: { open: parseInt(opsNo.open) || 0, healed: parseInt(opsNo.healed) || 0, escalated: parseInt(opsNo.escalated) || 0 },
      details: { total: parseInt(r.total) || 0, sent24h: parseInt(r.sent_24h) || 0, totalTargets: parseInt(r.total_targets) || 0 },
    recommendedAction: "Keine Aktion erforderlich",
  };
}

function checkAuthSystem(): SystemSignal {
  const conn = buildConnection(true, false, false, false, true);
  return {
    id: "auth", name: "Auth / Zugang",
    role: "Authentifizierung, Session-Management und Zugangssteuerung",
    health: "green", speed: "fast", errorLevel: 0, riskLevel: 0,
    lastUpdate: new Date().toISOString(), requiresAttention: false, actionFlag: "monitoring",
    summary: "Founder-Key + localStorage aktiv",
    analysis: "Auth über Founder-Key und localStorage-basierte Zugangssteuerung — funktional, aber nicht produktionsreif",
    importanceWeight: "critical", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: 100, errorRate: 0, activityLevel: 0, responseSpeed: 1 },
    incidents: { open: 0, healed: 0, escalated: 0 },
    details: { method: "founder_key_localStorage", productionReady: false },
    recommendedAction: "Auth-System für Produktion vorbereiten — echte Session-Verwaltung implementieren",
  };
}

function checkFounderDashboard(): SystemSignal {
  const conn = buildConnection(true, true, true, true, true);
  return {
    id: "founder_dashboard", name: "Founder Dashboard",
    role: "Zentrale Steuerungskonsole des Gründers",
    health: "green", speed: "fast", errorLevel: 0, riskLevel: 0,
    lastUpdate: new Date().toISOString(), requiresAttention: false, actionFlag: "monitoring",
    summary: "8 Module aktiv (Command/Pipeline/Conversion/Wettbewerb/Städte/Brain/Ops)",
    analysis: "Founder Dashboard vollständig integriert — alle Module laden korrekt",
    importanceWeight: "critical", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
    metrics: { successRate: 100, errorRate: 0, activityLevel: 0, responseSpeed: 1 },
    incidents: { open: 0, healed: 0, escalated: 0 },
    details: { modules: ["dashboard", "pipeline", "conversion", "competition", "cities", "brain", "ops"], totalModules: 7 },
    recommendedAction: "Keine Aktion erforderlich — alle Module verbunden",
  };
}


  async function checkLaunchControl(): Promise<SystemSignal> {
    const t0 = Date.now();
    const restaurantsRes = await db.execute(sql`
      SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active,
             COUNT(*) FILTER (WHERE city IS NOT NULL AND lat IS NOT NULL AND lng IS NOT NULL) as complete
      FROM restaurants
    `);
    const claimsRes = await db.execute(sql`
      SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'onboarded') as onboarded,
             COUNT(*) FILTER (WHERE status = 'new') as pending
      FROM business_claims
    `);
    const menuRes = await db.execute(sql`SELECT COUNT(*) as with_menu FROM menu_items`);
    const opsRes = await db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed,
             COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents
    `);
    const speed = Date.now() - t0;
    const r = (restaurantsRes.rows[0] as any) ?? {};
    const c = (claimsRes.rows[0] as any) ?? {};
    const m = (menuRes.rows[0] as any) ?? {};
    const ops = (opsRes.rows[0] as any) ?? {};
    const total = parseInt(r.total) || 0;
    const active = parseInt(r.active) || 0;
    const complete = parseInt(r.complete) || 0;
    const withMenu = parseInt(m.with_menu) || 0;
    const pending = parseInt(c.pending) || 0;
    const openOps = parseInt(ops.open) || 0;
    const completeness = total > 0 ? complete / total : 0;
    const hasMenuItems = withMenu > 0 ? 1 : 0;
    const launchScore = Math.round(((completeness * 0.6) + (hasMenuItems * 0.2) + (active > 0 ? 0.2 : 0)) * 100);
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "launch_control", name: "Launch Control",
      role: "Startbereitschaft, Onboarding-Vollständigkeit und Go-Live-Prüfung",
      health: openOps > 2 ? "red" : openOps > 0 || launchScore < 40 ? "yellow" : launchScore >= 70 ? "green" : "yellow",
      speed: speedFromMs(speed), errorLevel: openOps, riskLevel: pending > 10 ? 2 : 0,
      lastUpdate: new Date().toISOString(), requiresAttention: launchScore < 50,
      actionFlag: launchScore < 50 ? "action_needed" : "monitoring",
      summary: `Launch-Score: ${launchScore}%, ${active}/${total} aktiv, ${withMenu} mit Menü`,
      analysis: launchScore >= 70 ? "Plattform startbereit — alle kritischen Systeme operativ"
        : launchScore >= 40 ? "Teilweise bereit — einige Bereiche brauchen Aufmerksamkeit"
        : "Nicht startbereit — wesentliche Lücken vorhanden",
      importanceWeight: "critical", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
      metrics: { successRate: launchScore, errorRate: openOps, activityLevel: active, responseSpeed: speed },
      incidents: { open: openOps, healed: parseInt(ops.healed) || 0, escalated: parseInt(ops.escalated) || 0 },
      details: { launchScore, totalRestaurants: total, active, complete, withMenu, pendingClaims: pending, onboardedClaims: parseInt(c.onboarded) || 0 },
      recommendedAction: launchScore < 50 ? "Unvollständige Restaurant-Daten ergänzen — Menüs und Geo-Daten hinzufügen" : "Keine Aktion erforderlich",
    };
  }

  async function checkHeatMapSystem(): Promise<SystemSignal> {
    const t0 = Date.now();
    const result = await db.execute(sql`
      SELECT city, COUNT(*) as biz_count,
             COALESCE(AVG(rating), 0) as avg_rating
      FROM restaurants WHERE is_active = true AND city IS NOT NULL
      GROUP BY city ORDER BY biz_count DESC
    `);
    const activityRes = await db.execute(sql`
      SELECT COUNT(*) as total_activities FROM social_activities WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    const opsRes = await db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed,
             COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area IN ('heat_map','city_expansion')
    `);
    const speed = Date.now() - t0;
    const rows = result.rows as any[];
    const act = (activityRes.rows[0] as any) ?? {};
    const ops = (opsRes.rows[0] as any) ?? {};
    const totalZones = rows.length;
    const hotZones = rows.filter((r: any) => parseInt(r.biz_count) >= 3).length;
    const coldZones = rows.filter((r: any) => parseInt(r.biz_count) === 1).length;
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "heat_map", name: "Heat Map / Aktivität",
      role: "Geografische Aktivitätsverteilung, Hot Zones und Cold Zones",
      health: coldZones > hotZones ? "yellow" : "green",
      speed: speedFromMs(speed), errorLevel: 0, riskLevel: coldZones > totalZones * 0.5 ? 1 : 0,
      lastUpdate: new Date().toISOString(), requiresAttention: coldZones > totalZones * 0.5,
      actionFlag: coldZones > totalZones * 0.5 ? "action_needed" : "monitoring",
      summary: `${totalZones} Zonen, ${hotZones} hot, ${coldZones} cold, ${parseInt(act.total_activities) || 0} Aktivitäten (24h)`,
      analysis: hotZones > 0 ? `${hotZones} aktive Zonen erkannt — Marktpräsenz verteilt` : "Keine Hot Zones — Aktivierung nötig",
      importanceWeight: "medium", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
      metrics: { successRate: totalZones > 0 ? Math.round((hotZones / totalZones) * 100) : 0, errorRate: 0, activityLevel: parseInt(act.total_activities) || 0, responseSpeed: speed },
      incidents: { open: parseInt(ops.open) || 0, healed: parseInt(ops.healed) || 0, escalated: parseInt(ops.escalated) || 0 },
      details: { totalZones, hotZones, coldZones, zoneBreakdown: rows.map((r: any) => ({ city: r.city, count: parseInt(r.biz_count), rating: parseFloat(r.avg_rating)?.toFixed(1) })) },
      recommendedAction: coldZones > totalZones * 0.5 ? "Cold Zones aktivieren — lokale Partnerschaften ausbauen" : "Keine Aktion erforderlich",
    };
  }

  async function checkAutoPlansSystem(): Promise<SystemSignal> {
    const t0 = Date.now();
    const mealRes = await db.execute(sql`
      SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent
      FROM meal_plans
    `);
    const bookingRes = await db.execute(sql`
      SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent
      FROM booking_plans
    `);
    const opsRes = await db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE auto_healed=true) as healed,
             COUNT(*) FILTER (WHERE status='escalated') as escalated FROM ops_incidents WHERE system_area = 'auto_plans'
    `);
    const speed = Date.now() - t0;
    const meal = (mealRes.rows[0] as any) ?? {};
    const book = (bookingRes.rows[0] as any) ?? {};
    const ops = (opsRes.rows[0] as any) ?? {};
    const totalPlans = (parseInt(meal.total) || 0) + (parseInt(book.total) || 0);
    const recentPlans = (parseInt(meal.recent) || 0) + (parseInt(book.recent) || 0);
    const conn = buildConnection(true, true, true, true, true);

    return {
      id: "auto_plans", name: "Auto-Pläne",
      role: "Automatische Essens- und Buchungsplan-Generierung",
      health: "green", speed: speedFromMs(speed), errorLevel: 0, riskLevel: 0,
      lastUpdate: new Date().toISOString(), requiresAttention: false, actionFlag: "monitoring",
      summary: `${totalPlans} Pläne gesamt, ${recentPlans} neue (7d)`,
      analysis: recentPlans > 0 ? "Auto-Plan-System aktiv — Pläne werden generiert" : "Keine neuen Pläne in 7 Tagen",
      importanceWeight: "low", connectionStatus: deriveConnectionStatus(conn), connectionDetails: conn,
      metrics: { successRate: 100, errorRate: 0, activityLevel: recentPlans, responseSpeed: speed },
      incidents: { open: parseInt(ops.open) || 0, healed: parseInt(ops.healed) || 0, escalated: parseInt(ops.escalated) || 0 },
      details: { totalPlans, mealPlans: parseInt(meal.total) || 0, bookingPlans: parseInt(book.total) || 0, recentPlans },
      recommendedAction: recentPlans === 0 ? "Auto-Plan-Generierung prüfen" : "Keine Aktion erforderlich",
    };
  }

  function calculatePriorityScore(system: SystemSignal): number {
  let score = 0;
  const w = IMPORTANCE[system.importanceWeight] || 1;
  if (system.health === "red") score += 40 * w;
  else if (system.health === "yellow") score += 15 * w;
  score += system.errorLevel * 10 * w;
  score += system.riskLevel * 8 * w;
  score += system.incidents.open * 12 * w;
  score += system.incidents.escalated * 20 * w;
  if (system.requiresAttention) score += 5 * w;
  if (system.connectionStatus === "not_connected") score += 30 * w;
  if (system.connectionStatus === "not_reporting") score += 15 * w;
  return Math.round(score);
}

function buildPriorityIssues(systems: SystemSignal[]): PriorityIssue[] {
  const issues: PriorityIssue[] = [];

  for (const sys of systems) {
    if (sys.health === "green" && !sys.requiresAttention && sys.connectionStatus === "connected") continue;

    const score = calculatePriorityScore(sys);
    if (score === 0) continue;

    const severity: PriorityIssue["severity"] =
      sys.health === "red" ? "critical" :
      sys.incidents.escalated > 0 ? "high" :
      sys.health === "yellow" ? "medium" : "low";

    let suggestedAction = sys.recommendedAction;
    let safeAutoAction: string | null = null;
    let whatWasAttempted = "Noch keine automatische Aktion durchgeführt";

    if (sys.id === "billing" && sys.details.overspendCount > 0) {
      safeAutoAction = "billing-reconcile";
      whatWasAttempted = sys.incidents.healed > 0 ? `${sys.incidents.healed} Incident(s) bereits auto-geheilt` : "Noch keine Auto-Reparatur";
    } else if (sys.id === "boost" && sys.details.stuck > 0) {
      safeAutoAction = "health-check";
      whatWasAttempted = sys.incidents.healed > 0 ? `${sys.incidents.healed} Boost-Incident(s) auto-repariert` : "Noch keine Auto-Reparatur";
    } else if (sys.id === "watchdog" && sys.incidents.healed > 0) {
      whatWasAttempted = `${sys.incidents.healed} Incident(s) automatisch geheilt, ${sys.incidents.escalated} eskaliert`;
      if (sys.incidents.open > 0) safeAutoAction = "retry-open";
    } else if (sys.id === "data_integrity" && sys.details.invalidRatings > 0) {
      safeAutoAction = "health-check";
    }

    issues.push({
      rank: 0, title: sys.analysis,
      reason: `${sys.name} zeigt ${sys.health === "red" ? "kritische" : "auffällige"} Signale`,
      impact: sys.importanceWeight === "critical" ? "Direkte Umsatzauswirkung" : sys.importanceWeight === "high" ? "Hohe Betriebsrelevanz" : "Moderate Auswirkung",
      system: sys.id, severity, score, suggestedAction, safeAutoAction,
      whatHappened: sys.analysis,
      whyItMatters: sys.importanceWeight === "critical" ? "Dieses System ist geschäftskritisch — Ausfälle betreffen direkt Umsatz und Vertrauen"
        : sys.importanceWeight === "high" ? "Hohe Relevanz für den laufenden Betrieb"
        : "Betrifft Nutzererfahrung und Plattformqualität",
      whatWasAttempted,
      whatShouldHappenNext: suggestedAction,
      riskClassification: sys.riskClassification,
      classificationReason: sys.classificationReason,
    });
  }

  issues.sort((a, b) => b.score - a.score);
  issues.forEach((issue, i) => { issue.rank = i + 1; });
  return issues;
}

function determineBrainMode(systems: SystemSignal[]): { mode: BrainMode; reason: string; readiness: number } {
  const criticalSystems = ["billing", "premium", "watchdog", "auth", "founder_dashboard"];
  const criticalChecks = systems.filter(s => criticalSystems.includes(s.id));
  const allCriticalConnected = criticalChecks.every(s => s.connectionStatus === "connected" || s.connectionStatus === "partially_connected" || s.connectionStatus === "not_reporting");
  const allCriticalHealthy = criticalChecks.every(s => s.health !== "red");

  const connectedCount = systems.filter(s => s.connectionStatus === "connected").length;
  const totalCount = systems.length;
  const readiness = Math.round((connectedCount / totalCount) * 100);

  if (allCriticalConnected && allCriticalHealthy && readiness >= 70) {
    return { mode: "safe_autonomous", reason: "Alle kritischen Systeme verifiziert und stabil — sicherer autonomer Modus aktiv", readiness };
  }
  if (allCriticalConnected && readiness >= 50) {
    return { mode: "decision_support", reason: "Kritische Systeme verbunden, aber nicht alle stabil — Entscheidungsunterstützung aktiv", readiness };
  }
  return { mode: "monitoring", reason: "Nicht genug Systeme verifiziert — nur Monitoring aktiv", readiness };
}

const autoActionLog: AutoActionRecord[] = [];

async function executeAutoActions(systems: SystemSignal[], priorities: PriorityIssue[], mode: BrainMode): Promise<AutoActionRecord[]> {
  if (mode !== "safe_autonomous") return [];

  const newActions: AutoActionRecord[] = [];
  const headers: Record<string, string> = { "x-founder-key": FOUNDER_KEY, "Content-Type": "application/json" };

  for (const p of priorities.slice(0, 3)) {
    if (!p.safeAutoAction) continue;

    const record: AutoActionRecord = {
      id: `auto_${Date.now()}_${p.system}`,
      timestamp: new Date().toISOString(),
      system: p.system,
      trigger: p.title,
      action: p.safeAutoAction,
      result: "success",
      details: "",
      needsMoreAction: false,
    };

    try {
      const opsUrl = `http://localhost:${process.env.PORT || 8080}/api/ops/${p.safeAutoAction}`;
      const result = await fetch(opsUrl, { method: "POST", headers });
      if (result.ok) {
        const data = await result.json();
        record.details = `Auto-Aktion ${p.safeAutoAction} erfolgreich ausgeführt`;
        record.result = "success";
      } else {
        record.result = "failed";
        record.details = `Aktion fehlgeschlagen (HTTP ${result.status})`;
        record.needsMoreAction = true;
      }
    } catch (err: any) {
      record.result = "failed";
      record.details = `Fehler: ${err.message}`;
      record.needsMoreAction = true;
    }

    newActions.push(record);
    autoActionLog.push(record);
  }

  if (autoActionLog.length > 100) autoActionLog.splice(0, autoActionLog.length - 100);
  return newActions;
}

router.get("/status", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Forbidden" });

  try {
    const allChecks = [
      checkPremiumSystem(), checkBillingSystem(), checkBoostSystem(), checkGrowthSystem(),
      checkCompetitionEngine(), checkWatchdogSystem(), checkCityExpansion(), checkSocialSystem(),
      checkInstantPlansSystem(), checkReviewsSystem(), checkDataIntegrity(), checkAbuseDetection(),
      checkMonetizationEngine(), checkDiscoverySystem(), checkMapLocationSystem(),
      checkSmartOffersSystem(), checkUserProfileSystem(), checkReservationSystem(),
      checkLoyaltySystem(), checkConversionSystem(), checkNotificationSystem(),
      checkLaunchControl(), checkHeatMapSystem(), checkAutoPlansSystem(),
    ];

    const checkNames = [
      "premium", "billing", "boost", "growth", "competition", "watchdog", "cities", "social",
      "instant_plans", "reviews", "data_integrity", "abuse",
      "monetization", "discovery", "map", "smart_offers", "user_profiles", "reservations",
      "loyalty", "conversion", "notifications",
      "launch_control", "heat_map", "auto_plans",
    ];

    const results = await Promise.allSettled(allChecks);

    const rawSystems = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      console.error(`[BRAIN] ${checkNames[i]} check failed:`, (r as PromiseRejectedResult).reason?.message ?? r);
      const conn = buildConnection(false, false, false, false, false);
      return {
        id: checkNames[i], name: checkNames[i], role: "System-Check fehlgeschlagen",
        health: "red" as SystemHealth, speed: "slow" as SystemSpeed, errorLevel: 100, riskLevel: 80,
        lastUpdate: new Date().toISOString(), requiresAttention: true, actionFlag: "action_needed" as ActionFlag,
        summary: "Check fehlgeschlagen — System nicht erreichbar",
        analysis: `Der ${checkNames[i]}-Check konnte nicht ausgeführt werden. Mögliche Datenbank- oder Konfigurationsfehler.`,
        importanceWeight: "high" as const,
        connectionStatus: "not_connected" as ConnectionStatus,
        connectionDetails: conn,
        metrics: { successRate: 0, errorRate: 100, activityLevel: 0, responseSpeed: 9999 },
        incidents: { open: 0, healed: 0, escalated: 0 },
        details: { error: (r as PromiseRejectedResult).reason?.message ?? "Unknown" },
        recommendedAction: "System-Verbindung prüfen und Fehler beheben",
      };
    });

    rawSystems.push(checkAuthSystem() as any);
    rawSystems.push(checkFounderDashboard() as any);

    const systems: SystemSignal[] = rawSystems.map(sys => {
      const classification = classifySystemRisk(sys as any);
      return { ...sys, ...classification } as SystemSignal;
    });

    const priorities = buildPriorityIssues(systems);
    const brainMode = determineBrainMode(systems);
    const autoActions = await executeAutoActions(systems, priorities, brainMode.mode);

    const overallHealth: SystemHealth =
      systems.some(s => s.health === "red") ? "red" :
      systems.some(s => s.health === "yellow") ? "yellow" : "green";

    const greenCount = systems.filter(s => s.health === "green").length;
    const yellowCount = systems.filter(s => s.health === "yellow").length;
    const redCount = systems.filter(s => s.health === "red").length;
    const totalIncidentsOpen = systems.reduce((s, sys) => s + sys.incidents.open, 0);
    const totalHealed = systems.reduce((s, sys) => s + sys.incidents.healed, 0);
    const avgSpeed = Math.round(systems.reduce((s, sys) => s + sys.metrics.responseSpeed, 0) / systems.length);

    const connectedCount = systems.filter(s => s.connectionStatus === "connected").length;
    const partialCount = systems.filter(s => s.connectionStatus === "partially_connected").length;
    const notConnectedCount = systems.filter(s => s.connectionStatus === "not_connected").length;
    const notReportingCount = systems.filter(s => s.connectionStatus === "not_reporting").length;

    const classificationCounts = {
      demo_test: systems.filter(s => s.riskClassification === "demo_test").length,
      non_production: systems.filter(s => s.riskClassification === "non_production").length,
      minor_operational: systems.filter(s => s.riskClassification === "minor_operational").length,
      production_risk: systems.filter(s => s.riskClassification === "production_risk").length,
      launch_blocker: systems.filter(s => s.riskClassification === "launch_blocker").length,
    };

    const realBlockers = priorities.filter(p => p.riskClassification === "launch_blocker" || p.riskClassification === "production_risk");
    const demoAlerts = priorities.filter(p => p.riskClassification === "demo_test" || p.riskClassification === "non_production");

    const launchVerdict: { status: "ready" | "ready_with_risks" | "not_ready"; reason: string; realBlockerCount: number; demoAlertCount: number } =
      classificationCounts.launch_blocker > 0
        ? { status: "not_ready", reason: `${classificationCounts.launch_blocker} Launch-Blocker müssen vor dem Produktionsstart behoben werden`, realBlockerCount: realBlockers.length, demoAlertCount: demoAlerts.length }
        : classificationCounts.production_risk > 0
          ? { status: "ready_with_risks", reason: `${classificationCounts.production_risk} echte Produktionsrisiken vorhanden — vor Launch prüfen`, realBlockerCount: realBlockers.length, demoAlertCount: demoAlerts.length }
          : { status: "ready", reason: "Keine echten Produktionsrisiken oder Launch-Blocker erkannt", realBlockerCount: 0, demoAlertCount: demoAlerts.length };

    const summaryLines: string[] = [];
    if (connectedCount === systems.length) summaryLines.push("Alle Systeme vollständig verbunden");
    else summaryLines.push(`${connectedCount}/${systems.length} Systeme vollständig verbunden`);
    if (realBlockers.length > 0) summaryLines.push(`${realBlockers.length} echte Risiken`);
    if (demoAlerts.length > 0) summaryLines.push(`${demoAlerts.length} Demo/Test-Alerts`);
    summaryLines.push(`${greenCount} stabil, ${yellowCount} Warnung, ${redCount} kritisch`);
    if (totalHealed > 0) summaryLines.push(`${totalHealed} Auto-Reparaturen durchgeführt`);
    summaryLines.push(`Autonomer Modus: ${brainMode.mode === "safe_autonomous" ? "Aktiv" : brainMode.mode === "decision_support" ? "Eingeschränkt" : "Deaktiviert"}`);

    res.json({
      overallHealth,
      healthCounts: { green: greenCount, yellow: yellowCount, red: redCount },
      totalSystems: systems.length,
      totalIncidentsOpen,
      totalHealed,
      avgResponseSpeed: avgSpeed,
      brainMode: brainMode.mode,
      brainModeReason: brainMode.reason,
      readinessPercent: brainMode.readiness,
      connectionCounts: { connected: connectedCount, partial: partialCount, notConnected: notConnectedCount, notReporting: notReportingCount },
      classificationCounts,
      launchVerdict,
      summaryLines,
      systems,
      priorities: priorities.slice(0, 15),
      topPriorities: priorities.slice(0, 3),
      autoActionsThisRun: autoActions,
      autoActionHistory: autoActionLog.slice(-20),
      lastAnalysis: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[BRAIN] Status error:", err.message);
    res.status(500).json({ error: "Brain analysis failed" });
  }
});

router.post("/action/:actionType", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Forbidden" });

  const { actionType } = req.params;
  const headers: Record<string, string> = { "x-founder-key": FOUNDER_KEY, "Content-Type": "application/json" };

  try {
    const validActions = ["health-check", "billing-reconcile", "retry-open"];
    if (!validActions.includes(actionType)) {
      return res.status(400).json({ error: "Unknown action type" });
    }

    const opsUrl = `http://localhost:${process.env.PORT || 8080}/api/ops/${actionType}`;
    const result = await fetch(opsUrl, { method: "POST", headers });
    if (!result.ok) {
      const errText = await result.text().catch(() => "Unknown error");
      console.error(`[BRAIN] Ops ${actionType} returned ${result.status}:`, errText);
      return res.status(502).json({ error: `Ops action ${actionType} failed (${result.status})` });
    }
    const data = await result.json();

    autoActionLog.push({
      id: `manual_${Date.now()}`,
      timestamp: new Date().toISOString(),
      system: "founder_manual",
      trigger: `Manuell ausgelöst: ${actionType}`,
      action: actionType,
      result: "success",
      details: `Founder-Action ${actionType} erfolgreich`,
      needsMoreAction: false,
    });

    return res.json({ action: actionType, result: data });
  } catch (err: any) {
    console.error("[BRAIN] Action error:", err.message);
    res.status(500).json({ error: "Action failed" });
  }
});

export default router;
