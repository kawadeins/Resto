import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const bookingPlansTable = pgTable("booking_plans", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().default(1),
  title: text("title").notNull(),
  description: text("description"),
  date: text("date").notNull(),
  startTime: text("start_time").notNull().default("18:00"),
  endTime: text("end_time").notNull().default("23:00"),
  targetAudience: text("target_audience").notNull().default("General"),
  status: text("status").notNull().default("draft"),
  visibility: text("visibility").notNull().default("team"),
  minCovers: integer("min_covers"),
  maxCovers: integer("max_covers"),
  notes: text("notes"),
  tags: text("tags"),
  createdBy: text("created_by").notNull().default("Manager"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type BookingPlanRecord = typeof bookingPlansTable.$inferSelect;
