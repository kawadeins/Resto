import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const loyaltyPointsTable = pgTable("loyalty_points", {
  id: serial("id").primaryKey(),
  customerEmail: text("customer_email").notNull().unique(),
  customerName: text("customer_name").notNull().default(""),
  points: integer("points").notNull().default(0),
  totalEarned: integer("total_earned").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLoyaltyPointsSchema = createInsertSchema(loyaltyPointsTable).omit({ id: true, updatedAt: true });
export type InsertLoyaltyPoints = z.infer<typeof insertLoyaltyPointsSchema>;
export type LoyaltyPointsRecord = typeof loyaltyPointsTable.$inferSelect;
