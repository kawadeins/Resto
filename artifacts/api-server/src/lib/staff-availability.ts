import { db } from "@workspace/db";
import { employeeOffDaysTable, employeeVacationsTable } from "@workspace/db";
import { eq, and, lte, gte } from "drizzle-orm";

/**
 * Returns a Set of employeeIds who are unavailable today (off day or on vacation).
 * Used by shifts and attendance routes to skip those employees.
 */
export async function getUnavailableEmployeeIds(dayOfWeek: string, todayStr: string): Promise<Set<number>> {
  const unavailable = new Set<number>();

  // Employees with today's weekday marked as off
  const offDays = await db
    .select({ employeeId: employeeOffDaysTable.employeeId })
    .from(employeeOffDaysTable)
    .where(eq(employeeOffDaysTable.dayOfWeek, dayOfWeek));

  for (const row of offDays) unavailable.add(row.employeeId);

  // Employees currently on vacation (startDate <= today <= endDate)
  const vacations = await db
    .select({ employeeId: employeeVacationsTable.employeeId })
    .from(employeeVacationsTable)
    .where(and(lte(employeeVacationsTable.startDate, todayStr), gte(employeeVacationsTable.endDate, todayStr)));

  for (const row of vacations) unavailable.add(row.employeeId);

  return unavailable;
}
