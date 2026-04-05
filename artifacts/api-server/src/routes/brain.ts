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
  metrics: {
    successRate: number;
    errorRate: number;
    activityLevel: number;
    responseSpeed: number;
  };
  incidents: { open: number; healed: number; escalated: number };
  details: Record<string, any>;
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
}

const IMPORTANCE: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

async function checkPremiumSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_active = true) as active,
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

  const healthScore = inactive > total * 0.3 ? "red" : inactive > total * 0.1 ? "yellow" : "green";

  return {
    id: "premium",
    name: "Premium-System",
    role: "Verwaltung der Premium-Abonnements und Zugangsrechte",
    health: healthScore as SystemHealth,
    speed: speed < 100 ? "fast" : speed < 500 ? "normal" : "slow",
    errorLevel: parseInt(ops.open) || 0,
    riskLevel: parseInt(ops.escalated) || 0,
    lastUpdate: new Date().toISOString(),
    requiresAttention: (parseInt(ops.open) || 0) > 0,
    actionFlag: (parseInt(ops.open) || 0) > 0 ? "action_needed" : "monitoring",
    summary: `${active} aktive Restaurants, ${inactive} inaktiv`,
    analysis: inactive > total * 0.3
      ? "Hohe Inaktivierungsrate — möglicherweise Churn-Problem"
      : inactive > total * 0.1
      ? "Moderate Inaktivierungen — beobachten"
      : "System stabil",
    importanceWeight: "critical",
    metrics: {
      successRate: total > 0 ? Math.round((active / total) * 100) : 100,
      errorRate: parseInt(ops.open) || 0,
      activityLevel: parseInt(r.new_7d) || 0,
      responseSpeed: speed,
    },
    incidents: { open: parseInt(ops.open) || 0, healed: parseInt(ops.healed) || 0, escalated: parseInt(ops.escalated) || 0 },
    details: { total, active, inactive, new7d: parseInt(r.new_7d) || 0 },
  };
}

async function checkBillingSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'active') as active,
      COALESCE(SUM(spent_today), 0) as total_spend,
      COALESCE(SUM(daily_budget), 0) as total_budget,
      COUNT(*) FILTER (WHERE spent_today > daily_budget AND daily_budget > 0) as overspend
    FROM promotions
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const overspend = parseInt(r.overspend) || 0;

  const opsRes = await db.execute(sql`
    SELECT COUNT(*) FILTER (WHERE status='open') as open,
           COUNT(*) FILTER (WHERE auto_healed=true) as healed,
           COUNT(*) FILTER (WHERE status='escalated') as escalated
    FROM ops_incidents WHERE system_area IN ('billing_integrity', 'billing_reconciliation')
  `);
  const ops = (opsRes.rows[0] as any) ?? {};
  const openOps = parseInt(ops.open) || 0;

  const health: SystemHealth = openOps > 2 || overspend > 3 ? "red" : openOps > 0 || overspend > 0 ? "yellow" : "green";

  return {
    id: "billing",
    name: "Billing / Zahlungen",
    role: "Abrechnungssystem, Budget-Kontrolle und Zahlungsabgleich",
    health,
    speed: speed < 100 ? "fast" : speed < 500 ? "normal" : "slow",
    errorLevel: openOps,
    riskLevel: overspend,
    lastUpdate: new Date().toISOString(),
    requiresAttention: health !== "green",
    actionFlag: openOps > 0 ? "action_needed" : overspend > 0 ? "monitoring" : "monitoring",
    summary: `${parseInt(r.active) || 0} aktive Kampagnen, €${parseFloat(r.total_spend).toFixed(2)} Ausgaben heute`,
    analysis: overspend > 0
      ? `${overspend} Kampagne(n) über Budget — Billing-Risiko`
      : openOps > 0
      ? "Offene Billing-Incidents vorhanden"
      : "Abrechnungssystem stabil",
    importanceWeight: "critical",
    metrics: {
      successRate: (parseInt(r.total) || 0) > 0 ? Math.round((1 - overspend / parseInt(r.total)) * 100) : 100,
      errorRate: openOps,
      activityLevel: parseInt(r.active) || 0,
      responseSpeed: speed,
    },
    incidents: { open: openOps, healed: parseInt(ops.healed) || 0, escalated: parseInt(ops.escalated) || 0 },
    details: {
      totalCampaigns: parseInt(r.total) || 0,
      activeCampaigns: parseInt(r.active) || 0,
      totalSpend: parseFloat(r.total_spend) || 0,
      totalBudget: parseFloat(r.total_budget) || 0,
      overspendCount: overspend,
    },
  };
}

