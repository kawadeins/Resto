import { Router } from "express";
import { db } from "@workspace/db";
import { restaurantsTable, discountsTable, menuItemsTable, reservationsTable } from "@workspace/db";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function isOpen(r: typeof restaurantsTable.$inferSelect): boolean {
  const now = new Date();
  const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];
  if (!r.openDays.includes(day)) return false;
  const [openH, openM] = r.openTime.split(":").map(Number);
  const [closeH, closeM] = r.closeTime.split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= openH * 60 + openM && nowMin <= closeH * 60 + closeM;
}

async function getActiveFlash() {
  const now = new Date();
  const deals = await db.select().from(discountsTable);
  return deals.find(
    (d) =>
      d.type === "flash" &&
      d.enabled &&
      d.flashExpiresAt != null &&
      new Date(d.flashExpiresAt) > now
  ) ?? null;
}

function mapRestaurant(r: typeof restaurantsTable.$inferSelect, flashDeal: typeof discountsTable.$inferSelect | null) {
  const now = new Date();
  const open = isOpen(r);
  const hasFlash = flashDeal != null;
  const minutesRemaining = hasFlash && flashDeal.flashExpiresAt
    ? Math.max(0, Math.round((new Date(flashDeal.flashExpiresAt).getTime() - now.getTime()) / 60000))
    : null;

  return {
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    cuisineEmoji: r.cuisineEmoji,
    description: r.description ?? "",
    address: r.address,
    city: r.city,
    phone: r.phone ?? "",
    email: r.email ?? "",
    heroImage: r.heroImage ?? null,
    rating: parseFloat(r.rating),
    reviewCount: r.reviewCount,
    priceRange: r.priceRange,
    openTime: r.openTime,
    closeTime: r.closeTime,
    openDays: r.openDays,
    tags: r.tags,
    lat: r.lat ? parseFloat(r.lat) : 51.5074,
    lng: r.lng ? parseFloat(r.lng) : -0.1278,
    isActive: r.isActive,
    isFeatured: r.isFeatured,
    isPartner: r.isPartner,
    isOpenNow: open,
    hasActiveFlash: hasFlash && r.id === 1,
    flashPercentage: hasFlash && r.id === 1 ? parseFloat(flashDeal!.percentage) : null,
    flashLabel: hasFlash && r.id === 1 ? flashDeal!.label : null,
    flashMinutesRemaining: hasFlash && r.id === 1 ? minutesRemaining : null,
  };
}

router.get("/restaurants", async (req, res) => {
  try {
    const { cuisine, priceRange, rating, openNow, search, featured } = req.query as Record<string, string>;
    const flash = await getActiveFlash();

    let rows = await db.select().from(restaurantsTable).where(eq(restaurantsTable.isActive, true));

    if (cuisine && cuisine !== "all") {
      rows = rows.filter((r) => r.cuisine.toLowerCase() === cuisine.toLowerCase());
    }
    if (priceRange) {
      const pr = parseInt(priceRange);
      rows = rows.filter((r) => r.priceRange <= pr);
    }
    if (rating) {
      const minRating = parseFloat(rating);
      rows = rows.filter((r) => parseFloat(r.rating) >= minRating);
    }
    if (openNow === "true") {
      rows = rows.filter((r) => isOpen(r));
    }
    if (featured === "true") {
      rows = rows.filter((r) => r.isFeatured);
    }
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.cuisine.toLowerCase().includes(s) ||
          (r.description ?? "").toLowerCase().includes(s) ||
          r.tags.some((t) => t.toLowerCase().includes(s))
      );
    }

    res.json(rows.map((r) => mapRestaurant(r, flash)));
  } catch (err) {
    req.log.error({ err }, "Failed to list restaurants");
    res.status(500).json({ error: "Failed to list restaurants" });
  }
});

router.get("/restaurants/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const flash = await getActiveFlash();
    const rows = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, id));
    if (rows.length === 0) return void res.status(404).json({ error: "Not found" });
    const restaurant = mapRestaurant(rows[0], flash);

    const menuItems = await db
      .select()
      .from(menuItemsTable)
      .where(eq(menuItemsTable.isActive, true));

    res.json({
      ...restaurant,
      menu: menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description ?? "",
        category: m.category,
        price: parseFloat(m.sellingPrice),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get restaurant");
    res.status(500).json({ error: "Failed to get restaurant" });
  }
});

router.get("/flash-deals", async (req, res) => {
  try {
    const now = new Date();
    const deals = await db.select().from(discountsTable);
    const active = deals.filter(
      (d) =>
        d.type === "flash" &&
        d.enabled &&
        d.flashExpiresAt != null &&
        new Date(d.flashExpiresAt) > now
    );

    const restaurants = await db.select().from(restaurantsTable).where(eq(restaurantsTable.isActive, true));
    const mainRestaurant = restaurants.find((r) => r.id === 1) ?? restaurants[0];

    res.json(
      active.map((d) => ({
        id: d.id,
        label: d.label,
        percentage: parseFloat(d.percentage),
        flashExpiresAt: d.flashExpiresAt?.toISOString() ?? null,
        minutesRemaining: d.flashExpiresAt
          ? Math.max(0, Math.round((new Date(d.flashExpiresAt).getTime() - now.getTime()) / 60000))
          : null,
        restaurant: mainRestaurant
          ? { id: mainRestaurant.id, name: mainRestaurant.name, cuisine: mainRestaurant.cuisine, cuisineEmoji: mainRestaurant.cuisineEmoji, heroImage: mainRestaurant.heroImage }
          : null,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get flash deals");
    res.status(500).json({ error: "Failed to get flash deals" });
  }
});

const CreateBookingBody = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(1),
  date: z.string(),
  time: z.string(),
  partySize: z.number().int().min(1),
  notes: z.string().optional(),
  restaurantId: z.number().optional(),
});

router.post("/bookings", async (req, res) => {
  try {
    const body = CreateBookingBody.parse(req.body);
    const [created] = await db.insert(reservationsTable).values({
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      date: body.date,
      time: body.time,
      partySize: body.partySize,
      notes: body.notes ?? null,
      status: "pending",
      source: "customer",
    }).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create customer booking");
    res.status(500).json({ error: "Failed to create booking" });
  }
});

router.get("/my-bookings", async (req, res) => {
  try {
    const email = req.query.email as string;
    if (!email) return void res.status(400).json({ error: "email query param required" });

    const bookings = await db
      .select()
      .from(reservationsTable)
      .where(eq(reservationsTable.customerEmail, email))
      .orderBy(sql`${reservationsTable.date} desc, ${reservationsTable.time} desc`);

    const restaurants = await db.select().from(restaurantsTable).where(eq(restaurantsTable.isActive, true));
    const mainRestaurant = restaurants[0];

    res.json(
      bookings.map((b) => ({
        id: b.id,
        customerName: b.customerName,
        customerEmail: b.customerEmail,
        customerPhone: b.customerPhone,
        date: b.date,
        time: b.time,
        partySize: b.partySize,
        status: b.status,
        notes: b.notes,
        source: b.source,
        createdAt: b.createdAt.toISOString(),
        restaurant: mainRestaurant ? { id: mainRestaurant.id, name: mainRestaurant.name, cuisine: mainRestaurant.cuisine, heroImage: mainRestaurant.heroImage } : null,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get customer bookings");
    res.status(500).json({ error: "Failed to get bookings" });
  }
});

export default router;
