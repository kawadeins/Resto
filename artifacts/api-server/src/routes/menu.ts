import { Router } from "express";
import { db } from "@workspace/db";
import { menuItemsTable, menuIngredientsTable, inventoryTable, posSalesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireManagerOrAbove } from "../middleware/role-guard";

const router = Router();

const CreateMenuItemBody = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.string().min(1),
  sellingPrice: z.number().positive(),
  isActive: z.boolean().optional().default(true),
});

const UpdateMenuItemBody = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.string().min(1),
  sellingPrice: z.number().positive(),
  isActive: z.boolean().optional(),
});

const SetIngredientsBody = z.object({
  ingredients: z.array(z.object({
    inventoryItemId: z.number().int().positive(),
    quantityUsed: z.number().positive(),
  })),
});

async function buildMenuItemResponse(item: typeof menuItemsTable.$inferSelect) {
  const ingredientRows = await db
    .select({
      id: menuIngredientsTable.id,
      menuItemId: menuIngredientsTable.menuItemId,
      inventoryItemId: menuIngredientsTable.inventoryItemId,
      inventoryItemName: inventoryTable.name,
      unit: inventoryTable.unit,
      quantityUsed: menuIngredientsTable.quantityUsed,
      costPerUnit: inventoryTable.costPerUnit,
    })
    .from(menuIngredientsTable)
    .innerJoin(inventoryTable, eq(menuIngredientsTable.inventoryItemId, inventoryTable.id))
    .where(eq(menuIngredientsTable.menuItemId, item.id));

  const ingredients = ingredientRows.map((r) => {
    const qty = parseFloat(r.quantityUsed);
    const cpu = parseFloat(r.costPerUnit);
    return {
      id: r.id,
      menuItemId: r.menuItemId,
      inventoryItemId: r.inventoryItemId,
      inventoryItemName: r.inventoryItemName,
      unit: r.unit,
      quantityUsed: qty,
      costPerUnit: cpu,
      lineCost: Math.round(qty * cpu * 100) / 100,
    };
  });

  const recipeCost = ingredients.reduce((sum, i) => sum + i.lineCost, 0);
  const sellingPrice = parseFloat(item.sellingPrice);
  const absoluteProfit = sellingPrice - recipeCost;
  const profitMargin = sellingPrice > 0
    ? Math.round((absoluteProfit / sellingPrice) * 10000) / 100
    : 0;

  return {
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    category: item.category,
    sellingPrice,
    recipeCost: Math.round(recipeCost * 100) / 100,
    absoluteProfit: Math.round(absoluteProfit * 100) / 100,
    profitMargin,
    isActive: item.isActive,
    ingredients,
  };
}

router.get("/analytics", async (req, res) => {
  try {
    const items = await db.select().from(menuItemsTable);

    const analytics = await Promise.all(items.map(async (item) => {
      const menuData = await buildMenuItemResponse(item);

      const salesRows = await db
        .select({
          totalSold: sql<string>`COALESCE(SUM(quantity), 0)`,
          totalRevenue: sql<string>`COALESCE(SUM(total_revenue::numeric), 0)`,
          totalProfit: sql<string>`COALESCE(SUM(total_profit::numeric), 0)`,
        })
        .from(posSalesTable)
        .where(eq(posSalesTable.menuItemId, item.id));

      const s = salesRows[0];
      return {
        id: menuData.id,
        name: menuData.name,
        category: menuData.category,
        sellingPrice: menuData.sellingPrice,
        recipeCost: menuData.recipeCost,
        absoluteProfit: menuData.absoluteProfit,
        profitMargin: menuData.profitMargin,
        totalSold: parseInt(s?.totalSold ?? "0"),
        totalRevenue: Math.round(parseFloat(s?.totalRevenue ?? "0") * 100) / 100,
        totalProfit: Math.round(parseFloat(s?.totalProfit ?? "0") * 100) / 100,
      };
    }));

    analytics.sort((a, b) => b.totalProfit - a.totalProfit);

    res.json(analytics);
  } catch (err) {
    req.log.error({ err }, "Failed to get menu analytics");
    res.status(500).json({ error: "Failed to get menu analytics" });
  }
});

router.get("/", async (req, res) => {
  try {
    const items = await db.select().from(menuItemsTable).orderBy(menuItemsTable.category, menuItemsTable.name);
    const results = await Promise.all(items.map(buildMenuItemResponse));
    res.json(results);
  } catch (err) {
    req.log.error({ err }, "Failed to list menu items");
    res.status(500).json({ error: "Failed to list menu items" });
  }
});

