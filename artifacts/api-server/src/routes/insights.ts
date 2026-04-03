import { Router } from "express";
import { db } from "@workspace/db";
import { reservationsTable, discountsTable, salesTable } from "@workspace/db";
import { gte } from "drizzle-orm";

const router = Router();

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DISPLAY_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun
const DISPLAY_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 10); // 10am–10pm

function formatHour(h: number): string {
  if (h === 12) return "12pm";
  if (h === 0) return "12am";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function formatTime(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

// ─── Core analysis helper ────────────────────────────────────────────────────
async function buildReservationMatrix() {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const sinceStr = since.toISOString().split("T")[0];

  const reservations = await db
    .select()
    .from(reservationsTable)
    .where(gte(reservationsTable.date, sinceStr));

  // matrix[dayIndex][hour] = total booking count
  const matrix: Record<number, Record<number, number>> = {};
  const weekCounts: Record<number, number> = {};

  for (let i = 0; i < 7; i++) {
    matrix[i] = {};
    weekCounts[i] = 0;
    for (const h of HOURS) matrix[i][h] = 0;
  }

  // Count how many of each weekday exist in the 90-day window
  const startDate = new Date(sinceStr + "T00:00:00");
  const today = new Date();
  for (const d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    weekCounts[d.getDay()] = (weekCounts[d.getDay()] || 0) + 1;
  }

  for (const r of reservations) {
    if (!["pending", "confirmed", "arrived"].includes(r.status)) continue;
    const date = new Date(r.date + "T00:00:00");
    const dayIdx = date.getDay();
    const hour = parseInt(r.time.split(":")[0]);
    if (hour >= 10 && hour <= 22) {
      matrix[dayIdx][hour] = (matrix[dayIdx][hour] || 0) + 1;
    }
  }

  return { matrix, weekCounts, reservations };
}

function computeOverallAvg(matrix: Record<number, Record<number, number>>, weekCounts: Record<number, number>): number {
  let total = 0;
  let count = 0;
  for (let d = 0; d < 7; d++) {
    const wc = weekCounts[d] || 1;
    for (const h of HOURS) {
      total += (matrix[d][h] || 0) / wc;
      count++;
    }
  }
  return count > 0 ? total / count : 0;
}

// ─── GET /api/insights/heatmap ───────────────────────────────────────────────
router.get("/heatmap", async (req, res) => {
  try {
    const { matrix, weekCounts } = await buildReservationMatrix();

    let maxValue = 0;
    const days = DISPLAY_DAYS.map((dayIdx, i) => {
      const wc = weekCounts[dayIdx] || 1;
      const hours = HOURS.map((hour) => {
        const avgPerWeek = (matrix[dayIdx][hour] || 0) / wc;
        if (avgPerWeek > maxValue) maxValue = avgPerWeek;
        return { hour, label: formatHour(hour), avgPerWeek: Math.round(avgPerWeek * 10) / 10 };
      });
      return { day: DISPLAY_DAY_NAMES[i], dayIndex: dayIdx, hours };
    });

    res.json({ days, maxValue: Math.max(maxValue, 0.1), hours: HOURS.map((h) => ({ hour: h, label: formatHour(h) })) });
  } catch (err) {
    req.log.error({ err }, "Failed to get heatmap");
    res.status(500).json({ error: "Failed to get heatmap" });
  }
});

// ─── GET /api/insights/suggestions ──────────────────────────────────────────
router.get("/suggestions", async (req, res) => {
  try {
    const { matrix, weekCounts } = await buildReservationMatrix();
    const overallAvg = computeOverallAvg(matrix, weekCounts);
    const deadThreshold = overallAvg * 0.5;

    const suggestions: object[] = [];
    let sid = 1;

    for (let di = 0; di < DISPLAY_DAYS.length; di++) {
      const dayIdx = DISPLAY_DAYS[di];
      const dayName = DISPLAY_DAY_NAMES[di];
      const wc = weekCounts[dayIdx] || 1;

      const hourAvgs = HOURS.map((h) => ({ hour: h, avg: (matrix[dayIdx][h] || 0) / wc }));

      let i = 0;
      while (i < hourAvgs.length) {
        if (hourAvgs[i].avg <= deadThreshold) {
          let j = i;
          while (j < hourAvgs.length && hourAvgs[j].avg <= deadThreshold) j++;

          const rangeStart = hourAvgs[i].hour;
          const rangeEnd = hourAvgs[j - 1].hour + 1;
          const rangeLen = j - i;
          const avgInRange = hourAvgs.slice(i, j).reduce((s, h) => s + h.avg, 0) / rangeLen;
          const severity = overallAvg > 0 ? 1 - avgInRange / overallAvg : 1;

          let pct: number;
          let sev: string;
          if (severity >= 0.85) { pct = 25; sev = "high"; }
          else if (severity >= 0.65) { pct = 20; sev = "medium"; }
          else { pct = 15; sev = "low"; }

          suggestions.push({
            id: `sug-${sid++}`,
            type: "scheduled",
            title: `Boost ${dayName} ${formatHour(rangeStart)}–${formatHour(rangeEnd)}`,
            description: `${dayName} between ${formatHour(rangeStart)} and ${formatHour(rangeEnd)} averages only ${avgInRange.toFixed(1)} bookings/week. A ${pct}% discount could fill these quiet tables.`,
            dayOfWeek: dayName,
            days: [dayName],
            startTime: formatTime(rangeStart),
            endTime: formatTime(rangeEnd),
            suggestedPercentage: pct,
            severity: sev,
            avgBookingsPerWeek: Math.round(avgInRange * 10) / 10,
            reason: `${Math.round(severity * 100)}% below average — only ${avgInRange.toFixed(1)} bookings/week in this slot`,
          });

          i = j;
        } else {
          i++;
        }
      }
    }

    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a: any, b: any) => order[a.severity] - order[b.severity]);
    res.json(suggestions.slice(0, 6));
  } catch (err) {
    req.log.error({ err }, "Failed to get suggestions");
    res.status(500).json({ error: "Failed to get suggestions" });
  }
});

