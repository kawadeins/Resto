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
import { z } from "zod";
import { EMAIL_ENABLED } from "../services/email";

const router = Router();

// ─── Segmentation engine ─────────────────────────────────────────────────────

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

async function buildCustomerProfiles(): Promise<CustomerProfile[]> {
  // Aggregate reservations by customer email
  const resRows = await db.execute(sql`
    SELECT
      customer_email,
      MAX(customer_name) AS customer_name,
      COUNT(*)::int AS booking_count,
      COUNT(CASE WHEN status = 'arrived' THEN 1 END)::int AS arrived_count,
      MAX(date) AS last_booking_date
    FROM reservations
    GROUP BY customer_email
  `);

  // Get loyalty balances
  const loyaltyRows = await db.select().from(loyaltyPointsTable);
  const loyaltyMap = new Map(loyaltyRows.map((l) => [l.customerEmail, l]));

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
    const totalEarned = loyalty?.totalEarned ?? 0;
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
router.get("/status", (_req, res) => {
  res.json({ emailEnabled: EMAIL_ENABLED });
});

// ─── GET /api/campaigns/segments ─────────────────────────────────────────────
router.get("/segments", async (req, res) => {
  try {
    const profiles = await buildCustomerProfiles();

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
          label: "New Customers",
          description: "First-time visitors — make a great impression",
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
          label: "Returning Customers",
          description: "Already loyal — keep them engaged",
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
          label: "High-Value Guests",
          description: "Your most loyal — reward them",
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
          label: "Inactive Customers",
          description: "Haven't visited in 45+ days — win them back",
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
router.get("/retention", async (req, res) => {
  try {
    const profiles = await buildCustomerProfiles();
    const total = profiles.length;

    // Repeat customer rate: customers with 2+ bookings
    const repeaters = profiles.filter((p) => p.bookingCount >= 2).length;
    const repeatRate = total > 0 ? Math.round((repeaters / total) * 100) : 0;

    // Inactive count
    const inactiveCount = profiles.filter((p) => p.segment === "inactive").length;

    // At-risk: 21-44 days since last booking (about to go inactive)
    const atRiskCount = profiles.filter(
      (p) => p.daysSinceLast >= 21 && p.daysSinceLast <= 44
    ).length;

    // High-value count
    const highValueCount = profiles.filter((p) => p.segment === "high_value").length;

    // Top returning customers (by booking count)
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

    // Campaign-driven bookings: bookings from customers who received a campaign in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sends = await db
      .select()
      .from(campaignSendsTable)
      .where(gte(campaignSendsTable.sentAt, thirtyDaysAgo));

    const sentEmails = new Set(sends.map((s) => s.customerEmail));

    const recentBookings = await db
      .select()
      .from(reservationsTable)
      .where(gte(reservationsTable.createdAt, thirtyDaysAgo));

    const campaignDrivenBookings = recentBookings.filter(
      (b) =>
        sentEmails.has(b.customerEmail) &&
        ["pending", "confirmed", "arrived"].includes(b.status)
    ).length;

    // Reward redemptions (proxy: Gold tier customers)
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
router.get("/", async (req, res) => {
  try {
    const campaigns = await db
      .select()
      .from(campaignsTable)
      .orderBy(sql`${campaignsTable.createdAt} DESC`);

    // For each campaign, compute conversions from sends
    const results = await Promise.all(
      campaigns.map(async (c) => {
        if (c.status === "draft") {
          return {
            ...c,
            totalSent: c.totalSent,
            totalConverted: c.totalConverted,
            conversionRate: 0,
          };
        }

        // Count converted sends
        const sends = await db
          .select()
          .from(campaignSendsTable)
          .where(
            and(
              eq(campaignSendsTable.campaignId, c.id),
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

router.post("/", async (req, res) => {
  try {
    const body = CreateCampaignBody.parse(req.body);
    const [campaign] = await db
      .insert(campaignsTable)
      .values({ ...body, status: "draft" })
      .returning();
    res.status(201).json(campaign);
  } catch (err) {
    req.log.error({ err }, "Failed to create campaign");
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

// ─── POST /api/campaigns/:id/launch ──────────────────────────────────────────
router.post("/:id/launch", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, id));

    if (!campaign) return void res.status(404).json({ error: "Campaign not found" });
    if (campaign.status !== "draft") {
      return void res.status(400).json({ error: "Campaign already launched" });
    }

    const profiles = await buildCustomerProfiles();

    // Filter to target segment
    const targets =
      campaign.targetSegment === "all"
        ? profiles
        : profiles.filter((p) => p.segment === campaign.targetSegment);

    if (targets.length === 0) {
      return void res.status(400).json({ error: "No customers in target segment" });
    }

    // Create send records
    const now = new Date();
    await db.insert(campaignSendsTable).values(
      targets.map((t) => ({
        campaignId: id,
        customerEmail: t.email,
        customerName: t.name,
        segment: t.segment,
        status: "sent" as const,
        sentAt: now,
      }))
    );

    // Update campaign
    const [updated] = await db
      .update(campaignsTable)
      .set({ status: "sent", totalSent: targets.length, sentAt: now })
      .where(eq(campaignsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to launch campaign");
    res.status(500).json({ error: "Failed to launch campaign" });
  }
});

// ─── GET /api/campaigns/:id/sends ────────────────────────────────────────────
router.get("/:id/sends", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const sends = await db
      .select()
      .from(campaignSendsTable)
      .where(eq(campaignSendsTable.campaignId, id))
      .orderBy(sql`${campaignSendsTable.sentAt} DESC`);

    res.json(sends);
  } catch (err) {
    req.log.error({ err }, "Failed to get campaign sends");
    res.status(500).json({ error: "Failed to get sends" });
  }
});

// ─── GET /api/campaigns/personalized ─────────────────────────────────────────
// Customer-facing: personalized offers and loyalty status by email
router.get("/personalized", async (req, res) => {
  try {
    const email = req.query.email as string;
    if (!email) return void res.status(400).json({ error: "email query param required" });

    // Get this customer's profile
    const resRows = await db
      .select()
      .from(reservationsTable)
      .where(eq(reservationsTable.customerEmail, email));

    const loyalty = await db
      .select()
      .from(loyaltyPointsTable)
      .where(eq(loyaltyPointsTable.customerEmail, email));

    const loyaltyData = loyalty[0];
    const points = loyaltyData?.points ?? 0;
    const totalEarned = loyaltyData?.totalEarned ?? 0;
    const tier = points >= 500 ? "Gold" : points >= 200 ? "Silver" : "Bronze";
    const pointsToGold = Math.max(0, 500 - points);
    const pointsToSilver = Math.max(0, 200 - points);
    const nextTier = tier === "Bronze" ? "Silver" : tier === "Silver" ? "Gold" : null;
    const pointsToNextTier = tier === "Bronze" ? pointsToSilver : tier === "Silver" ? pointsToGold : 0;

    const bookingCount = resRows.length;
    const arrivedCount = resRows.filter((r) => r.status === "arrived").length;
    const lastBooking = resRows.length > 0
      ? resRows.sort((a, b) => b.date.localeCompare(a.date))[0]
      : null;
    const today = new Date();
    const daysSinceLast = lastBooking
      ? Math.floor((today.getTime() - new Date(lastBooking.date + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const segment = classifySegment(bookingCount, arrivedCount, daysSinceLast, points);

    // Active flash deals
    const now = new Date();
    const allDiscounts = await db.select().from(discountsTable);
    const flashDeals = allDiscounts.filter(
      (d) =>
        d.type === "flash" &&
        d.enabled &&
        d.flashExpiresAt != null &&
        new Date(d.flashExpiresAt) > now
    );

    // Personalized message
    let personalizedMessage: string | null = null;
    let messageType: string | null = null;

    if (segment === "inactive") {
      personalizedMessage = `We miss you! It's been ${daysSinceLast} days since your last visit. Come back and earn double loyalty points on your next booking.`;
      messageType = "win_back";
    } else if (segment === "high_value") {
      personalizedMessage = `Thank you for being one of our most loyal guests! You have ${points} points — ${nextTier ? `only ${pointsToNextTier} more to reach ${nextTier}` : "you're at our top Gold tier"}.`;
      messageType = "loyalty_reward";
    } else if (arrivedCount > 0 && daysSinceLast <= 7) {
      personalizedMessage = `Thanks for your recent visit! Leave a review to earn 5 bonus loyalty points and help others discover us.`;
      messageType = "thank_you";
    } else if (nextTier && pointsToNextTier <= 50) {
      personalizedMessage = `You're only ${pointsToNextTier} points away from ${nextTier} tier! Book again to unlock your next reward.`;
      messageType = "loyalty_reward";
    }

    // Recommended (same restaurant with any active offers)
    const recommendations = flashDeals.length > 0
      ? [{ type: "flash_deal", message: `Active flash deal: ${flashDeals[0].percentage}% off — limited time` }]
      : [];

    res.json({
      segment,
      tier,
      points,
      totalEarned,
      nextTier,
      pointsToNextTier,
      bookingCount,
      arrivedCount,
      personalizedMessage,
      messageType,
      activeFlashDeals: flashDeals.map((d) => ({
        id: d.id,
        label: d.label,
        percentage: parseFloat(d.percentage),
        expiresAt: d.flashExpiresAt?.toISOString() ?? null,
      })),
      recommendations,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get personalized data");
    res.status(500).json({ error: "Failed to get personalized data" });
  }
});

// ─── POST /api/campaigns/:id/mark-converted ──────────────────────────────────
// Mark sends as converted when a booking is made
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
