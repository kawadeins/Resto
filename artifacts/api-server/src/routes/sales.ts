import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { CreateSaleRecordBody } from "@workspace/api-zod";
import { requireManagerOrAbove } from "../middleware/role-guard";

const router = Router();

function mapSale(s: typeof salesTable.$inferSelect) {
  return {
    id: s.id,
    date: s.date,
    revenue: parseFloat(s.revenue),
    profit: parseFloat(s.profit),
    popularDishes: s.popularDishes ?? [],
    covers: s.covers,
  };
}

router.get("/", async (req, res) => {
  try {
    const sales = await db.select().from(salesTable).orderBy(salesTable.date);
    res.json(sales.map(mapSale));
  } catch (err) {
    req.log.error({ err }, "Failed to list sales");
    res.status(500).json({ error: "Failed to list sales" });
  }
});

router.post("/", requireManagerOrAbove(), async (req, res) => {
  try {
    const body = CreateSaleRecordBody.parse(req.body);
    const [sale] = await db.insert(salesTable).values({
      date: body.date,
      revenue: String(body.revenue),
      profit: String(body.profit),
      popularDishes: body.popularDishes,
      covers: body.covers,
    }).returning();
    res.status(201).json(mapSale(sale));
  } catch (err) {
    req.log.error({ err }, "Failed to create sale");
    res.status(400).json({ error: "Invalid sale data" });
  }
});

router.get("/finances-summary", async (req, res) => {
  try {
    const sales = await db.select().from(salesTable).orderBy(salesTable.date);

    const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.revenue), 0);
    const totalProfit = sales.reduce((sum, s) => sum + parseFloat(s.profit), 0);
    const avgDailyRevenue = sales.length > 0 ? totalRevenue / sales.length : 0;
    const avgProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const dishCounts: Record<string, number> = {};
    for (const sale of sales) {
      for (const dish of sale.popularDishes ?? []) {
        dishCounts[dish] = (dishCounts[dish] ?? 0) + 1;
      }
    }
    const topDishes = Object.entries(dishCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const monthlyMap: Record<string, { revenue: number; profit: number }> = {};
    for (const sale of sales) {
      const d = new Date(sale.date);
      const key = d.toLocaleString("default", { month: "short", year: "numeric" });
      if (!monthlyMap[key]) monthlyMap[key] = { revenue: 0, profit: 0 };
      monthlyMap[key].revenue += parseFloat(sale.revenue);
      monthlyMap[key].profit += parseFloat(sale.profit);
    }
    const revenueByMonth = Object.entries(monthlyMap).map(([month, vals]) => ({
      month,
      revenue: vals.revenue,
      profit: vals.profit,
    }));

    res.json({
      totalRevenue,
      totalProfit,
      avgDailyRevenue,
      avgProfitMargin,
      topDishes,
      revenueByMonth,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get finances summary");
    res.status(500).json({ error: "Failed to get finances summary" });
  }
});

export default router;
