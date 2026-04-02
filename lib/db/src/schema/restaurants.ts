import { pgTable, text, serial, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const restaurantsTable = pgTable("restaurants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cuisine: text("cuisine").notNull(),
  cuisineEmoji: text("cuisine_emoji").notNull().default("🍽️"),
  description: text("description"),
  address: text("address").notNull(),
  city: text("city").notNull().default("London"),
  phone: text("phone"),
  email: text("email"),
  heroImage: text("hero_image"),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("4.5"),
  reviewCount: integer("review_count").notNull().default(0),
  priceRange: integer("price_range").notNull().default(2),
  openTime: text("open_time").notNull().default("12:00"),
  closeTime: text("close_time").notNull().default("22:00"),
  openDays: text("open_days").array().notNull().default(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]),
  tags: text("tags").array().notNull().default([]),
  lat: numeric("lat", { precision: 10, scale: 7 }).default("51.5074"),
  lng: numeric("lng", { precision: 10, scale: 7 }).default("-0.1278"),
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPartner: boolean("is_partner").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRestaurantSchema = createInsertSchema(restaurantsTable).omit({ id: true, createdAt: true });
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type RestaurantRecord = typeof restaurantsTable.$inferSelect;
