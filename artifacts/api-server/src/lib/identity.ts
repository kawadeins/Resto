import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type TeamRole = "owner" | "manager" | "staff";

export async function resolveIdentity(
  email: string,
): Promise<{ role: TeamRole; restaurantId: number } | null> {
  if (!email) return null;
  const normalised = email.trim().toLowerCase();

  // Check if owner of any restaurant (multi-tenant: not hardcoded to ID=1)
  const ownerRow = await db.execute(sql`
    SELECT id FROM restaurants WHERE LOWER(owner_email) = ${normalised} LIMIT 1
  `);
  const owned = ownerRow.rows[0] as { id: number } | undefined;
  if (owned) {
    return { role: "owner", restaurantId: owned.id };
  }

  // Check if active team member of any restaurant
  const memberRows = await db.execute(sql`
    SELECT role, restaurant_id FROM team_members
    WHERE LOWER(email) = ${normalised}
      AND status = 'active'
    LIMIT 1
  `);
  const member = memberRows.rows[0] as
    | { role: string; restaurant_id: number }
    | undefined;
  if (!member) return null;

  return {
    role: member.role as TeamRole,
    restaurantId: member.restaurant_id,
  };
}
