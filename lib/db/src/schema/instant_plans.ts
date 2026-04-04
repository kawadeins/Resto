import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const instantPlansTable = pgTable("instant_plans", {
  id: serial("id").primaryKey(),
  creatorEmail: text("creator_email").notNull(),
  restaurantId: integer("restaurant_id"),
  restaurantName: text("restaurant_name"),
  restaurantEmoji: text("restaurant_emoji"),
  restaurantAddress: text("restaurant_address"),
  mode: text("mode").notNull().default("quick_coffee"),
  // quick_coffee | lunch_plan | night_out | group_dinner | trending_spot
  suggestedTime: text("suggested_time"),
  status: text("status").notNull().default("active"),
  // draft | active | cancelled | completed
  invitedEmails: jsonb("invited_emails").notNull().$type<string[]>().default([]),
  joinedEmails: jsonb("joined_emails").notNull().$type<string[]>().default([]),
  declinedEmails: jsonb("declined_emails").notNull().$type<string[]>().default([]),
  data: jsonb("data").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const insertInstantPlanSchema = createInsertSchema(instantPlansTable).omit({
  id: true, createdAt: true,
});
export type InsertInstantPlan = z.infer<typeof insertInstantPlanSchema>;
export type InstantPlanRecord = typeof instantPlansTable.$inferSelect;
