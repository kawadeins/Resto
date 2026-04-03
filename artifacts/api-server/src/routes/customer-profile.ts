import { Router } from "express";
import { db } from "@workspace/db";
import {
  customerProfilesTable,
  reservationsTable,
  reviewsTable,
  loyaltyPointsTable,
} from "@workspace/db";
import { eq, desc, count, avg } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const uploadsDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/customer-profile/:email — get full profile + stats
router.get("/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);

    const [profile] = await db
      .select()
      .from(customerProfilesTable)
      .where(eq(customerProfilesTable.email, email));

    const [loyalty] = await db
      .select()
      .from(loyaltyPointsTable)
      .where(eq(loyaltyPointsTable.customerEmail, email));

    const bookings = await db
      .select()
      .from(reservationsTable)
      .where(eq(reservationsTable.customerEmail, email))
      .orderBy(desc(reservationsTable.createdAt))
      .limit(5);

    const [reviewStats] = await db
      .select({ total: count(reviewsTable.id), avg: avg(reviewsTable.rating) })
      .from(reviewsTable)
      .where(eq(reviewsTable.customerEmail, email));

    const totalBookings = await db
      .select({ total: count(reservationsTable.id) })
      .from(reservationsTable)
      .where(eq(reservationsTable.customerEmail, email));

    const points = loyalty?.points ?? 0;
    const totalEarned = loyalty?.totalEarned ?? 0;
    const tier = points >= 500 ? "Gold" : points >= 200 ? "Silver" : "Bronze";
    const nextTier = tier === "Gold" ? null : tier === "Silver" ? "Gold" : "Silver";
    const nextTierThreshold = tier === "Bronze" ? 200 : tier === "Silver" ? 500 : null;
    const pointsToNext = nextTierThreshold ? nextTierThreshold - points : 0;
    const tierPct =
      tier === "Gold"
        ? 100
        : tier === "Silver"
        ? Math.min(100, Math.round(((points - 200) / 300) * 100))
        : Math.min(100, Math.round((points / 200) * 100));

    res.json({
      email,
      name: profile?.name ?? "",
      photoUrl: profile?.photoUrl ?? null,
      favoriteCuisines: profile?.favoriteCuisines ?? [],
      dietaryStyle: profile?.dietaryStyle ?? "no_preference",
      allergies: profile?.allergies ?? [],
      favoriteTags: profile?.favoriteTags ?? [],
      favoriteRestaurantIds: profile?.favoriteRestaurantIds ?? [],
      loyalty: {
        points,
        totalEarned,
        tier,
        nextTier,
        nextTierThreshold,
        pointsToNext,
        tierPct,
      },
      stats: {
        totalBookings: Number(totalBookings[0]?.total ?? 0),
        totalReviews: Number(reviewStats?.total ?? 0),
        avgRating: reviewStats?.avg ? parseFloat(reviewStats.avg) : null,
      },
      recentBookings: bookings.map((b) => ({
        id: b.id,
        date: b.date,
        time: b.time,
        partySize: b.partySize,
        status: b.status,
        restaurantName: "RestoSmart Brasserie",
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get customer profile");
    res.status(500).json({ error: "Failed to get customer profile" });
  }
});

const UpdateBody = z.object({
  name: z.string().optional(),
  photoUrl: z.string().optional(),
  favoriteCuisines: z.array(z.string()).optional(),
  dietaryStyle: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  favoriteTags: z.array(z.string()).optional(),
  favoriteRestaurantIds: z.array(z.string()).optional(),
});

// PATCH /api/customer-profile/:email — upsert profile
router.patch("/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const body = UpdateBody.parse(req.body);

    const existing = await db
      .select()
      .from(customerProfilesTable)
      .where(eq(customerProfilesTable.email, email));

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.photoUrl !== undefined) updates.photoUrl = body.photoUrl;
    if (body.favoriteCuisines !== undefined) updates.favoriteCuisines = body.favoriteCuisines;
    if (body.dietaryStyle !== undefined) updates.dietaryStyle = body.dietaryStyle;
    if (body.allergies !== undefined) updates.allergies = body.allergies;
    if (body.favoriteTags !== undefined) updates.favoriteTags = body.favoriteTags;
    if (body.favoriteRestaurantIds !== undefined) updates.favoriteRestaurantIds = body.favoriteRestaurantIds;

    if (existing.length === 0) {
      await db.insert(customerProfilesTable).values({ email, ...updates });
    } else {
      await db
        .update(customerProfilesTable)
        .set(updates)
        .where(eq(customerProfilesTable.email, email));
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update customer profile");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// POST /api/customer-profile/upload — avatar upload
router.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return void res.status(400).json({ error: "No file" });
    res.json({ url: `/uploads/${req.file.filename}` });
  } catch {
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
