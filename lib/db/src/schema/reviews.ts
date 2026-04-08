import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().default(1),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  bookingId: integer("booking_id"),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  ownerReply: text("owner_reply"),
  ownerRepliedAt: timestamp("owner_replied_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  recoveryStatus: text("recovery_status"),
  recoveryMessage: text("recovery_message"),
  businessResponse: text("business_response"),
  businessRespondedAt: timestamp("business_responded_at", { withTimezone: true }),
  aiReplySuggestion: text("ai_reply_suggestion"),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ id: true, ownerReply: true, ownerRepliedAt: true, createdAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type ReviewRecord = typeof reviewsTable.$inferSelect;
