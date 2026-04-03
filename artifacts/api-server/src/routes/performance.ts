import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable, shiftsTable, shiftAttendanceTable } from "@workspace/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) + (m || 0) / 60;
}

function shiftHours(start: string, end: string): number {
  const s = parseTime(start);
  let e = parseTime(end);
  if (e < s) e += 24;
  return Math.max(0, e - s);
}

// GET /api/performance/summary
// Returns all active employees with payroll & attendance metrics
router.get("/summary", async (req, res) => {
  try {
    const employees = await db.select().from(employeesTable).where(eq(employeesTable.status, "active"));
    const shifts = await db.select().from(shiftsTable);

    // Get attendance for the current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

    const attendance = await db.select().from(shiftAttendanceTable)
      .where(gte(shiftAttendanceTable.shiftDate, monthStart));

    const result = employees.map(emp => {
      const empShifts = shifts.filter(s => s.employeeId === emp.id);

      // Calculate weekly scheduled hours from the shift schedule
      const weeklyScheduledHours = empShifts.reduce((acc, s) => {
        return acc + shiftHours(s.startTime, s.endTime);
      }, 0);

      // Monthly scheduled hours ≈ weekly * 4.33
      const monthlyScheduledHours = Math.round(weeklyScheduledHours * 4.33 * 10) / 10;

      // Attendance metrics for this month
      const empAttendance = attendance.filter(a => a.employeeId === emp.id);
      const totalAttendanceRecords = empAttendance.length;
      const confirmedCount = empAttendance.filter(a => a.status === "confirmed" || a.status === "late").length;
      const missedCount = empAttendance.filter(a => a.status === "missed").length;
      const attendanceRate = totalAttendanceRecords > 0
        ? Math.round((confirmedCount / totalAttendanceRecords) * 100)
        : null;

      // Compute actual hours worked from confirmed attendance records
      // Each attendance record corresponds to one shift
      let actualHoursThisMonth = 0;
      for (const att of empAttendance) {
        if (att.status === "confirmed" || att.status === "late") {
          const shift = shifts.find(s => s.id === att.shiftId);
          if (shift) {
            actualHoursThisMonth += shiftHours(shift.startTime, shift.endTime);
          }
        }
      }
      actualHoursThisMonth = Math.round(actualHoursThisMonth * 10) / 10;

      const hourlyRate = parseFloat(emp.hourlyRate ?? "15.00");
      const projectedMonthlyPay = Math.round(monthlyScheduledHours * hourlyRate * 100) / 100;
      const actualPayThisMonth = Math.round(actualHoursThisMonth * hourlyRate * 100) / 100;

      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        email: emp.email,
        phone: emp.phone,
        status: emp.status,
        hourlyRate,
        shiftsPerWeek: empShifts.length,
        weeklyScheduledHours,
        monthlyScheduledHours,
        actualHoursThisMonth,
        projectedMonthlyPay,
        actualPayThisMonth,
        totalAttendanceRecords,
        confirmedCount,
        missedCount,
        attendanceRate,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get performance summary");
    res.status(500).json({ error: "Failed to get performance summary" });
  }
});

const SetRateBody = z.object({
  employeeId: z.number(),
  hourlyRate: z.number().positive().max(500),
});

// POST /api/performance/set-rate
// Update the hourly rate of an employee
router.post("/set-rate", async (req, res) => {
  try {
    const { employeeId, hourlyRate } = SetRateBody.parse(req.body);

    const [updated] = await db.update(employeesTable)
      .set({ hourlyRate: String(hourlyRate), updatedAt: new Date() })
      .where(eq(employeesTable.id, employeeId))
      .returning();

    if (!updated) return void res.status(404).json({ error: "Employee not found" });

    res.json({ success: true, employeeId, hourlyRate });
  } catch (err) {
    req.log.error({ err }, "Failed to set hourly rate");
    res.status(500).json({ error: "Failed to set hourly rate" });
  }
});

// GET /api/performance/leaderboard
// Returns top performers sorted by attendance rate
router.get("/leaderboard", async (req, res) => {
  try {
    const employees = await db.select().from(employeesTable).where(eq(employeesTable.status, "active"));
    const shifts = await db.select().from(shiftsTable);
    const attendance = await db.select().from(shiftAttendanceTable);

    const leaderboard = employees.map(emp => {
      const empAttendance = attendance.filter(a => a.employeeId === emp.id);
      const confirmed = empAttendance.filter(a => a.status === "confirmed").length;
      const late = empAttendance.filter(a => a.status === "late").length;
      const missed = empAttendance.filter(a => a.status === "missed").length;
      const total = confirmed + late + missed;
      const attendanceRate = total > 0 ? Math.round(((confirmed + late) / total) * 100) : null;
      const reliabilityScore = total > 0
        ? Math.round(((confirmed * 1.0 + late * 0.75) / total) * 100)
        : null;

      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        totalShiftsTracked: total,
        confirmedCount: confirmed,
        lateCount: late,
        missedCount: missed,
        attendanceRate,
        reliabilityScore,
      };
    }).filter(e => e.totalShiftsTracked > 0)
      .sort((a, b) => (b.reliabilityScore ?? 0) - (a.reliabilityScore ?? 0));

    res.json(leaderboard);
  } catch (err) {
    req.log.error({ err }, "Failed to get leaderboard");
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

export default router;
