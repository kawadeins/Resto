import { Router } from "express";
import { db } from "@workspace/db";
import { customerProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ── GET /api/public-profile/:userEmail?viewer=:viewerEmail ────────────────────
// Returns ONLY public-safe data. Enforces is_private server-side.
router.get("/:userEmail", async (req, res) => {
  try {
    const userEmail = decodeURIComponent(req.params.userEmail).trim().toLowerCase();
    const viewerEmail = typeof req.query.viewer === "string"
      ? req.query.viewer.trim().toLowerCase()
      : null;
    const pgDb = (db as any).$client;

    const [profile] = await db
      .select({
        name: customerProfilesTable.name,
        photoUrl: customerProfilesTable.photoUrl,
        bio: customerProfilesTable.bio,
        city: customerProfilesTable.city,
        country: customerProfilesTable.country,
        isPrivate: customerProfilesTable.isPrivate,
      })
      .from(customerProfilesTable)
      .where(eq(customerProfilesTable.email, userEmail));

    if (!profile) {
      return res.status(404).json({ error: "Profil nicht gefunden." });
    }

    // ── Friendship status (used by public profile UI) ──────────────────────────
    let friendshipStatus: "none" | "pending_sent" | "pending_received" | "accepted" = "none";
    if (viewerEmail && viewerEmail !== userEmail) {
      const { rows: fRows } = await pgDb.query(
        `SELECT status, requester_email FROM friendships
         WHERE (requester_email=$1 AND recipient_email=$2) OR (requester_email=$2 AND recipient_email=$1)
         LIMIT 1`,
        [viewerEmail, userEmail]
      );
      if (fRows.length > 0) {
        const row = fRows[0];
        if (row.status === "accepted") friendshipStatus = "accepted";
        else if (row.status === "pending") {
          friendshipStatus = row.requester_email === viewerEmail ? "pending_sent" : "pending_received";
        }
      }
    }

    const isSelf = viewerEmail && viewerEmail === userEmail;
    const isFriend = friendshipStatus === "accepted";
    const canViewFull = !profile.isPrivate || isSelf || isFriend;

    // Private profile: return restricted view for non-friends
    if (!canViewFull) {
      return res.json({
        name: profile.name,
        photoUrl: profile.photoUrl,
        bio: null,
        city: null,
        country: null,
        postCount: 0,
        posts: [],
        isPrivate: true,
        friendshipStatus,
      });
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
      isPrivate: profile.isPrivate,
      postCount: posts.length,
      posts,
      friendshipStatus,
    });
  } catch (err) {
    console.error("[public-profile] GET error:", err);
    return res.status(500).json({ error: "Serverfehler." });
  }
});

export default router;
