/**
 * Messages API — direct messages and group chats.
 * Requires friendship before DMs. Blocks enforced server-side.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { customerProfilesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import {
  moderateText,
  recordViolation,
  getUserStatus,
  getSuspendedMessage,
} from "../utils/moderation.js";

const router = Router();

// ── Helper: raw pg client ──────────────────────────────────────────────────────
function pg() { return (db as any).$client; }

// ── Check if blocked ───────────────────────────────────────────────────────────
async function isBlocked(a: string, b: string): Promise<boolean> {
  const { rows } = await pg().query(
    `SELECT 1 FROM blocked_users WHERE (blocker_email=$1 AND blocked_email=$2) OR (blocker_email=$2 AND blocked_email=$1) LIMIT 1`,
    [a, b]
  );
  return rows.length > 0;
}

// ── GET /api/messages/conversations/:email ─────────────────────────────────────
// Returns all conversations (DM + group) for a user with last message + unread
router.get("/conversations/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).trim().toLowerCase();
    const pgDb = pg();

    const { rows } = await pgDb.query(
      `SELECT c.id, c.type, c.name, c.created_by, c.created_at,
              (SELECT dm.text FROM direct_messages dm WHERE dm.conversation_id = c.id ORDER BY dm.created_at DESC LIMIT 1) as last_message,
              (SELECT dm.created_at FROM direct_messages dm WHERE dm.conversation_id = c.id ORDER BY dm.created_at DESC LIMIT 1) as last_message_at,
              (SELECT COUNT(*) FROM direct_messages dm WHERE dm.conversation_id = c.id AND dm.is_read = false AND dm.sender_email != $1)::int as unread_count,
              (SELECT EXISTS(SELECT 1 FROM muted_conversations mc WHERE mc.user_email = $1 AND mc.conversation_id = c.id)) as muted
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_email = $1
       ORDER BY COALESCE(
         (SELECT dm2.created_at FROM direct_messages dm2 WHERE dm2.conversation_id = c.id ORDER BY dm2.created_at DESC LIMIT 1),
         c.created_at
       ) DESC`,
      [email]
    );

    // Enrich with participant info
    const convIds = rows.map((r: any) => r.id);
    if (convIds.length === 0) return void res.json([]);

    const { rows: parts } = await pgDb.query(
      `SELECT cp.conversation_id, cp.user_email, pr.name, pr.photo_url
       FROM conversation_participants cp
       LEFT JOIN customer_profiles pr ON pr.email = cp.user_email
       WHERE cp.conversation_id = ANY($1::int[])`,
      [convIds]
    );

    const partMap = new Map<number, any[]>();
    for (const p of parts) {
      if (!partMap.has(p.conversation_id)) partMap.set(p.conversation_id, []);
      partMap.get(p.conversation_id)!.push(p);
    }

    const result = rows.map((r: any) => ({
      ...r,
      participants: (partMap.get(r.id) || []).filter((p: any) => p.user_email !== email),
      allParticipants: partMap.get(r.id) || [],
    }));

    res.json(result);
  } catch (err) {
    console.error("[messages] conversations error:", err);
    res.status(500).json({ error: "Fehler beim Laden der Chats." });
  }
});

// ── GET /api/messages/conversation/:id/:email ──────────────────────────────────
// Get messages for a conversation + mark as read
router.get("/conversation/:id/:email", async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    const email = decodeURIComponent(req.params.email).trim().toLowerCase();
    const pgDb = pg();

    // Check participant access
    const { rows: access } = await pgDb.query(
      `SELECT 1 FROM conversation_participants WHERE conversation_id=$1 AND user_email=$2`,
      [convId, email]
    );
    if (access.length === 0) return void res.status(403).json({ error: "Kein Zugriff." });

    // Fetch messages
    const { rows: msgs } = await pgDb.query(
      `SELECT dm.id, dm.sender_email, dm.text, dm.is_read, dm.created_at,
              cp.name as sender_name, cp.photo_url as sender_photo
       FROM direct_messages dm
       LEFT JOIN customer_profiles cp ON cp.email = dm.sender_email
       WHERE dm.conversation_id = $1
       ORDER BY dm.created_at ASC
       LIMIT 200`,
      [convId]
    );

    // Mark unread messages as read
    await pgDb.query(
      `UPDATE direct_messages SET is_read=true WHERE conversation_id=$1 AND sender_email != $2 AND is_read=false`,
      [convId, email]
    );

    res.json(msgs);
  } catch (err) {
    console.error("[messages] get conversation error:", err);
    res.status(500).json({ error: "Fehler beim Laden der Nachrichten." });
  }
});

// ── POST /api/messages/send ────────────────────────────────────────────────────
// Send a message in a conversation
router.post("/send", async (req, res) => {
  try {
    const { senderEmail, conversationId, text } = req.body;
    if (!senderEmail || !conversationId || !text?.trim()) {
      return void res.status(400).json({ error: "Fehlende Felder." });
    }
    const pgDb = pg();

    // ── Account suspension check ─────────────────────────────────────────────
    const userStatus = await getUserStatus(senderEmail, pgDb);
    if (userStatus.suspended) {
      return void res.status(403).json({
        error: getSuspendedMessage("message"),
        moderated: true,
        suspended: true,
      });
    }

    // Check participant
    const { rows: access } = await pgDb.query(
      `SELECT 1 FROM conversation_participants WHERE conversation_id=$1 AND user_email=$2`,
      [conversationId, senderEmail]
    );
    if (access.length === 0) return void res.status(403).json({ error: "Kein Zugriff." });

    // Check if blocked by any participant in a DM
    const { rows: parts } = await pgDb.query(
      `SELECT user_email FROM conversation_participants WHERE conversation_id=$1 AND user_email != $2`,
      [conversationId, senderEmail]
    );
    for (const p of parts) {
      if (await isBlocked(senderEmail, p.user_email)) {
        return void res.status(403).json({ error: "Nachricht kann nicht gesendet werden." });
      }
    }

    // ── Text moderation ──────────────────────────────────────────────────────
    const modResult = await moderateText(text.trim(), "message");
    if (modResult.blocked) {
      const violation = await recordViolation(
        senderEmail, "message", modResult.severity,
        modResult.reason ?? "unsafe message", modResult.category,
        text.slice(0, 200), pgDb
      );
      return void res.status(422).json({
        error: modResult.message,
        moderated: true,
        strikeMessage: violation.strikeMessage,
      });
    }

    const { rows } = await pgDb.query(
      `INSERT INTO direct_messages (conversation_id, sender_email, text) VALUES ($1, $2, $3) RETURNING *`,
      [conversationId, senderEmail, text.trim()]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("[messages] send error:", err);
    res.status(500).json({ error: "Fehler beim Senden." });
  }
});

// ── POST /api/messages/start-dm ───────────────────────────────────────────────
// Start or get a DM conversation between two friends
router.post("/start-dm", async (req, res) => {
  try {
    const { senderEmail, recipientEmail } = req.body;
    if (!senderEmail || !recipientEmail) return void res.status(400).json({ error: "Fehlende Felder." });
    if (senderEmail === recipientEmail) return void res.status(400).json({ error: "Nicht möglich." });

    const pgDb = pg();

    // Check friendship
    const { rows: friendRows } = await pgDb.query(
      `SELECT 1 FROM friendships WHERE status='accepted' AND (
        (requester_email=$1 AND recipient_email=$2) OR (requester_email=$2 AND recipient_email=$1)
      )`,
      [senderEmail, recipientEmail]
    );
    if (friendRows.length === 0) {
      return void res.status(403).json({ error: "Ihr müsst zuerst Freunde sein, um Nachrichten zu senden." });
    }

    // Check if blocked
    if (await isBlocked(senderEmail, recipientEmail)) {
      return void res.status(403).json({ error: "Nachricht kann nicht gesendet werden." });
    }

    // Find existing DM conversation
    const { rows: existing } = await pgDb.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_email = $1
       JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_email = $2
       WHERE c.type = 'direct'
       LIMIT 1`,
      [senderEmail, recipientEmail]
    );

    if (existing.length > 0) {
      return void res.json({ conversationId: existing[0].id, existing: true });
    }

    // Create new DM conversation
    const { rows: conv } = await pgDb.query(
      `INSERT INTO conversations (type, created_by) VALUES ('direct', $1) RETURNING id`,
      [senderEmail]
    );
    const convId = conv[0].id;

    await pgDb.query(
      `INSERT INTO conversation_participants (conversation_id, user_email) VALUES ($1,$2),($1,$3)`,
      [convId, senderEmail, recipientEmail]
    );

    res.json({ conversationId: convId, existing: false });
  } catch (err) {
    console.error("[messages] start-dm error:", err);
    res.status(500).json({ error: "Fehler beim Starten des Chats." });
  }
});

// ── POST /api/messages/create-group ───────────────────────────────────────────
// Create a group chat
router.post("/create-group", async (req, res) => {
  try {
    const { creatorEmail, name, participantEmails } = req.body;
    if (!creatorEmail || !name?.trim() || !Array.isArray(participantEmails) || participantEmails.length < 1) {
      return void res.status(400).json({ error: "Fehlende Felder." });
    }
    const pgDb = pg();

    const allEmails = [...new Set([creatorEmail, ...participantEmails])];

    const { rows: conv } = await pgDb.query(
      `INSERT INTO conversations (type, name, created_by) VALUES ('group', $1, $2) RETURNING id`,
      [name.trim(), creatorEmail]
    );
    const convId = conv[0].id;

    const values = allEmails.map((_, i) => `($1,$${i + 2})`).join(",");
    await pgDb.query(
      `INSERT INTO conversation_participants (conversation_id, user_email) VALUES ${values}`,
      [convId, ...allEmails]
    );

    res.json({ conversationId: convId });
  } catch (err) {
    console.error("[messages] create-group error:", err);
    res.status(500).json({ error: "Fehler beim Erstellen der Gruppe." });
  }
});

// ── POST /api/messages/mute/:id ────────────────────────────────────────────────
router.post("/mute/:id", async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    const { userEmail } = req.body;
    if (!userEmail) return void res.status(400).json({ error: "Fehlende Felder." });
    await pg().query(
      `INSERT INTO muted_conversations (user_email, conversation_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [userEmail, convId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Fehler." });
  }
});

// ── DELETE /api/messages/mute/:id ─────────────────────────────────────────────
router.delete("/mute/:id", async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    const { userEmail } = req.body;
    await pg().query(
      `DELETE FROM muted_conversations WHERE user_email=$1 AND conversation_id=$2`,
      [userEmail, convId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Fehler." });
  }
});

// ── POST /api/messages/block ───────────────────────────────────────────────────
router.post("/block", async (req, res) => {
  try {
    const { blockerEmail, blockedEmail } = req.body;
    if (!blockerEmail || !blockedEmail) return void res.status(400).json({ error: "Fehlende Felder." });
    await pg().query(
      `INSERT INTO blocked_users (blocker_email, blocked_email) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [blockerEmail, blockedEmail]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Fehler." });
  }
});

// ── DELETE /api/messages/block ─────────────────────────────────────────────────
router.delete("/block", async (req, res) => {
  try {
    const { blockerEmail, blockedEmail } = req.body;
    await pg().query(
      `DELETE FROM blocked_users WHERE blocker_email=$1 AND blocked_email=$2`,
      [blockerEmail, blockedEmail]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Fehler." });
  }
});

export default router;
