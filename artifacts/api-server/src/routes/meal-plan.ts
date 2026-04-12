import { Router } from "express";
import { db } from "@workspace/db";
import { mealPlansTable, groupPlansTable, restaurantsTable, discountsTable, groupReservationRequestsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

const router = Router();

const FOOD_TYPE_TO_CUISINE_KEYWORDS: Record<string, string[]> = {
  burger: ["burger", "american", "fast food", "grill"],
  pizza: ["pizza", "italian", "pizzeria"],
  meat: ["grill", "steakhouse", "bbq", "american", "argentinian", "burger"],
  fish: ["fish", "seafood", "japanese", "mediterranean", "sushi"],
  pasta: ["italian", "pasta", "pizza"],
  sushi: ["sushi", "japanese", "asian"],
  vegan: ["vegan", "vegetarian", "healthy", "salad"],
  desserts: ["cafe", "bakery", "dessert", "patisserie"],
  salat: ["salad", "healthy", "vegan", "vegetarian", "mediterranean"],
  mexican: ["mexican", "tex-mex", "tacos"],
  asian: ["asian", "chinese", "thai", "vietnamese", "japanese"],
  oriental: ["lebanese", "turkish", "middle eastern", "kebab", "arabic"],
  soup: ["soup", "asian", "vietnamese", "mediterranean"],
};

function isOpen(r: any): boolean {
  const now = new Date();
  const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];
  if (!r.openDays?.includes(day)) return false;
  const [openH, openM] = (r.openTime || "00:00").split(":").map(Number);
  const [closeH, closeM] = (r.closeTime || "23:59").split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= openH * 60 + openM && nowMin <= closeH * 60 + closeM;
}

function scoreRestaurantForFoodType(restaurant: any, foodType: string, activeDeal: any): number {
  const keywords = FOOD_TYPE_TO_CUISINE_KEYWORDS[foodType] ?? [foodType];
  const cuisineLower = (restaurant.cuisine ?? "").toLowerCase();
  const tagsLower = (restaurant.tags ?? []).map((t: string) => t.toLowerCase());
  let score = 0;
  for (const kw of keywords) {
    if (cuisineLower.includes(kw)) score += 10;
    if (tagsLower.some((t: string) => t.includes(kw))) score += 5;
  }
  if (restaurant.isOpenNow) score += 8;
  if (restaurant.isFeatured) score += 3;
  if (activeDeal && restaurant.hasActiveFlash) score += 6;
  if (restaurant.rating >= 4.5) score += 4;
  else if (restaurant.rating >= 4.0) score += 2;
  return score;
}

