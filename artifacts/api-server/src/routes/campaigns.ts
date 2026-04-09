/**
 * Campaigns API — tenant-scoped email retention and customer segmentation.
 *
 * All queries are scoped to the authenticated restaurant_id.
 * The restaurant_id is derived from the server session (req.session.restaurantId).
 * No cross-tenant data leakage is possible.
 */

import { Router } from "express";
import { db } from "@workspace/db";
import {
  campaignsTable,
  campaignSendsTable,
  reservationsTable,
  loyaltyPointsTable,
  discountsTable,
} from "@workspace/db";
import { eq, gte, sql, and } from "drizzle-orm";
import { requireManagerOrAbove } from "../middleware/role-guard";
import { z } from "zod";
import { EMAIL_ENABLED } from "../services/email";

const router = Router();

// ─── Tenant helper ────────────────────────────────────────────────────────────
// Prefer session restaurantId; fall back to 1 for single-tenant compatibility.
function getRestaurantId(req: any): number {
  return req.session?.restaurantId ?? 1;
}

// ─── Segmentation engine (tenant-scoped) ──────────────────────────────────────

interface CustomerProfile {
  email: string;
  name: string;
  bookingCount: number;
  arrivedCount: number;
  lastBookingDate: string | null;
  daysSinceLast: number;
  loyaltyPoints: number;
  totalEarned: number;
  tier: string;
  segment: "new" | "returning" | "high_value" | "inactive";
}

function classifySegment(
  bookingCount: number,
  arrivedCount: number,
  daysSinceLast: number,
  points: number
): CustomerProfile["segment"] {
  if (daysSinceLast > 45) return "inactive";
  if (points >= 400 || arrivedCount >= 5) return "high_value";
  if (bookingCount >= 2) return "returning";
  return "new";
}

async function buildCustomerProfiles(restaurantId: number): Promise<CustomerProfile[]> {
  // Aggregate reservations by customer email — scoped to this restaurant
  const resRows = await db.execute(sql`
    SELECT
      customer_email,
      MAX(customer_name) AS customer_name,
      COUNT(*)::int AS booking_count,
      COUNT(CASE WHEN status = 'arrived' THEN 1 END)::int AS arrived_count,
      MAX(date) AS last_booking_date
    FROM reservations
    WHERE restaurant_id = ${restaurantId}
    GROUP BY customer_email
  `);

  // Get loyalty balances for this restaurant
  const loyaltyRows = await db.execute(sql`
    SELECT customer_email, points, total_earned
    FROM loyalty_points
    WHERE restaurant_id = ${restaurantId}
  `);
  const loyaltyMap = new Map(
    (loyaltyRows.rows as { customer_email: string; points: number; total_earned: number }[]).map(
      (l) => [l.customer_email, l]
    )
  );

  const today = new Date();
  const profiles: CustomerProfile[] = [];

  for (const row of resRows.rows as {
    customer_email: string;
    customer_name: string;
    booking_count: number;
    arrived_count: number;
    last_booking_date: string | null;
  }[]) {
    const loyalty = loyaltyMap.get(row.customer_email);
    const points = loyalty?.points ?? 0;
    const totalEarned = loyalty?.total_earned ?? 0;
    const tier = points >= 500 ? "Gold" : points >= 200 ? "Silver" : "Bronze";

    const lastDate = row.last_booking_date ? new Date(row.last_booking_date) : null;
    const daysSinceLast = lastDate
      ? Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const segment = classifySegment(row.booking_count, row.arrived_count, daysSinceLast, points);

    profiles.push({
      email: row.customer_email,
      name: row.customer_name,
      bookingCount: row.booking_count,
      arrivedCount: row.arrived_count,
      lastBookingDate: row.last_booking_date,
      daysSinceLast,
      loyaltyPoints: points,
      totalEarned,
      tier,
      segment,
    });
  }

  return profiles;
}

// ─── GET /api/campaigns/status ───────────────────────────────────────────────
router.get("/status", requireManagerOrAbove(), (_req, res) => {
  res.json({ emailEnabled: EMAIL_ENABLED });
});