async function checkBoostSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active') as active_boosts,
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
    SELECT COUNT(*) FILTER (WHERE status='open') as open,
           COUNT(*) FILTER (WHERE auto_healed=true) as healed,
           COUNT(*) FILTER (WHERE status='escalated') as escalated
    FROM ops_incidents WHERE system_area IN ('boost_delivery', 'boost_integrity')
  `);
  const ops = (opsRes.rows[0] as any) ?? {};
  const openOps = parseInt(ops.open) || 0;

  const health: SystemHealth = stuck > 2 || openOps > 2 ? "red" : stuck > 0 || openOps > 0 ? "yellow" : "green";

  return {
    id: "boost",
    name: "Boost / Werbesystem",
    role: "Verwaltung und Auslieferung von Boost-Kampagnen",
    health,
    speed: speed < 100 ? "fast" : speed < 500 ? "normal" : "slow",
    errorLevel: openOps,
    riskLevel: stuck,
    lastUpdate: new Date().toISOString(),
    requiresAttention: stuck > 0 || openOps > 0,
    actionFlag: stuck > 0 ? "action_needed" : openOps > 0 ? "auto_handled" : "monitoring",
    summary: `${activeBoosts} aktive Boosts, ${parseInt(r.total_impressions) || 0} Impressionen`,
    analysis: stuck > 0
      ? `${stuck} Boost(s) ohne Impressionen — Delivery-Problem`
      : "Boost-Auslieferung normal",
    importanceWeight: "high",
    metrics: {
      successRate: activeBoosts > 0 ? Math.round(((activeBoosts - stuck) / activeBoosts) * 100) : 100,
      errorRate: stuck,
      activityLevel: activeBoosts,
      responseSpeed: speed,
    },
    incidents: { open: openOps, healed: parseInt(ops.healed) || 0, escalated: parseInt(ops.escalated) || 0 },
    details: {
      activeBoosts,
      stuck,
      totalImpressions: parseInt(r.total_impressions) || 0,
      totalClicks: parseInt(r.total_clicks) || 0,
    },
  };
}

async function checkGrowthSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total_claims,
      COUNT(*) FILTER (WHERE status = 'new') as new_claims,
      COUNT(*) FILTER (WHERE status = 'onboarded') as onboarded,
      COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as claims_7d
    FROM business_claims
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const newClaims = parseInt(r.new_claims) || 0;
  const claims7d = parseInt(r.claims_7d) || 0;

  const health: SystemHealth = claims7d === 0 ? "yellow" : "green";

  return {
    id: "growth",
    name: "Growth / Self-Serve",
    role: "Business-Onboarding, Self-Serve-Pipeline und Wachstumsmotor",
    health,
    speed: speed < 100 ? "fast" : speed < 500 ? "normal" : "slow",
    errorLevel: 0,
    riskLevel: claims7d === 0 ? 1 : 0,
    lastUpdate: new Date().toISOString(),
    requiresAttention: newClaims > 5,
    actionFlag: newClaims > 5 ? "action_needed" : "monitoring",
    summary: `${newClaims} neue Claims, ${parseInt(r.onboarded) || 0} onboarded`,
    analysis: claims7d === 0
      ? "Keine neuen Claims in 7 Tagen — Wachstum stagniert"
      : newClaims > 10
      ? "Viele offene Claims — Pipeline-Kapazität prüfen"
      : "Wachstumspipeline aktiv",
    importanceWeight: "medium",
    metrics: {
      successRate: (parseInt(r.total_claims) || 0) > 0 ? Math.round((parseInt(r.onboarded) || 0) / parseInt(r.total_claims) * 100) : 0,
      errorRate: 0,
      activityLevel: claims7d,
      responseSpeed: speed,
    },
    incidents: { open: 0, healed: 0, escalated: 0 },
    details: {
      totalClaims: parseInt(r.total_claims) || 0,
      newClaims,
      onboarded: parseInt(r.onboarded) || 0,
      rejected: parseInt(r.rejected) || 0,
      claims7d,
    },
  };
}

async function checkSocialSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total_activities,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as activities_24h
    FROM social_activities
  `);
  const friendRes = await db.execute(sql`
    SELECT COUNT(*) as total FROM friendships WHERE status = 'accepted'
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const fr = (friendRes.rows[0] as any) ?? {};
  const activities24h = parseInt(r.activities_24h) || 0;

  return {
    id: "social",
    name: "Social / Freunde",
    role: "Soziales Netzwerk, Freundschaften und Gruppen-Features",
    health: "green",
    speed: speed < 100 ? "fast" : speed < 500 ? "normal" : "slow",
    errorLevel: 0,
    riskLevel: 0,
    lastUpdate: new Date().toISOString(),
    requiresAttention: false,
    actionFlag: "monitoring",
    summary: `${parseInt(fr.total) || 0} Freundschaften, ${activities24h} Aktivitäten (24h)`,
    analysis: activities24h === 0
      ? "Keine soziale Aktivität in 24h — Engagement niedrig"
      : "Social-System aktiv",
    importanceWeight: "medium",
    metrics: {
      successRate: 100,
      errorRate: 0,
      activityLevel: activities24h,
      responseSpeed: speed,
    },
    incidents: { open: 0, healed: 0, escalated: 0 },
    details: {
      totalActivities: parseInt(r.total_activities) || 0,
      activities24h,
      totalFriendships: parseInt(fr.total) || 0,
    },
  };
}

async function checkInstantPlansSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'open') as open_plans,
      COUNT(*) FILTER (WHERE status = 'joined') as joined,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as plans_24h
    FROM instant_plans
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};

  return {
    id: "instant_plans",
    name: "Instant / Auto-Pläne",
    role: "Spontane Treffpunkt-Planung und Gruppen-Koordination",
    health: "green",
    speed: speed < 100 ? "fast" : speed < 500 ? "normal" : "slow",
    errorLevel: 0,
    riskLevel: 0,
    lastUpdate: new Date().toISOString(),
    requiresAttention: false,
    actionFlag: "monitoring",
    summary: `${parseInt(r.open_plans) || 0} offene Pläne, ${parseInt(r.plans_24h) || 0} heute`,
    analysis: "Instant-Plan-System aktiv",
    importanceWeight: "low",
    metrics: {
      successRate: 100,
      errorRate: 0,
      activityLevel: parseInt(r.plans_24h) || 0,
      responseSpeed: speed,
    },
    incidents: { open: 0, healed: 0, escalated: 0 },
    details: {
      total: parseInt(r.total) || 0,
      openPlans: parseInt(r.open_plans) || 0,
      joined: parseInt(r.joined) || 0,
      plans24h: parseInt(r.plans_24h) || 0,
    },
  };
}

async function checkCompetitionEngine(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      AVG(rating) as avg_rating,
      COUNT(*) FILTER (WHERE is_active = true) as active
    FROM restaurants
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};

  return {
    id: "competition",
    name: "Competition Engine",
    role: "Wettbewerbsanalyse, Sichtbarkeit und Marktpositionierung",
    health: "green",
    speed: speed < 100 ? "fast" : speed < 500 ? "normal" : "slow",
    errorLevel: 0,
    riskLevel: 0,
    lastUpdate: new Date().toISOString(),
    requiresAttention: false,
    actionFlag: "monitoring",
    summary: `${parseInt(r.active) || 0} aktive Restaurants, Ø ${parseFloat(r.avg_rating)?.toFixed(1) || "0"} Rating`,
    analysis: "Wettbewerbsdaten aktuell",
    importanceWeight: "medium",
    metrics: {
      successRate: 100,
      errorRate: 0,
      activityLevel: parseInt(r.active) || 0,
      responseSpeed: speed,
    },
    incidents: { open: 0, healed: 0, escalated: 0 },
    details: {
      total: parseInt(r.total) || 0,
      active: parseInt(r.active) || 0,
      avgRating: parseFloat(r.avg_rating) || 0,
    },
  };
}

async function checkWatchdogSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'open') as open,
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

  return {
    id: "watchdog",
    name: "Watchdog / Self-Healing",
    role: "Automatische Plattform-Überwachung, Erkennung und Selbstheilung",
    health,
    speed: speed < 100 ? "fast" : speed < 500 ? "normal" : "slow",
    errorLevel: openInc,
    riskLevel: escalated,
    lastUpdate: new Date().toISOString(),
    requiresAttention: criticalOpen > 0 || escalated > 0,
    actionFlag: openInc > 0 ? "action_needed" : parseInt(r.healed) || 0 > 0 ? "auto_handled" : "monitoring",
    summary: `${openInc} offen, ${parseInt(r.healed) || 0} auto-geheilt, ${escalated} eskaliert`,
    analysis: criticalOpen > 0
      ? `${criticalOpen} kritische(r) Incident(s) offen — sofortige Aufmerksamkeit`
      : escalated > 0
      ? `${escalated} eskalierte(r) Incident(s) — Retry ausgeschöpft`
      : openInc > 0
      ? `${openInc} offene Incidents — Monitoring aktiv`
      : `Alle Incidents gelöst — System stabil`,
    importanceWeight: "high",
    metrics: {
      successRate: (parseInt(r.total) || 0) > 0 ? Math.round((parseInt(r.healed) || 0) / parseInt(r.total) * 100) : 100,
      errorRate: openInc,
      activityLevel: parseInt(r.total) || 0,
      responseSpeed: speed,
    },
    incidents: { open: openInc, healed: parseInt(r.healed) || 0, escalated },
    details: {
      total: parseInt(r.total) || 0,
      open: openInc,
      escalated,
      healed: parseInt(r.healed) || 0,
      reviewNeeded: parseInt(r.review_needed) || 0,
      criticalOpen,
      highOpen: parseInt(r.high_open) || 0,
    },
  };
}

async function checkCityExpansion(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT city, COUNT(*) as count
    FROM restaurants
    WHERE is_active = true
    GROUP BY city
    ORDER BY count DESC
  `);
  const speed = Date.now() - t0;
  const rows = result.rows as any[];
  const totalCities = rows.length;
  const totalBiz = rows.reduce((s: number, r: any) => s + parseInt(r.count), 0);

  return {
    id: "cities",
    name: "City Expansion",
    role: "Städte-Expansion, Markterschließung und regionale Penetration",
    health: totalCities >= 3 ? "green" : "yellow",
    speed: speed < 100 ? "fast" : speed < 500 ? "normal" : "slow",
    errorLevel: 0,
    riskLevel: 0,
    lastUpdate: new Date().toISOString(),
    requiresAttention: false,
    actionFlag: "monitoring",
    summary: `${totalCities} Städte aktiv, ${totalBiz} Betriebe gesamt`,
    analysis: totalCities >= 5
      ? "Multi-City-Expansion läuft erfolgreich"
      : totalCities >= 3
      ? "Gute Stadtabdeckung — weitere Expansion möglich"
      : "Wenige Städte aktiv — Expansionspotenzial",
    importanceWeight: "medium",
    metrics: {
      successRate: 100,
      errorRate: 0,
      activityLevel: totalCities,
      responseSpeed: speed,
    },
    incidents: { open: 0, healed: 0, escalated: 0 },
    details: {
      totalCities,
      totalBiz,
      breakdown: rows.map((r: any) => ({ city: r.city, count: parseInt(r.count) })),
    },
  };
}

