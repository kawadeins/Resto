import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shiftsTable } from "./shifts";
import { employeesTable } from "./employees";

export const shiftAttendanceTable = pgTable("shift_attendance", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id").notNull().references(() => shiftsTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  shiftDate: text("shift_date").notNull(),
  status: text("status").notNull().default("pending"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  morningReminderSentAt: timestamp("morning_reminder_sent_at", { withTimezone: true }),
  preShiftReminderSentAt: timestamp("pre_shift_reminder_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertShiftAttendanceSchema = createInsertSchema(shiftAttendanceTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertShiftAttendance = z.infer<typeof insertShiftAttendanceSchema>;
export type ShiftAttendance = typeof shiftAttendanceTable.$inferSelect;