// ─── GET /api/campaigns/segments ─────────────────────────────────────────────
router.get("/segments", requireManagerOrAbove(), async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const profiles = await buildCustomerProfiles(restaurantId);

    const segments: Record<string, CustomerProfile[]> = {
      new: [],
      returning: [],
      high_value: [],
      inactive: [],
    };

    for (const p of profiles) {
      segments[p.segment].push(p);
    }

    res.json({
      total: profiles.length,
      segments: {
        new: {
          count: segments.new.length,
          label: "Neukunden",
          description: "Erstbesucher — hinterlassen Sie einen starken ersten Eindruck",
          customers: segments.new.slice(0, 10).map((c) => ({
            email: c.email,
            name: c.name,
            bookingCount: c.bookingCount,
            loyaltyPoints: c.loyaltyPoints,
            tier: c.tier,
          })),
        },
        returning: {
          count: segments.returning.length,
          label: "Stammkunden",
          description: "Bereits treu — halten Sie sie aktiv und engagiert",
          customers: segments.returning.slice(0, 10).map((c) => ({
            email: c.email,
            name: c.name,
            bookingCount: c.bookingCount,
            loyaltyPoints: c.loyaltyPoints,
            tier: c.tier,
          })),
        },
        high_value: {
          count: segments.high_value.length,
          label: "Hochwertige Gäste",
          description: "Ihre treuesten Stammgäste — belohnen Sie sie besonders",
          customers: segments.high_value
            .sort((a, b) => b.loyaltyPoints - a.loyaltyPoints)
            .slice(0, 10)
            .map((c) => ({
              email: c.email,
              name: c.name,
              bookingCount: c.bookingCount,
              loyaltyPoints: c.loyaltyPoints,
              tier: c.tier,
            })),
        },
        inactive: {
          count: segments.inactive.length,
          label: "Inaktive Kunden",
          description: "Seit 45+ Tagen nicht mehr da — jetzt zurückgewinnen",
          customers: segments.inactive
            .sort((a, b) => a.daysSinceLast - b.daysSinceLast)
            .slice(0, 10)
            .map((c) => ({
              email: c.email,
              name: c.name,
              bookingCount: c.bookingCount,
              daysSinceLast: c.daysSinceLast,
              loyaltyPoints: c.loyaltyPoints,
              tier: c.tier,
            })),
        },
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get segments");
    res.status(500).json({ error: "Failed to get segments" });
  }
});

// ─── GET /api/campaigns/retention ────────────────────────────────────────────
router.get("/retention", requireManagerOrAbove(), async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const profiles = await buildCustomerProfiles(restaurantId);
    const total = profiles.length;

    const repeaters = profiles.filter((p) => p.bookingCount >= 2).length;
    const repeatRate = total > 0 ? Math.round((repeaters / total) * 100) : 0;
    const inactiveCount = profiles.filter((p) => p.segment === "inactive").length;
    const atRiskCount = profiles.filter(
      (p) => p.daysSinceLast >= 21 && p.daysSinceLast <= 44
    ).length;
    const highValueCount = profiles.filter((p) => p.segment === "high_value").length;

    const topCustomers = [...profiles]
      .sort((a, b) => b.arrivedCount - a.arrivedCount || b.loyaltyPoints - a.loyaltyPoints)
      .slice(0, 5)
      .map((c) => ({
        email: c.email,
        name: c.name,
        bookingCount: c.bookingCount,
        arrivedCount: c.arrivedCount,
        loyaltyPoints: c.loyaltyPoints,
        tier: c.tier,
        segment: c.segment,
      }));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Campaign sends scoped to this restaurant
    const sends = await db
      .select()
      .from(campaignSendsTable)
      .where(
        and(
          eq(campaignSendsTable.restaurantId, restaurantId),
          gte(campaignSendsTable.sentAt, thirtyDaysAgo)
        )
      );

    const sentEmails = new Set(sends.map((s) => s.customerEmail));

    const recentBookings = await db.execute(sql`
      SELECT customer_email, status FROM reservations
      WHERE restaurant_id = ${restaurantId}
        AND created_at >= ${thirtyDaysAgo.toISOString()}
    `);

    const campaignDrivenBookings = (
      recentBookings.rows as { customer_email: string; status: string }[]
    ).filter(
      (b) =>
        sentEmails.has(b.customer_email) &&
        ["pending", "confirmed", "arrived"].includes(b.status)
    ).length;

    const goldCount = profiles.filter((p) => p.loyaltyPoints >= 500).length;

    res.json({
      totalCustomers: total,
      repeatRate,
      repeatCustomers: repeaters,
      inactiveCount,
      atRiskCount,
      highValueCount,
      campaignDrivenBookings,
      rewardRedemptions: goldCount,
      topCustomers,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get retention metrics");
    res.status(500).json({ error: "Failed to get retention metrics" });
  }
});

// ─── GET /api/campaigns ───────────────────────────────────────────────────────
router.get("/", requireManagerOrAbove(), async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    const campaigns = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.restaurantId, restaurantId))
      .orderBy(sql`${campaignsTable.createdAt} DESC`);

    const results = await Promise.all(
      campaigns.map(async (c) => {
        if (c.status === "draft") {
          return { ...c, totalSent: c.totalSent, totalConverted: c.totalConverted, conversionRate: 0 };
        }

        const sends = await db
          .select()
          .from(campaignSendsTable)
          .where(
            and(
              eq(campaignSendsTable.campaignId, c.id),
              eq(campaignSendsTable.restaurantId, restaurantId),
              eq(campaignSendsTable.status, "converted")
            )
          );

        const converted = sends.length;
        const conversionRate = c.totalSent > 0 ? Math.round((converted / c.totalSent) * 100) : 0;
        return { ...c, totalConverted: converted, conversionRate };
      })
    );

    res.json(results);
  } catch (err) {
    req.log.error({ err }, "Failed to list campaigns");
    res.status(500).json({ error: "Failed to list campaigns" });
  }
});

