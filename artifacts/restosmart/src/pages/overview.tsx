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
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, AlertTriangle, Utensils, Calendar, Clock, Bell, ShoppingBag, Zap, TrendingUp, CheckCircle2, Circle, Lightbulb, ArrowRight, Rocket, Star, MessageSquare, MapPin, Target, BarChart2, Flame, UserCheck, UserX, ClipboardList, Send, RefreshCw } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type PilotStatus = {
  pilotMode: boolean;
  pilotActivatedAt: string | null;
  isPilotActive: boolean;
  is24hAlert: boolean;
  readinessScore: number;
  criteria: Record<string, boolean>;
  totalBookings: number;
  totalCustomers: number;
  restaurantName: string;
};

const FEEDBACK_CATEGORIES = [
  { value: "bookings", label: "Bookings" },
  { value: "revenue", label: "Revenue" },
  { value: "marketing", label: "Marketing" },
  { value: "general", label: "General" },
] as const;

export default function Overview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackCategory, setFeedbackCategory] = useState<"bookings" | "revenue" | "marketing" | "general">("general");
  const [feedbackSent, setFeedbackSent] = useState(false);

  const { data: pilotStatus } = useQuery<PilotStatus>({
    queryKey: ["pilot-status"],
    queryFn: () => fetch("/api/pilot/status").then(r => r.json()),
    refetchInterval: 60000,
  });

  const submitFeedback = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pilot/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: feedbackText, rating: feedbackRating || undefined, category: feedbackCategory }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Feedback submitted — thank you!" });
      setFeedbackText("");
      setFeedbackRating(0);
      setFeedbackSent(true);
      queryClient.invalidateQueries({ queryKey: ["pilot-status"] });
    },
    onError: () => toast({ title: "Failed to submit feedback", variant: "destructive" }),
  });

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

  const { data: localReach, isLoading: loadingLocalReach } = useQuery<{
    activeDeals: number;
    totalDeals: number;
    bookingsThisWeek: number;
    totalBookingsDuringDeals: number;
    totalEstimatedImpressions: number;
    overallConversionRate: number;
    topDeal: {
      id: number;
      label: string;
      percentage: number;
      isActive: boolean;
      type: string;
      bookingsDuringPeriod: number;
      estimatedImpressions: number;
      conversionRate: number;
    } | null;
    deals: Array<{
      id: number;
      label: string;
      percentage: number;
      isActive: boolean;
      type: string;
      bookingsDuringPeriod: number;
      estimatedImpressions: number;
      conversionRate: number;
    }>;
  }>({
    queryKey: ["local-reach"],
    queryFn: () => fetch("/api/discounts/local-reach").then((r) => r.json()),
    staleTime: 2 * 60 * 1000,
  });

  type AttendanceRecord = {
    shiftId: number;
    attendanceId: number;
    employeeId: number;
    employeeName: string;
    employeeEmail: string;
    role: string;
    startTime: string;
    endTime: string;
    status: "pending" | "confirmed" | "late" | "missed";
    confirmedAt: string | null;
    morningReminderSent: boolean;
    preShiftReminderSent: boolean;
    confirmToken: string;
  };

  const { data: attendanceToday, isLoading: loadingAttendance, refetch: refetchAttendance } = useQuery<AttendanceRecord[]>({
    queryKey: ["attendance-today"],
    queryFn: () => fetch("/api/attendance/today").then((r) => r.json()),
    refetchInterval: 60000,
  });

  const confirmAttendance = useMutation({
    mutationFn: (attendanceId: number) =>
      fetch("/api/attendance/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId }),
      }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["attendance-today"] }); },
  });

  const sendReminders = useMutation({
    mutationFn: () =>
      fetch("/api/attendance/send-reminders", { method: "POST" }).then((r) => r.json()),
    onSuccess: (data) => {
      toast({ title: `Reminders sent (${data.remindersSent ?? 0} of ${data.totalShifts ?? 0} staff)` });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
    },
  });

  const showOnboardingBanner = onboardingStatus && !onboardingStatus.onboardingCompleted;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
            {pilotStatus?.pilotMode && (
              <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/30 gap-1 text-xs font-semibold">
                <Rocket className="h-3 w-3" />
                Pilot Programme
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-2">
            Your cockpit for today's performance and key metrics.
          </p>
        </div>
        {pilotStatus?.pilotMode && (
          <div className="shrink-0 text-right">
            <div className="text-xs text-muted-foreground">Pilot readiness</div>
            <div className="text-2xl font-bold text-violet-400">{pilotStatus.readinessScore}%</div>
            <div className="h-1.5 w-28 rounded-full bg-muted overflow-hidden mt-1">
              <div
                className="h-full bg-violet-500 rounded-full transition-all"
                style={{ width: `${pilotStatus.readinessScore}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pilot 24h activity alert */}
      {pilotStatus?.is24hAlert && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-amber-500/40 bg-amber-500/8 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-400 text-sm">No bookings in your first 24 hours</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your restaurant is live but no customers have booked yet. Here's what to do right now:
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link href="/discounts">
                  <Button size="sm" variant="outline" className="text-xs h-7 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                    Boost Discount
                  </Button>
                </Link>
                <Link href="/campaigns">
                  <Button size="sm" variant="outline" className="text-xs h-7 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                    Launch Flash Deal
                  </Button>
                </Link>
                <Link href="/dead-hours">
                  <Button size="sm" variant="outline" className="text-xs h-7 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                    Fill Dead Hours
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}

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

      {/* Today's Staff Status */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <CardTitle>Today's Staff Status</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => refetchAttendance()}
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => sendReminders.mutate()}
                  disabled={sendReminders.isPending}
                >
                  <Send className="h-3 w-3" />
                  {sendReminders.isPending ? "Sending…" : "Send Reminders"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Live attendance tracking — refreshes every minute. Employees confirm via email link.</p>
          </CardHeader>
          <CardContent>
            {loadingAttendance ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : !attendanceToday || attendanceToday.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <Users className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">No shifts scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Summary row */}
                <div className="flex gap-3 mb-4 flex-wrap">
                  {[
                    { label: "On shift", value: attendanceToday.length, color: "text-foreground" },
                    { label: "Confirmed", value: attendanceToday.filter(r => r.status === "confirmed").length, color: "text-emerald-500" },
                    { label: "Late", value: attendanceToday.filter(r => r.status === "late").length, color: "text-amber-500" },
                    { label: "Pending", value: attendanceToday.filter(r => r.status === "pending").length, color: "text-muted-foreground" },
                    { label: "Missed", value: attendanceToday.filter(r => r.status === "missed").length, color: "text-red-500" },
                  ].map(stat => (
                    <div key={stat.label} className="text-center px-4 py-2 rounded-lg bg-muted/40 border border-border min-w-[70px]">
                      <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                      <div className="text-[11px] text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Per-employee rows */}
                {attendanceToday.map((rec) => {
                  const statusConfig = {
                    confirmed: { label: "Confirmed", icon: UserCheck, className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
                    late:      { label: "Late",      icon: UserCheck, className: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
                    pending:   { label: "Pending",   icon: Circle,    className: "bg-muted/50 text-muted-foreground border-border" },
                    missed:    { label: "Missed",    icon: UserX,     className: "bg-red-500/10 text-red-400 border-red-500/30" },
                  }[rec.status];
                  const StatusIcon = statusConfig.icon;
                  const canConfirm = rec.status === "pending" || rec.status === "late";

                  return (
                    <div key={rec.attendanceId} className="flex items-center justify-between p-3 rounded-lg border bg-card gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 border ${statusConfig.className}`}>
                          <StatusIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{rec.employeeName}</p>
                          <p className="text-xs text-muted-foreground">{rec.role}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-medium text-foreground">{rec.startTime} – {rec.endTime}</p>
                          {rec.confirmedAt && (
                            <p className="text-[11px] text-muted-foreground">
                              Arrived {new Date(rec.confirmedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                          {!rec.confirmedAt && rec.morningReminderSent && (
                            <p className="text-[11px] text-muted-foreground">Reminder sent</p>
                          )}
                        </div>

                        <Badge variant="outline" className={`text-xs shrink-0 ${statusConfig.className}`}>
                          {statusConfig.label}
                        </Badge>

                        {canConfirm && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 shrink-0"
                            onClick={() => confirmAttendance.mutate(rec.attendanceId)}
                            disabled={confirmAttendance.isPending}
                          >
                            <UserCheck className="h-3 w-3" />
                            <span className="hidden sm:inline">Mark Present</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Local Reach Analytics */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <CardTitle>Local Reach & Deal Performance</CardTitle>
              </div>
              {localReach && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                    {localReach.activeDeals} active deal{localReach.activeDeals !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs">
                    ~{localReach.totalEstimatedImpressions.toLocaleString()} local impressions
                  </Badge>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              How your active deals are reaching and converting nearby customers. Impressions are estimates based on deal activity windows.
            </p>
          </CardHeader>
          <CardContent>
            {loadingLocalReach ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : !localReach || localReach.totalDeals === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <MapPin className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No deals configured yet</p>
                <p className="text-xs mt-1">Create a flash deal or scheduled discount to start reaching nearby customers.</p>
                <Link href="/discounts" className="mt-4 text-xs text-primary hover:underline flex items-center gap-1">
                  Go to Deals <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary metrics row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-muted/40 border text-center">
                    <div className="text-2xl font-bold text-foreground">{localReach.bookingsThisWeek}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Bookings this week</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 border text-center">
                    <div className="text-2xl font-bold text-primary">{localReach.totalBookingsDuringDeals}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">During deal windows</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 border text-center">
                    <div className="text-2xl font-bold text-foreground">{localReach.totalEstimatedImpressions.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Est. impressions</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 border text-center">
                    <div className="text-2xl font-bold text-emerald-500">{localReach.overallConversionRate}%</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Conversion rate</div>
                  </div>
                </div>

                {/* Top deal highlight */}
                {localReach.topDeal && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
                      <Flame className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate">{localReach.topDeal.label}</span>
                        <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-xs border">
                          {localReach.topDeal.percentage}% off · Top performer
                        </Badge>
                        {localReach.topDeal.isActive && (
                          <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live now
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{localReach.topDeal.bookingsDuringPeriod} bookings during deal</span>
                        <span>~{localReach.topDeal.estimatedImpressions} impressions</span>
                        <span>{localReach.topDeal.conversionRate}% conversion</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Deal list */}
                {localReach.deals.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">All Deals Performance</p>
                    <div className="rounded-lg border divide-y divide-border overflow-hidden">
                      {localReach.deals.map((deal) => (
                        <div key={deal.id} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${deal.isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{deal.label}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{deal.percentage}% off</Badge>
                              <span className="text-[10px] text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded">{deal.type}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                            <div className="text-right hidden sm:block">
                              <div className="font-semibold text-foreground">{deal.bookingsDuringPeriod}</div>
                              <div>bookings</div>
                            </div>
                            <div className="text-right hidden md:block">
                              <div className="font-semibold text-foreground">~{deal.estimatedImpressions}</div>
                              <div>impressions</div>
                            </div>
                            <div className="text-right">
                              <div className={`font-semibold ${deal.conversionRate > 1 ? "text-emerald-500" : "text-foreground"}`}>
                                {deal.conversionRate}%
                              </div>
                              <div>conv.</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
                  <BarChart2 className="h-3 w-3" />
                  Impressions are platform estimates based on deal activity windows. Bookings are cross-referenced with actual reservation timestamps.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Pilot Feedback Widget — only shown when in pilot mode */}
      {pilotStatus?.pilotMode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-violet-500/20 bg-violet-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4 text-violet-400" />
                How is RestoSmart helping your restaurant?
              </CardTitle>
              <p className="text-xs text-muted-foreground">Your feedback shapes what we build next. All responses are stored.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {feedbackSent ? (
                <div className="flex items-center gap-2 text-sm text-emerald-400 py-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Feedback received — thank you for helping us improve.
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Rate your experience</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFeedbackRating(star)}
                          className="transition-transform hover:scale-110"
                        >
                          <Star
                            className={`h-6 w-6 transition-colors ${
                              star <= feedbackRating
                                ? "text-amber-400 fill-amber-400"
                                : "text-muted-foreground/40"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Category</p>
                    <div className="flex flex-wrap gap-2">
                      {FEEDBACK_CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setFeedbackCategory(cat.value)}
                          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                            feedbackCategory === cat.value
                              ? "bg-violet-500/20 text-violet-400 border-violet-500/40"
                              : "text-muted-foreground border-muted hover:border-violet-500/30"
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Textarea
                    placeholder="Tell us what's working, what's not, or what you wish you had..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    className="resize-none text-sm min-h-[80px] bg-background"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                      disabled={!feedbackText.trim() || submitFeedback.isPending}
                      onClick={() => submitFeedback.mutate()}
                    >
                      {submitFeedback.isPending ? "Sending..." : "Send Feedback"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
