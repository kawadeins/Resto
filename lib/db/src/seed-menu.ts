import { db } from "./index";
import { menuItemsTable, menuIngredientsTable, inventoryTable } from "./schema";
import { eq } from "drizzle-orm";

async function seedMenu() {
  console.log("Seeding menu items...");

  // Get existing inventory items
  const inventory = await db.select().from(inventoryTable);
  const inv = (name: string) => inventory.find((i) => i.name.toLowerCase().includes(name.toLowerCase()));

  if (inventory.length === 0) {
    console.log("No inventory found. Run main seed first.");
    process.exit(1);
  }

  // Check if menu items already seeded
  const existing = await db.select().from(menuItemsTable);
  if (existing.length > 0) {
    console.log(`Menu already seeded with ${existing.length} items. Skipping.`);
    process.exit(0);
  }

  const menuItems = [
    {
      name: "Grilled Salmon with Herb Butter",
      description: "Pan-seared Atlantic salmon with lemon herb butter, seasonal vegetables",
      category: "Main Course",
      sellingPrice: "28.50",
    },
    {
      name: "Beef Tenderloin",
      description: "250g centre-cut beef tenderloin, truffle jus, roasted potatoes",
      category: "Main Course",
      sellingPrice: "42.00",
    },
    {
      name: "Pasta Carbonara",
      description: "Fresh tagliatelle, guanciale, pecorino romano, free-range egg yolk",
      category: "Pasta",
      sellingPrice: "18.00",
    },
    {
      name: "Margherita Pizza",
      description: "San Marzano tomato, fior di latte mozzarella, fresh basil",
      category: "Pizza",
      sellingPrice: "16.00",
    },
    {
      name: "Caesar Salad",
      description: "Romaine lettuce, house-made Caesar dressing, parmesan crisps, croutons",
      category: "Starters",
      sellingPrice: "12.50",
    },
    {
      name: "Mushroom Risotto",
      description: "Wild mushroom risotto, parmesan, truffle oil, fresh herbs",
      category: "Main Course",
      sellingPrice: "22.00",
    },
    {
      name: "Tiramisu",
      description: "Classic Italian tiramisu, espresso-soaked savoiardi, mascarpone cream",
      category: "Desserts",
      sellingPrice: "9.00",
    },
    {
      name: "Chocolate Fondant",
      description: "Warm dark chocolate fondant, vanilla bean ice cream, raspberry coulis",
      category: "Desserts",
      sellingPrice: "10.50",
    },
    {
      name: "House Burger",
      description: "200g dry-aged beef patty, brioche bun, aged cheddar, house sauce, fries",
      category: "Grill",
      sellingPrice: "19.00",
    },
    {
      name: "Bruschetta al Pomodoro",
      description: "Toasted sourdough, heritage tomatoes, garlic, basil, extra virgin olive oil",
      category: "Starters",
      sellingPrice: "9.50",
    },
  ];

  const inserted = await db.insert(menuItemsTable).values(menuItems).returning();
  console.log(`Inserted ${inserted.length} menu items`);

  // Link ingredients where we have inventory matches
  // Each dish will get 2-4 ingredients from inventory
  const ingredientLinks: Array<{ menuItemId: number; inventoryItemId: number; quantityUsed: string }> = [];

  for (const item of inserted) {
    const name = item.name.toLowerCase();

    if (name.includes("salmon")) {
      const fish = inv("salmon") || inv("fish") || inventory[0];
      const butter = inv("butter") || inv("dairy") || inventory[1];
      const lemon = inv("lemon") || inv("citrus") || inventory[2];
      if (fish) ingredientLinks.push({ menuItemId: item.id, inventoryItemId: fish.id, quantityUsed: "0.2500" });
      if (butter) ingredientLinks.push({ menuItemId: item.id, inventoryItemId: butter.id, quantityUsed: "0.0500" });
      if (lemon && lemon.id !== fish?.id && lemon.id !== butter?.id) ingredientLinks.push({ menuItemId: item.id, inventoryItemId: lemon.id, quantityUsed: "0.1000" });
    } else if (name.includes("beef") || name.includes("burger")) {
      const beef = inv("beef") || inv("meat") || inventory[0];
      const onion = inv("onion") || inv("vegetable") || inventory[1];
      const oil = inv("oil") || inv("olive") || inventory[2];
      if (beef) ingredientLinks.push({ menuItemId: item.id, inventoryItemId: beef.id, quantityUsed: "0.2500" });
      if (onion && onion.id !== beef?.id) ingredientLinks.push({ menuItemId: item.id, inventoryItemId: onion.id, quantityUsed: "0.1000" });
      if (oil && oil.id !== beef?.id && oil.id !== onion?.id) ingredientLinks.push({ menuItemId: item.id, inventoryItemId: oil.id, quantityUsed: "0.0300" });
    } else if (name.includes("pasta") || name.includes("carbonara")) {
      const pasta = inv("pasta") || inv("flour") || inventory[0];
      const egg = inv("egg") || inv("dairy") || inventory[1];
      const cheese = inv("parmesan") || inv("cheese") || inventory[2];
      if (pasta) ingredientLinks.push({ menuItemId: item.id, inventoryItemId: pasta.id, quantityUsed: "0.1500" });
      if (egg && egg.id !== pasta?.id) ingredientLinks.push({ menuItemId: item.id, inventoryItemId: egg.id, quantityUsed: "0.2000" });
      if (cheese && cheese.id !== pasta?.id && cheese.id !== egg?.id) ingredientLinks.push({ menuItemId: item.id, inventoryItemId: cheese.id, quantityUsed: "0.0500" });
    } else if (name.includes("pizza")) {
      const flour = inv("flour") || inv("bread") || inventory[0];
      const tomato = inv("tomato") || inv("sauce") || inventory[1];
      const cheese = inv("mozzarella") || inv("cheese") || inventory[2];
      if (flour) ingredientLinks.push({ menuItemId: item.id, inventoryItemId: flour.id, quantityUsed: "0.2000" });
      if (tomato && tomato.id !== flour?.id) ingredientLinks.push({ menuItemId: item.id, inventoryItemId: tomato.id, quantityUsed: "0.1500" });
      if (cheese && cheese.id !== flour?.id && cheese.id !== tomato?.id) ingredientLinks.push({ menuItemId: item.id, inventoryItemId: cheese.id, quantityUsed: "0.1200" });
    } else if (name.includes("risotto")) {
      const rice = inv("rice") || inv("grain") || inventory[0];
      const mushroom = inv("mushroom") || inv("vegetable") || inventory[1];
      const wine = inv("wine") || inv("alcohol") || inventory[2];
      if (rice) ingredientLinks.push({ menuItemId: item.id, inventoryItemId: rice.id, quantityUsed: "0.1800" });
      if (mushroom && mushroom.id !== rice?.id) ingredientLinks.push({ menuItemId: item.id, inventoryItemId: mushroom.id, quantityUsed: "0.1200" });
      if (wine && wine.id !== rice?.id && wine.id !== mushroom?.id) ingredientLinks.push({ menuItemId: item.id, inventoryItemId: wine.id, quantityUsed: "0.0800" });
    } else {
      // Generic: pick 2 random items from inventory
      const idxA = Math.floor(Math.random() * inventory.length);
      let idxB = Math.floor(Math.random() * inventory.length);
      while (idxB === idxA) idxB = Math.floor(Math.random() * inventory.length);
      ingredientLinks.push({ menuItemId: item.id, inventoryItemId: inventory[idxA].id, quantityUsed: "0.1000" });
      ingredientLinks.push({ menuItemId: item.id, inventoryItemId: inventory[idxB].id, quantityUsed: "0.0800" });
    }
  }

  if (ingredientLinks.length > 0) {
    await db.insert(menuIngredientsTable).values(ingredientLinks);
    console.log(`Linked ${ingredientLinks.length} ingredient connections`);
  }

  console.log("Menu seeding complete!");
  process.exit(0);
}

seedMenu().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
