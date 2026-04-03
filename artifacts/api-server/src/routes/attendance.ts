import { Router } from "express";
import { db } from "@workspace/db";
import { shiftsTable, employeesTable, shiftAttendanceTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sendShiftMorningReminder, sendShiftPreReminder } from "../lib/email";

const router = Router();

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function makeToken(shiftId: number, date: string): string {
  return Buffer.from(`${shiftId}:${date}`).toString("base64url");
}

function parseToken(token: string): { shiftId: number; date: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [shiftIdStr, date] = decoded.split(":");
    const shiftId = parseInt(shiftIdStr, 10);
    if (!shiftId || !date) return null;
    return { shiftId, date };
  } catch {
    return null;
  }
}

function computeLiveStatus(
  confirmedAt: Date | null,
  startTime: string,
  endTime: string,
  now: Date
): "pending" | "confirmed" | "late" | "missed" {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  if (confirmedAt) {
    const h = confirmedAt.getHours();
    const m = confirmedAt.getMinutes();
    const confirmedMinutes = h * 60 + m;
    return confirmedMinutes <= startMin ? "confirmed" : "late";
  }

  if (nowMinutes > endMin) return "missed";
  return "pending";
}

async function getTodayShifts() {
  const now = new Date();
  const dayOfWeek = DAYS[now.getDay()];
  return db
    .select({
      shiftId: shiftsTable.id,
      employeeId: employeesTable.id,
      employeeName: employeesTable.name,
      employeeEmail: employeesTable.email,
      role: employeesTable.role,
      startTime: shiftsTable.startTime,
      endTime: shiftsTable.endTime,
    })
    .from(shiftsTable)
    .innerJoin(employeesTable, eq(shiftsTable.employeeId, employeesTable.id))
    .where(and(eq(shiftsTable.dayOfWeek, dayOfWeek), eq(employeesTable.status, "active")));
}

async function ensureAttendanceRecord(shiftId: number, employeeId: number, date: string) {
  const [existing] = await db
    .select()
    .from(shiftAttendanceTable)
    .where(and(eq(shiftAttendanceTable.shiftId, shiftId), eq(shiftAttendanceTable.shiftDate, date)));
  if (existing) return existing;
  const [created] = await db
    .insert(shiftAttendanceTable)
    .values({ shiftId, employeeId, shiftDate: date, status: "pending" })
    .returning();
  return created;
}

// GET /api/attendance/today
// Returns all today's shifts with live attendance status, triggers reminders automatically
router.get("/today", async (req, res) => {
  try {
    const now = new Date();
    const today = todayDate();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const appBaseUrl = process.env.APP_BASE_URL ?? `http://localhost:${process.env.PORT ?? 5000}`;

    const shifts = await getTodayShifts();
    if (shifts.length === 0) return res.json([]);

    const results = [];

    for (const shift of shifts) {
      const record = await ensureAttendanceRecord(shift.shiftId, shift.employeeId, today);
      const liveStatus = computeLiveStatus(record.confirmedAt, shift.startTime, shift.endTime, now);

      if (liveStatus !== record.status) {
        await db
          .update(shiftAttendanceTable)
          .set({ status: liveStatus })
          .where(eq(shiftAttendanceTable.id, record.id));
      }

      const startMin = timeToMinutes(shift.startTime);
      const confirmUrl = `${appBaseUrl}/api/attendance/confirm?token=${makeToken(shift.shiftId, today)}`;

      // Morning reminder — send once, only while shift hasn't ended
      if (!record.morningReminderSentAt && nowMinutes < timeToMinutes(shift.endTime)) {
        sendShiftMorningReminder({
          employeeEmail: shift.employeeEmail,
          employeeName: shift.employeeName,
          shiftDate: today,
          startTime: shift.startTime,
          endTime: shift.endTime,
          confirmUrl,
          shiftId: shift.shiftId,
        })
          .then(() =>
            db
              .update(shiftAttendanceTable)
              .set({ morningReminderSentAt: new Date() })
              .where(eq(shiftAttendanceTable.id, record.id))
              .catch(() => {})
          )
          .catch(() => {});
      }

      // Pre-shift reminder — send once when 15–30 min before start
      const minutesUntilStart = startMin - nowMinutes;
      if (!record.preShiftReminderSentAt && minutesUntilStart > 0 && minutesUntilStart <= 30) {
        sendShiftPreReminder({
          employeeEmail: shift.employeeEmail,
          employeeName: shift.employeeName,
          startTime: shift.startTime,
          endTime: shift.endTime,
          confirmUrl,
          shiftId: shift.shiftId,
          minutesUntil: Math.round(minutesUntilStart),
        })
          .then(() =>
            db
              .update(shiftAttendanceTable)
              .set({ preShiftReminderSentAt: new Date() })
              .where(eq(shiftAttendanceTable.id, record.id))
              .catch(() => {})
          )
          .catch(() => {});
      }

      results.push({
        shiftId: shift.shiftId,
        attendanceId: record.id,
        employeeId: shift.employeeId,
        employeeName: shift.employeeName,
        employeeEmail: shift.employeeEmail,
        role: shift.role,
        startTime: shift.startTime,
        endTime: shift.endTime,
        status: liveStatus,
        confirmedAt: record.confirmedAt?.toISOString() ?? null,
        morningReminderSent: !!record.morningReminderSentAt,
        preShiftReminderSent: !!record.preShiftReminderSentAt,
        confirmToken: makeToken(shift.shiftId, today),
      });
    }

    results.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    res.json(results);
  } catch (err) {
    req.log.error({ err }, "Failed to get attendance today");
    res.status(500).json({ error: "Failed to get attendance" });
  }
});

