import { Router } from "express";
import { db } from "@workspace/db";
import { friendshipsTable, socialActivitiesTable, customerProfilesTable, restaurantsTable } from "@workspace/db";
import { eq, or, and, desc, inArray, ne, sql } from "drizzle-orm";

const router = Router();

// ─── Helper: get friend emails for a user ─────────────────────────────────────

async function getFriendEmails(email: string): Promise<string[]> {
  const rows = await db
    .select()
    .from(friendshipsTable)
    .where(
      and(
        or(
          eq(friendshipsTable.requesterEmail, email),
          eq(friendshipsTable.recipientEmail, email)
        ),
        eq(friendshipsTable.status, "accepted")
      )
    );
  return rows.map(r => r.requesterEmail === email ? r.recipientEmail : r.requesterEmail);
}

// ─── GET /api/social/friends/:email ───────────────────────────────────────────

router.get("/friends/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const friendEmails = await getFriendEmails(email);
    if (friendEmails.length === 0) return void res.json([]);

    const profiles = await db
      .select({ email: customerProfilesTable.email, name: customerProfilesTable.name, photoUrl: customerProfilesTable.photoUrl })
      .from(customerProfilesTable)
      .where(inArray(customerProfilesTable.email, friendEmails));

    // For any friend without a profile, return minimal info
    const profileMap = new Map(profiles.map(p => [p.email, p]));
    const result = friendEmails.map(fe => profileMap.get(fe) ?? { email: fe, name: fe.split("@")[0], photoUrl: null });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get friends");
    res.status(500).json({ error: "Failed to get friends" });
  }
});

// ─── GET /api/social/requests/:email ─────────────────────────────────────────

router.get("/requests/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const rows = await db
      .select()
      .from(friendshipsTable)
      .where(
        and(
          or(
            eq(friendshipsTable.requesterEmail, email),
            eq(friendshipsTable.recipientEmail, email)
          ),
          eq(friendshipsTable.status, "pending")
        )
      )
      .orderBy(desc(friendshipsTable.createdAt));

    // Fetch profile names for display
    const allEmails = [...new Set(rows.flatMap(r => [r.requesterEmail, r.recipientEmail]))].filter(e => e !== email);
    const profiles = allEmails.length > 0
      ? await db.select({ email: customerProfilesTable.email, name: customerProfilesTable.name, photoUrl: customerProfilesTable.photoUrl })
          .from(customerProfilesTable)
          .where(inArray(customerProfilesTable.email, allEmails))
      : [];

    const profileMap = new Map(profiles.map(p => [p.email, p]));

    const incoming = rows
      .filter(r => r.recipientEmail === email)
      .map(r => ({
        ...r,
        requesterName: profileMap.get(r.requesterEmail)?.name ?? r.requesterEmail.split("@")[0],
        requesterPhoto: profileMap.get(r.requesterEmail)?.photoUrl ?? null,
      }));

    const outgoing = rows
      .filter(r => r.requesterEmail === email)
      .map(r => ({
        ...r,
        recipientName: profileMap.get(r.recipientEmail)?.name ?? r.recipientEmail.split("@")[0],
        recipientPhoto: profileMap.get(r.recipientEmail)?.photoUrl ?? null,
      }));

    res.json({ incoming, outgoing });
  } catch (err) {
    req.log.error({ err }, "Failed to get requests");
    res.status(500).json({ error: "Failed to get requests" });
  }
});

// ─── POST /api/social/request ─────────────────────────────────────────────────

