import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const employeeVacationsTable = pgTable("employee_vacations", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmployeeVacation = typeof employeeVacationsTable.$inferSelect;
