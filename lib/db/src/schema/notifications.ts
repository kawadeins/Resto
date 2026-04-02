import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("discount_blast"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  targetCount: integer("target_count").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, sentAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationRecord = typeof notificationsTable.$inferSelect;
