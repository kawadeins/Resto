import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateEmployeeBody, UpdateEmployeeBody, GetEmployeeParams, UpdateEmployeeParams, DeleteEmployeeParams } from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const employees = await db.select().from(employeesTable).orderBy(employeesTable.name);
    res.json(employees.map((e) => ({
      id: e.id,
      name: e.name,
      role: e.role,
      email: e.email,
      phone: e.phone,
      status: e.status,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list employees");
    res.status(500).json({ error: "Failed to list employees" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateEmployeeBody.parse(req.body);
    const [employee] = await db.insert(employeesTable).values({
      name: body.name,
      role: body.role,
      email: body.email,
      phone: body.phone,
      status: body.status ?? "active",
    }).returning();
    res.status(201).json({
      id: employee.id,
      name: employee.name,
      role: employee.role,
      email: employee.email,
      phone: employee.phone,
      status: employee.status,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create employee");
    res.status(400).json({ error: "Invalid employee data" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = GetEmployeeParams.parse({ id: parseInt(req.params.id) });
    const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
    if (!employee) return void res.status(404).json({ error: "Not found" });
    res.json({
      id: employee.id,
      name: employee.name,
      role: employee.role,
      email: employee.email,
      phone: employee.phone,
      status: employee.status,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get employee");
    res.status(500).json({ error: "Failed to get employee" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = UpdateEmployeeParams.parse({ id: parseInt(req.params.id) });
    const body = UpdateEmployeeBody.parse(req.body);
    const [employee] = await db.update(employeesTable).set({
      name: body.name,
      role: body.role,
      email: body.email,
      phone: body.phone,
      status: body.status ?? "active",
    }).where(eq(employeesTable.id, id)).returning();
    if (!employee) return void res.status(404).json({ error: "Not found" });
    res.json({
      id: employee.id,
      name: employee.name,
      role: employee.role,
      email: employee.email,
      phone: employee.phone,
      status: employee.status,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update employee");
    res.status(400).json({ error: "Invalid data" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeleteEmployeeParams.parse({ id: parseInt(req.params.id) });
    await db.delete(employeesTable).where(eq(employeesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete employee");
    res.status(500).json({ error: "Failed to delete employee" });
  }
});

export default router;