router.post("/", requireManagerOrAbove(), async (req, res) => {
  try {
    const body = CreateMenuItemBody.parse(req.body);
    const [item] = await db.insert(menuItemsTable).values({
      name: body.name,
      description: body.description ?? null,
      category: body.category,
      sellingPrice: body.sellingPrice.toFixed(2),
      isActive: body.isActive ?? true,
    }).returning();
    res.status(201).json(await buildMenuItemResponse(item));
  } catch (err) {
    req.log.error({ err }, "Failed to create menu item");
    res.status(400).json({ error: "Invalid menu item data" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.id, id));
    if (!item) return void res.status(404).json({ error: "Not found" });
    res.json(await buildMenuItemResponse(item));
  } catch (err) {
    req.log.error({ err }, "Failed to get menu item");
    res.status(500).json({ error: "Failed to get menu item" });
  }
});

router.put("/:id", requireManagerOrAbove(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = UpdateMenuItemBody.parse(req.body);
    const [item] = await db.update(menuItemsTable).set({
      name: body.name,
      description: body.description ?? null,
      category: body.category,
      sellingPrice: body.sellingPrice.toFixed(2),
      isActive: body.isActive,
    }).where(eq(menuItemsTable.id, id)).returning();
    if (!item) return void res.status(404).json({ error: "Not found" });
    res.json(await buildMenuItemResponse(item));
  } catch (err) {
    req.log.error({ err }, "Failed to update menu item");
    res.status(400).json({ error: "Invalid data" });
  }
});

router.delete("/:id", requireManagerOrAbove(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(menuItemsTable).where(eq(menuItemsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete menu item");
    res.status(500).json({ error: "Failed to delete menu item" });
  }
});

router.get("/:id/ingredients", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const rows = await db
      .select({
        id: menuIngredientsTable.id,
        menuItemId: menuIngredientsTable.menuItemId,
        inventoryItemId: menuIngredientsTable.inventoryItemId,
        inventoryItemName: inventoryTable.name,
        unit: inventoryTable.unit,
        quantityUsed: menuIngredientsTable.quantityUsed,
        costPerUnit: inventoryTable.costPerUnit,
      })
      .from(menuIngredientsTable)
      .innerJoin(inventoryTable, eq(menuIngredientsTable.inventoryItemId, inventoryTable.id))
      .where(eq(menuIngredientsTable.menuItemId, id));

    res.json(rows.map((r) => {
      const qty = parseFloat(r.quantityUsed);
      const cpu = parseFloat(r.costPerUnit);
      return {
        id: r.id,
        menuItemId: r.menuItemId,
        inventoryItemId: r.inventoryItemId,
        inventoryItemName: r.inventoryItemName,
        unit: r.unit,
        quantityUsed: qty,
        costPerUnit: cpu,
        lineCost: Math.round(qty * cpu * 100) / 100,
      };
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to get menu ingredients");
    res.status(500).json({ error: "Failed to get menu ingredients" });
  }
});

router.put("/:id/ingredients", requireManagerOrAbove(), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { ingredients } = SetIngredientsBody.parse(req.body);

    await db.delete(menuIngredientsTable).where(eq(menuIngredientsTable.menuItemId, id));

    if (ingredients.length > 0) {
      await db.insert(menuIngredientsTable).values(
        ingredients.map((ing) => ({
          menuItemId: id,
          inventoryItemId: ing.inventoryItemId,
          quantityUsed: ing.quantityUsed.toFixed(4),
        }))
      );
    }

    const rows = await db
      .select({
        id: menuIngredientsTable.id,
        menuItemId: menuIngredientsTable.menuItemId,
        inventoryItemId: menuIngredientsTable.inventoryItemId,
        inventoryItemName: inventoryTable.name,
        unit: inventoryTable.unit,
        quantityUsed: menuIngredientsTable.quantityUsed,
        costPerUnit: inventoryTable.costPerUnit,
      })
      .from(menuIngredientsTable)
      .innerJoin(inventoryTable, eq(menuIngredientsTable.inventoryItemId, inventoryTable.id))
      .where(eq(menuIngredientsTable.menuItemId, id));

    res.json(rows.map((r) => {
      const qty = parseFloat(r.quantityUsed);
      const cpu = parseFloat(r.costPerUnit);
      return {
        id: r.id,
        menuItemId: r.menuItemId,
        inventoryItemId: r.inventoryItemId,
        inventoryItemName: r.inventoryItemName,
        unit: r.unit,
        quantityUsed: qty,
        costPerUnit: cpu,
        lineCost: Math.round(qty * cpu * 100) / 100,
      };
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to set menu ingredients");
    res.status(400).json({ error: "Invalid ingredients data" });
  }
});

export default router;
