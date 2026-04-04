import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const friendshipsTable = pgTable("friendships", {
  id: serial("id").primaryKey(),
  requesterEmail: text("requester_email").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  status: text("status").notNull().default("pending"), // "pending" | "accepted" | "rejected"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFriendshipSchema = createInsertSchema(friendshipsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;
export type FriendshipRecord = typeof friendshipsTable.$inferSelect;