async function checkReviewsSystem(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      AVG(rating) as avg_rating,
      COUNT(*) FILTER (WHERE rating <= 2) as negative,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent
    FROM reviews
  `);
  const speed = Date.now() - t0;
  const r = (result.rows[0] as any) ?? {};
  const negative = parseInt(r.negative) || 0;
  const total = parseInt(r.total) || 0;

  return {
    id: "reviews",
    name: "Reviews / Reputation",
    role: "Kundenbewertungen, Reputationsmanagement und Feedback",
    health: negative > total * 0.3 ? "red" : negative > total * 0.1 ? "yellow" : "green",
    speed: speed < 100 ? "fast" : speed < 500 ? "normal" : "slow",
    errorLevel: 0,
    riskLevel: negative > total * 0.2 ? 2 : 0,
    lastUpdate: new Date().toISOString(),
    requiresAttention: negative > total * 0.2,
    actionFlag: "monitoring",
    summary: `${total} Bewertungen, Ø ${parseFloat(r.avg_rating)?.toFixed(1) || "0"}`,
    analysis: negative > total * 0.2
      ? "Hohe Rate negativer Bewertungen — Reputationsrisiko"
      : "Bewertungsprofil gesund",
    importanceWeight: "medium",
    metrics: {
      successRate: total > 0 ? Math.round(((total - negative) / total) * 100) : 100,
      errorRate: 0,
      activityLevel: parseInt(r.recent) || 0,
      responseSpeed: speed,
    },
    incidents: { open: 0, healed: 0, escalated: 0 },
    details: {
      total,
      avgRating: parseFloat(r.avg_rating) || 0,
      negative,
      recent: parseInt(r.recent) || 0,
    },
  };
}

async function checkDataIntegrity(): Promise<SystemSignal> {
  const t0 = Date.now();
  const badRatings = await db.execute(sql`
    SELECT COUNT(*) as count FROM restaurants WHERE rating < 1 OR rating > 5
  `);
  const opsRes = await db.execute(sql`
    SELECT COUNT(*) FILTER (WHERE status='open') as open,
           COUNT(*) FILTER (WHERE auto_healed=true) as healed,
           COUNT(*) FILTER (WHERE status='escalated') as escalated
    FROM ops_incidents WHERE system_area IN ('data_integrity', 'platform_consistency')
  `);
  const speed = Date.now() - t0;
  const bad = parseInt((badRatings.rows[0] as any)?.count) || 0;
  const ops = (opsRes.rows[0] as any) ?? {};
  const openOps = parseInt(ops.open) || 0;

  return {
    id: "data_integrity",
    name: "Datenintegrität",
    role: "Überwachung der Datenkonsistenz und Plattform-Validierung",
    health: bad > 0 || openOps > 0 ? "yellow" : "green",
    speed: speed < 100 ? "fast" : speed < 500 ? "normal" : "slow",
    errorLevel: bad + openOps,
    riskLevel: bad,
    lastUpdate: new Date().toISOString(),
    requiresAttention: bad > 0,
    actionFlag: bad > 0 ? "action_needed" : openOps > 0 ? "auto_handled" : "monitoring",
    summary: `${bad} Datenfehler erkannt`,
    analysis: bad > 0
      ? `${bad} ungültige Datensätze gefunden`
      : "Datenintegrität bestätigt",
    importanceWeight: "high",
    metrics: {
      successRate: bad === 0 ? 100 : 90,
      errorRate: bad,
      activityLevel: 0,
      responseSpeed: speed,
    },
    incidents: { open: openOps, healed: parseInt(ops.healed) || 0, escalated: parseInt(ops.escalated) || 0 },
    details: { invalidRatings: bad },
  };
}

async function checkAbuseDetection(): Promise<SystemSignal> {
  const t0 = Date.now();
  const result = await db.execute(sql`
    SELECT email, COUNT(*) as cnt
    FROM business_claims
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY email
    HAVING COUNT(*) >= 3
  `);
  const speed = Date.now() - t0;
  const suspiciousEmails = result.rows.length;

  const opsRes = await db.execute(sql`
    SELECT COUNT(*) FILTER (WHERE status='open') as open,
           COUNT(*) FILTER (WHERE auto_healed=true) as healed,
           COUNT(*) FILTER (WHERE status='escalated') as escalated
    FROM ops_incidents WHERE system_area = 'abuse_detection'
  `);
  const ops = (opsRes.rows[0] as any) ?? {};

  return {
    id: "abuse",
    name: "Missbrauchs-Erkennung",
    role: "Erkennung von Trial-Missbrauch, Spam und verdächtigen Mustern",
    health: suspiciousEmails > 2 ? "red" : suspiciousEmails > 0 ? "yellow" : "green",
    speed: speed < 100 ? "fast" : speed < 500 ? "normal" : "slow",
    errorLevel: parseInt(ops.open) || 0,
    riskLevel: suspiciousEmails,
    lastUpdate: new Date().toISOString(),
    requiresAttention: suspiciousEmails > 0,
    actionFlag: suspiciousEmails > 0 ? "action_needed" : "monitoring",
    summary: `${suspiciousEmails} verdächtige E-Mail-Muster`,
    analysis: suspiciousEmails > 0
      ? `${suspiciousEmails} E-Mail(s) mit Mehrfach-Claims — Missbrauchsrisiko`
      : "Keine Missbrauchsmuster erkannt",
    importanceWeight: "high",
    metrics: {
      successRate: suspiciousEmails === 0 ? 100 : 80,
      errorRate: suspiciousEmails,
      activityLevel: 0,
      responseSpeed: speed,
    },
    incidents: { open: parseInt(ops.open) || 0, healed: parseInt(ops.healed) || 0, escalated: parseInt(ops.escalated) || 0 },
    details: { suspiciousEmails },
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
  return Math.round(score);
}

function buildPriorityIssues(systems: SystemSignal[]): PriorityIssue[] {
  const issues: PriorityIssue[] = [];

  for (const sys of systems) {
    if (sys.health === "green" && !sys.requiresAttention) continue;

    const score = calculatePriorityScore(sys);
    if (score === 0) continue;

    const severity: PriorityIssue["severity"] =
      sys.health === "red" ? "critical" :
      sys.incidents.escalated > 0 ? "high" :
      sys.health === "yellow" ? "medium" : "low";

    let suggestedAction = "Beobachten und bei Verschlechterung eingreifen";
    let safeAutoAction: string | null = null;

    if (sys.id === "billing" && sys.details.overspendCount > 0) {
      suggestedAction = "Budget-Überschreitungen prüfen — Billing-Abgleich durchführen";
      safeAutoAction = "billing-reconcile";
    } else if (sys.id === "boost" && sys.details.stuck > 0) {
      suggestedAction = "Stuck-Boosts prüfen — Health Check durchführen";
      safeAutoAction = "health-check";
    } else if (sys.id === "watchdog" && sys.details.criticalOpen > 0) {
      suggestedAction = "Kritische Incidents sofort prüfen — Ops Center öffnen";
    } else if (sys.id === "watchdog" && sys.details.escalated > 0) {
      suggestedAction = "Eskalierte Incidents manuell lösen";
    } else if (sys.id === "abuse" && sys.details.suspiciousEmails > 0) {
      suggestedAction = "Verdächtige E-Mails prüfen und ggf. sperren";
    } else if (sys.id === "growth" && sys.details.newClaims > 5) {
      suggestedAction = "Offene Claims bearbeiten — Pipeline-Kapazität sicherstellen";
    } else if (sys.id === "data_integrity" && sys.details.invalidRatings > 0) {
      suggestedAction = "Datenbereinigung durchführen — Health Check starten";
      safeAutoAction = "health-check";
    }

    issues.push({
      rank: 0,
      title: sys.analysis,
      reason: `${sys.name} zeigt ${sys.health === "red" ? "kritische" : "auffällige"} Signale`,
      impact: sys.importanceWeight === "critical" ? "Direkte Umsatzauswirkung"
        : sys.importanceWeight === "high" ? "Hohe Betriebsrelevanz"
        : "Moderate Auswirkung",
      system: sys.id,
      severity,
      score,
      suggestedAction,
      safeAutoAction,
    });
  }

  issues.sort((a, b) => b.score - a.score);
  issues.forEach((issue, i) => { issue.rank = i + 1; });

  return issues;
}

router.get("/status", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Forbidden" });

  try {
    const results = await Promise.allSettled([
      checkPremiumSystem(),
      checkBillingSystem(),
      checkBoostSystem(),
      checkGrowthSystem(),
      checkCompetitionEngine(),
      checkWatchdogSystem(),
      checkCityExpansion(),
      checkSocialSystem(),
      checkInstantPlansSystem(),
      checkReviewsSystem(),
      checkDataIntegrity(),
      checkAbuseDetection(),
    ]);

    const checkNames = ["premium", "billing", "boost", "growth", "competition", "watchdog", "cities", "social", "instant_plans", "reviews", "data_integrity", "abuse"];
    const systems: SystemSignal[] = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      console.error(`[BRAIN] ${checkNames[i]} check failed:`, (r as PromiseRejectedResult).reason?.message ?? r);
      return {
        id: checkNames[i],
        name: checkNames[i],
        role: "System-Check fehlgeschlagen",
        health: "red" as SystemHealth,
        speed: "slow" as SystemSpeed,
        errorLevel: 100,
        riskLevel: 80,
        lastUpdate: new Date().toISOString(),
        requiresAttention: true,
        actionFlag: "action_needed" as ActionFlag,
        summary: "Check fehlgeschlagen — System nicht erreichbar",
        analysis: `Der ${checkNames[i]}-Check konnte nicht ausgeführt werden. Mögliche Datenbank- oder Konfigurationsfehler.`,
        importanceWeight: "high" as const,
        metrics: { successRate: 0, errorRate: 100, activityLevel: 0, responseSpeed: 9999 },
        incidents: { open: 0, healed: 0, escalated: 0 },
        details: { error: (r as PromiseRejectedResult).reason?.message ?? "Unknown" },
      };
    });

    const priorities = buildPriorityIssues(systems);

    const overallHealth: SystemHealth =
      systems.some(s => s.health === "red") ? "red" :
      systems.some(s => s.health === "yellow") ? "yellow" : "green";

    const greenCount = systems.filter(s => s.health === "green").length;
    const yellowCount = systems.filter(s => s.health === "yellow").length;
    const redCount = systems.filter(s => s.health === "red").length;
    const totalIncidentsOpen = systems.reduce((s, sys) => s + sys.incidents.open, 0);
    const totalHealed = systems.reduce((s, sys) => s + sys.incidents.healed, 0);
    const avgSpeed = Math.round(systems.reduce((s, sys) => s + sys.metrics.responseSpeed, 0) / systems.length);

    res.json({
      overallHealth,
      healthCounts: { green: greenCount, yellow: yellowCount, red: redCount },
      totalSystems: systems.length,
      totalIncidentsOpen,
      totalHealed,
      avgResponseSpeed: avgSpeed,
      systems,
      priorities: priorities.slice(0, 10),
      topPriorities: priorities.slice(0, 3),
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
    return res.json({ action: actionType, result: data });
  } catch (err: any) {
    console.error("[BRAIN] Action error:", err.message);
    res.status(500).json({ error: "Action failed" });
  }
});

export default router;
