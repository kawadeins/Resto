import { Router } from "express";
import { db } from "@workspace/db";
import { shiftsTable, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateShiftBody, DeleteShiftParams } from "@workspace/api-zod";
import { getUnavailableEmployeeIds } from "../lib/staff-availability";

const router = Router();

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

router.get("/working-now", async (req, res) => {
  try {
    const now = new Date();
    const dayOfWeek = DAYS[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayStr = todayDate();

    const unavailable = await getUnavailableEmployeeIds(dayOfWeek, todayStr);

    const rows = await db
      .select({
        id: shiftsTable.id,
        employeeId: shiftsTable.employeeId,
        employeeName: employeesTable.name,
        role: employeesTable.role,
        dayOfWeek: shiftsTable.dayOfWeek,
        startTime: shiftsTable.startTime,
        endTime: shiftsTable.endTime,
      })
      .from(shiftsTable)
      .innerJoin(employeesTable, eq(shiftsTable.employeeId, employeesTable.id))
      .where(eq(shiftsTable.dayOfWeek, dayOfWeek));

    const workingNow = rows
      .filter((r) => !unavailable.has(r.employeeId))
      .filter((r) => {
        const startMin = timeToMinutes(r.startTime);
        const endMin = timeToMinutes(r.endTime);
        if (endMin < startMin) {
          return currentMinutes >= startMin || currentMinutes < endMin;
        }
        return currentMinutes >= startMin && currentMinutes < endMin;
      });

    const result = workingNow.map((r) => {
      const endMin = timeToMinutes(r.endTime);
      const minutesUntilEnd = endMin > currentMinutes
        ? endMin - currentMinutes
        : (24 * 60 - currentMinutes) + endMin;
      return {
        id: r.employeeId,
        name: r.employeeName,
        role: r.role,
        shiftStart: r.startTime,
        shiftEnd: r.endTime,
        dayOfWeek: r.dayOfWeek,
        minutesUntilEnd,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get working now");
    res.status(500).json({ error: "Failed to get working now" });
  }
});

router.get("/upcoming-reminders", async (req, res) => {
  try {
    const now = new Date();
    const dayOfWeek = DAYS[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const windowEnd = currentMinutes + 30;
    const todayStr = todayDate();

    const unavailable = await getUnavailableEmployeeIds(dayOfWeek, todayStr);

    const rows = await db
      .select({
        employeeId: shiftsTable.employeeId,
        employeeName: employeesTable.name,
        role: employeesTable.role,
        dayOfWeek: shiftsTable.dayOfWeek,
        startTime: shiftsTable.startTime,
        endTime: shiftsTable.endTime,
      })
      .from(shiftsTable)
      .innerJoin(employeesTable, eq(shiftsTable.employeeId, employeesTable.id))
      .where(eq(shiftsTable.dayOfWeek, dayOfWeek));

    const reminders = rows
      .filter((r) => !unavailable.has(r.employeeId))
      .filter((r) => {
        const startMin = timeToMinutes(r.startTime);
        return startMin > currentMinutes && startMin <= windowEnd;
      })
      .map((r) => ({
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        role: r.role,
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        minutesUntilStart: timeToMinutes(r.startTime) - currentMinutes,
      }));

    res.json(reminders);
  } catch (err) {
    req.log.error({ err }, "Failed to get shift reminders");
    res.status(500).json({ error: "Failed to get shift reminders" });
  }
});

router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: shiftsTable.id,
        employeeId: shiftsTable.employeeId,
        employeeName: employeesTable.name,
        dayOfWeek: shiftsTable.dayOfWeek,
        startTime: shiftsTable.startTime,
        endTime: shiftsTable.endTime,
      })
      .from(shiftsTable)
      .innerJoin(employeesTable, eq(shiftsTable.employeeId, employeesTable.id))
      .orderBy(shiftsTable.dayOfWeek, shiftsTable.startTime);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list shifts");
    res.status(500).json({ error: "Failed to list shifts" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateShiftBody.parse(req.body);
    const [shift] = await db.insert(shiftsTable).values({
      employeeId: body.employeeId,
      dayOfWeek: body.dayOfWeek,
      startTime: body.startTime,
      endTime: body.endTime,
    }).returning();

    const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, shift.employeeId));

    res.status(201).json({
      id: shift.id,
      employeeId: shift.employeeId,
      employeeName: employee?.name ?? "Unknown",
      dayOfWeek: shift.dayOfWeek,
      startTime: shift.startTime,
      endTime: shift.endTime,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create shift");
    res.status(400).json({ error: "Invalid shift data" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeleteShiftParams.parse({ id: parseInt(req.params.id) });
    await db.delete(shiftsTable).where(eq(shiftsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete shift");
    res.status(500).json({ error: "Failed to delete shift" });
  }
});

export default router;
