import { pgTable, text, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { menuItemsTable } from "./menu";

export const posSalesTable = pgTable("pos_sales", {
  id: serial("id").primaryKey(),
  menuItemId: integer("menu_item_id").notNull().references(() => menuItemsTable.id, { onDelete: "restrict" }),
  menuItemName: text("menu_item_name").notNull(),
  quantity: integer("quantity").notNull(),
  sellingPrice: numeric("selling_price", { precision: 10, scale: 2 }).notNull(),
  recipeCost: numeric("recipe_cost", { precision: 10, scale: 2 }).notNull(),
  totalRevenue: numeric("total_revenue", { precision: 10, scale: 2 }).notNull(),
  totalProfit: numeric("total_profit", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  soldAt: timestamp("sold_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PosSaleRecord = typeof posSalesTable.$inferSelect;