// ─── POST /api/campaigns ──────────────────────────────────────────────────────
const CreateCampaignBody = z.object({
  type: z.enum(["win_back", "thank_you", "flash_blast", "loyalty_reward"]),
  name: z.string().min(1),
  targetSegment: z.enum(["inactive", "new", "returning", "high_value", "all"]),
  messageTemplate: z.string().min(1),
  offerDetails: z.string().optional(),
});

router.post("/", requireManagerOrAbove(), async (req, res) => {
  try {
    const body = CreateCampaignBody.parse(req.body);
    const restaurantId = getRestaurantId(req);
    const [campaign] = await db
      .insert(campaignsTable)
      .values({ ...body, status: "draft", restaurantId })
      .returning();
    res.status(201).json(campaign);
  } catch (err) {
    req.log.error({ err }, "Failed to create campaign");
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

// ─── POST /api/campaigns/:id/launch ──────────────────────────────────────────
router.post("/:id/launch", requireManagerOrAbove(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const restaurantId = getRestaurantId(req);

    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.id, id),
          eq(campaignsTable.restaurantId, restaurantId) // Tenant isolation
        )
      );

    if (!campaign) return void res.status(404).json({ error: "Campaign nicht gefunden" });
    if (campaign.status !== "draft") {
      return void res.status(400).json({ error: "Kampagne wurde bereits gestartet" });
    }

    const profiles = await buildCustomerProfiles(restaurantId);

    const targets =
      campaign.targetSegment === "all"
        ? profiles
        : profiles.filter((p) => p.segment === campaign.targetSegment);

    if (targets.length === 0) {
      return void res.status(400).json({ error: "Keine Kunden in dieser Zielgruppe" });
    }

    const now = new Date();
    await db.insert(campaignSendsTable).values(
      targets.map((t) => ({
        restaurantId,
        campaignId: id,
        customerEmail: t.email,
        customerName: t.name,
        segment: t.segment,
        status: "sent" as const,
        sentAt: now,
      }))
    );

    const [updated] = await db
      .update(campaignsTable)
      .set({ status: "sent", totalSent: targets.length, sentAt: now })
      .where(
        and(
          eq(campaignsTable.id, id),
          eq(campaignsTable.restaurantId, restaurantId)
        )
      )
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to launch campaign");
    res.status(500).json({ error: "Failed to launch campaign" });
  }
});

// ─── GET /api/campaigns/:id/sends ────────────────────────────────────────────
router.get("/:id/sends", requireManagerOrAbove(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const restaurantId = getRestaurantId(req);

    // Verify campaign belongs to this restaurant
    const [campaign] = await db
      .select({ id: campaignsTable.id })
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.id, id),
          eq(campaignsTable.restaurantId, restaurantId)
        )
      );
    if (!campaign) return void res.status(404).json({ error: "Campaign nicht gefunden" });

    const sends = await db
      .select()
      .from(campaignSendsTable)
      .where(
        and(
          eq(campaignSendsTable.campaignId, id),
          eq(campaignSendsTable.restaurantId, restaurantId)
        )
      )
      .orderBy(sql`${campaignSendsTable.sentAt} DESC`);

    res.json(sends);
  } catch (err) {
    req.log.error({ err }, "Failed to get campaign sends");
    res.status(500).json({ error: "Failed to get sends" });
  }
});