async function getRestaurantSuggestions(foodType: string, dietaryStyle?: string, allergies?: string[]) {
  const now = new Date();
  const restaurants = await db.select().from(restaurantsTable).where(eq(restaurantsTable.isActive, true));
  const deals = await db.select().from(discountsTable);
  const activeDeal = deals.find(
    (d) => d.type === "flash" && d.enabled && d.flashExpiresAt && new Date(d.flashExpiresAt) > now
  ) ?? null;

  return restaurants
    .map((r) => {
      const open = isOpen(r);
      const hasFlash = activeDeal &&
        activeDeal.flashExpiresAt != null &&
        new Date(activeDeal.flashExpiresAt) > new Date();
      const score = scoreRestaurantForFoodType(
        { ...r, isOpenNow: open, hasActiveFlash: hasFlash, rating: parseFloat(r.rating) },
        foodType,
        activeDeal
      );
      return {
        id: r.id,
        name: r.name,
        cuisine: r.cuisine,
        cuisineEmoji: r.cuisineEmoji,
        address: r.address,
        heroImage: r.heroImage,
        rating: parseFloat(r.rating),
        reviewCount: r.reviewCount,
        priceRange: r.priceRange,
        isOpenNow: open,
        openTime: r.openTime,
        closeTime: r.closeTime,
        hasActiveFlash: !!hasFlash,
        flashPercentage: hasFlash ? parseFloat(activeDeal!.percentage) : null,
        score,
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

router.get("/", (_req, res) => {
  res.status(400).json({ error: "E-Mail-Parameter erforderlich: /api/meal-plan/{email}" });
});

router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const plans = await db.select().from(mealPlansTable).where(eq(mealPlansTable.email, decodeURIComponent(email)));
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden des Mahlzeitenplans" });
  }
});

router.put("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const { dayOfWeek, mealSlot, foodType } = req.body;
    if (!dayOfWeek || !mealSlot || !foodType) {
      return res.status(400).json({ error: "dayOfWeek, mealSlot und foodType sind erforderlich" });
    }
    const decodedEmail = decodeURIComponent(email);

    const existing = await db
      .select()
      .from(mealPlansTable)
      .where(
        and(
          eq(mealPlansTable.email, decodedEmail),
          eq(mealPlansTable.dayOfWeek, dayOfWeek),
          eq(mealPlansTable.mealSlot, mealSlot)
        )
      );

    if (existing.length > 0) {
      await db
        .update(mealPlansTable)
        .set({ foodType, updatedAt: new Date() })
        .where(
          and(
            eq(mealPlansTable.email, decodedEmail),
            eq(mealPlansTable.dayOfWeek, dayOfWeek),
            eq(mealPlansTable.mealSlot, mealSlot)
          )
        );
    } else {
      await db.insert(mealPlansTable).values({ email: decodedEmail, dayOfWeek, mealSlot, foodType });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Speichern" });
  }
});

router.delete("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const { dayOfWeek, mealSlot } = req.body;
    if (!dayOfWeek || !mealSlot) {
      return res.status(400).json({ error: "dayOfWeek und mealSlot sind erforderlich" });
    }
    const decodedEmail = decodeURIComponent(email);
    await db
      .delete(mealPlansTable)
      .where(
        and(
          eq(mealPlansTable.email, decodedEmail),
          eq(mealPlansTable.dayOfWeek, dayOfWeek),
          eq(mealPlansTable.mealSlot, mealSlot)
        )
      );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Löschen" });
  }
});

router.get("/:email/suggestions", async (req, res) => {
  try {
    const { email } = req.params;
    const { foodType, dietaryStyle, allergies } = req.query;
    const allergyList = allergies ? (Array.isArray(allergies) ? allergies : [allergies]) : [];
    const suggestions = await getRestaurantSuggestions(
      String(foodType || ""),
      String(dietaryStyle || ""),
      allergyList as string[]
    );
    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Vorschläge" });
  }
});

// ── GET single plan by numeric ID (for shareable link) ──────────────────────
// Must be registered BEFORE /group/:email to avoid "plan" being treated as email
router.get("/group/plan/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Ungültige Plan-ID" });
    const [plan] = await db.select().from(groupPlansTable).where(eq(groupPlansTable.id, id));
    if (!plan) return res.status(404).json({ error: "Plan nicht gefunden" });
    let restaurant = null;
    if (plan.restaurantId) {
      const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, plan.restaurantId));
      if (r) restaurant = { id: r.id, name: r.name, address: r.address, heroImage: r.heroImage };
    }
    res.json({ ...plan, restaurant });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden des Plans" });
  }
});

// ── GET all plans for an organizer (enriched with restaurant data) ────────────
router.get("/group/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const plans = await db.select().from(groupPlansTable).where(eq(groupPlansTable.organizerEmail, decodeURIComponent(email)));
    const sorted = plans.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // Enrich with restaurant info
    const restaurantIds = [...new Set(sorted.filter(p => p.restaurantId).map(p => p.restaurantId as number))];
    const restaurants = restaurantIds.length > 0
      ? await db.select({ id: restaurantsTable.id, name: restaurantsTable.name, address: restaurantsTable.address, heroImage: restaurantsTable.heroImage })
          .from(restaurantsTable)
          .where(inArray(restaurantsTable.id, restaurantIds))
      : [];
    const rMap = Object.fromEntries(restaurants.map(r => [r.id, r]));
    res.json(sorted.map(p => ({ ...p, restaurant: p.restaurantId ? (rMap[p.restaurantId] ?? null) : null })));
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Gruppenpläne" });
  }
});

