import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryTable } from "@workspace/db";
import { eq, lte } from "drizzle-orm";
import { CreateInventoryItemBody, UpdateInventoryItemBody, UpdateInventoryItemParams, DeleteInventoryItemParams } from "@workspace/api-zod";

const router = Router();

function mapItem(item: typeof inventoryTable.$inferSelect) {
  const qty = parseFloat(item.quantity);
  const threshold = parseFloat(item.alertThreshold);
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: qty,
    unit: item.unit,
    alertThreshold: threshold,
    isLowStock: qty <= threshold,
    costPerUnit: parseFloat(item.costPerUnit),
  };
}

router.get("/", async (req, res) => {
  try {
    const items = await db.select().from(inventoryTable).orderBy(inventoryTable.name);
    res.json(items.map(mapItem));
  } catch (err) {
    req.log.error({ err }, "Failed to list inventory");
    res.status(500).json({ error: "Failed to list inventory" });
  }
});

router.get("/low-stock", async (req, res) => {
  try {
    const items = await db.select().from(inventoryTable).orderBy(inventoryTable.name);
    const lowStock = items.filter(
      (item) => parseFloat(item.quantity) <= parseFloat(item.alertThreshold)
    );
    res.json(lowStock.map(mapItem));
  } catch (err) {
    req.log.error({ err }, "Failed to get low stock items");
    res.status(500).json({ error: "Failed to get low stock items" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = CreateInventoryItemBody.parse(req.body);
    const [item] = await db.insert(inventoryTable).values({
      name: body.name,
      category: body.category,
      quantity: String(body.quantity),
      unit: body.unit,
      alertThreshold: String(body.alertThreshold),
      costPerUnit: String(body.costPerUnit),
    }).returning();
    res.status(201).json(mapItem(item));
  } catch (err) {
    req.log.error({ err }, "Failed to create inventory item");
    res.status(400).json({ error: "Invalid inventory data" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = UpdateInventoryItemParams.parse({ id: parseInt(req.params.id) });
    const body = UpdateInventoryItemBody.parse(req.body);
    const [item] = await db.update(inventoryTable).set({
      name: body.name,
      category: body.category,
      quantity: String(body.quantity),
      unit: body.unit,
      alertThreshold: String(body.alertThreshold),
      costPerUnit: String(body.costPerUnit),
    }).where(eq(inventoryTable.id, id)).returning();
    if (!item) return void res.status(404).json({ error: "Not found" });
    res.json(mapItem(item));
  } catch (err) {
    req.log.error({ err }, "Failed to update inventory item");
    res.status(400).json({ error: "Invalid data" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = DeleteInventoryItemParams.parse({ id: parseInt(req.params.id) });
    await db.delete(inventoryTable).where(eq(inventoryTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete inventory item");
    res.status(500).json({ error: "Failed to delete item" });
  }
});

export default router;
