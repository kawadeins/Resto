import { Router } from "express";
import { db } from "@workspace/db";
import { employeeOffDaysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireManagerOrAbove } from "../middleware/role-guard";

const router = Router();

// GET /api/employee-days — list all off day records
router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(employeeOffDaysTable);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list employee off days");
    res.status(500).json({ error: "Failed to list employee off days" });
  }
});

// POST /api/employee-days — toggle an off day (creates if not exists, deletes if exists)
router.post("/toggle", requireManagerOrAbove(), async (req, res) => {
  try {
    const { employeeId, dayOfWeek } = req.body as { employeeId: number; dayOfWeek: string };
    if (!employeeId || !dayOfWeek) return res.status(400).json({ error: "employeeId and dayOfWeek required" });

    const [existing] = await db
      .select()
      .from(employeeOffDaysTable)
      .where(and(eq(employeeOffDaysTable.employeeId, employeeId), eq(employeeOffDaysTable.dayOfWeek, dayOfWeek)));

    if (existing) {
      await db.delete(employeeOffDaysTable).where(eq(employeeOffDaysTable.id, existing.id));
      return res.json({ action: "removed", dayOfWeek, employeeId });
    } else {
      const [created] = await db
        .insert(employeeOffDaysTable)
        .values({ employeeId, dayOfWeek })
        .returning();
      return res.status(201).json({ action: "added", ...created });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to toggle employee off day");
    res.status(500).json({ error: "Failed to toggle off day" });
  }
});

// DELETE /api/employee-days/:id
router.delete("/:id", requireManagerOrAbove(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(employeeOffDaysTable).where(eq(employeeOffDaysTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete employee off day");
    res.status(500).json({ error: "Failed to delete off day" });
  }
});

export default router;
