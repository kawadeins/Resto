import { Router } from "express";
import { db } from "@workspace/db";
import { teamMembersTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";
import { requireOwner, requireManagerOrAbove } from "../middleware/role-guard";
import { teamInviteLimiter, mutationLimiter } from "../middleware/rate-limiters";

const router = Router();
const RESTAURANT_ID = 1;

type TeamRole = "owner" | "manager" | "staff";
const VALID_ROLES: TeamRole[] = ["owner", "manager", "staff"];

async function getOwnerEmail(): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT owner_email FROM restaurants WHERE id = ${RESTAURANT_ID} LIMIT 1
  `);
  const row = result.rows[0] as { owner_email?: string } | undefined;
  const email = row?.owner_email?.trim();
  return email || null;
}

// ── POST /api/team/bootstrap-owner ───────────────────────────────────────────
// One-time owner setup — only callable when owner_email is not yet set.
// No auth required (bootstrapping). Idempotent — blocked after first call.
router.post("/bootstrap-owner", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "E-Mail erforderlich" });

    const existing = await getOwnerEmail();
    if (existing) {
      return res.status(409).json({ error: "Inhaber bereits festgelegt" });
    }

    await db.execute(sql`
      UPDATE restaurants SET owner_email = ${email.toLowerCase()} WHERE id = ${RESTAURANT_ID} AND (owner_email IS NULL OR owner_email = '')
    `);

    return res.json({ ok: true, message: "Inhaber festgelegt" });
  } catch (err) {
    req.log.error({ err }, "Failed to bootstrap owner");
    return res.status(500).json({ error: "Fehler" });
  }
});

// ── GET /api/team ─────────────────────────────────────────────────────────────
// Requires manager or above (via session)
router.get("/", requireManagerOrAbove(), async (req, res) => {
  try {
    const members = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.restaurantId, RESTAURANT_ID));

    const ownerEmail = await getOwnerEmail();

    const ownerEntry = {
      id: 0,
      email: ownerEmail ?? "",
      name: ownerEmail ? ownerEmail.split("@")[0].replace(/[._]/g, " ") : "Inhaber",
      role: "owner" as const,
      status: "active" as const,
      isOwner: true,
      createdAt: new Date().toISOString(),
    };

    const teamList = members.map((m) => ({
      id: m.id,
      email: m.email,
      name: m.name,
      role: m.role,
      status: m.status,
      isOwner: false,
      createdAt: m.createdAt.toISOString(),
    }));

    return res.json({ members: [ownerEntry, ...teamList] });
  } catch (err) {
    req.log.error({ err }, "Failed to list team members");
    return res.status(500).json({ error: "Fehler beim Laden des Teams" });
  }
});

// ── POST /api/team/invite ─────────────────────────────────────────────────────
router.post("/invite", requireOwner(), teamInviteLimiter, async (req, res) => {
  try {
    const { email, name, role } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: "E-Mail und Name sind erforderlich" });
    }

    const inviteRole = (role && VALID_ROLES.includes(role) && role !== "owner") ? role : "staff";
    const callerEmail = (req as any).userEmail ?? "";

    const existing = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.email, email.toLowerCase()), eq(teamMembersTable.restaurantId, RESTAURANT_ID)))
      .limit(1);

    if (existing.length > 0) {
      const member = existing[0];
      if (member.status === "active") {
        return res.status(409).json({ error: "Diese Person ist bereits im Team" });
      }
      if (member.status === "pending") {
        return res.status(409).json({ error: "Einladung bereits gesendet" });
      }
      if (member.status === "removed") {
        const token = crypto.randomBytes(16).toString("hex");
        await db
          .update(teamMembersTable)
          .set({ status: "pending", role: inviteRole, inviteToken: token, name, invitedBy: callerEmail })
          .where(eq(teamMembersTable.id, member.id));

        return res.json({ ok: true, message: `${name} wurde erneut eingeladen`, inviteToken: token });
      }
    }

    const token = crypto.randomBytes(16).toString("hex");
    await db.insert(teamMembersTable).values({
      restaurantId: RESTAURANT_ID,
      email: email.toLowerCase(),
      name,
      role: inviteRole,
      status: "pending",
      inviteToken: token,
      invitedBy: callerEmail,
    });

    return res.json({ ok: true, message: `Einladung an ${name} gesendet`, inviteToken: token });
  } catch (err) {
    req.log.error({ err }, "Failed to invite team member");
    return res.status(500).json({ error: "Fehler beim Einladen" });
  }
});

// ── POST /api/team/accept ─────────────────────────────────────────────────────
// Public — invite token is the credential
router.post("/accept", async (req, res) => {
  try {
    const { token, email } = req.body;

    if (!token || !email) {
      return res.status(400).json({ error: "Token und E-Mail sind erforderlich" });
    }

    const rows = await db
      .select()
      .from(teamMembersTable)
      .where(
        and(
          eq(teamMembersTable.inviteToken, token),
          eq(teamMembersTable.email, email.toLowerCase()),
          eq(teamMembersTable.status, "pending")
        )
      )
      .limit(1);

    if (!rows.length) {
      return res.status(404).json({ error: "Einladung nicht gefunden oder bereits verwendet" });
    }

    await db
      .update(teamMembersTable)
      .set({ status: "active", inviteToken: null })
      .where(eq(teamMembersTable.id, rows[0].id));

    return res.json({ ok: true, message: "Einladung angenommen", role: rows[0].role });
  } catch (err) {
    req.log.error({ err }, "Failed to accept invite");
    return res.status(500).json({ error: "Fehler beim Annehmen" });
  }
});

// ── PATCH /api/team/:id/role ──────────────────────────────────────────────────
router.patch("/:id/role", requireOwner(), mutationLimiter, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    if (isNaN(memberId)) return res.status(400).json({ error: "Ungültige ID" });

    const { role: newRole } = req.body;

    if (!newRole || !VALID_ROLES.includes(newRole) || newRole === "owner") {
      return res.status(400).json({ error: "Ungültige Rolle" });
    }

    const member = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.restaurantId, RESTAURANT_ID)))
      .limit(1);

    if (!member.length) {
      return res.status(404).json({ error: "Mitglied nicht gefunden" });
    }

    await db
      .update(teamMembersTable)
      .set({ role: newRole })
      .where(eq(teamMembersTable.id, memberId));

    return res.json({ ok: true, message: `Rolle auf ${newRole === "manager" ? "Manager" : "Mitarbeiter"} geändert` });
  } catch (err) {
    req.log.error({ err }, "Failed to change role");
    return res.status(500).json({ error: "Fehler beim Ändern der Rolle" });
  }
});

// ── DELETE /api/team/:id ──────────────────────────────────────────────────────
router.delete("/:id", requireOwner(), mutationLimiter, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    if (isNaN(memberId)) return res.status(400).json({ error: "Ungültige ID" });

    const member = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.restaurantId, RESTAURANT_ID)))
      .limit(1);

    if (!member.length) {
      return res.status(404).json({ error: "Mitglied nicht gefunden" });
    }

    await db
      .update(teamMembersTable)
      .set({ status: "removed", inviteToken: null })
      .where(eq(teamMembersTable.id, memberId));

    return res.json({ ok: true, message: "Mitglied entfernt" });
  } catch (err) {
    req.log.error({ err }, "Failed to remove member");
    return res.status(500).json({ error: "Fehler beim Entfernen" });
  }
});

// ── POST /api/team/resend ─────────────────────────────────────────────────────
router.post("/resend", requireOwner(), teamInviteLimiter, async (req, res) => {
  try {
    const { memberId } = req.body;
    if (!memberId) return res.status(400).json({ error: "Mitglieds-ID erforderlich" });

    const member = await db
      .select()
      .from(teamMembersTable)
      .where(
        and(
          eq(teamMembersTable.id, memberId),
          eq(teamMembersTable.restaurantId, RESTAURANT_ID),
          eq(teamMembersTable.status, "pending")
        )
      )
      .limit(1);

    if (!member.length) {
      return res.status(404).json({ error: "Ausstehende Einladung nicht gefunden" });
    }

    const newToken = crypto.randomBytes(16).toString("hex");
    await db
      .update(teamMembersTable)
      .set({ inviteToken: newToken })
      .where(eq(teamMembersTable.id, memberId));

    return res.json({ ok: true, message: "Einladung erneut gesendet", inviteToken: newToken });
  } catch (err) {
    req.log.error({ err }, "Failed to resend invite");
    return res.status(500).json({ error: "Fehler" });
  }
});

// ── GET /api/team/permissions ─────────────────────────────────────────────────
// Returns role and permissions for the currently authenticated user.
// Uses session identity only — does NOT fall back to x-user-email header.
router.get("/permissions", async (req, res) => {
  try {
    const email = req.session?.userEmail ?? "";

    // No session → return null role (unauthenticated)
    if (!email) {
      return res.json({ role: null, permissions: {} });
    }

    // Resolve role from DB (session email is validated)
    const ownerEmail = await getOwnerEmail();
    let role: TeamRole | null = null;

    if (ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase()) {
      role = "owner";
    } else if (ownerEmail) {
      const rows = await db
        .select({ role: teamMembersTable.role, status: teamMembersTable.status })
        .from(teamMembersTable)
        .where(and(eq(teamMembersTable.email, email.toLowerCase()), eq(teamMembersTable.restaurantId, RESTAURANT_ID)))
        .limit(1);

      if (rows.length && rows[0].status === "active") {
        role = rows[0].role as TeamRole;
      }
    }

    if (!role) return res.json({ role: null, permissions: {} });

    const permissions = {
      canViewDashboard: true,
      canManageContent: role === "owner" || role === "manager",
      canUseBoostTools: role === "owner" || role === "manager",
      canViewAnalytics: role === "owner" || role === "manager",
      canAccessBilling: role === "owner",
      canManagePremium: role === "owner" || role === "manager",
      canManageTeam: role === "owner",
      canAccessSettings: role === "owner",
      canManageMenu: role === "owner" || role === "manager",
      canManageReservations: true,
    };

    return res.json({ role, permissions });
  } catch (err) {
    req.log.error({ err }, "Failed to get permissions");
    return res.status(500).json({ error: "Fehler" });
  }
});

export default router;
