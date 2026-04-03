import { 
  useGetOverviewSummary, 
  getGetOverviewSummaryQueryKey, 
  useGetMonthlySalesChart, 
  getGetMonthlySalesChartQueryKey,
  useGetWorkingNow,
  getGetWorkingNowQueryKey,
  useGetUpcomingShiftReminders,
  getGetUpcomingShiftRemindersQueryKey,
  useGetLowStockItems,
  getGetLowStockItemsQueryKey,
  useGetActiveDiscountStatus,
  getGetActiveDiscountStatusQueryKey,
  useGetOnboardingStatus,
  getGetOnboardingStatusQueryKey,
  useGetInsightsDailySummary,
  getGetInsightsDailySummaryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, AlertTriangle, Utensils, Calendar, Clock, Bell, ShoppingBag, Zap, TrendingUp, CheckCircle2, Circle, Lightbulb, ArrowRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Overview() {
  const { data: summary, isLoading: loadingSummary } = useGetOverviewSummary({
    query: { queryKey: getGetOverviewSummaryQueryKey() }
  });

  const { data: chartData, isLoading: loadingChart } = useGetMonthlySalesChart({
    query: { queryKey: getGetMonthlySalesChartQueryKey() }
  });

  const { data: workingNow, isLoading: loadingWorkingNow } = useGetWorkingNow({
    query: { queryKey: getGetWorkingNowQueryKey(), refetchInterval: 60000 }
  });

  const { data: shiftReminders, isLoading: loadingReminders } = useGetUpcomingShiftReminders({
    query: { queryKey: getGetUpcomingShiftRemindersQueryKey(), refetchInterval: 60000 }
  });

  const { data: lowStockItems } = useGetLowStockItems({
    query: { queryKey: getGetLowStockItemsQueryKey() }
  });

  const { data: activeDiscount } = useGetActiveDiscountStatus({
    query: { queryKey: getGetActiveDiscountStatusQueryKey(), refetchInterval: 30000 }
  });

  const { data: onboardingStatus } = useGetOnboardingStatus({
    query: { queryKey: getGetOnboardingStatusQueryKey() }
  });

  const { data: dailySummary } = useGetInsightsDailySummary({
    query: { queryKey: getGetInsightsDailySummaryQueryKey(), staleTime: 5 * 60 * 1000 }
  });

  const showOnboardingBanner = onboardingStatus && !onboardingStatus.onboardingCompleted;

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground mt-2">
          Your cockpit for today's performance and key metrics.
        </p>
      </div>

      {/* Onboarding banner */}
      {showOnboardingBanner && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-primary/30 bg-primary/5 p-4"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded bg-primary flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary-foreground">R</span>
                </div>
                <span className="font-semibold text-sm">
                  Complete your setup — {onboardingStatus.progressPercent}% done
                </span>
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                  {onboardingStatus.completedCount}/{onboardingStatus.totalCount} steps
                </Badge>
              </div>
              <div className="h-1.5 w-full max-w-xs rounded-full bg-muted overflow-hidden mb-3">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${onboardingStatus.progressPercent}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {onboardingStatus.checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-1.5 text-xs">
                    {item.completed
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      : <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    }
                    <span className={item.completed ? "text-muted-foreground line-through" : "text-foreground"}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap shrink-0">
              {onboardingStatus.checklist
                .filter((c) => !c.completed && c.href)
                .slice(0, 2)
                .map((item) => (
                  <Link key={item.id} href={item.href!}>
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                      {item.label}
                    </Button>
                  </Link>
                ))}
              <Link href="/onboarding">
                <Button size="sm" className="text-xs h-7 gap-1">
                  Continue Setup
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* Dead Hours daily insight */}
      {dailySummary && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${
            dailySummary.severity === "high"
              ? "bg-rose-500/10 border-rose-500/30"
              : dailySummary.severity === "medium"
              ? "bg-amber-500/10 border-amber-500/30"
              : "bg-blue-500/10 border-blue-500/30"
          }`}
        >
          <Lightbulb className={`h-4 w-4 mt-0.5 shrink-0 ${
            dailySummary.severity === "high" ? "text-rose-500" :
            dailySummary.severity === "medium" ? "text-amber-500" : "text-blue-500"
          }`} />
          <p className="text-sm flex-1">{dailySummary.message}</p>
          <Link href="/insights">
            <Button size="sm" variant="ghost" className="text-xs h-6 gap-1 shrink-0">
              View Insights
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </motion.div>
      )}

      {shiftReminders && shiftReminders.length > 0 && (
        <div className="flex flex-col gap-2">
          {shiftReminders.map(reminder => (
            <Alert key={`${reminder.employeeId}-${reminder.startTime}`} className="bg-amber-500/10 text-amber-600 border-amber-500/20">
              <Bell className="h-4 w-4 text-amber-600" />
              <AlertTitle>Shift Starting Soon</AlertTitle>
              <AlertDescription>
                {reminder.employeeName} ({reminder.role}) is scheduled to start in {reminder.minutesUntilStart} minutes at {reminder.startTime}.
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {activeDiscount?.active && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <Zap className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-bold text-emerald-500">{activeDiscount.label}</span>
            <span className="text-sm text-muted-foreground ml-2">{activeDiscount.percentage}% off is live right now</span>
            {activeDiscount.minutesRemaining != null && (
              <span className="ml-2 text-sm text-emerald-500 font-mono">({activeDiscount.minutesRemaining} min left)</span>
            )}
          </div>
          <Badge className="bg-emerald-500 text-white border-0 animate-pulse text-xs">LIVE DISCOUNT</Badge>
        </motion.div>
      )}

      {lowStockItems && lowStockItems.length > 0 && (
        <Alert className="border-rose-500/30 bg-rose-500/10">
          <ShoppingBag className="h-4 w-4 text-rose-500" />
          <AlertTitle className="text-rose-500 font-bold">Action Required — Low Stock Alert</AlertTitle>
          <AlertDescription>
            <p className="mb-4">{lowStockItems.length} ingredient(s) have fallen below minimum stock levels and require immediate restocking.</p>
            <div className="space-y-2">
              {lowStockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm border-t border-rose-500/10 pt-2 first:border-0 first:pt-0">
                  <span className="font-bold text-rose-500">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-rose-500">{item.quantity} {item.unit}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{item.alertThreshold} {item.unit}</span>
                    <Badge variant="outline" className="text-rose-500 border-rose-500/30 bg-rose-500/5">Below Minimum</Badge>
                  </div>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Profit</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-[100px]" />
              ) : (
                <div className="text-2xl font-bold text-emerald-500">
                  €{summary?.todayProfit?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Revenue: €{summary?.todayRevenue?.toLocaleString()}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reservations</CardTitle>
              <Calendar className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-[60px]" />
              ) : (
                <div className="text-2xl font-bold">{summary?.todayReservations || 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">{summary?.pendingReservations || 0} pending</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-[60px]" />
              ) : (
                <div className="text-2xl font-bold">{summary?.workingNowCount || summary?.activeStaff || 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Currently clocked in</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Alerts</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${summary?.lowStockAlerts && summary.lowStockAlerts > 0 ? "text-rose-500" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-[60px]" />
              ) : (
                <div className={`text-2xl font-bold ${summary?.lowStockAlerts && summary.lowStockAlerts > 0 ? "text-rose-500" : ""}`}>
                  {summary?.lowStockAlerts || 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Items below threshold</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Occupancy</CardTitle>
              <Utensils className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-[80px]" />
              ) : (
                <div className="text-2xl font-bold text-amber-500">{summary?.tableOccupancyPercent || 0}%</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">{summary?.tableOccupancy || 0} / {summary?.tableTotal || 0} tables seated</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Live Traffic</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-[60px]" />
              ) : (
                <div className="text-2xl font-bold text-blue-500">{summary?.liveTraffic ?? 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Bookings in next 2h</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expected Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-[100px]" />
              ) : (
                <div className="text-2xl font-bold text-indigo-500">
                  €{(summary?.expectedRevenue ?? 0).toLocaleString()}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">From confirmed bookings</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <motion.div className="col-span-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Revenue vs Profit (Monthly)</CardTitle>
            </CardHeader>
            <CardContent className="pl-0">
              {loadingChart ? (
                <div className="h-[350px] w-full flex items-center justify-center">
                  <Skeleton className="h-[300px] w-[95%]" />
                </div>
              ) : (
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        padding={{ left: 20, right: 20 }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(value) => `€${value}`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                      <Area type="monotone" dataKey="profit" stroke="hsl(160, 84%, 39%)" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div className="col-span-1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                On Shift Right Now
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingWorkingNow ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : workingNow && workingNow.length > 0 ? (
                <div className="space-y-4">
                  {workingNow.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div>
                        <p className="font-medium text-sm">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">{emp.role}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          {emp.shiftStart} - {emp.shiftEnd}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {emp.minutesUntilEnd} min left
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] text-center text-muted-foreground">
                  <Users className="h-8 w-8 mb-2 opacity-20" />
                  <p>No staff currently on shift</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
