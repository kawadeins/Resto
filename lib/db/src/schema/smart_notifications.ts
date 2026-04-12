import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const smartNotificationsTable = pgTable("smart_notifications", {
  id: serial("id").primaryKey(),
  userType: text("user_type").notNull(),
  recipientEmail: text("recipient_email"),
  restaurantId: integer("restaurant_id"),
  type: text("type").notNull(),
  priority: text("priority").notNull().default("informational"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  link: text("link"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SmartNotificationRecord = typeof smartNotificationsTable.$inferSelect;