// ─── GET /api/campaigns/personalized ─────────────────────────────────────────
// Customer-facing: personalized offers and loyalty status by email.
// Scoped to restaurant 1 (customer marketplace always shows single restaurant).
router.get("/personalized", async (req, res) => {
  try {
    const email = req.query.email as string;
    if (!email) return void res.status(400).json({ error: "email query param required" });
    const restaurantId = Number(req.query.restaurantId) || 1;

    const resRows = await db.execute(sql`
      SELECT customer_email, status, date FROM reservations
      WHERE customer_email = ${email} AND restaurant_id = ${restaurantId}
    `);

    const loyalty = await db.execute(sql`
      SELECT points, total_earned FROM loyalty_points
      WHERE customer_email = ${email}
      LIMIT 1
    `);

    const loyaltyData = loyalty.rows[0] as { points: number; total_earned: number } | undefined;
    const points = loyaltyData?.points ?? 0;
    const totalEarned = loyaltyData?.total_earned ?? 0;
    const tier = points >= 500 ? "Gold" : points >= 200 ? "Silver" : "Bronze";
    const pointsToGold = Math.max(0, 500 - points);
    const pointsToSilver = Math.max(0, 200 - points);
    const nextTier = tier === "Bronze" ? "Silver" : tier === "Silver" ? "Gold" : null;
    const pointsToNextTier = tier === "Bronze" ? pointsToSilver : tier === "Silver" ? pointsToGold : 0;

    const rows = resRows.rows as { customer_email: string; status: string; date: string }[];
    const bookingCount = rows.length;
    const arrivedCount = rows.filter((r) => r.status === "arrived").length;
    const lastBooking = rows.length > 0 ? rows.sort((a, b) => b.date.localeCompare(a.date))[0] : null;
    const today = new Date();
    const daysSinceLast = lastBooking
      ? Math.floor((today.getTime() - new Date(lastBooking.date + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const segment = classifySegment(bookingCount, arrivedCount, daysSinceLast, points);

    const now = new Date();
    const flashDeals = await db.execute(sql`
      SELECT id, label, percentage, flash_expires_at
      FROM discounts
      WHERE type = 'flash'
        AND enabled = TRUE
        AND flash_expires_at > ${now.toISOString()}
    `);

    let personalizedMessage: string | null = null;
    let messageType: string | null = null;
    if (segment === "inactive") {
      personalizedMessage = `Wir vermissen Sie! Es ist ${daysSinceLast} Tage her. Kommen Sie zurück und sammeln Sie doppelte Treuepunkte.`;
      messageType = "win_back";
    } else if (segment === "high_value") {
      personalizedMessage = `Danke, dass Sie einer unserer treuesten Gäste sind! Sie haben ${points} Punkte.`;
      messageType = "loyalty_reward";
    } else if (arrivedCount > 0 && daysSinceLast <= 7) {
      personalizedMessage = `Danke für Ihren letzten Besuch! Hinterlassen Sie eine Bewertung für 5 Bonuspunkte.`;
      messageType = "thank_you";
    }

    const flashRows = flashDeals.rows as { id: number; label: string; percentage: string; flash_expires_at: string }[];
    const recommendations = flashRows.length > 0
      ? [{ type: "flash_deal", message: `Aktiver Flash-Deal: ${flashRows[0].percentage}% Rabatt — begrenzte Zeit` }]
      : [];

    res.json({
      segment, tier, points, totalEarned, nextTier, pointsToNextTier,
      bookingCount, arrivedCount, personalizedMessage, messageType,
      activeFlashDeals: flashRows.map((d) => ({
        id: d.id, label: d.label,
        percentage: parseFloat(d.percentage),
        expiresAt: d.flash_expires_at,
      })),
      recommendations,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get personalized data");
    res.status(500).json({ error: "Failed to get personalized data" });
  }
});

// ─── POST /api/campaigns/:id/mark-converted ──────────────────────────────────
// Customer-facing — no auth required (driven by booking confirmation event)
router.post("/:id/mark-converted", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { customerEmail } = z.object({ customerEmail: z.string() }).parse(req.body);

    await db
      .update(campaignSendsTable)
      .set({ status: "converted", convertedAt: new Date() })
      .where(
        and(
          eq(campaignSendsTable.campaignId, id),
          eq(campaignSendsTable.customerEmail, customerEmail)
        )
      );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark converted" });
  }
});

export default router;
