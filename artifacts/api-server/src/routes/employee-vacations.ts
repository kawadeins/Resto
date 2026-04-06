import { Router } from "express";
import { db } from "@workspace/db";
import { employeeVacationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireManagerOrAbove } from "../middleware/role-guard";

const router = Router();

// GET /api/employee-vacations — list all vacation records
router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(employeeVacationsTable).orderBy(employeeVacationsTable.startDate);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list vacations");
    res.status(500).json({ error: "Failed to list vacations" });
  }
});

// POST /api/employee-vacations — create a vacation period
router.post("/", requireManagerOrAbove(), async (req, res) => {
  try {
    const { employeeId, startDate, endDate, notes } = req.body as {
      employeeId: number;
      startDate: string;
      endDate: string;
      notes?: string;
    };
    if (!employeeId || !startDate || !endDate) {
      return res.status(400).json({ error: "employeeId, startDate, and endDate required" });
    }
    if (endDate < startDate) {
      return res.status(400).json({ error: "endDate must be >= startDate" });
    }
    const [created] = await db
      .insert(employeeVacationsTable)
      .values({ employeeId, startDate, endDate, notes })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create vacation");
    res.status(500).json({ error: "Failed to create vacation" });
  }
});

// DELETE /api/employee-vacations/:id
router.delete("/:id", requireManagerOrAbove(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(employeeVacationsTable).where(eq(employeeVacationsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete vacation");
    res.status(500).json({ error: "Failed to delete vacation" });
  }
});

export default router;
