import { Router } from "express";
import { db } from "@workspace/db";
import { customerProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/public-profile/:userEmail
// Returns ONLY public-safe data — no private saves, plans, or preferences
router.get("/:userEmail", async (req, res) => {
  try {
    const userEmail = decodeURIComponent(req.params.userEmail).trim().toLowerCase();
    const pgDb = (db as any).$client;

    const [profile] = await db
      .select({
        name: customerProfilesTable.name,
        photoUrl: customerProfilesTable.photoUrl,
        bio: customerProfilesTable.bio,
        city: customerProfilesTable.city,
        country: customerProfilesTable.country,
      })
      .from(customerProfilesTable)
      .where(eq(customerProfilesTable.email, userEmail));

    if (!profile) {
      return res.status(404).json({ error: "Profil nicht gefunden." });
    }

    // Fetch public posts
    const postsResult = await pgDb.query(
      `SELECT id, image_url, caption, restaurant_name, created_at,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = sp.id)::int AS like_count,
              (SELECT COUNT(*) FROM post_comments WHERE post_id = sp.id)::int AS comment_count
       FROM social_posts sp
       WHERE user_email = $1
       ORDER BY created_at DESC
       LIMIT 24`,
      [userEmail]
    );

    const posts = postsResult.rows;

    return res.json({
      name: profile.name,
      photoUrl: profile.photoUrl,
      bio: profile.bio,
      city: profile.city,
      country: profile.country,
      postCount: posts.length,
      posts,
    });
  } catch (err) {
    console.error("[public-profile] GET error:", err);
    return res.status(500).json({ error: "Serverfehler." });
  }
});

export default router;
