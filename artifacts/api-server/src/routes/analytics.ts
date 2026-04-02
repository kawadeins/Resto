import { Router } from "express";
import { db } from "@workspace/db";
import { salesTable, reservationsTable } from "@workspace/db";
import { sql, gte } from "drizzle-orm";

const router = Router();

router.get("/performance", async (req, res) => {
  try {
    const allSales = await db.select().from(salesTable).orderBy(salesTable.date);

    const monthly = new Map<string, { month: string; revenue: number; profit: number; expenses: number }>();
    for (const row of allSales) {
      const d = new Date(row.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      const rev = parseFloat(row.revenue);
      const prof = parseFloat(row.profit);
      const exp = parseFloat(row.expenses ?? "0");

      if (!monthly.has(key)) {
        monthly.set(key, { month: label, revenue: 0, profit: 0, expenses: 0 });
      }
      const m = monthly.get(key)!;
      m.revenue = Math.round((m.revenue + rev) * 100) / 100;
      m.profit = Math.round((m.profit + prof) * 100) / 100;
      m.expenses = Math.round((m.expenses + exp) * 100) / 100;
    }

    const monthlyData = Array.from(monthly.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, v]) => v);

    const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
    const totalProfit = monthlyData.reduce((s, m) => s + m.profit, 0);
    const avgMonthlyRevenue = monthlyData.length > 0 ? totalRevenue / monthlyData.length : 0;

    const reservationRows = await db.execute(sql`
      SELECT
        TO_CHAR(date::date, 'Mon YYYY') as month,
        COUNT(*) as count
      FROM reservations
      GROUP BY TO_CHAR(date::date, 'Mon YYYY'), DATE_TRUNC('month', date::date)
      ORDER BY DATE_TRUNC('month', date::date)
      LIMIT 12
    `);

    const reservationsByMonth = (reservationRows.rows as { month: string; count: string }[]).map((r) => ({
      month: r.month,
      count: parseInt(r.count),
    }));

    res.json({
      monthlyData,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      avgMonthlyRevenue: Math.round(avgMonthlyRevenue * 100) / 100,
      profitMarginOverall: totalRevenue > 0
        ? Math.round((totalProfit / totalRevenue) * 10000) / 100
        : 0,
      reservationsByMonth,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get performance analytics");
    res.status(500).json({ error: "Failed to get performance analytics" });
  }
});

router.get("/daily", async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split("T")[0];

    const salesRows = await db.execute(sql`
      SELECT
        date::text,
        SUM(revenue::numeric) as revenue,
        SUM(profit::numeric) as profit
      FROM sales
      WHERE date >= ${cutoffDate}
      GROUP BY date
      ORDER BY date
    `);

    const reservationRows = await db.execute(sql`
      SELECT date, COUNT(*) as count
      FROM reservations
      WHERE date >= ${cutoffDate}
      GROUP BY date
      ORDER BY date
    `);

    const reservationMap = new Map<string, number>();
    for (const r of reservationRows.rows as { date: string; count: string }[]) {
      reservationMap.set(r.date, parseInt(r.count));
    }

    const result = (salesRows.rows as { date: string; revenue: string; profit: string }[]).map((r) => ({
      date: r.date,
      revenue: Math.round(parseFloat(r.revenue) * 100) / 100,
      profit: Math.round(parseFloat(r.profit) * 100) / 100,
      covers: Math.floor(parseFloat(r.revenue) / 35),
      reservations: reservationMap.get(r.date) ?? 0,
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get daily analytics");
    res.status(500).json({ error: "Failed to get daily analytics" });
  }
});

export default router;
