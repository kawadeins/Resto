import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationLogsTable = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // booking_confirmation | campaign | loyalty_tier | discount_alert
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("pending"), // sent | failed | skipped
  referenceId: text("reference_id"), // e.g. booking id, campaign id
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationLogSchema = createInsertSchema(notificationLogsTable).omit({ id: true, createdAt: true });
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type NotificationLogRecord = typeof notificationLogsTable.$inferSelect;
