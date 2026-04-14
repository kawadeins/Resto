import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { 
  useListMenuItems, 
  getListMenuItemsQueryKey, 
  useCreateMenuItem, 
  useUpdateMenuItem, 
  useDeleteMenuItem, 
  useSetMenuItemIngredients, 
  useListInventory,
  getListInventoryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, UtensilsCrossed, X, Info } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import type { MenuItem, MenuIngredient } from "@workspace/api-client-react";

const CATEGORIES = ["Vorspeisen", "Hauptgericht", "Pasta", "Pizza", "Grill", "Desserts", "Getränke", "Beilagen"];

const dishSchema = z.object({
  name: z.string().min(2, "Name required"),
  category: z.string().min(1, "Category required"),
  sellingPrice: z.coerce.number().positive("Price must be positive"),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

type DishFormValues = z.infer<typeof dishSchema>;

export default function Menu() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<MenuItem | null>(null);
  const [ingredients, setIngredients] = useState<{ inventoryItemId: number; quantityUsed: number }[]>([]);

  const { data: menuItems, isLoading: loadingMenu } = useListMenuItems({
    query: { queryKey: getListMenuItemsQueryKey() }
  });

  const { data: inventory } = useListInventory({
    query: { queryKey: getListInventoryQueryKey() }
  });

  const createMenuItem = useCreateMenuItem();
  const updateMenuItem = useUpdateMenuItem();
  const deleteMenuItem = useDeleteMenuItem();
  const setMenuItemIngredients = useSetMenuItemIngredients();

  const form = useForm<DishFormValues>({
    resolver: zodResolver(dishSchema),
    defaultValues: {
      name: "",
      category: "Hauptgericht",
      sellingPrice: 0,
      description: "",
      isActive: true,
    },
  });

  const stats = useMemo(() => {
    if (!menuItems) return { activeCount: 0, avgMargin: 0, highestMarginDish: "N/A" };
    const active = menuItems.filter((i: any) => i.isActive);
    const avgMargin = active.length > 0 ? active.reduce((acc: any, i: any) => acc + (i.profitMargin || 0), 0) / active.length : 0;
    const sorted = [...menuItems].sort((a, b) => (b.profitMargin || 0) - (a.profitMargin || 0));
    return {
      activeCount: active.length,
      avgMargin,
      highestMarginDish: sorted[0]?.name || "–"
    };
  }, [menuItems]);

  const estimatedRecipeCost = useMemo(() => {
    if (!inventory) return 0;
    return ingredients.reduce((acc, ing) => {
      const invItem = inventory.find((i: any) => i.id === ing.inventoryItemId);
      return acc + (ing.quantityUsed * (invItem?.costPerUnit || 0));
    }, 0);
  }, [ingredients, inventory]);

  const estimatedMargin = useMemo(() => {
    const price = form.watch("sellingPrice") || 0;
    if (price === 0) return 0;
    return ((price - estimatedRecipeCost) / price) * 100;
  }, [estimatedRecipeCost, form.watch("sellingPrice")]);

  const handleEdit = (dish: MenuItem) => {
    setEditingDish(dish);
    form.reset({
      name: dish.name,
      category: dish.category,
      sellingPrice: dish.sellingPrice,
      description: dish.description,
      isActive: dish.isActive,
    });
    setIngredients(dish.ingredients.map((i: any) => ({ inventoryItemId: i.inventoryItemId, quantityUsed: i.quantityUsed })));
    setSheetOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm(t("menu.delete_confirm_full"))) {
      deleteMenuItem.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
          toast({ title: t("menu.toast_deleted") });
        }
      });
    }
  };

  const onSubmit = async (data: DishFormValues) => {
    try {
      let dishId: number;
      if (editingDish) {
        await updateMenuItem.mutateAsync({ id: editingDish.id, data: { ...data, description: data.description || null } });
        dishId = editingDish.id;
      } else {
        const newDish = await createMenuItem.mutateAsync({ data: { ...data, description: data.description || null } });
        dishId = newDish.id;
      }

      await setMenuItemIngredients.mutateAsync({ 
        id: dishId, 
        data: { ingredients } 
      });

      queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
      setSheetOpen(false);
      toast({ title: editingDish ? t("menu.toast_updated") : t("menu.toast_created") });
    } catch (error) {
      toast({ title: t("menu.toast_save_error"), variant: "destructive" });
    }
  };

  const addIngredient = () => {
    if (inventory && inventory.length > 0) {
      setIngredients([...ingredients, { inventoryItemId: inventory[0].id, quantityUsed: 0.1 }]);
    }
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: string, value: any) => {
    const newIngs = [...ingredients];
    newIngs[index] = { ...newIngs[index], [field]: value };
    setIngredients(newIngs);
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("menu.page_title")}</h2>
          <p className="text-muted-foreground mt-2">
            {t("menu.page_subtitle")}
          </p>
        </div>
        <Button onClick={() => {
          setEditingDish(null);
          form.reset({ name: "", category: "Hauptgericht", sellingPrice: 0, description: "", isActive: true });
          setIngredients([]);
          setSheetOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" /> {t("menu.add_dish_btn")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t("menu.stat_active_dishes")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeCount}</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t("menu.stat_avg_margin")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">{stats.avgMargin.toFixed(1)}%</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t("menu.stat_highest_margin")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.highestMarginDish}</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card>
          <CardContent className="pt-6">
            {loadingMenu ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("menu.col_name")}</TableHead>
                    <TableHead>{t("menu.col_category")}</TableHead>
                    <TableHead className="text-right">{t("menu.col_selling_price")}</TableHead>
                    <TableHead className="text-right">{t("menu.col_recipe_cost")}</TableHead>
                    <TableHead className="text-right">{t("menu.col_profit")}</TableHead>
                    <TableHead className="text-right">{t("menu.col_margin")}</TableHead>
                    <TableHead>{t("menu.col_status")}</TableHead>
                    <TableHead className="text-right">{t("menu.col_actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {menuItems?.sort((a: any, b: any) => a.category.localeCompare(b.category)).map((dish: any) => (
                    <TableRow key={dish.id}>
                      <TableCell className="font-bold">{dish.name}</TableCell>
                      <TableCell><Badge variant="outline">{dish.category}</Badge></TableCell>
                      <TableCell className="text-right">€{dish.sellingPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">€{dish.recipeCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-500">€{dish.absoluteProfit.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={
                            dish.profitMargin < 40
                              ? "text-rose-500 border-rose-500/30 bg-rose-500/5"
                              : dish.profitMargin < 60
                              ? "text-amber-500 border-amber-500/30 bg-amber-500/5"
                              : "text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
                          }
                        >
                          {dish.profitMargin.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {dish.isActive ? (
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{t("menu.badge_active")}</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-muted text-muted-foreground">{t("menu.badge_inactive")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(dish)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-rose-500" onClick={() => handleDelete(dish.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingDish ? t("menu.sheet_title_edit") : t("menu.sheet_title_new")}</SheetTitle>
            <SheetDescription>
              {t("menu.sheet_desc")}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("menu.form_dish_name")}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("menu.form_category")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sellingPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("menu.form_selling_price")}</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("menu.form_description")}</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/20">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t("menu.form_active_status")}</FormLabel>
                      <p className="text-sm text-muted-foreground">{t("menu.form_active_hint")}</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="pt-6 border-t border-border">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg">{t("menu.section_ingredients")}</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
                    <Plus className="mr-2 h-4 w-4" /> {t("menu.btn_add_ingredient")}
                  </Button>
                </div>

                <div className="space-y-3">
                  {ingredients.map((ing, idx) => {
                    const invItem = inventory?.find((i: any) => i.id === ing.inventoryItemId);
                    const lineCost = (invItem?.costPerUnit || 0) * ing.quantityUsed;
                    return (
                      <div key={idx} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-[10px] text-muted-foreground">{t("menu.ingredient_item_label")}</Label>
                          <Select
                            value={ing.inventoryItemId.toString()}
                            onValueChange={(val) => updateIngredient(idx, "inventoryItemId", parseInt(val))}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {inventory?.map((i: any) => (
                                <SelectItem key={i.id} value={i.id.toString()}>{i.name} ({i.unit})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-24">
                          <Label className="text-[10px] text-muted-foreground">Qty ({invItem?.unit || "-"})</Label>
                          <Input
                            type="number"
                            step="0.001"
                            className="h-9"
                            value={ing.quantityUsed}
                            onChange={(e) => updateIngredient(idx, "quantityUsed", parseFloat(e.target.value))}
                          />
                        </div>
                        <div className="w-20 text-right">
                          <Label className="text-[10px] text-muted-foreground">{t("menu.ingredient_cost_label")}</Label>
                          <div className="h-9 flex items-center justify-end text-xs font-mono text-muted-foreground">
                            €{lineCost.toFixed(2)}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-rose-500"
                          onClick={() => removeIngredient(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  {ingredients.length === 0 && (
                    <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                      {t("menu.no_ingredients")}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-primary/5 rounded-lg space-y-2 border border-primary/10">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{t("menu.est_recipe_cost")}</span>
                  <span className="font-bold">€{estimatedRecipeCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{t("menu.est_profit_margin")}</span>
                  <span className={`font-bold ${estimatedMargin > 50 ? "text-emerald-500" : estimatedMargin > 30 ? "text-amber-500" : "text-rose-500"}`}>
                    {estimatedMargin.toFixed(1)}%
                  </span>
                </div>
              </div>

              <SheetFooter className="pt-6">
                <Button type="submit" className="w-full" disabled={createMenuItem.isPending || updateMenuItem.isPending || setMenuItemIngredients.isPending}>
                  {editingDish ? t("menu.btn_save_dish") : t("menu.btn_create_dish")}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </div>
  );
}