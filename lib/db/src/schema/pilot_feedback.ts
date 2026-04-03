import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pilotFeedbackTable = pgTable("pilot_feedback", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().default(1),
  rating: integer("rating"), // 1–5 stars
  message: text("message").notNull(),
  category: text("category").notNull().default("general"), // bookings | revenue | marketing | general
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPilotFeedbackSchema = createInsertSchema(pilotFeedbackTable).omit({ id: true, createdAt: true });
export type InsertPilotFeedback = z.infer<typeof insertPilotFeedbackSchema>;
export type PilotFeedbackRecord = typeof pilotFeedbackTable.$inferSelect;
