import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { 
  useListMenuItems, 
  getListMenuItemsQueryKey, 
  useRecordPosSale, 
  useListPosSales,
  getListPosSalesQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Clock, CheckCircle2, TrendingUp, DollarSign } from "lucide-react";
import type { MenuItem, PosSale } from "@workspace/api-client-react";

const CATEGORY_KEYS = ["Alle", "Vorspeisen", "Hauptgericht", "Pasta", "Pizza", "Grill", "Desserts", "Getränke", "Beilagen"];

export default function Pos() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState("Alle");
  const [sellingDish, setSellingDish] = useState<MenuItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const { data: menuItems, isLoading: loadingMenu } = useListMenuItems({
    query: { queryKey: getListMenuItemsQueryKey() }
  });

  const { data: salesLog, isLoading: loadingSales } = useListPosSales({
    params: { limit: 50 },
    query: { queryKey: getListPosSalesQueryKey({ params: { limit: 50 } }) }
  });

  const recordSale = useRecordPosSale();

  const filteredMenu = useMemo(() => {
    if (!menuItems) return [];
    let items = menuItems.filter((i: any) => i.isActive);
    if (selectedCategory !== "Alle") {
      items = items.filter((i: any) => i.category === selectedCategory);
    }
    return items;
  }, [menuItems, selectedCategory]);

  const todayStats = useMemo(() => {
    if (!salesLog) return { revenue: 0, profit: 0 };
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return salesLog
      .filter((sale: any) => {
        if (!sale.soldAt) return false;
        const d = new Date(sale.soldAt);
        const saleStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return saleStr === todayStr;
      })
      .reduce((acc: any, sale: any) => ({
        revenue: acc.revenue + (sale.totalRevenue || 0),
        profit: acc.profit + (sale.totalProfit || 0),
      }), { revenue: 0, profit: 0 });
  }, [salesLog]);

  const handleConfirmSale = () => {
    if (!sellingDish) return;
    recordSale.mutate({ 
      data: {
        menuItemId: sellingDish.id, 
        quantity, 
        notes: notes || null 
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListPosSalesQueryKey({ params: { limit: 50 } }) });
        toast({ title: t("pos.toast_sale_recorded") });
        setSellingDish(null);
        setQuantity(1);
        setNotes("");
      },
      onError: () => toast({ title: t("pos.toast_sale_error"), variant: "destructive" })
    });
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t("pos.time_just_now");
    if (diffMin < 60) return t("pos.time_minutes_ago", { count: diffMin });
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return t("pos.time_hours_ago", { count: diffHours });
    return t("pos.time_yesterday");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10 h-full max-h-[calc(100vh-120px)] overflow-hidden">
      {/* Left Column: Menu Grid */}
      <div className="lg:col-span-2 flex flex-col h-full overflow-hidden">
        <div className="mb-6">
          <h2 className="text-3xl font-bold tracking-tight">{t("pos.page_title")}</h2>
          <p className="text-muted-foreground mt-1">
            {t("pos.page_subtitle")}
          </p>
        </div>

        <Tabs defaultValue="Alle" onValueChange={setSelectedCategory} className="mb-6">
          <TabsList className="bg-card border border-border flex flex-wrap h-auto gap-1 p-1">
            {CATEGORY_KEYS.map(cat => (
              <TabsTrigger key={cat} value={cat} className="px-4 py-2 text-xs">
                {({ "Alle": t("menu.cat_all"), "Vorspeisen": t("menu.cat_starters"), "Hauptgericht": t("menu.cat_main"), "Pasta": t("menu.cat_pasta"), "Pizza": t("menu.cat_pizza"), "Grill": t("menu.cat_grill"), "Desserts": t("menu.cat_desserts"), "Getränke": t("menu.cat_drinks"), "Beilagen": t("menu.cat_sides") } as Record<string, string>)[cat] ?? cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex-1 overflow-y-auto pr-2">
          {loadingMenu ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 w-full" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredMenu.map((item: any) => (
                <Card 
                  key={item.id} 
                  className="hover:border-primary/40 hover:bg-card/80 transition-all cursor-pointer group"
                  onClick={() => setSellingDish(item)}
                >
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                      <Badge 
                        variant="outline" 
                        className={
                          item.profitMargin < 40 
                            ? "text-rose-500 border-rose-500/30 bg-rose-500/5" 
                            : item.profitMargin < 60 
                            ? "text-amber-500 border-amber-500/30 bg-amber-500/5" 
                            : "text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
                        }
                      >
                        {item.profitMargin.toFixed(0)}%
                      </Badge>
                    </div>
                    <h3 className="font-bold text-sm mb-1 leading-tight line-clamp-2 min-h-[2.5rem]">{item.name}</h3>
                    <div className="text-2xl font-black text-emerald-500 mb-4">
                      €{item.sellingPrice.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground mb-4">
                      {t("pos.recipe_cost_label")} €{item.recipeCost.toFixed(2)}
                    </div>
                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSellingDish(item);
                      }}
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" /> {t("pos.btn_sell")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Sales Log */}
      <div className="flex flex-col h-full overflow-hidden border-l border-border/50 pl-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {t("pos.sales_log_title")}
          </h3>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Live
          </Badge>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2">
          {loadingSales ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : salesLog && salesLog.length > 0 ? (
            <AnimatePresence initial={false}>
              {salesLog.slice(0, 20).map((sale: any) => (
                <motion.div
                  key={sale.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-4 rounded-lg bg-card border border-border group hover:border-primary/30 transition-colors"
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-bold truncate max-w-[150px]">{sale.menuItemName}</div>
                    <div className="text-emerald-500 font-bold">€{sale.totalRevenue.toFixed(2)}</div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <Badge className="h-4 px-1 text-[9px] bg-muted text-muted-foreground">x{sale.quantity}</Badge>
                      <span className="text-emerald-500/70 font-mono">{t("pos.profit_suffix", { amount: sale.totalProfit.toFixed(2) })}</span>
                    </div>
                    <div className="text-muted-foreground">{formatTimeAgo(sale.soldAt)}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground px-6">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <ShoppingCart className="h-6 w-6 opacity-20" />
              </div>
              <p className="text-sm font-medium">{t("pos.no_sales_title")}</p>
              <p className="text-xs">{t("pos.no_sales_hint")}</p>
            </div>
          )}
        </div>

        <div className="mt-auto p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> {t("pos.today_profit")}
            </div>
            <div className="text-xl font-bold text-emerald-500">
              €{todayStats.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" /> {t("pos.today_revenue")}
            </div>
            <div className="text-xl font-bold">
              €{todayStats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Sale Dialog */}
      <Dialog open={!!sellingDish} onOpenChange={(open) => !open && setSellingDish(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("pos.dialog_title", { name: sellingDish?.name ?? "" })}</DialogTitle>
            <DialogDescription>
              {t("pos.dialog_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">{t("pos.label_quantity")}</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">{t("pos.label_notes")}</Label>
              <Textarea
                id="notes"
                placeholder={t("pos.notes_placeholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="col-span-3 h-20"
              />
            </div>
            <div className="bg-muted/30 p-4 rounded-lg space-y-2 text-sm mt-4 border border-border/50">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pos.total_revenue")}</span>
                <span className="font-bold text-emerald-500">€{((sellingDish?.sellingPrice || 0) * quantity).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pos.total_profit")}</span>
                <span className="font-bold text-emerald-400">€{((sellingDish?.absoluteProfit || 0) * quantity).toFixed(2)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellingDish(null)}>{t("pos.btn_cancel")}</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={handleConfirmSale}
              disabled={recordSale.isPending}
            >
              {recordSale.isPending ? t("pos.btn_confirming") : t("pos.btn_confirm_sale")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}