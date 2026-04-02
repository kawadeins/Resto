import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable, inventoryTable, salesTable } from "@workspace/db";
import { eq, lte, sql } from "drizzle-orm";

const router = Router();

router.get("/summary", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const [todaySale] = await db
      .select()
      .from(salesTable)
      .where(eq(salesTable.date, today))
      .limit(1);

    const activeStaffRows = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.status, "active"));

    const allInventory = await db.select().from(inventoryTable);
    const lowStockCount = allInventory.filter(
      (item) => parseFloat(item.quantity) <= parseFloat(item.alertThreshold)
    ).length;

    const tableTotal = 20;
    const tableOccupancy = Math.floor(Math.random() * 10) + 8;

    res.json({
      todayProfit: todaySale ? parseFloat(todaySale.profit) : 0,
      todayRevenue: todaySale ? parseFloat(todaySale.revenue) : 0,
      activeStaff: activeStaffRows.length,
      lowStockAlerts: lowStockCount,
      tableOccupancy,
      tableTotal,
      tableOccupancyPercent: Math.round((tableOccupancy / tableTotal) * 100),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get overview summary");
    res.status(500).json({ error: "Failed to get overview summary" });
  }
});

router.get("/sales-chart", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        TO_CHAR(date::date, 'Mon YYYY') as month,
        SUM(revenue::numeric) as revenue,
        SUM(profit::numeric) as profit
      FROM sales
      GROUP BY TO_CHAR(date::date, 'Mon YYYY'), DATE_TRUNC('month', date::date)
      ORDER BY DATE_TRUNC('month', date::date)
      LIMIT 12
    `);

    const data = (rows.rows as { month: string; revenue: string; profit: string }[]).map((r) => ({
      month: r.month,
      revenue: parseFloat(r.revenue),
      profit: parseFloat(r.profit),
    }));

    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to get sales chart");
    res.status(500).json({ error: "Failed to get sales chart" });
  }
});

export default router;
