import { useGetFinancesSummary, getGetFinancesSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp, DollarSign, Percent, Megaphone } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Finances() {
  const { data: summary, isLoading: loadingSummary } = useGetFinancesSummary({
    query: { queryKey: getGetFinancesSummaryQueryKey() }
  });

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Finanzen & Strategie</h2>
        <p className="text-muted-foreground mt-2">Umsatzanalyse und Überblick über die Finanzleistung.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gesamtumsatz (lfd. Jahr)</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-[120px]" /> : (
                <div className="text-2xl font-bold text-emerald-500">
                  €{summary?.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nettoprofit (lfd. Jahr)</CardTitle>
              <TrendingUp className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-[120px]" /> : (
                <div className="text-2xl font-bold">
                  €{summary?.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ø Gewinnmarge</CardTitle>
              <Percent className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-[80px]" /> : (
                <div className="text-2xl font-bold text-amber-500">
                  {summary?.avgProfitMargin.toFixed(1)}%
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ø Tagesumsatz</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-[100px]" /> : (
                <div className="text-2xl font-bold text-muted-foreground">
                  €{summary?.avgDailyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <motion.div className="col-span-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Monatlicher Umsatzverlauf</CardTitle>
            </CardHeader>
            <CardContent className="pl-0">
              {loadingSummary ? (
                <div className="h-[300px] w-full flex items-center justify-center">
                  <Skeleton className="h-[250px] w-[90%]" />
                </div>
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary?.revenueByMonth} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v / 1000}k`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number) => [`€${value.toLocaleString()}`, "Umsatz"]}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div className="col-span-3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Umsatzstärkste Gerichte</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              {loadingSummary ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : (
                <div className="space-y-4">
                  {summary?.topDishes?.map((dish, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center gap-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                          {i + 1}
                        </div>
                        <span className="font-medium">{dish.name}</span>
                      </div>
                      <span className="text-muted-foreground font-mono">{dish.count}× bestellt</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Megaphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Blitzangebote & Rabattaktionen</p>
                <p className="text-sm text-muted-foreground">
                  Verwalten Sie Ihre Werbestrategie auf der Marketing-Seite.
                </p>
              </div>
            </div>
            <Link href="/marketing">
              <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 flex-shrink-0">
                Zum Marketing
              </Button>
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