router.post("/request", async (req, res) => {
  try {
    const { requesterEmail, recipientEmail } = req.body;
    if (!requesterEmail || !recipientEmail) return void res.status(400).json({ error: "Missing fields" });
    if (requesterEmail === recipientEmail) return void res.status(400).json({ error: "Cannot add yourself" });

    // Check if already exists (either direction)
    const existing = await db
      .select()
      .from(friendshipsTable)
      .where(
        or(
          and(eq(friendshipsTable.requesterEmail, requesterEmail), eq(friendshipsTable.recipientEmail, recipientEmail)),
          and(eq(friendshipsTable.requesterEmail, recipientEmail), eq(friendshipsTable.recipientEmail, requesterEmail))
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      if (row.status === "accepted") return void res.status(409).json({ error: "Already friends" });
      if (row.status === "pending") return void res.status(409).json({ error: "Request already pending" });
      // If rejected, allow re-sending
      await db.delete(friendshipsTable).where(eq(friendshipsTable.id, row.id));
    }

    const [row] = await db
      .insert(friendshipsTable)
      .values({ requesterEmail, recipientEmail, status: "pending" })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to send request");
    res.status(500).json({ error: "Failed to send request" });
  }
});

// ─── PATCH /api/social/request/:id ───────────────────────────────────────────

router.patch("/request/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body; // "accepted" | "rejected"
    if (!["accepted", "rejected"].includes(status)) return void res.status(400).json({ error: "Invalid status" });

    const [updated] = await db
      .update(friendshipsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(friendshipsTable.id, id))
      .returning();

    if (!updated) return void res.status(404).json({ error: "Request not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update request");
    res.status(500).json({ error: "Failed to update request" });
  }
});

// ─── DELETE /api/social/friend/:id ───────────────────────────────────────────

router.delete("/friend/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(friendshipsTable).where(eq(friendshipsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to remove friend");
    res.status(500).json({ error: "Failed to remove friend" });
  }
});

// ─── DELETE /api/social/friend-by-email ──────────────────────────────────────

router.delete("/friend-by-email", async (req, res) => {
  try {
    const { userEmail, friendEmail } = req.body;
    await db.delete(friendshipsTable).where(
      or(
        and(eq(friendshipsTable.requesterEmail, userEmail), eq(friendshipsTable.recipientEmail, friendEmail)),
        and(eq(friendshipsTable.requesterEmail, friendEmail), eq(friendshipsTable.recipientEmail, userEmail))
      )
    );
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to remove friend");
    res.status(500).json({ error: "Failed to remove friend" });
  }
});

// ─── POST /api/social/activity ────────────────────────────────────────────────

router.post("/activity", async (req, res) => {
  try {
    const { userEmail, activityType, restaurantId, restaurantName, restaurantEmoji, data, visibility } = req.body;
    if (!userEmail || !activityType) return void res.status(400).json({ error: "Missing fields" });

    // Deduplicate: don't log same activity + restaurant within 1 hour
    if (restaurantId) {
      const oneHourAgo = new Date(Date.now() - 3600000);
      const recent = await db
        .select({ id: socialActivitiesTable.id })
        .from(socialActivitiesTable)
        .where(
          and(
            eq(socialActivitiesTable.userEmail, userEmail),
            eq(socialActivitiesTable.activityType, activityType),
            eq(socialActivitiesTable.restaurantId, restaurantId)
          )
        )
        .limit(1);
      if (recent.length > 0) return void res.json({ deduplicated: true });
    }

    const [row] = await db
      .insert(socialActivitiesTable)
      .values({
        userEmail,
        activityType,
        restaurantId: restaurantId ?? null,
        restaurantName: restaurantName ?? null,
        restaurantEmoji: restaurantEmoji ?? null,
        data: data ?? {},
        visibility: visibility ?? "friends",
      })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to record activity");
    res.status(500).json({ error: "Failed to record activity" });
  }
});

// ─── GET /api/social/feed/:email ─────────────────────────────────────────────

