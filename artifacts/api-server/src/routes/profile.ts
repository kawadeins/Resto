import { Router } from "express";
import { db } from "@workspace/db";
import { restaurantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();
const RESTAURANT_ID = 1;

const uploadsDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif|mp4|mov|webm/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) &&
               allowed.test(file.mimetype.split("/")[1] || "");
    cb(null, ok);
  },
});

// GET /api/profile
router.get("/", async (req, res) => {
  try {
    const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, RESTAURANT_ID));
    if (!r) return void res.status(404).json({ error: "Restaurant not found" });
    res.json({
      id: r.id,
      name: r.name,
      cuisine: r.cuisine,
      cuisineEmoji: r.cuisineEmoji,
      description: r.description ?? "",
      about: r.about ?? "",
      address: r.address,
      city: r.city,
      phone: r.phone ?? "",
      email: r.email ?? "",
      heroImage: r.heroImage ?? "",
      photos: r.photos ?? [],
      videoUrl: r.videoUrl ?? "",
      instagram: r.instagram ?? "",
      facebook: r.facebook ?? "",
      tiktok: r.tiktok ?? "",
      website: r.website ?? "",
      googleMapsUrl: r.googleMapsUrl ?? "",
      tags: r.tags ?? [],
      priceRange: r.priceRange,
      openTime: r.openTime,
      closeTime: r.closeTime,
      openDays: r.openDays,
      lat: r.lat ? parseFloat(r.lat) : 48.2093,
      lng: r.lng ? parseFloat(r.lng) : 16.3726,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get profile");
    res.status(500).json({ error: "Failed to get profile" });
  }
});

const UpdateProfileBody = z.object({
  name: z.string().min(1).optional(),
  cuisine: z.string().optional(),
  cuisineEmoji: z.string().optional(),
  description: z.string().optional(),
  about: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  heroImage: z.string().optional(),
  photos: z.array(z.string()).optional(),
  videoUrl: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  tiktok: z.string().optional(),
  website: z.string().optional(),
  googleMapsUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priceRange: z.number().int().min(1).max(4).optional(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  openDays: z.array(z.string()).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

// PATCH /api/profile
router.patch("/", async (req, res) => {
  try {
    const body = UpdateProfileBody.parse(req.body);
    const updates: Record<string, any> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.cuisine !== undefined) updates.cuisine = body.cuisine;
    if (body.cuisineEmoji !== undefined) updates.cuisineEmoji = body.cuisineEmoji;
    if (body.description !== undefined) updates.description = body.description;
    if (body.about !== undefined) updates.about = body.about;
    if (body.address !== undefined) updates.address = body.address;
    if (body.city !== undefined) updates.city = body.city;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.email !== undefined) updates.email = body.email;
    if (body.heroImage !== undefined) updates.heroImage = body.heroImage;
    if (body.photos !== undefined) updates.photos = body.photos;
    if (body.videoUrl !== undefined) updates.videoUrl = body.videoUrl;
    if (body.instagram !== undefined) updates.instagram = body.instagram;
    if (body.facebook !== undefined) updates.facebook = body.facebook;
    if (body.tiktok !== undefined) updates.tiktok = body.tiktok;
    if (body.website !== undefined) updates.website = body.website;
    if (body.googleMapsUrl !== undefined) updates.googleMapsUrl = body.googleMapsUrl;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.priceRange !== undefined) updates.priceRange = body.priceRange;
    if (body.openTime !== undefined) updates.openTime = body.openTime;
    if (body.closeTime !== undefined) updates.closeTime = body.closeTime;
    if (body.openDays !== undefined) updates.openDays = body.openDays;
    if (body.lat !== undefined) updates.lat = String(body.lat);
    if (body.lng !== undefined) updates.lng = String(body.lng);

    const [updated] = await db.update(restaurantsTable).set(updates).where(eq(restaurantsTable.id, RESTAURANT_ID)).returning();
    if (!updated) return void res.status(404).json({ error: "Restaurant not found" });

    res.json({
      id: updated.id,
      name: updated.name,
      cuisine: updated.cuisine,
      cuisineEmoji: updated.cuisineEmoji,
      description: updated.description ?? "",
      about: updated.about ?? "",
      address: updated.address,
      city: updated.city,
      phone: updated.phone ?? "",
      email: updated.email ?? "",
      heroImage: updated.heroImage ?? "",
      photos: updated.photos ?? [],
      videoUrl: updated.videoUrl ?? "",
      instagram: updated.instagram ?? "",
      facebook: updated.facebook ?? "",
      tiktok: updated.tiktok ?? "",
      website: updated.website ?? "",
      googleMapsUrl: updated.googleMapsUrl ?? "",
      tags: updated.tags ?? [],
      priceRange: updated.priceRange,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update profile");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// POST /api/profile/upload — single file upload
router.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return void res.status(400).json({ error: "No file uploaded" });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
