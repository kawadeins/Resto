/**
 * Auth routes — server-side session management for the business dashboard.
 *
 * POST /api/auth/login   — validate email against DB, create session
 * GET  /api/auth/session — return current session user
 * POST /api/auth/logout  — destroy session
 *
 * Identity model: email-based. The email must exist in the restaurants
 * owner_email column OR in the team_members table as an active member.
 * No passwords are stored; this is an internal B2B SaaS dashboard where
 * team members are invited by the owner (invite-token flow).
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { strictLimiter } from "../middleware/rate-limiters";

const router = Router();
const RESTAURANT_ID = 1;

type TeamRole = "owner" | "manager" | "staff";

async function resolveIdentity(
  email: string,
): Promise<{ role: TeamRole; restaurantId: number } | null> {
  if (!email) return null;
  const normalised = email.trim().toLowerCase();

  const ownerRow = await db.execute(sql`
    SELECT id, owner_email FROM restaurants WHERE id = ${RESTAURANT_ID} LIMIT 1
  `);
  const restaurant = ownerRow.rows[0] as
    | { id: number; owner_email: string }
    | undefined;
  if (!restaurant) return null;

  if (
    restaurant.owner_email &&
    normalised === restaurant.owner_email.trim().toLowerCase()
  ) {
    return { role: "owner", restaurantId: restaurant.id };
  }

  const memberRows = await db.execute(sql`
    SELECT role, status FROM team_members
    WHERE LOWER(email) = ${normalised}
      AND restaurant_id = ${restaurant.id}
    LIMIT 1
  `);
  const member = memberRows.rows[0] as
    | { role: string; status: string }
    | undefined;
  if (!member || member.status !== "active") return null;

  return {
    role: member.role as TeamRole,
    restaurantId: restaurant.id,
  };
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email().max(320),
});

router.post("/login", strictLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Ungültige E-Mail-Adresse" });
  }

  const { email } = parsed.data;
  const identity = await resolveIdentity(email);

  if (!identity) {
    return res
      .status(401)
      .json({ error: "Kein aktives Konto für diese E-Mail-Adresse gefunden" });
  }

  req.session.userEmail = email.trim().toLowerCase();
  req.session.role = identity.role;
  req.session.restaurantId = identity.restaurantId;

  await new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve())),
  );

  return res.json({
    email: req.session.userEmail,
    role: req.session.role,
    restaurantId: req.session.restaurantId,
  });
});

// ── GET /api/auth/session ─────────────────────────────────────────────────────

router.get("/session", (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({
    authenticated: true,
    email: req.session.userEmail,
    role: req.session.role,
    restaurantId: req.session.restaurantId,
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("restosmart.sid");
    return res.json({ success: true });
  });
});

export default router;
