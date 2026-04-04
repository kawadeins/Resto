import { pgTable, text, serial, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appFeedbackTable = pgTable("app_feedback", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }),
  rating: integer("rating").notNull(),
  feedbackText: text("feedback_text"),
  source: varchar("source", { length: 50 }).default("prompt"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAppFeedbackSchema = createInsertSchema(appFeedbackTable).omit({ id: true, createdAt: true });
export type InsertAppFeedback = z.infer<typeof insertAppFeedbackSchema>;
export type AppFeedbackRecord = typeof appFeedbackTable.$inferSelect;
