import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const RESTAURANT_ID = 1;

export type TeamRole = "owner" | "manager" | "staff";

export async function resolveIdentity(
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
