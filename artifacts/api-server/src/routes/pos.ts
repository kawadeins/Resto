import { Router } from "express";
import { db } from "@workspace/db";
import { posSalesTable, menuItemsTable, menuIngredientsTable, inventoryTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const RecordPosSaleBody = z.object({
  menuItemId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  notes: z.string().optional().nullable(),
});

function mapPosSale(s: typeof posSalesTable.$inferSelect) {
  return {
    id: s.id,
    menuItemId: s.menuItemId,
    menuItemName: s.menuItemName,
    quantity: s.quantity,
    sellingPrice: parseFloat(s.sellingPrice),
    recipeCost: parseFloat(s.recipeCost),
    totalRevenue: parseFloat(s.totalRevenue),
    totalProfit: parseFloat(s.totalProfit),
    notes: s.notes ?? null,
    soldAt: s.soldAt.toISOString(),
  };
}

router.post("/sell", async (req, res) => {
  try {
    const body = RecordPosSaleBody.parse(req.body);

    const [menuItem] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.id, body.menuItemId));
    if (!menuItem) {
      return void res.status(404).json({ error: "Menu item not found" });
    }

    const ingredientRows = await db
      .select({
        inventoryItemId: menuIngredientsTable.inventoryItemId,
        quantityUsed: menuIngredientsTable.quantityUsed,
        inventoryName: inventoryTable.name,
        currentQuantity: inventoryTable.quantity,
      })
      .from(menuIngredientsTable)
      .innerJoin(inventoryTable, eq(menuIngredientsTable.inventoryItemId, inventoryTable.id))
      .where(eq(menuIngredientsTable.menuItemId, body.menuItemId));

    // Calculate recipe cost precisely
    const costRows = await db
      .select({
        quantityUsed: menuIngredientsTable.quantityUsed,
        costPerUnit: inventoryTable.costPerUnit,
      })
      .from(menuIngredientsTable)
      .innerJoin(inventoryTable, eq(menuIngredientsTable.inventoryItemId, inventoryTable.id))
      .where(eq(menuIngredientsTable.menuItemId, body.menuItemId));

    const recipeCost = costRows.reduce((sum, r) => {
      return sum + parseFloat(r.quantityUsed) * parseFloat(r.costPerUnit);
    }, 0);

    const sellingPrice = parseFloat(menuItem.sellingPrice);
    const totalRevenue = sellingPrice * body.quantity;
    const totalRecipeCost = recipeCost * body.quantity;
    const totalProfit = totalRevenue - totalRecipeCost;

    // Deduct ingredients from inventory
    for (const ing of ingredientRows) {
      const deductAmount = parseFloat(ing.quantityUsed) * body.quantity;
      const currentQty = parseFloat(ing.currentQuantity);
      const newQty = Math.max(0, currentQty - deductAmount);

      await db
        .update(inventoryTable)
        .set({
          quantity: newQty.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(inventoryTable.id, ing.inventoryItemId));
    }

    // Record the POS sale
    const [sale] = await db.insert(posSalesTable).values({
      menuItemId: body.menuItemId,
      menuItemName: menuItem.name,
      quantity: body.quantity,
      sellingPrice: sellingPrice.toFixed(2),
      recipeCost: (Math.round(recipeCost * 100) / 100).toFixed(2),
      totalRevenue: (Math.round(totalRevenue * 100) / 100).toFixed(2),
      totalProfit: (Math.round(totalProfit * 100) / 100).toFixed(2),
      notes: body.notes ?? null,
    }).returning();

    res.status(201).json(mapPosSale(sale));
  } catch (err) {
    req.log.error({ err }, "Failed to record POS sale");
    res.status(500).json({ error: "Failed to record sale" });
  }
});

router.get("/sales-log", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string ?? "50"), 200);
    const rows = await db
      .select()
      .from(posSalesTable)
      .orderBy(desc(posSalesTable.soldAt))
      .limit(limit);
    res.json(rows.map(mapPosSale));
  } catch (err) {
    req.log.error({ err }, "Failed to get POS sales log");
    res.status(500).json({ error: "Failed to get sales log" });
  }
});

export default router;
