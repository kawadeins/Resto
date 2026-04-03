import { useState } from "react";
import { useListInventory, getListInventoryQueryKey, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, MoreHorizontal, Pencil, Trash2, Package } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import type { InventoryItem } from "@workspace/api-client-react";

const itemSchema = z.object({
  name: z.string().min(2, "Name ist erforderlich"),
  category: z.string().min(2, "Kategorie ist erforderlich"),
  quantity: z.coerce.number().min(0, "Menge darf nicht negativ sein"),
  unit: z.string().min(1, "Einheit ist erforderlich"),
  alertThreshold: z.coerce.number().min(0, "Schwellenwert darf nicht negativ sein"),
  costPerUnit: z.coerce.number().min(0, "Kosten dürfen nicht negativ sein"),
});

type ItemFormValues = z.infer<typeof itemSchema>;

export default function Inventory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const { data: inventory, isLoading } = useListInventory({
    query: { queryKey: getListInventoryQueryKey() }
  });

  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const deleteItem = useDeleteInventoryItem();

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: "",
      category: "",
      quantity: 0,
      unit: "kg",
      alertThreshold: 10,
      costPerUnit: 0,
    },
  });

  const onSubmit = (data: ItemFormValues) => {
    if (editingItem) {
      updateItem.mutate(
        { id: editingItem.id, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
            setDialogOpen(false);
            toast({ title: "Artikel erfolgreich aktualisiert" });
          },
          onError: () => toast({ title: "Artikel konnte nicht aktualisiert werden", variant: "destructive" })
        }
      );
    } else {
      createItem.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
            setDialogOpen(false);
            form.reset();
            toast({ title: "Artikel erfolgreich erstellt" });
          },
          onError: () => toast({ title: "Artikel konnte nicht erstellt werden", variant: "destructive" })
        }
      );
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    form.reset({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      alertThreshold: item.alertThreshold,
      costPerUnit: item.costPerUnit,
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Möchten Sie diesen Artikel wirklich löschen?")) {
      deleteItem.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
            toast({ title: "Artikel gelöscht" });
          }
        }
      );
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inventar</h2>
          <p className="text-muted-foreground mt-2">Lagerbestände verwalten und Zutatenkosten verfolgen.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingItem(null);
            form.reset({ name: "", category: "", quantity: 0, unit: "kg", alertThreshold: 10, costPerUnit: 0 });
          }
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Artikel hinzufügen</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? "Artikel bearbeiten" : "Neuen Artikel hinzufügen"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Artikelname</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategorie</FormLabel>
                      <FormControl><Input {...field} placeholder="z. B. Fleisch, Gemüse, Getränke" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aktueller Bestand</FormLabel>
                        <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Einheit</FormLabel>
                        <FormControl><Input {...field} placeholder="z. B. kg, L, Stk." /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="alertThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mindestbestand-Alarm bei</FormLabel>
                        <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="costPerUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kosten pro Einheit (€)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createItem.isPending || updateItem.isPending}>
                  {editingItem ? "Änderungen speichern" : "Artikel erstellen"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Lagerliste</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artikel</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead className="text-right">Bestand</TableHead>
                    <TableHead className="text-right">Kosten</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory?.map((item) => {
                    const isLowStock = item.quantity <= item.alertThreshold;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-muted text-muted-foreground">{item.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono ${isLowStock ? "text-rose-500 font-bold" : ""}`}>
                            {item.quantity} {item.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          €{item.costPerUnit.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {isLowStock ? (
                            <Badge variant="destructive" className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border-rose-500/20">Niedriger Bestand</Badge>
                          ) : (
                            <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">OK</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(item)}>
                                <Pencil className="mr-2 h-4 w-4" /> Bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Löschen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!inventory?.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Keine Inventarartikel gefunden.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