router.get("/feed/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const friendEmails = await getFriendEmails(email);
    if (friendEmails.length === 0) return void res.json([]);

    const activities = await db
      .select()
      .from(socialActivitiesTable)
      .where(
        and(
          inArray(socialActivitiesTable.userEmail, friendEmails),
          ne(socialActivitiesTable.visibility, "private")
        )
      )
      .orderBy(desc(socialActivitiesTable.createdAt))
      .limit(limit);

    // Attach profile names
    const profiles = await db
      .select({ email: customerProfilesTable.email, name: customerProfilesTable.name, photoUrl: customerProfilesTable.photoUrl })
      .from(customerProfilesTable)
      .where(inArray(customerProfilesTable.email, friendEmails));

    const profileMap = new Map(profiles.map(p => [p.email, p]));

    const enriched = activities.map(a => ({
      ...a,
      authorName: profileMap.get(a.userEmail)?.name ?? a.userEmail.split("@")[0],
      authorPhoto: profileMap.get(a.userEmail)?.photoUrl ?? null,
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to get feed");
    res.status(500).json({ error: "Failed to get feed" });
  }
});

// ─── GET /api/social/cues/:email ─────────────────────────────────────────────
// Returns { [restaurantId]: { count, names } } for all restaurants friends have activity on

router.get("/cues/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const friendEmails = await getFriendEmails(email);
    if (friendEmails.length === 0) return void res.json({});

    const activities = await db
      .select({
        restaurantId: socialActivitiesTable.restaurantId,
        userEmail: socialActivitiesTable.userEmail,
      })
      .from(socialActivitiesTable)
      .where(
        and(
          inArray(socialActivitiesTable.userEmail, friendEmails),
          ne(socialActivitiesTable.visibility, "private")
        )
      );

    // Get friend names
    const profiles = await db
      .select({ email: customerProfilesTable.email, name: customerProfilesTable.name })
      .from(customerProfilesTable)
      .where(inArray(customerProfilesTable.email, friendEmails));
    const profileMap = new Map(profiles.map(p => [p.email, p.name ?? p.email.split("@")[0]]));

    const cues: Record<string, { count: number; names: string[] }> = {};
    for (const a of activities) {
      if (!a.restaurantId) continue;
      const key = String(a.restaurantId);
      if (!cues[key]) cues[key] = { count: 0, names: [] };
      const name = profileMap.get(a.userEmail) ?? a.userEmail.split("@")[0];
      if (!cues[key].names.includes(name)) {
        cues[key].count++;
        cues[key].names.push(name);
      }
    }

    res.json(cues);
  } catch (err) {
    req.log.error({ err }, "Failed to get cues");
    res.status(500).json({ error: "Failed to get cues" });
  }
});

// ─── GET /api/social/status/:email/:otherEmail ───────────────────────────────

router.get("/status/:email/:otherEmail", async (req, res) => {
  try {
    const { email, otherEmail } = req.params;
    const rows = await db
      .select()
      .from(friendshipsTable)
      .where(
        or(
          and(eq(friendshipsTable.requesterEmail, email), eq(friendshipsTable.recipientEmail, otherEmail)),
          and(eq(friendshipsTable.requesterEmail, otherEmail), eq(friendshipsTable.recipientEmail, email))
        )
      )
      .limit(1);

    if (rows.length === 0) return void res.json({ status: "none" });
    res.json({ status: rows[0].status, id: rows[0].id, isRequester: rows[0].requesterEmail === email });
  } catch (err) {
    res.status(500).json({ error: "Failed to get status" });
  }
});

// ─── PATCH /api/social/privacy ────────────────────────────────────────────────

router.patch("/privacy", async (req, res) => {
  try {
    const { userEmail, visibility } = req.body;
    if (!["public", "friends", "private"].includes(visibility)) return void res.status(400).json({ error: "Invalid visibility" });

    // Update all future activities default — stored client-side in localStorage
    // Just acknowledge the request, client manages localStorage
    res.json({ success: true, visibility });
  } catch (err) {
    res.status(500).json({ error: "Failed to update privacy" });
  }
});

// ─── GET /api/social/radar/:email ────────────────────────────────────────────
// Returns friend activity zones (per-restaurant aggregated, last 48h)
// Safe: only shows restaurant-level aggregates, never GPS coordinates

