import { Router } from "express";
import { db } from "@workspace/db";
import { shiftsTable, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateShiftBody, DeleteShiftParams } from "@workspace/api-zod";

const router = Router();

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
