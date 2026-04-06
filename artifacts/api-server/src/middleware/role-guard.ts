import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { teamMembersTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";

type TeamRole = "owner" | "manager" | "staff";
const RESTAURANT_ID = 1;

async function resolveRole(email: string): Promise<TeamRole | null> {
  if (!email) return null;

  const result = await db.execute(sql`
    SELECT owner_email FROM restaurants WHERE id = ${RESTAURANT_ID} LIMIT 1
  `);
  const row = result.rows[0] as { owner_email?: string } | undefined;
  const ownerEmail = row?.owner_email?.trim();

  if (ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase()) return "owner";
  if (!ownerEmail) return null;

  const rows = await db
    .select({ role: teamMembersTable.role, status: teamMembersTable.status })
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.email, email.toLowerCase()), eq(teamMembersTable.restaurantId, RESTAURANT_ID)));

  if (!rows.length || rows[0].status !== "active") return null;
  return rows[0].role as TeamRole;
}

export function requireRole(...allowed: TeamRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const email = (req.headers["x-user-email"] as string) || "";
    const role = await resolveRole(email);

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