router.post("/group", async (req, res) => {
  try {
    const {
      organizerEmail, organizerName, title, date, time,
      mealSlot, foodTheme, participants, groupSize, reminderTiming, restaurantId
    } = req.body;

    if (!organizerEmail || !title || !date || !time || !foodTheme) {
      return res.status(400).json({ error: "Pflichtfelder fehlen" });
    }

    const suggestions = await getRestaurantSuggestions(foodTheme);
    const topRestaurant = suggestions[0];

    const [created] = await db.insert(groupPlansTable).values({
      organizerEmail,
      organizerName: organizerName ?? "",
      title,
      date,
      time,
      mealSlot: mealSlot ?? "dinner",
      foodTheme,
      participants: participants ?? [],
      groupSize: groupSize ?? (Array.isArray(participants) ? participants.length + 1 : 2),
      reminderTiming: reminderTiming ?? "1_hour_before",
      restaurantId: restaurantId ?? topRestaurant?.id ?? null,
    }).returning();

    const restaurantData = topRestaurant
      ? { id: topRestaurant.id, name: topRestaurant.name, cuisine: topRestaurant.cuisine, address: topRestaurant.address }
      : null;

    res.json({ ...created, suggestedRestaurant: restaurantData });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Erstellen des Gruppenplans" });
  }
});

// ── PUT update an existing group plan ────────────────────────────────────────
router.put("/group/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Ungültige Plan-ID" });
    const { title, date, time, mealSlot, foodTheme, participants, groupSize, reminderTiming, restaurantId } = req.body;
    const [updated] = await db.update(groupPlansTable)
      .set({
        ...(title    !== undefined && { title: title.trim() }),
        ...(date     !== undefined && { date }),
        ...(time     !== undefined && { time }),
        ...(mealSlot !== undefined && { mealSlot }),
        ...(foodTheme !== undefined && { foodTheme }),
        ...(participants !== undefined && { participants }),
        ...(groupSize !== undefined && { groupSize }),
        ...(reminderTiming !== undefined && { reminderTiming }),
        restaurantId: restaurantId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(groupPlansTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Plan nicht gefunden" });
    let restaurant = null;
    if (updated.restaurantId) {
      const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, updated.restaurantId));
      if (r) restaurant = { id: r.id, name: r.name, address: r.address };
    }
    res.json({ ...updated, restaurant });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Aktualisieren des Plans" });
  }
});

router.delete("/group/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(groupPlansTable).where(eq(groupPlansTable.id, parseInt(id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Löschen" });
  }
});

router.get("/group/:planId/suggestions", async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await db.select().from(groupPlansTable).where(eq(groupPlansTable.id, parseInt(planId)));
    if (!plan.length) return res.status(404).json({ error: "Plan nicht gefunden" });
    const suggestions = await getRestaurantSuggestions(plan[0].foodTheme);
    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Vorschläge" });
  }
});

// ─── Group Reservation Requests ───────────────────────────────────────────────

function calcScheduledSendAt(requestedDate: string, sendTiming: string): Date | null {
  if (sendTiming === "sofort" || sendTiming === "manual") return null;
  const d = new Date(requestedDate);
  const days = sendTiming === "3_days_before" ? 3 : sendTiming === "2_days_before" ? 2 : 1;
  d.setDate(d.getDate() - days);
  d.setHours(9, 0, 0, 0);
  return d;
}