// GET /api/attendance/confirm?token=...
// Employee clicks link from email — confirms attendance via browser
router.get("/confirm", async (req, res) => {
  const { token } = req.query as { token?: string };
  if (!token) return res.status(400).send(confirmPage("Error", "Invalid confirmation link.", "#dc2626"));

  const parsed = parseToken(token);
  if (!parsed) return res.status(400).send(confirmPage("Error", "Invalid or expired confirmation link.", "#dc2626"));

  const { shiftId, date } = parsed;
  const today = todayDate();

  if (date !== today) {
    return res.send(
      confirmPage("Link Expired", `This confirmation link was for ${date}. Please use today's reminder email.`, "#dc2626")
    );
  }

  try {
    const [record] = await db
      .select()
      .from(shiftAttendanceTable)
      .where(and(eq(shiftAttendanceTable.shiftId, shiftId), eq(shiftAttendanceTable.shiftDate, date)));

    if (!record) return res.status(404).send(confirmPage("Not Found", "No shift record found. Contact your manager.", "#6b7280"));

    if (record.confirmedAt) {
      return res.send(
        confirmPage(
          "Already Confirmed",
          `Your attendance was already confirmed at ${record.confirmedAt.toLocaleTimeString()}.`,
          "#16a34a"
        )
      );
    }

    const now = new Date();
    const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, shiftId));
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = shift ? timeToMinutes(shift.startTime) : 0;
    const newStatus = nowMin <= startMin ? "confirmed" : "late";

    await db
      .update(shiftAttendanceTable)
      .set({ confirmedAt: now, status: newStatus, updatedAt: now })
      .where(eq(shiftAttendanceTable.id, record.id));

    const message =
      newStatus === "confirmed"
        ? "You're confirmed and on time — great work! See you at the restaurant."
        : "Attendance recorded. You arrived after your shift start time — please check in with your manager.";

    return res.send(confirmPage(newStatus === "confirmed" ? "Attendance Confirmed!" : "Confirmed — Late", message, newStatus === "confirmed" ? "#16a34a" : "#f59e0b"));
  } catch {
    return res.status(500).send(confirmPage("Error", "Something went wrong. Please contact your manager.", "#dc2626"));
  }
});

// POST /api/attendance/confirm
// Admin or manager manually confirms an employee (JSON)
router.post("/confirm", async (req, res) => {
  const { attendanceId } = req.body as { attendanceId?: number };
  if (!attendanceId) return res.status(400).json({ error: "attendanceId required" });

  try {
    const [record] = await db
      .select()
      .from(shiftAttendanceTable)
      .where(eq(shiftAttendanceTable.id, attendanceId));

    if (!record) return res.status(404).json({ error: "Attendance record not found" });
    if (record.confirmedAt) return res.json({ ok: true, status: record.status, alreadyConfirmed: true });

    const now = new Date();
    const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, record.shiftId));
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = shift ? timeToMinutes(shift.startTime) : 0;
    const newStatus: "confirmed" | "late" = nowMin <= startMin ? "confirmed" : "late";

    await db
      .update(shiftAttendanceTable)
      .set({ confirmedAt: now, status: newStatus, updatedAt: now })
      .where(eq(shiftAttendanceTable.id, record.id));

    res.json({ ok: true, status: newStatus, confirmedAt: now.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to confirm attendance");
    res.status(500).json({ error: "Failed to confirm attendance" });
  }
});

// POST /api/attendance/send-reminders
// Trigger reminders manually (e.g. from admin dashboard button)
router.post("/send-reminders", async (req, res) => {
  try {
    const now = new Date();
    const today = todayDate();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const appBaseUrl = process.env.APP_BASE_URL ?? `http://localhost:${process.env.PORT ?? 5000}`;

    const shifts = await getTodayShifts();
    let sent = 0;

    for (const shift of shifts) {
      const record = await ensureAttendanceRecord(shift.shiftId, shift.employeeId, today);
      if (record.morningReminderSentAt) continue;

      const confirmUrl = `${appBaseUrl}/api/attendance/confirm?token=${makeToken(shift.shiftId, today)}`;
      await sendShiftMorningReminder({
        employeeEmail: shift.employeeEmail,
        employeeName: shift.employeeName,
        shiftDate: today,
        startTime: shift.startTime,
        endTime: shift.endTime,
        confirmUrl,
        shiftId: shift.shiftId,
      });
      await db
        .update(shiftAttendanceTable)
        .set({ morningReminderSentAt: new Date() })
        .where(eq(shiftAttendanceTable.id, record.id));
      sent++;
    }

    res.json({ ok: true, remindersSent: sent, totalShifts: shifts.length });
  } catch (err) {
    req.log.error({ err }, "Failed to send reminders");
    res.status(500).json({ error: "Failed to send reminders" });
  }
});

function confirmPage(title: string, message: string, color: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — RestoSmart</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f9fafb; min-height: 100vh;
           display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 16px; padding: 40px 32px; max-width: 420px; width: 100%;
            text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center;
            justify-content: center; margin: 0 auto 20px; font-size: 24px;
            background: ${color}20; color: ${color}; }
    h1 { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 10px; }
    p { color: #6b7280; font-size: 15px; line-height: 1.6; }
    .brand { color: #9ca3af; font-size: 12px; margin-top: 28px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${color === "#16a34a" ? "✓" : color === "#f59e0b" ? "!" : "✕"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p class="brand">RestoSmart Shift System</p>
  </div>
</body>
</html>`;
}

export default router;
