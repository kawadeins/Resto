import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const socialActivitiesTable = pgTable("social_activities", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  activityType: text("activity_type").notNull(),
  // booking | review | achievement | streak_milestone | meal_plan | favorite | check_in | explore
  restaurantId: integer("restaurant_id"),
  restaurantName: text("restaurant_name"),
  restaurantEmoji: text("restaurant_emoji"),
  data: jsonb("data").notNull().default({}),
  visibility: text("visibility").notNull().default("friends"), // "public" | "friends" | "private"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSocialActivitySchema = createInsertSchema(socialActivitiesTable).omit({ id: true, createdAt: true });
export type InsertSocialActivity = z.infer<typeof insertSocialActivitySchema>;
export type SocialActivityRecord = typeof socialActivitiesTable.$inferSelect;
