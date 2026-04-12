import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const groupReservationRequestsTable = pgTable("group_reservation_requests", {
  id: serial("id").primaryKey(),
  groupPlanId: integer("group_plan_id").notNull(),
  restaurantId: integer("restaurant_id").notNull(),
  restaurantName: text("restaurant_name").notNull().default(""),
  organizerEmail: text("organizer_email").notNull(),
  organizerName: text("organizer_name").notNull().default(""),
  partySize: integer("party_size").notNull().default(2),
  requestedDate: text("requested_date").notNull(),
  requestedTime: text("requested_time").notNull(),
  note: text("note").default(""),
  sendTiming: text("send_timing").notNull().default("sofort"),
  scheduledSendAt: timestamp("scheduled_send_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  status: text("status").notNull().default("planned"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type GroupReservationRequestRecord = typeof groupReservationRequestsTable.$inferSelect;
