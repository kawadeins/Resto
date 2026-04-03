import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const employeeOffDaysTable = pgTable("employee_off_days", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  dayOfWeek: text("day_of_week").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmployeeOffDay = typeof employeeOffDaysTable.$inferSelect;
