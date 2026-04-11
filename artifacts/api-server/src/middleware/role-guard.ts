/**
 * Role-guard middleware — validates business user identity and role.
 *
 * Identity resolution: server-side session only (req.session.userEmail).
 * Client-supplied headers are never trusted for auth decisions.
 */

import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

type TeamRole = "owner" | "manager" | "staff";
const RESTAURANT_ID = 1;

async function resolveRole(email: string): Promise<TeamRole | null> {
  if (!email) return null;
  const normalised = email.trim().toLowerCase();

  const ownerRow = await db.execute(sql`
    SELECT owner_email FROM restaurants WHERE id = ${RESTAURANT_ID} LIMIT 1
  `);
  const row = ownerRow.rows[0] as { owner_email?: string } | undefined;
  const ownerEmail = row?.owner_email?.trim().toLowerCase();

  if (ownerEmail && normalised === ownerEmail) return "owner";
  if (!ownerEmail) return null;

  const memberRows = await db.execute(sql`
    SELECT role, status FROM team_members
    WHERE LOWER(email) = ${normalised}
      AND restaurant_id = ${RESTAURANT_ID}
    LIMIT 1
  `);
  const member = memberRows.rows[0] as
    | { role: string; status: string }
    | undefined;
  if (!member || member.status !== "active") return null;
  return member.role as TeamRole;
}

export function requireRole(...allowed: TeamRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const email = req.session?.userEmail ?? "";

    const role = await resolveRole(email);

    if (!role) {
      return res.status(403).json({ error: "Nicht authentifiziert" });
    }

    if (!allowed.includes(role)) {
      return res
        .status(403)
        .json({ error: "Zugriff verweigert — fehlende Berechtigung" });
    }

    (req as any).userRole = role;
    (req as any).userEmail = email;
    next();
  };
}

export function requireOwner() {
  return requireRole("owner");
}

export function requireManagerOrAbove() {
  return requireRole("owner", "manager");
}
