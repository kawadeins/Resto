import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable, inventoryTable, salesTable, reservationsTable, shiftsTable, discountsTable, restaurantsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireManagerOrAbove } from "../middleware/role-guard";

const router = Router();

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const AVG_SPEND_BY_TYPE: Record<string, number> = {
  restaurant: 35,
  cafe: 12,
  bar: 18,
};
const TABLE_TOTAL_BY_TYPE: Record<string, number> = {
  restaurant: 20,
  cafe: 14,
  bar: 16,
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

router.get("/summary", requireManagerOrAbove(), async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const dayOfWeek = DAYS[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const twoHoursLater = currentMinutes + 120;

    const [bizRow] = await db.select({ businessType: restaurantsTable.businessType }).from(restaurantsTable).limit(1);
    const bizType = bizRow?.businessType ?? "restaurant";
    const AVG_SPEND_PER_COVER = AVG_SPEND_BY_TYPE[bizType] ?? 35;
    const tableTotal = TABLE_TOTAL_BY_TYPE[bizType] ?? 20;

    const [todaySale] = await db.select().from(salesTable).where(eq(salesTable.date, today)).limit(1);
    const activeStaffRows = await db.select().from(employeesTable).where(eq(employeesTable.status, "active"));
    const allInventory = await db.select().from(inventoryTable);
    const lowStockItems = allInventory.filter(
      (item) => parseFloat(item.quantity) <= parseFloat(item.alertThreshold)
    );

    const allShifts = await db
      .select({ startTime: shiftsTable.startTime, endTime: shiftsTable.endTime })
      .from(shiftsTable)
      .where(eq(shiftsTable.dayOfWeek, dayOfWeek));

    const workingNowCount = allShifts.filter((s) => {
      const startMin = timeToMinutes(s.startTime);
      const endMin = timeToMinutes(s.endTime);
      if (endMin < startMin) return currentMinutes >= startMin || currentMinutes < endMin;
      return currentMinutes >= startMin && currentMinutes < endMin;
    }).length;

    const upcomingShiftReminders = allShifts.filter((s) => {
      const startMin = timeToMinutes(s.startTime);
      return startMin > currentMinutes && startMin <= currentMinutes + 30;
    }).length;

    const allReservations = await db.select().from(reservationsTable);
    const todayReservations = allReservations.filter((r) => r.date === today);

    const confirmedToday = todayReservations.filter((r) => r.status === "confirmed" || r.status === "arrived");
    const pendingReservations = todayReservations.filter(
      (r) => r.status === "pending" || r.status === "confirmed"
    );

    const tableOccupancy = todayReservations.filter(
      (r) => r.status === "arrived" || r.status === "confirmed"
    ).length;

    const liveTraffic = allReservations.filter((r) => {
      if (r.date !== today) return false;
      if (r.status === "rejected" || r.status === "cancelled") return false;
      const reservationMin = timeToMinutes(r.time);
      return reservationMin >= currentMinutes && reservationMin <= twoHoursLater;
    }).length;

    const confirmedCovers = confirmedToday.reduce((sum, r) => sum + r.partySize, 0);
    const expectedRevenue = confirmedCovers * AVG_SPEND_PER_COVER;

    const allDeals = await db.select().from(discountsTable);
    const flashDeal = allDeals.find(
      (d) =>
        d.type === "flash" &&
        d.enabled &&
        d.flashExpiresAt != null &&
        new Date(d.flashExpiresAt) > now
    );

    let activeDiscount: { active: boolean; label: string | null; percentage: number | null; minutesRemaining: number | null } = {
      active: false, label: null, percentage: null, minutesRemaining: null,
    };

    if (flashDeal) {
      activeDiscount = {
        active: true,
        label: flashDeal.label,
        percentage: parseFloat(flashDeal.percentage),
        minutesRemaining: Math.max(0, Math.round((new Date(flashDeal.flashExpiresAt!).getTime() - now.getTime()) / 60000)),
      };
    } else {
      const scheduledActive = allDeals.find((d) => {
        if (d.type !== "scheduled" || !d.enabled) return false;
        if (!d.days.includes(dayOfWeek)) return false;
        const startMin = timeToMinutes(d.startTime);
        const endMin = timeToMinutes(d.endTime);
        return currentMinutes >= startMin && currentMinutes < endMin;
      });
      if (scheduledActive) {
        const endMin = timeToMinutes(scheduledActive.endTime);
        activeDiscount = {
          active: true,
          label: scheduledActive.label,
          percentage: parseFloat(scheduledActive.percentage),
          minutesRemaining: Math.max(0, endMin - currentMinutes),
        };
      }
    }

    res.json({
      todayProfit: todaySale ? parseFloat(todaySale.profit) : 0,
      todayRevenue: todaySale ? parseFloat(todaySale.revenue) : 0,
      activeStaff: activeStaffRows.length,
      workingNowCount,
      lowStockAlerts: lowStockItems.length,
      tableOccupancy,
      tableTotal,
      tableOccupancyPercent: Math.round((tableOccupancy / tableTotal) * 100),
      todayReservations: todayReservations.length,
      pendingReservations: pendingReservations.length,
      upcomingShiftReminders,
      liveTraffic,
      expectedRevenue,
      activeDiscount,
      lowStockItems: lowStockItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: parseFloat(item.quantity),
        alertThreshold: parseFloat(item.alertThreshold),
        unit: item.unit,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get overview summary");
    res.status(500).json({ error: "Failed to get overview summary" });
  }
});

router.get("/sales-chart", requireManagerOrAbove(), async (req, res) => {
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
