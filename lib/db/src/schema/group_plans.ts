import { pgTable, text, serial, timestamp, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const groupPlansTable = pgTable("group_plans", {
  id: serial("id").primaryKey(),
  organizerEmail: text("organizer_email").notNull(),
  organizerName: text("organizer_name").notNull().default(""),
  title: text("title").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  mealSlot: text("meal_slot").notNull().default("dinner"),
  foodTheme: text("food_theme").notNull(),
  participants: json("participants").notNull().default([]),
  groupSize: integer("group_size").notNull().default(2),
  reminderTiming: text("reminder_timing").notNull().default("1_hour_before"),
  restaurantId: integer("restaurant_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGroupPlanSchema = createInsertSchema(groupPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGroupPlan = z.infer<typeof insertGroupPlanSchema>;
export type GroupPlanRecord = typeof groupPlansTable.$inferSelect;
