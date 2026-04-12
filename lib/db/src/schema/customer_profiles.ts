import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customerProfilesTable = pgTable("customer_profiles", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  photoUrl: text("photo_url"),
  favoriteCuisines: text("favorite_cuisines").array().notNull().default([]),
  dietaryStyle: text("dietary_style").notNull().default("no_preference"),
  allergies: text("allergies").array().notNull().default([]),
  favoriteTags: text("favorite_tags").array().notNull().default([]),
  favoriteRestaurantIds: text("favorite_restaurant_ids").array().notNull().default([]),
  bio: text("bio"),
  city: text("city"),
  country: text("country"),
  age: integer("age"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCustomerProfileSchema = createInsertSchema(customerProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomerProfile = z.infer<typeof insertCustomerProfileSchema>;
export type CustomerProfileRecord = typeof customerProfilesTable.$inferSelect;
