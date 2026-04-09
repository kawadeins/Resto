import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().default(1),
  type: text("type").notNull(), // win_back | thank_you | flash_blast | loyalty_reward
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"), // draft | sent | completed
  targetSegment: text("target_segment").notNull(), // inactive | new | returning | high_value | all
  messageTemplate: text("message_template").notNull(),
  offerDetails: text("offer_details"), // JSON: { discountPercent, validHours, notes }
  totalSent: integer("total_sent").notNull().default(0),
  totalConverted: integer("total_converted").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignSendsTable = pgTable("campaign_sends", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().default(1),
  campaignId: integer("campaign_id").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  segment: text("segment").notNull(),
  status: text("status").notNull().default("sent"), // sent | converted | bounced
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type CampaignRecord = typeof campaignsTable.$inferSelect;

export const insertCampaignSendSchema = createInsertSchema(campaignSendsTable).omit({ id: true, sentAt: true });
export type InsertCampaignSend = z.infer<typeof insertCampaignSendSchema>;
export type CampaignSendRecord = typeof campaignSendsTable.$inferSelect;
