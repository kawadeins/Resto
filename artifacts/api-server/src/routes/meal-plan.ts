import { Router } from "express";
import { db } from "@workspace/db";
import { mealPlansTable, groupPlansTable, restaurantsTable, discountsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

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

router.get("/group/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const plans = await db.select().from(groupPlansTable).where(eq(groupPlansTable.organizerEmail, decodeURIComponent(email)));
    res.json(plans.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
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

export default router;
