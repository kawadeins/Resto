import { Router } from "express";
import { db } from "@workspace/db";
import { restaurantsTable, discountsTable, menuItemsTable, reservationsTable } from "@workspace/db";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { sendBookingConfirmation } from "../services/email";
import { computeLiveAvailability, buildSlots } from "../lib/availability";

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

type AvailInfo = { status: string; availableSeats: number; nextAvailableSlot: string | null };

function mapRestaurant(
  r: typeof restaurantsTable.$inferSelect,
  flashDeal: typeof discountsTable.$inferSelect | null,
  avail?: AvailInfo
) {
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
    about: r.about ?? "",
    photos: r.photos ?? [],
    videoUrl: r.videoUrl ?? "",
    instagram: r.instagram ?? "",
    facebook: r.facebook ?? "",
    tiktok: r.tiktok ?? "",
    website: r.website ?? "",
    googleMapsUrl: r.googleMapsUrl ?? "",
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
    // Availability engine
    availabilityStatus: avail?.status ?? (open ? "available" : "closed"),
    availableSeats: avail?.availableSeats ?? null,
    nextAvailableSlot: avail?.nextAvailableSlot ?? null,
    tableCapacity: r.tableCapacity ?? 20,
    seatingCapacity: r.seatingCapacity ?? 80,
    slotDurationMinutes: r.slotDurationMinutes ?? 90,
    maxPartySize: r.maxPartySize ?? 8,
    walkInsEnabled: r.walkInsEnabled ?? true,
    businessType: r.businessType ?? "restaurant",
  };
}

async function getTodayReservations() {
  const today = new Date().toISOString().split("T")[0];
  return db.select({
    time: reservationsTable.time,
    partySize: reservationsTable.partySize,
    status: reservationsTable.status,
  }).from(reservationsTable).where(eq(reservationsTable.date, today));
}

router.get("/restaurants", async (req, res) => {
  try {
    const { cuisine, priceRange, rating, openNow, search, featured, businessType } = req.query as Record<string, string>;
    const flash = await getActiveFlash();
    const todayRes = await getTodayReservations();

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
    if (businessType && businessType !== "all") {
      rows = rows.filter((r) => (r.businessType ?? "restaurant") === businessType);
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

    res.json(rows.map((r) => {
      const open = isOpen(r);
      const avail = computeLiveAvailability(
        {
          isOpenNow: open,
          seatingCapacity: r.seatingCapacity ?? 80,
          slotDurationMinutes: r.slotDurationMinutes ?? 90,
          availabilityPaused: r.availabilityPaused ?? false,
          availabilityPausedUntil: r.availabilityPausedUntil ?? null,
          openTime: r.openTime,
          closeTime: r.closeTime,
        },
        todayRes
      );
      return mapRestaurant(r, flash, avail);
    }));
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
    const r = rows[0];

    const todayRes = await getTodayReservations();
    const open = isOpen(r);
    const avail = computeLiveAvailability(
      {
        isOpenNow: open,
        seatingCapacity: r.seatingCapacity ?? 80,
        slotDurationMinutes: r.slotDurationMinutes ?? 90,
        availabilityPaused: r.availabilityPaused ?? false,
        availabilityPausedUntil: r.availabilityPausedUntil ?? null,
        openTime: r.openTime,
        closeTime: r.closeTime,
      },
      todayRes
    );

    const restaurant = mapRestaurant(r, flash, avail);

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

// GET /api/marketplace/slots?restaurantId=1&date=YYYY-MM-DD
router.get("/slots", async (req, res) => {
  try {
    const restaurantId = parseInt((req.query.restaurantId as string) ?? "1") || 1;
    const date = (req.query.date as string) ?? new Date().toISOString().split("T")[0];

    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
    if (!r) return void res.status(404).json({ error: "Restaurant not found" });

    const dayReservations = await db.select({
      time: reservationsTable.time,
      partySize: reservationsTable.partySize,
      status: reservationsTable.status,
    }).from(reservationsTable).where(eq(reservationsTable.date, date));

    const slots = buildSlots(
      r.openTime,
      r.closeTime,
      r.slotDurationMinutes ?? 90,
      r.seatingCapacity ?? 80,
      dayReservations
    );

    res.json({
      date,
      restaurantId,
      openTime: r.openTime,
      closeTime: r.closeTime,
      seatingCapacity: r.seatingCapacity ?? 80,
      slotDurationMinutes: r.slotDurationMinutes ?? 90,
      maxPartySize: r.maxPartySize ?? 8,
      walkInsEnabled: r.walkInsEnabled ?? true,
      slots,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get slots");
    res.status(500).json({ error: "Failed to get slot availability" });
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

    const restaurantId = body.restaurantId ?? 1;
    const [restaurant] = await db
      .select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, restaurantId));

    if (!restaurant) {
      return void res.status(404).json({ error: "Restaurant not found" });
    }
    if (!restaurant.bookingsEnabled) {
      return void res.status(403).json({ error: "This restaurant is not currently accepting online bookings" });
    }

    // Check if availability is paused
    if (restaurant.availabilityPaused) {
      const until = restaurant.availabilityPausedUntil;
      if (!until || until > new Date()) {
        return void res.status(409).json({ error: "The restaurant is temporarily not accepting new bookings right now. Please try again later or call us." });
      }
    }

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

    // Non-blocking email confirmation
    try {
      await sendBookingConfirmation({
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        date: body.date,
        time: body.time,
        partySize: body.partySize,
        restaurantName: restaurant.name,
      });
    } catch {}

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