// ─── GET /api/insights/daily-summary ────────────────────────────────────────
router.get("/daily-summary", async (req, res) => {
  try {
    const { matrix, weekCounts } = await buildReservationMatrix();
    const overallAvg = computeOverallAvg(matrix, weekCounts);

    const todayIdx = new Date().getDay();
    const tomorrowIdx = (todayIdx + 1) % 7;

    const todayHours = HOURS.map((h) => ({
      hour: h,
      avg: (matrix[todayIdx][h] || 0) / (weekCounts[todayIdx] || 1),
    }));
    const weakestToday = todayHours.reduce((a, b) => (a.avg < b.avg ? a : b));

    const tomorrowTotal = HOURS.reduce(
      (s, h) => s + (matrix[tomorrowIdx][h] || 0) / (weekCounts[tomorrowIdx] || 1),
      0
    );
    const tomorrowAvgPerHour = tomorrowTotal / HOURS.length;
    const tomorrowIsWeak = tomorrowAvgPerHour < overallAvg * 0.65;

    let message: string;
    let severity: string;
    let suggestedPercentage: number;
    let actionType: string;

    if (weakestToday.avg < overallAvg * 0.35 && weakestToday.avg < 0.5) {
      severity = "high";
      suggestedPercentage = 25;
      actionType = "flash";
      message = `${DAYS_OF_WEEK[todayIdx]} ${formatHour(weakestToday.hour)}–${formatHour(weakestToday.hour + 2)} is your quietest slot today with virtually no bookings historically. Activate a flash deal now to pull in walk-ins.`;
    } else if (tomorrowIsWeak) {
      severity = "medium";
      suggestedPercentage = 20;
      actionType = "scheduled";
      message = `${DAYS_OF_WEEK[tomorrowIdx]} is one of your slower days. A recurring discount during off-peak hours could add ${Math.round(overallAvg * 2)} extra covers per week.`;
    } else if (weakestToday.avg < overallAvg * 0.5) {
      severity = "medium";
      suggestedPercentage = 15;
      actionType = "flash";
      message = `Today's ${formatHour(weakestToday.hour)} hour is tracking below average. A short flash deal could turn a quiet period into a profitable one.`;
    } else {
      severity = "low";
      suggestedPercentage = 10;
      actionType = "flash";
      message = `Bookings are looking solid today. Keep an eye on later this evening — a targeted flash deal can maximise tonight's covers.`;
    }

    res.json({
      message,
      severity,
      actionType,
      suggestedPercentage,
      todayDayName: DAYS_OF_WEEK[todayIdx],
      tomorrowDayName: DAYS_OF_WEEK[tomorrowIdx],
      weakestHour: weakestToday.hour,
      weakestHourLabel: formatHour(weakestToday.hour),
      overallAvgPerSlot: Math.round(overallAvg * 100) / 100,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get daily summary");
    res.status(500).json({ error: "Failed to get daily summary" });
  }
});

// ─── GET /api/insights/outcomes ─────────────────────────────────────────────
router.get("/outcomes", async (req, res) => {
  try {
    const { matrix, weekCounts, reservations: allReservations } = await buildReservationMatrix();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const allDiscounts = await db.select().from(discountsTable);
    const recentDiscounts = allDiscounts
      .filter((d) => d.createdAt > thirtyDaysAgo)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8);

    const now = new Date();
    const outcomes: object[] = [];

    for (const discount of recentDiscounts) {
      const created = new Date(discount.createdAt);

      if (discount.type === "flash" && discount.flashExpiresAt) {
        const expires = new Date(discount.flashExpiresAt);
        const isCompleted = expires < now;
        const isActive = discount.enabled && expires > now;

        const bookingsDuring = allReservations.filter((r) => {
          const rc = new Date(r.createdAt);
          return rc >= created && rc <= expires && ["pending", "confirmed", "arrived"].includes(r.status);
        });

        const flashHour = created.getHours();
        const flashDayIdx = created.getDay();
        const wc = weekCounts[flashDayIdx] || 1;
        const historicalAvg = (matrix[flashDayIdx][flashHour] || 0) / wc;
        const lift =
          historicalAvg > 0
            ? Math.round(((bookingsDuring.length - historicalAvg) / historicalAvg) * 100)
            : bookingsDuring.length > 0
            ? 100
            : 0;

        outcomes.push({
          id: discount.id,
          label: discount.label,
          type: "flash",
          percentage: parseFloat(discount.percentage),
          activatedAt: created.toISOString(),
          status: isActive ? "active" : isCompleted ? "completed" : "expired",
          bookingsDuringDiscount: isCompleted || isActive ? bookingsDuring.length : null,
          historicalBaseline: Math.round(historicalAvg * 10) / 10,
          liftPercent: isCompleted ? lift : null,
          periodLabel: `${created.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} flash`,
        });
      } else if (discount.type === "scheduled") {
        const targetDay = discount.days?.[0];
        const dayIdx = DAYS_OF_WEEK.indexOf(targetDay ?? "");
        if (dayIdx < 0 || !discount.startTime || !discount.endTime) continue;

        const startHour = parseInt(discount.startTime.split(":")[0]);
        const endHour = parseInt(discount.endTime.split(":")[0]);
        const wc = weekCounts[dayIdx] || 1;

        let historicalTotal = 0;
        for (let h = startHour; h < endHour; h++) historicalTotal += (matrix[dayIdx][h] || 0) / wc;

        const recentInSlot = allReservations.filter((r) => {
          const rDate = new Date(r.date + "T00:00:00");
          const rDay = rDate.getDay();
          const rHour = parseInt(r.time.split(":")[0]);
          const rCreated = new Date(r.createdAt);
          return (
            rDay === dayIdx &&
            rHour >= startHour &&
            rHour < endHour &&
            rCreated >= created &&
            ["pending", "confirmed", "arrived"].includes(r.status)
          );
        });

        const weeksRunning = Math.max(1, Math.ceil((now.getTime() - created.getTime()) / (7 * 24 * 3600 * 1000)));
        const avgPerWeek = recentInSlot.length / weeksRunning;
        const lift =
          historicalTotal > 0
            ? Math.round(((avgPerWeek - historicalTotal) / historicalTotal) * 100)
            : avgPerWeek > 0
            ? 100
            : 0;

        outcomes.push({
          id: discount.id,
          label: discount.label,
          type: "scheduled",
          percentage: parseFloat(discount.percentage),
          activatedAt: created.toISOString(),
          status: discount.enabled ? "active" : "paused",
          bookingsDuringDiscount: recentInSlot.length,
          historicalBaseline: Math.round(historicalTotal * 10) / 10,
          liftPercent: weeksRunning >= 1 ? lift : null,
          periodLabel: `${targetDay} ${discount.startTime}–${discount.endTime}`,
        });
      }
    }

    res.json(outcomes);
  } catch (err) {
    req.log.error({ err }, "Failed to get outcomes");
    res.status(500).json({ error: "Failed to get outcomes" });
  }
});

export default router;