// Auto-send scheduled reservations every 10 minutes
async function processScheduledReservations() {
  try {
    const now = new Date();
    const rows = await db.select().from(groupReservationRequestsTable)
      .where(eq(groupReservationRequestsTable.status, "planned"));
    for (const r of rows) {
      if (r.scheduledSendAt && r.scheduledSendAt <= now) {
        await db.update(groupReservationRequestsTable)
          .set({ status: "sent", sentAt: now, updatedAt: now })
          .where(eq(groupReservationRequestsTable.id, r.id));
      }
    }
  } catch { /* silent */ }
}
setInterval(processScheduledReservations, 10 * 60 * 1000);
processScheduledReservations();

// POST /reservation — create / replace reservation request for a group plan
router.post("/reservation", async (req, res) => {
  try {
    const {
      groupPlanId, restaurantId, restaurantName, organizerEmail,
      organizerName, partySize, requestedDate, requestedTime, note, sendTiming,
    } = req.body;
    if (!groupPlanId || !restaurantId || !organizerEmail || !requestedDate || !requestedTime) {
      return res.status(400).json({ error: "Pflichtfelder fehlen" });
    }
    const timing = sendTiming ?? "sofort";
    const status = timing === "sofort" ? "sent" : "planned";
    const sentAt = timing === "sofort" ? new Date() : null;
    const scheduledSendAt = calcScheduledSendAt(requestedDate, timing);

    await db.delete(groupReservationRequestsTable)
      .where(eq(groupReservationRequestsTable.groupPlanId, parseInt(groupPlanId)));

    const [created] = await db.insert(groupReservationRequestsTable).values({
      groupPlanId: parseInt(groupPlanId),
      restaurantId: parseInt(restaurantId),
      restaurantName: restaurantName ?? "",
      organizerEmail,
      organizerName: organizerName ?? "",
      partySize: parseInt(partySize) || 2,
      requestedDate,
      requestedTime,
      note: note ?? "",
      sendTiming: timing,
      scheduledSendAt,
      sentAt,
      status,
    }).returning();
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Erstellen der Anfrage" });
  }
});

// GET /reservation/organizer/:email — all requests for an organizer
router.get("/reservation/organizer/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const rows = await db.select().from(groupReservationRequestsTable)
      .where(eq(groupReservationRequestsTable.organizerEmail, email));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Anfragen" });
  }
});

// GET /reservation/plan/:groupPlanId — single request for a plan (must be before /:id routes)
router.get("/reservation/plan/:groupPlanId", async (req, res) => {
  try {
    const planId = parseInt(req.params.groupPlanId);
    const [row] = await db.select().from(groupReservationRequestsTable)
      .where(eq(groupReservationRequestsTable.groupPlanId, planId));
    res.json(row ?? null);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Anfrage" });
  }
});

// PUT /reservation/:id — update (only while status=planned)
router.put("/reservation/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { partySize, requestedDate, requestedTime, note, sendTiming } = req.body;
    const sched = requestedDate && sendTiming ? calcScheduledSendAt(requestedDate, sendTiming) : undefined;
    const [updated] = await db.update(groupReservationRequestsTable)
      .set({
        ...(partySize     !== undefined && { partySize: parseInt(partySize) }),
        ...(requestedDate !== undefined && { requestedDate }),
        ...(requestedTime !== undefined && { requestedTime }),
        ...(note          !== undefined && { note }),
        ...(sendTiming    !== undefined && { sendTiming }),
        ...(sched         !== undefined && { scheduledSendAt: sched }),
        updatedAt: new Date(),
      })
      .where(eq(groupReservationRequestsTable.id, id))
      .returning();
    res.json(updated ?? null);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Aktualisieren" });
  }
});

// POST /reservation/:id/send — manually trigger send
router.post("/reservation/:id/send", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(groupReservationRequestsTable)
      .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(groupReservationRequestsTable.id, id))
      .returning();
    res.json(updated ?? null);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Senden" });
  }
});

// DELETE /reservation/:id — cancel reservation request
router.delete("/reservation/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(groupReservationRequestsTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(groupReservationRequestsTable.id, id))
      .returning();
    res.json(updated ?? null);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Stornieren" });
  }
});

export default router;