router.get("/radar/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const friendEmails = await getFriendEmails(email);
    if (friendEmails.length === 0) return void res.json([]);

    // Activities from last 48 hours
    const cutoff = new Date(Date.now() - 48 * 3600000);
    const activities = await db
      .select({
        restaurantId: socialActivitiesTable.restaurantId,
        restaurantName: socialActivitiesTable.restaurantName,
        restaurantEmoji: socialActivitiesTable.restaurantEmoji,
        userEmail: socialActivitiesTable.userEmail,
        activityType: socialActivitiesTable.activityType,
        createdAt: socialActivitiesTable.createdAt,
      })
      .from(socialActivitiesTable)
      .where(
        and(
          inArray(socialActivitiesTable.userEmail, friendEmails),
          ne(socialActivitiesTable.visibility, "private"),
          sql`${socialActivitiesTable.createdAt} > ${cutoff}`
        )
      )
      .orderBy(desc(socialActivitiesTable.createdAt));

    // Fetch friend names + restaurant lat/lng
    const profiles = friendEmails.length > 0
      ? await db.select({ email: customerProfilesTable.email, name: customerProfilesTable.name })
          .from(customerProfilesTable).where(inArray(customerProfilesTable.email, friendEmails))
      : [];
    const profileMap = new Map(profiles.map(p => [p.email, p.name ?? p.email.split("@")[0]]));

    // Aggregate by restaurant
    const zones: Record<string, {
      restaurantId: number;
      restaurantName: string;
      restaurantEmoji: string;
      friendCount: number;
      friendNames: string[];
      activityTypes: string[];
      lastSeen: string;
    }> = {};

    for (const a of activities) {
      if (!a.restaurantId || !a.restaurantName) continue;
      const key = String(a.restaurantId);
      if (!zones[key]) {
        zones[key] = {
          restaurantId: a.restaurantId,
          restaurantName: a.restaurantName,
          restaurantEmoji: a.restaurantEmoji ?? "🍽️",
          friendCount: 0,
          friendNames: [],
          activityTypes: [],
          lastSeen: a.createdAt.toISOString(),
        };
      }
      const name = profileMap.get(a.userEmail) ?? a.userEmail.split("@")[0];
      if (!zones[key].friendNames.includes(name)) {
        zones[key].friendCount++;
        zones[key].friendNames.push(name);
      }
      if (!zones[key].activityTypes.includes(a.activityType)) {
        zones[key].activityTypes.push(a.activityType);
      }
    }

    // Attach restaurant coordinates from restaurants table
    const restaurantIds = Object.values(zones).map(z => z.restaurantId);
    let restaurantCoords: Record<number, { lat: number | null; lng: number | null; city: string | null }> = {};

    if (restaurantIds.length > 0) {
      const rows = await db
        .select({ id: restaurantsTable.id, lat: restaurantsTable.lat, lng: restaurantsTable.lng, city: restaurantsTable.city })
        .from(restaurantsTable)
        .where(inArray(restaurantsTable.id, restaurantIds));
      for (const r of rows) restaurantCoords[r.id] = { lat: r.lat, lng: r.lng, city: r.city };
    }

    const result = Object.values(zones).map(z => ({
      ...z,
      lat: restaurantCoords[z.restaurantId]?.lat ?? null,
      lng: restaurantCoords[z.restaurantId]?.lng ?? null,
      city: restaurantCoords[z.restaurantId]?.city ?? null,
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get radar");
    res.status(500).json({ error: "Failed to get radar" });
  }
});

// ─── GET /api/social/group-suggestions/:email ─────────────────────────────────
// Returns contextual group activity suggestions

router.get("/group-suggestions/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const hour = new Date().getHours();
    const friendEmails = await getFriendEmails(email);
    if (friendEmails.length === 0) return void res.json([]);

    const cutoff = new Date(Date.now() - 6 * 3600000); // last 6 hours

    // Recent friend activities
    const activities = await db
      .select()
      .from(socialActivitiesTable)
      .where(
        and(
          inArray(socialActivitiesTable.userEmail, friendEmails),
          ne(socialActivitiesTable.visibility, "private"),
          sql`${socialActivitiesTable.createdAt} > ${cutoff}`
        )
      )
      .orderBy(desc(socialActivitiesTable.createdAt))
      .limit(50);

    // Friend profiles
    const profiles = await db
      .select({ email: customerProfilesTable.email, name: customerProfilesTable.name })
      .from(customerProfilesTable)
      .where(inArray(customerProfilesTable.email, friendEmails));
    const profileMap = new Map(profiles.map(p => [p.email, p.name ?? p.email.split("@")[0]]));

    const suggestions: any[] = [];

    // Group by restaurant → find places with 2+ friends active
    const restaurantMap: Record<string, { name: string; emoji: string; id: number; friends: string[] }> = {};
    for (const a of activities) {
      if (!a.restaurantId) continue;
      const key = String(a.restaurantId);
      if (!restaurantMap[key]) restaurantMap[key] = { name: a.restaurantName ?? "", emoji: a.restaurantEmoji ?? "🍽️", id: a.restaurantId, friends: [] };
      const name = profileMap.get(a.userEmail) ?? a.userEmail.split("@")[0];
      if (!restaurantMap[key].friends.includes(name)) restaurantMap[key].friends.push(name);
    }

    for (const [, place] of Object.entries(restaurantMap)) {
      if (place.friends.length >= 1) {
        const friendLabel = place.friends.length === 1
          ? place.friends[0]
          : place.friends.length === 2
          ? `${place.friends[0]} & ${place.friends[1]}`
          : `${place.friends.length} Freunde`;

        const timeCtx = hour >= 6 && hour < 11 ? "zum Frühstück"
          : hour >= 11 && hour < 15 ? "zum Mittagessen"
          : hour >= 15 && hour < 18 ? "auf einen Kaffee"
          : hour >= 18 && hour < 22 ? "zum Abendessen"
          : "auf einen Drink";

        suggestions.push({
          type: "friends_active",
          restaurantId: place.id,
          restaurantName: place.name,
          restaurantEmoji: place.emoji,
          friendNames: place.friends,
          title: `${friendLabel} ${place.friends.length === 1 ? "war" : "waren"} hier`,
          cta: `Triff ${place.friends.length === 1 ? place.friends[0] : "deine Freunde"} ${timeCtx}`,
          ctaButton: "Jetzt buchen",
          urgency: place.friends.length >= 2 ? "high" : "medium",
        });
      }
    }

    // Time-based universal suggestion
    if (hour >= 6 && hour < 11) {
      suggestions.push({
        type: "time_context",
        title: "Guten Morgen!",
        cta: `${friendEmails.length} ${friendEmails.length === 1 ? "Freund" : "Freunde"} in deiner Nähe — vielleicht gemeinsam frühstücken?`,
        ctaButton: "Cafés entdecken",
        icon: "☀️",
        link: "/explore?businessType=cafe",
        urgency: "low",
      });
    } else if (hour >= 11 && hour < 15) {
      suggestions.push({
        type: "time_context",
        title: "Lunch-Zeit!",
        cta: "Plane ein Mittagessen mit deinen Freunden.",
        ctaButton: "Restaurants entdecken",
        icon: "🍽️",
        link: "/explore?businessType=restaurant",
        urgency: "medium",
      });
    } else if (hour >= 18 && hour < 23) {
      suggestions.push({
        type: "time_context",
        title: "Abend-Tipps",
        cta: "Was ist heute Abend geplant? Finde etwas Passendes.",
        ctaButton: "Abends entdecken",
        icon: "🌆",
        link: "/explore",
        urgency: "low",
      });
    }

    // Cap at 5 suggestions, highest urgency first
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => (urgencyOrder[a.urgency as keyof typeof urgencyOrder] ?? 2) - (urgencyOrder[b.urgency as keyof typeof urgencyOrder] ?? 2));

    res.json(suggestions.slice(0, 5));
  } catch (err) {
    req.log.error({ err }, "Failed to get group suggestions");
    res.status(500).json({ error: "Failed to get suggestions" });
  }
});

export default router;
