import { useEffect } from "react";
import { track } from "@/lib/conversion-tracking";
import { Link } from "wouter";
import { useGetPerformanceAnalytics, getGetPerformanceAnalyticsQueryKey, useGetDailyAnalytics, getGetDailyAnalyticsQueryKey, useGetMenuAnalytics, getGetMenuAnalyticsQueryKey, useGetSubscription, getGetSubscriptionQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Area, AreaChart, Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Calendar, Users, Lock, BarChart3, Zap, Star, Headphones } from "lucide-react";
import { TrialConversionBanner } from "@/components/layout";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PromotionTools } from "@/components/promotion-tools";
import { PromotionPerformance } from "@/components/promotion-performance";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Analytics() {
  const { data: subscription, isLoading: loadingSubscription } = useGetSubscription({
    query: { queryKey: getGetSubscriptionQueryKey() }
  });
  
  const isPro = subscription?.isActive === true && subscription?.status !== "trial";

  const { data: performance, isLoading: loadingPerf } = useGetPerformanceAnalytics({
    query: { queryKey: getGetPerformanceAnalyticsQueryKey(), enabled: isPro }
  });

  const { data: dailyData, isLoading: loadingDaily } = useGetDailyAnalytics({
    query: { queryKey: getGetDailyAnalyticsQueryKey(), enabled: isPro }
  });

  const { data: menuAnalytics, isLoading: loadingMenu } = useGetMenuAnalytics({
    query: { queryKey: getGetMenuAnalyticsQueryKey(), enabled: isPro }
  });

  const isTrial = subscription?.isActive === true && subscription?.status === "trial";

  useEffect(() => {
    if (!loadingSubscription && !isPro) {
      track("analytics_locked_viewed");
    }
  }, [loadingSubscription, isPro]);

  if (!loadingSubscription && !isPro) {
    const customerProfileUrl = typeof window !== "undefined" ? window.location.origin + "/customer/profile" : "/customer/profile";
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-xl space-y-4">

          {/* PROBLEM — shown first */}
          <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-4 flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-red-300">
                {isTrial ? "Deine Analysen sind in der Testphase nicht verfügbar" : "Ohne Premium siehst du keine Geschäftsdaten"}
              </p>
              <p className="text-[11px] text-red-400/60 mt-0.5">
                {isTrial
                  ? "Aktiviere Premium, um deine Umsatzdaten, Stoßzeiten und Reservierungsquellen zu sehen."
                  : "Andere Betriebe optimieren täglich – nutze auch du deine Daten für bessere Entscheidungen."}
              </p>
            </div>
          </div>

          <Card className="border-border bg-card shadow-lg">
            <CardHeader className="text-center space-y-4 pb-2">
              <div className="mx-auto bg-violet-500/10 p-4 rounded-full w-20 h-20 flex items-center justify-center">
                <BarChart3 className="w-10 h-10 text-violet-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Analysen & Intelligenz</CardTitle>
                <CardDescription className="mt-2">
                  {isTrial
                    ? "Behalte deinen Wettbewerbsvorteil dauerhaft – aktiviere Premium für volle Einblicke."
                    : "Erreiche mehr Gäste zur richtigen Zeit mit datenbasierten Entscheidungen."}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-2">

              {/* VALUE — what you get */}
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { icon: BarChart3, color: "text-violet-400", label: "30-Tage-Umsatztrends" },
                  { icon: TrendingUp, color: "text-emerald-400", label: "Gerichts-Rentabilität" },
                  { icon: Calendar, color: "text-indigo-400", label: "Stoßzeiten-Heatmap" },
                  { icon: Users, color: "text-amber-400", label: "Reservierungsquellen" },
                ].map(({ icon: Icon, color, label }) => (
                  <div key={label} className="flex items-center gap-3 text-sm p-3 rounded-lg border bg-muted/20">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>

              {/* ROI FRAMING */}
              <div className="rounded-xl border border-amber-800/30 bg-amber-950/10 px-4 py-3 flex items-center gap-3">
                <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-amber-300/70 leading-relaxed">
                  {"Schon ein optimierter Abend rechtfertigt den Monatsbetrag. 39,90€ im Monat."}
                </p>
              </div>

              {/* CTA */}
              <div className="flex flex-col items-center gap-3 pt-2">
                {isTrial ? (
                  <a
                    href={customerProfileUrl}
                    className="inline-flex items-center justify-center w-full sm:w-auto px-8 h-12 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/20"
                  >
                    Für 39,90€ / Monat fortsetzen
                  </a>
                ) : (
                  <a
                    href={customerProfileUrl}
                    className="inline-flex items-center justify-center w-full sm:w-auto px-8 h-12 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/20"
                  >
                    Analysen freischalten – 14 Tage kostenlos
                  </a>
                )}
                <p className="text-[11px] text-muted-foreground/50">Jederzeit kündbar. Keine langfristige Verpflichtung.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analysen & Intelligenz</h2>
          <p className="text-muted-foreground mt-2">Tiefgehende Einblicke in Ihre Unternehmensleistung.</p>
        </div>
        <div className="text-sm text-muted-foreground font-mono bg-muted/30 px-3 py-1.5 rounded-md border">
          Live • Gerade aktualisiert
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {(() => {
          const monthly = performance?.monthlyData ?? [];
          const lastMonth = monthly[monthly.length - 1];
          const prevMonth = monthly[monthly.length - 2];
          const revenueGrowth = lastMonth && prevMonth && prevMonth.revenue > 0
            ? ((lastMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100
            : 0;
          const profitGrowth = lastMonth && prevMonth && prevMonth.profit > 0
            ? ((lastMonth.profit - prevMonth.profit) / prevMonth.profit) * 100
            : 0;
          return (
            <>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Umsatz diesen Monat</CardTitle>
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    {loadingPerf ? <Skeleton className="h-8 w-[100px]" /> : (
                      <>
                        <div className="text-2xl font-bold text-emerald-500">
                          €{(lastMonth?.revenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div className={`text-xs mt-1 flex items-center ${revenueGrowth >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          {revenueGrowth >= 0 ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}
                          {Math.abs(revenueGrowth).toFixed(1)}% vs. Vormonat
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Gewinn diesen Monat</CardTitle>
                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                  </CardHeader>
                  <CardContent>
                    {loadingPerf ? <Skeleton className="h-8 w-[100px]" /> : (
                      <>
                        <div className="text-2xl font-bold">
                          €{(lastMonth?.profit ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div className={`text-xs mt-1 flex items-center ${profitGrowth >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          {profitGrowth >= 0 ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}
                          {Math.abs(profitGrowth).toFixed(1)}% vs. Vormonat
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Gesamtumsatz (12 Mon.)</CardTitle>
                    <Calendar className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    {loadingPerf ? <Skeleton className="h-8 w-[100px]" /> : (
                      <>
                        <div className="text-2xl font-bold text-amber-500">
                          €{(performance?.totalRevenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Ø €{(performance?.avgMonthlyRevenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}/Monat
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Gewinnmarge</CardTitle>
                    <Users className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    {loadingPerf ? <Skeleton className="h-8 w-[100px]" /> : (
                      <>
                        <div className="text-2xl font-bold">
                          {(performance?.profitMarginOverall ?? 0).toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Ø der letzten 12 Monate
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </>
          );
        })()}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <motion.div className="col-span-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Tagesleistung (30 Tage)</CardTitle>
              <CardDescription>Umsatz-, Gewinn- und Reservierungstrend</CardDescription>
            </CardHeader>
            <CardContent className="pl-0">
              {loadingDaily ? (
                <div className="h-[400px] w-full flex items-center justify-center">
                  <Skeleton className="h-[350px] w-[95%]" />
                </div>
              ) : (
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(value) => value.slice(5)} // Show MM-DD
                      />
                      <YAxis 
                        yAxisId="left"
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(value) => `€${value/1000}k`}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Line yAxisId="left" type="monotone" dataKey="revenue" name="Umsatz" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} />
                      <Line yAxisId="left" type="monotone" dataKey="profit" name="Gewinn" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="stepAfter" dataKey="reservations" name="Reservierungen" stroke="hsl(35, 91%, 54%)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div className="col-span-1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Reservierungen nach Quelle</CardTitle>
              <CardDescription>Woher Ihre Buchungen kommen</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPerf ? (
                <div className="h-[300px] w-full flex items-center justify-center">
                  <Skeleton className="h-48 w-48 rounded-full" />
                </div>
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={performance?.reservationsBySource}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="source"
                      >
                        {performance?.reservationsBySource?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        formatter={(value) => <span className="capitalize">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card>
          <CardHeader>
            <CardTitle>Stoßzeiten-Heatmap</CardTitle>
            <CardDescription>Ø Gedecke pro Stunde</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {loadingPerf ? (
              <div className="h-[250px] w-full flex items-center justify-center">
                <Skeleton className="h-[200px] w-[95%]" />
              </div>
            ) : (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performance?.peakHours} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Bar dataKey="covers" name="Ø Gedecke" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                      {performance?.peakHours?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fillOpacity={0.4 + (entry.covers / Math.max(...(performance?.peakHours.map(h => h.covers) || [1]))) * 0.6} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Gewinnstärkste Gerichte</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMenu ? (
                <div className="h-[400px] w-full flex items-center justify-center">
                  <Skeleton className="h-[350px] w-[90%]" />
                </div>
              ) : (
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={menuAnalytics?.sort((a, b) => (b.totalProfit || 0) - (a.totalProfit || 0)).slice(0, 8)}
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `€${value.toLocaleString()}`}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={100}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number) => [`€${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "Gesamtgewinn"]}
                      />
                      <Bar dataKey="totalProfit" radius={[0, 4, 4, 0]}>
                        {menuAnalytics?.sort((a, b) => (b.totalProfit || 0) - (a.totalProfit || 0)).slice(0, 8).map((entry, index) => {
                          const margin = entry.profitMargin || 0;
                          let fill = "hsl(142, 71%, 45%)"; // emerald
                          if (margin < 40) fill = "hsl(346, 84%, 61%)"; // rose
                          else if (margin < 60) fill = "hsl(37, 91%, 55%)"; // amber
                          return <Cell key={`cell-${index}`} fill={fill} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Gerichts-Rentabilität im Detail</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMenu ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Gericht</TableHead>
                        <TableHead>Kategorie</TableHead>
                        <TableHead className="text-right">Preis</TableHead>
                        <TableHead className="text-right">Kosten</TableHead>
                        <TableHead className="text-right">Gewinn</TableHead>
                        <TableHead className="text-right">Marge</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {menuAnalytics?.sort((a, b) => (b.profitMargin || 0) - (a.profitMargin || 0)).map((dish) => (
                        <TableRow key={dish.id}>
                          <TableCell className="font-medium">{dish.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{dish.category}</TableCell>
                          <TableCell className="text-right">€{dish.sellingPrice?.toFixed(2)}</TableCell>
                          <TableCell className="text-right">€{dish.recipeCost?.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-500">€{dish.absoluteProfit?.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={
                                (dish.profitMargin || 0) < 40
                                  ? "text-rose-500 border-rose-500/30 bg-rose-500/5"
                                  : (dish.profitMargin || 0) < 60
                                  ? "text-amber-500 border-amber-500/30 bg-amber-500/5"
                                  : "text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
                              }
                            >
                              {dish.profitMargin?.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Promotion Engine ─────────────────────────────────────────────────── */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Promotion Engine
          </h3>
          <p className="text-muted-foreground text-sm mt-1">
            Starten Sie gezielte Boosts, messen Sie Einblendungen, Klicks und Buchungen — in Echtzeit.
          </p>
        </div>
        <PromotionTools />
        <PromotionPerformance />
      </div>
    </div>
  );
}