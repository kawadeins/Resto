/**
 * Role-guard middleware — validates business user identity and role.
 *
 * Identity resolution: server-side session only (req.session.userEmail + req.session.restaurantId).
 * Client-supplied headers are never trusted for auth decisions.
 * Role is re-verified against the DB on each request so permission changes take effect immediately.
 */

import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

type TeamRole = "owner" | "manager" | "staff";

async function resolveRoleForRestaurant(email: string, restaurantId: number): Promise<TeamRole | null> {
  if (!email || !restaurantId) return null;
  const normalised = email.trim().toLowerCase();

  // Check if owner of this specific restaurant
  const ownerRow = await db.execute(sql`
    SELECT id FROM restaurants
    WHERE id = ${restaurantId} AND LOWER(owner_email) = ${normalised}
    LIMIT 1
  `);
  if (ownerRow.rows.length > 0) return "owner";

  // Check if active team member of this specific restaurant
  const memberRows = await db.execute(sql`
    SELECT role FROM team_members
    WHERE LOWER(email) = ${normalised}
      AND restaurant_id = ${restaurantId}
      AND status = 'active'
    LIMIT 1
  `);
  const member = memberRows.rows[0] as { role: string } | undefined;
  if (!member) return null;
  return member.role as TeamRole;
}

export function requireRole(...allowed: TeamRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const email = req.session?.userEmail ?? "";
    const restaurantId = req.session?.restaurantId;

    if (!email || !restaurantId) {
      return res.status(403).json({ error: "Nicht authentifiziert" });
    }

    const role = await resolveRoleForRestaurant(email, restaurantId);

    if (!role) {
      return res.status(403).json({ error: "Nicht authentifiziert" });
    }

    if (!allowed.includes(role)) {
      return res.status(403).json({ error: "Zugriff verweigert — fehlende Berechtigung" });
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

export function requireAnyRole() {
  return requireRole("owner", "manager", "staff");
}
