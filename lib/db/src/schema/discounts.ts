import { pgTable, text, serial, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const discountsTable = pgTable("discounts", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull().default("10"),
  startTime: text("start_time").notNull().default("15:00"),
  endTime: text("end_time").notNull().default("17:00"),
  days: text("days").array().notNull().default([]),
  label: text("label").notNull().default("Happy Hour"),
  targetType: text("target_type").notNull().default("all"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDiscountSchema = createInsertSchema(discountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDiscount = z.infer<typeof insertDiscountSchema>;
export type Discount = typeof discountsTable.$inferSelect;
