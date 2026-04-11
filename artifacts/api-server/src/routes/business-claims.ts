/**
 * Business Claims & Growth Signals API
 *
 * POST /api/business-claims      — submit a business claim / activation request
 * GET  /api/business-claims      — list all claims (founder-auth required)
 * PUT  /api/business-claims/:id  — update claim status (founder-auth required)
 * GET  /api/growth-signals       — public growth signals for the for-business landing page
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { businessClaimLimiter } from "../middleware/rate-limiters";

const router = Router();

const FOUNDER_KEY = "rs_founder_2026";

function isFounder(req: any) {
  return req.headers["x-founder-key"] === FOUNDER_KEY;
}

// ─── GET /api/growth-signals — public platform stats for value prop ──────────

router.get("/growth-signals", async (req, res) => {
  try {
    const [restaurantStats, bookingStats, promoStats] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*) AS total_venues,
          COUNT(*) FILTER (WHERE business_type = 'restaurant') AS restaurants,
          COUNT(*) FILTER (WHERE business_type = 'cafe')       AS cafes,
          COUNT(*) FILTER (WHERE business_type = 'bar')        AS bars,
          ROUND(AVG(rating)::numeric, 1) AS avg_rating
        FROM restaurants
      `),
      db.execute(sql`
        SELECT
          COUNT(*)                                                    AS total_bookings,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')  AS bookings_7d,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS bookings_30d
        FROM reservations
      `),
      db.execute(sql`
        SELECT
          COUNT(*)                                                                AS active_promotions,
          COALESCE(SUM(impressions), 0)                                           AS total_impressions,
          COALESCE(SUM(clicks), 0)                                                AS total_clicks,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')          AS new_promos_7d
        FROM promotions WHERE status = 'active'
      `),
    ]);

    const venues    = restaurantStats.rows[0] as any;
    const bookings  = bookingStats.rows[0] as any;
    const promos    = promoStats.rows[0] as any;

    const hour = new Date().getHours();
    const day  = new Date().getDay(); // 0=Sun, 6=Sat

    // Time-based demand signals (honest approximations based on time of day)
    const timeSignals = {
      cafe: hour >= 6 && hour < 12
        ? { active: true, label: "Starke Kaffeenachfrage in Wien",       sub: "Frühstücks- und Morgenstunden — höchste Café-Aktivität" }
        : hour >= 12 && hour < 15
        ? { active: true, label: "Mittagszeit in Wien",                   sub: "Viele Nutzer suchen gerade nach Cafés in der Nähe" }
        : { active: false, label: "Café-Aktivität im Stadtgebiet",        sub: "Täglich über 100 Suchanfragen nach Cafés in Wien" },
      restaurant: hour >= 11 && hour < 14
        ? { active: true, label: "Mittagspeak — höchste Sichtbarkeit",   sub: "Nutzer suchen gerade aktiv nach Restaurants in Wien" }
        : hour >= 17 && hour < 21
        ? { active: true, label: "Abendpeak — starke Nachfrage",          sub: "Abendreservierungen sind jetzt besonders gefragt" }
        : { active: false, label: "Restaurant-Nachfrage in Wien",         sub: "Täglich über 200 Reservierungsanfragen in Wien" },
      bar: (hour >= 19 || hour <= 2) && (day === 4 || day === 5 || day === 6 || day === 0)
        ? { active: true, label: "Nachtleben-Peak — Wien ist aktiv",     sub: "Freitag/Samstag: maximale Barsuche in Wien" }
        : hour >= 17 && hour < 20
        ? { active: true, label: "Happy-Hour-Zeit in Wien",               sub: "Happy-Hour-Suchen sind gerade sehr hoch" }
        : { active: false, label: "Bar-Aktivität in Wien",               sub: "Täglich über 80 Suchanfragen nach Bars und Lounges" },
    };

    return res.json({
      platform: {
        totalVenues:        parseInt(venues.total_venues ?? "0"),
        restaurants:        parseInt(venues.restaurants ?? "0"),
        cafes:              parseInt(venues.cafes ?? "0"),
        bars:               parseInt(venues.bars ?? "0"),
        avgRating:          parseFloat(venues.avg_rating ?? "0"),
        totalBookings:      parseInt(bookings.total_bookings ?? "0"),
        bookings7d:         parseInt(bookings.bookings_7d ?? "0"),
        bookings30d:        parseInt(bookings.bookings_30d ?? "0"),
        activePromotions:   parseInt(promos.active_promotions ?? "0"),
        totalImpressions:   parseInt(promos.total_impressions ?? "0"),
        newPromos7d:        parseInt(promos.new_promos_7d ?? "0"),
      },
      timeSignals,
      currentHour: hour,
      isWeekend: day === 0 || day === 5 || day === 6,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get growth signals");
    return res.status(500).json({ error: "Failed" });
  }
});

// ─── POST /api/business-claims — submit a claim ──────────────────────────────

const ClaimSchema = z.object({
  businessName: z.string().min(2).max(200),
  businessType: z.enum(["restaurant", "cafe", "bar"]),
  ownerName:    z.string().min(2).max(100),
  email:        z.string().email(),
  phone:        z.string().optional(),
  city:         z.string().optional().default("Wien"),
  message:      z.string().optional(),
  source:       z.string().optional().default("for_business_page"),
});

router.post("/", businessClaimLimiter, async (req, res) => {
  const parsed = ClaimSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Ungültige Daten", details: parsed.error.flatten() });
  }

  const { businessName, businessType, ownerName, email, phone, city, message, source } = parsed.data;

  try {
    const result = await db.execute(sql`
      INSERT INTO business_claims (business_name, business_type, owner_name, email, phone, city, message, source)
      VALUES (${businessName}, ${businessType}, ${ownerName}, ${email}, ${phone ?? null}, ${city ?? "Wien"}, ${message ?? null}, ${source ?? "for_business_page"})
      RETURNING id, created_at
    `);

    const claim = result.rows[0] as any;
    const isSelfServe = source === "self_serve";
    return res.status(201).json({
      ok: true,
      claimId: claim.id,
      selfServe: isSelfServe,
      message: isSelfServe
        ? "Betrieb aktiviert. Testphase läuft."
        : "Anfrage eingegangen. Wir melden uns innerhalb von 24 Stunden.",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create business claim");
    return res.status(500).json({ error: "Fehler beim Speichern" });
  }
});

// ─── GET /api/business-claims — list claims (founder only) ───────────────────

router.get("/", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Unauthorized" });

  try {
    const result = await db.execute(sql`
      SELECT
        id, business_name, business_type, owner_name, email, phone, city, message,
        status, source, created_at, updated_at
      FROM business_claims
      ORDER BY created_at DESC
      LIMIT 200
    `);

    const byType = result.rows.reduce((acc: any, r: any) => {
      acc[r.business_type] = (acc[r.business_type] ?? 0) + 1;
      return acc;
    }, {});

    const byStatus = result.rows.reduce((acc: any, r: any) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});

    const byCity = result.rows.reduce((acc: any, r: any) => {
      const city = r.city ?? "Wien";
      acc[city] = (acc[city] ?? 0) + 1;
      return acc;
    }, {});

    return res.json({
      claims: result.rows,
      total: result.rows.length,
      byType,
      byStatus,
      byCity,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list business claims");
    return res.status(500).json({ error: "Failed" });
  }
});

// ─── PUT /api/business-claims/:id — update status (founder only) ──────────────

router.put("/:id", async (req, res) => {
  if (!isFounder(req)) return res.status(403).json({ error: "Unauthorized" });

  const id = Number(req.params.id);
  const { status } = req.body;
  const validStatuses = ["new", "contacted", "onboarded", "rejected"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Ungültiger Status" });
  }

  try {
    await db.execute(sql`
      UPDATE business_claims SET status = ${status}, updated_at = NOW() WHERE id = ${id}
    `);
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update claim status");
    return res.status(500).json({ error: "Failed" });
  }
});

export default router;
