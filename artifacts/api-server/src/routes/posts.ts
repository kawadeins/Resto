import { Router } from "express";
import { db } from "@workspace/db";
import { customerProfilesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

// ── Multer setup for image uploads ────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), "public", "post-images");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// ── Serve uploaded images ──────────────────────────────────────────────────────
import express from "express";
router.use("/images", express.static(UPLOAD_DIR));

// ── Helper ─────────────────────────────────────────────────────────────────────
async function enrichPost(post: any, viewerEmail: string, pgDb: any) {
  const likeRes = await pgDb.query(
    "SELECT COUNT(*) as count FROM post_likes WHERE post_id = $1",
    [post.id]
  );
  const likeCount = parseInt(likeRes.rows[0]?.count ?? "0", 10);

  const commentRes = await pgDb.query(
    "SELECT COUNT(*) as count FROM post_comments WHERE post_id = $1",
    [post.id]
  );
  const commentCount = parseInt(commentRes.rows[0]?.count ?? "0", 10);

  let likedByMe = false;
  if (viewerEmail) {
    const likedRes = await pgDb.query(
      "SELECT 1 FROM post_likes WHERE post_id = $1 AND user_email = $2",
      [post.id, viewerEmail]
    );
    likedByMe = likedRes.rows.length > 0;
  }

  return { ...post, likeCount, commentCount, likedByMe };
}

// ── GET /api/posts — public feed ───────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const viewerEmail = (req.query.viewer as string) || "";
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;

    const { rows: posts } = await (db as any).$client.query(
      `SELECT * FROM social_posts ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const enriched = await Promise.all(
      posts.map((p: any) => enrichPost(p, viewerEmail, (db as any).$client))
    );

    res.json(enriched);
  } catch (err: any) {
    req.log.error({ err }, "Failed to get posts feed");
    res.status(500).json({ error: "Failed to get posts" });
  }
});

// ── GET /api/posts/user/:email — user's posts ─────────────────────────────────
router.get("/user/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const viewerEmail = (req.query.viewer as string) || "";

    const { rows: posts } = await (db as any).$client.query(
      `SELECT * FROM social_posts WHERE user_email = $1 ORDER BY created_at DESC`,
      [email]
    );

    const enriched = await Promise.all(
      posts.map((p: any) => enrichPost(p, viewerEmail, (db as any).$client))
    );

    res.json(enriched);
  } catch (err: any) {
    req.log.error({ err }, "Failed to get user posts");
    res.status(500).json({ error: "Failed to get user posts" });
  }
});

// ── POST /api/posts — create post with image upload ───────────────────────────
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { user_email, caption, restaurant_id, restaurant_name } = req.body;
    if (!user_email) return void res.status(400).json({ error: "user_email required" });
    if (!req.file) return void res.status(400).json({ error: "image required" });

    // Resolve user display name + photo from profile
    const profiles = await db
      .select({ name: customerProfilesTable.name, photoUrl: customerProfilesTable.photoUrl })
      .from(customerProfilesTable)
      .where(eq(customerProfilesTable.email, user_email));
    const profile = profiles[0];

    const imageUrl = `/api/posts/images/${req.file.filename}`;

    const { rows } = await (db as any).$client.query(
      `INSERT INTO social_posts (user_email, user_name, user_photo, image_url, caption, restaurant_id, restaurant_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        user_email,
        profile?.name || user_email.split("@")[0],
        profile?.photoUrl || null,
        imageUrl,
        caption || null,
        restaurant_id ? parseInt(restaurant_id, 10) : null,
        restaurant_name || null,
      ]
    );

    res.json({ ...rows[0], likeCount: 0, commentCount: 0, likedByMe: false });
  } catch (err: any) {
    req.log.error({ err }, "Failed to create post");
    res.status(500).json({ error: "Failed to create post" });
  }
});

// ── DELETE /api/posts/:id ─────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_email } = req.body;

    const { rows } = await (db as any).$client.query(
      `DELETE FROM social_posts WHERE id = $1 AND user_email = $2 RETURNING id`,
      [id, user_email]
    );

    if (rows.length === 0) return void res.status(403).json({ error: "Not found or not owner" });
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "Failed to delete post");
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// ── POST /api/posts/:id/like — toggle like ────────────────────────────────────
router.post("/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_email } = req.body;
    if (!user_email) return void res.status(400).json({ error: "user_email required" });

    // Try insert; if conflict, delete (toggle)
    const { rows: existing } = await (db as any).$client.query(
      `SELECT id FROM post_likes WHERE post_id = $1 AND user_email = $2`,
      [id, user_email]
    );

    let liked: boolean;
    if (existing.length > 0) {
      await (db as any).$client.query(
        `DELETE FROM post_likes WHERE post_id = $1 AND user_email = $2`,
        [id, user_email]
      );
      liked = false;
    } else {
      await (db as any).$client.query(
        `INSERT INTO post_likes (post_id, user_email) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, user_email]
      );
      liked = true;
    }

    const { rows: [countRow] } = await (db as any).$client.query(
      `SELECT COUNT(*) as count FROM post_likes WHERE post_id = $1`,
      [id]
    );

    res.json({ liked, likeCount: parseInt(countRow.count, 10) });
  } catch (err: any) {
    req.log.error({ err }, "Failed to toggle like");
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

// ── GET /api/posts/:id/comments ───────────────────────────────────────────────
router.get("/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await (db as any).$client.query(
      `SELECT * FROM post_comments WHERE post_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    res.json(rows);
  } catch (err: any) {
    req.log.error({ err }, "Failed to get comments");
    res.status(500).json({ error: "Failed to get comments" });
  }
});

// ── POST /api/posts/:id/comments ─────────────────────────────────────────────
router.post("/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_email, text } = req.body;
    if (!user_email || !text?.trim()) {
      return void res.status(400).json({ error: "user_email and text required" });
    }

    // Enrich with profile
    const profiles = await db
      .select({ name: customerProfilesTable.name, photoUrl: customerProfilesTable.photoUrl })
      .from(customerProfilesTable)
      .where(eq(customerProfilesTable.email, user_email));
    const profile = profiles[0];

    const { rows } = await (db as any).$client.query(
      `INSERT INTO post_comments (post_id, user_email, user_name, user_photo, text)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        id,
        user_email,
        profile?.name || user_email.split("@")[0],
        profile?.photoUrl || null,
        text.trim(),
      ]
    );

    res.json(rows[0]);
  } catch (err: any) {
    req.log.error({ err }, "Failed to add comment");
    res.status(500).json({ error: "Failed to add comment" });
  }
});

export default router;
