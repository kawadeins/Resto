import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mealPlansTable = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  dayOfWeek: text("day_of_week").notNull(),
  mealSlot: text("meal_slot").notNull(),
  foodType: text("food_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMealPlanSchema = createInsertSchema(mealPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMealPlan = z.infer<typeof insertMealPlanSchema>;
export type MealPlanRecord = typeof mealPlansTable.$inferSelect;
