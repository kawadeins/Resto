import { Router } from "express";
import { db, instantPlansTable, restaurantsTable, friendshipsTable, socialActivitiesTable } from "@workspace/db";
import { eq, or, and, desc, inArray, sql, ne } from "drizzle-orm";

const router = Router();

// ─── Helper: get friend emails ────────────────────────────────────────────────

async function getFriendEmails(email: string): Promise<string[]> {
  const rows = await db.select().from(friendshipsTable).where(
    and(
      or(eq(friendshipsTable.requesterEmail, email), eq(friendshipsTable.recipientEmail, email)),
      eq(friendshipsTable.status, "accepted")
    )
  );
  return rows.map(r => r.requesterEmail === email ? r.recipientEmail : r.requesterEmail);
}

// ─── POST /api/instant-plans/create ──────────────────────────────────────────

router.post("/create", async (req, res) => {
  try {
    const {
      creatorEmail, restaurantId, restaurantName, restaurantEmoji, restaurantAddress,
      mode, suggestedTime, invitedEmails, data,
    } = req.body;

    if (!creatorEmail || !mode) return void res.status(400).json({ error: "Missing required fields" });

    // Expire in 4 hours
    const expiresAt = new Date(Date.now() + 4 * 3600000);

    // Creator is always in joinedEmails
    const [plan] = await db.insert(instantPlansTable).values({
      creatorEmail,
      restaurantId: restaurantId ?? null,
      restaurantName: restaurantName ?? null,
      restaurantEmoji: restaurantEmoji ?? null,
      restaurantAddress: restaurantAddress ?? null,
      mode,
      suggestedTime: suggestedTime ?? null,
      status: "active",
      invitedEmails: invitedEmails ?? [],
      joinedEmails: [creatorEmail],
      declinedEmails: [],
      data: data ?? {},
      expiresAt,
    }).returning();

    // Record social activity
    if (restaurantId && restaurantName) {
      await db.insert(socialActivitiesTable).values({
        userEmail: creatorEmail,
        activityType: "group_plan",
        restaurantId,
        restaurantName,
        restaurantEmoji: restaurantEmoji ?? null,
        data: { planId: plan.id, mode, friendCount: (invitedEmails ?? []).length },
        visibility: "friends",
      }).catch(() => {});  // non-fatal
    }

    res.status(201).json(plan);
  } catch (err) {
    req.log.error({ err }, "Failed to create instant plan");
    res.status(500).json({ error: "Failed to create plan" });
  }
});

// ─── GET /api/instant-plans/:id ──────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [plan] = await db.select().from(instantPlansTable).where(eq(instantPlansTable.id, id)).limit(1);
    if (!plan) return void res.status(404).json({ error: "Plan not found" });

    // Attach restaurant info
    let restaurant = null;
    if (plan.restaurantId) {
      const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, plan.restaurantId)).limit(1);
      restaurant = r ?? null;
    }

    res.json({ ...plan, restaurant });
  } catch (err) {
    res.status(500).json({ error: "Failed to get plan" });
  }
});

// ─── PATCH /api/instant-plans/:id/respond ────────────────────────────────────

router.patch("/:id/respond", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { email, response } = req.body; // response: "join" | "decline"

    if (!email || !["join", "decline"].includes(response)) {
      return void res.status(400).json({ error: "Invalid request" });
    }

    const [plan] = await db.select().from(instantPlansTable).where(eq(instantPlansTable.id, id)).limit(1);
    if (!plan) return void res.status(404).json({ error: "Plan not found" });
    if (plan.status !== "active") return void res.status(409).json({ error: "Plan is no longer active" });

    const joined = (plan.joinedEmails as string[]) ?? [];
    const declined = (plan.declinedEmails as string[]) ?? [];

    let newJoined = joined;
    let newDeclined = declined;

    if (response === "join") {
      if (!joined.includes(email)) newJoined = [...joined, email];
      newDeclined = declined.filter(e => e !== email);
    } else {
      if (!declined.includes(email)) newDeclined = [...declined, email];
      newJoined = joined.filter(e => e !== email);
    }

    const [updated] = await db.update(instantPlansTable)
      .set({ joinedEmails: newJoined, declinedEmails: newDeclined })
      .where(eq(instantPlansTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to respond to plan" });
  }
});

// ─── GET /api/instant-plans/active/:email ────────────────────────────────────
// Returns active plans where the user is creator or invited

router.get("/active/:email", async (req, res) => {
  try {
    const { email } = req.params;

    // Plans created by user
    const createdPlans = await db.select().from(instantPlansTable)
      .where(and(eq(instantPlansTable.creatorEmail, email), eq(instantPlansTable.status, "active")))
      .orderBy(desc(instantPlansTable.createdAt))
      .limit(10);

    // Plans where user is invited — using jsonb containment
    const invitedPlans = await db.select().from(instantPlansTable)
      .where(
        and(
          eq(instantPlansTable.status, "active"),
          sql`${instantPlansTable.invitedEmails}::jsonb @> ${JSON.stringify([email])}::jsonb`
        )
      )
      .orderBy(desc(instantPlansTable.createdAt))
      .limit(10);

    // Merge and deduplicate
    const all = [...createdPlans];
    for (const p of invitedPlans) {
      if (!all.find(x => x.id === p.id)) all.push(p);
    }

    // Attach restaurant info
    const restaurantIds = all.filter(p => p.restaurantId).map(p => p.restaurantId!);
    let restaurantMap: Record<number, any> = {};
    if (restaurantIds.length > 0) {
      const restaurants = await db.select({ id: restaurantsTable.id, name: restaurantsTable.name, heroImage: restaurantsTable.heroImage, lat: restaurantsTable.lat, lng: restaurantsTable.lng })
        .from(restaurantsTable).where(inArray(restaurantsTable.id, restaurantIds));
      for (const r of restaurants) restaurantMap[r.id] = r;
    }

    const result = all.map(p => ({
      ...p,
      restaurant: p.restaurantId ? restaurantMap[p.restaurantId] ?? null : null,
      isCreator: p.creatorEmail === email,
      hasJoined: (p.joinedEmails as string[]).includes(email),
      hasDeclined: (p.declinedEmails as string[]).includes(email),
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get active plans");
    res.status(500).json({ error: "Failed to get active plans" });
  }
});

// ─── PATCH /api/instant-plans/:id/cancel ─────────────────────────────────────

router.patch("/:id/cancel", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { email } = req.body;
    const [plan] = await db.select().from(instantPlansTable).where(eq(instantPlansTable.id, id)).limit(1);
    if (!plan) return void res.status(404).json({ error: "Not found" });
    if (plan.creatorEmail !== email) return void res.status(403).json({ error: "Only creator can cancel" });
    const [updated] = await db.update(instantPlansTable).set({ status: "cancelled" }).where(eq(instantPlansTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to cancel plan" });
  }
});

// ─── GET /api/instant-plans/incoming/:email ───────────────────────────────────
// Plans the user has been invited to but hasn't responded yet

router.get("/incoming/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const plans = await db.select().from(instantPlansTable).where(
      and(
        eq(instantPlansTable.status, "active"),
        sql`${instantPlansTable.invitedEmails}::jsonb @> ${JSON.stringify([email])}::jsonb`,
        sql`NOT (${instantPlansTable.joinedEmails}::jsonb @> ${JSON.stringify([email])}::jsonb)`,
        sql`NOT (${instantPlansTable.declinedEmails}::jsonb @> ${JSON.stringify([email])}::jsonb)`
      )
    ).orderBy(desc(instantPlansTable.createdAt)).limit(5);
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: "Failed to get incoming plans" });
  }
});

export default router;
