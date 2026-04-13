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
import { PromotionTools } from "@/components/promotion-tools";
import { useSession } from "@/contexts/session-context";
import { useState, useEffect } from "react";
import { track } from "@/lib/conversion-tracking";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, AlertTriangle, Utensils, Calendar, Clock, Bell, ShoppingBag, Zap, TrendingUp, CheckCircle2, Circle, Lightbulb, ArrowRight, Rocket, Star, MessageSquare, MapPin, Target, BarChart2, Flame, UserCheck, UserX, ClipboardList, Send, RefreshCw } from "lucide-react";
import { getBizType, BIZ_POSSESSIVE } from "@/lib/biz-copy";
import { TrialConversionBanner } from "@/components/layout";
import { GrowthActivationHub } from "@/components/growth-activation-hub";
import { CompetitionEngine } from "@/components/competition-engine";
import { CityExpansionEngine } from "@/components/city-expansion-engine";
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
  { value: "bookings", label: "Buchungen" },
  { value: "revenue", label: "Umsatz" },
  { value: "marketing", label: "Marketing" },
  { value: "general", label: "Allgemein" },
] as const;

export default function Overview() {
  useEffect(() => {
    if (localStorage.getItem("restosmart_owner_premium") === "trial") {
      track("dashboard_accessed");
    }
  }, []);
  const { toast } = useToast();
  const { csrfToken } = useSession();
  const queryClient = useQueryClient();
  const bizPossessive = BIZ_POSSESSIVE[getBizType()];
  const csrfHdr = csrfToken ? { "X-CSRF-Token": csrfToken } : {};
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackCategory, setFeedbackCategory] = useState<"bookings" | "revenue" | "marketing" | "general">("general");
  const [feedbackSent, setFeedbackSent] = useState(false);

  const { data: pilotStatus } = useQuery<PilotStatus>({
    queryKey: ["pilot-status"],
    queryFn: async () => {
      const r = await fetch("/api/pilot/status");
      if (!r.ok) return null;
      return r.json();
    },
    refetchInterval: 60000,
  });

  const submitFeedback = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/pilot/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHdr },
        body: JSON.stringify({ message: feedbackText, rating: feedbackRating || undefined, category: feedbackCategory }),
      });
      if (!res.ok) throw new Error("Fehler");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Feedback eingereicht – vielen Dank!" });
      setFeedbackText("");
      setFeedbackRating(0);
      setFeedbackSent(true);
      queryClient.invalidateQueries({ queryKey: ["pilot-status"] });
    },
    onError: () => toast({ title: "Feedback konnte nicht gesendet werden", variant: "destructive" }),
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
    queryFn: async () => {
      const r = await fetch("/api/discounts/local-reach");
      if (!r.ok) return null;
      return r.json();
    },
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
    queryFn: async () => {
      const r = await fetch("/api/attendance/today");
      if (!r.ok) return [];
      return r.json();
    },
    refetchInterval: 60000,
  });

  const confirmAttendance = useMutation({
    mutationFn: (attendanceId: number) =>
      fetch("/api/attendance/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHdr },
        body: JSON.stringify({ attendanceId }),
      }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["attendance-today"] }); },
  });

  const sendReminders = useMutation({
    mutationFn: () =>
      fetch("/api/attendance/send-reminders", {
        method: "POST",
        credentials: "include",
        headers: { ...csrfHdr },
      }).then((r) => r.json()),
    onSuccess: (data) => {
      toast({ title: `Erinnerungen gesendet (${data.remindersSent ?? 0} von ${data.totalShifts ?? 0} Mitarbeitern)` });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
    },
  });

  const showOnboardingBanner = onboardingStatus && !onboardingStatus.onboardingCompleted;

  return (
    <div className="space-y-8 pb-10">
      {/* ── Willkommen-Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Willkommen</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {"Verwalten Sie Ihre Buchungen, Ihr Marketing, Ihre Bewertungen und Ihr Restaurant an einem Ort."}
          </p>
        </div>
      </div>

      {/* Growth Activation Hub — shown to new trial users with step-by-step activation */}
      <GrowthActivationHub onUpgrade={() => { window.location.href = "/billing"; }} />

      {/* Trial conversion prompt — only visible during active trial */}
      <TrialConversionBanner context="overview" />

      {/* Competition Engine — visibility tier, demand signals, competition level */}
      <CompetitionEngine
        onBoost={() => { window.location.href = "/boost"; }}
        onUpgrade={() => { window.location.href = "/billing"; }}
      />

      {/* City Expansion Engine — local market opportunity and city health */}
      <CityExpansionEngine
        onBoost={() => { window.location.href = "/boost"; }}
        onUpgrade={() => { window.location.href = "/billing"; }}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">Übersicht</h2>
            {pilotStatus?.pilotMode && (
              <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/30 gap-1 text-xs font-semibold">
                <Rocket className="h-3 w-3" />
                Pilotprogramm
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-2">
            Ihr Cockpit für die heutige Leistung und wichtige Kennzahlen.
          </p>
        </div>
        {pilotStatus?.pilotMode && (
          <div className="shrink-0 text-right">
            <div className="text-xs text-muted-foreground">Pilot-Bereitschaft</div>
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

      {/* Pilot 24h Aktivitätswarnung */}
      {pilotStatus?.is24hAlert && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-amber-500/40 bg-amber-500/8 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-400 text-sm">Keine Buchungen in den ersten 24 Stunden</p>
              <p className="text-xs text-muted-foreground mt-1">
                {bizPossessive} ist live, aber noch kein Gast hat gebucht. So reagieren Sie jetzt:
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link href="/campaigns">
                  <Button size="sm" variant="outline" className="text-xs h-7 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                    Rabatt erhöhen
                  </Button>
                </Link>
                <Link href="/campaigns">
                  <Button size="sm" variant="outline" className="text-xs h-7 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                    Flash-Deal starten
                  </Button>
                </Link>
                <Link href="/insights">
                  <Button size="sm" variant="outline" className="text-xs h-7 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                    Tote Stunden füllen
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Onboarding-Banner */}
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
                  Einrichtung abschließen — {onboardingStatus.progressPercent}% erledigt
                </span>
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                  {onboardingStatus.completedCount}/{onboardingStatus.totalCount} Schritte
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
                  Einrichtung fortsetzen
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tagesübersicht Tote Stunden */}
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
              Auswertung anzeigen
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
              <AlertTitle>Schicht beginnt bald</AlertTitle>
              <AlertDescription>
                {reminder.employeeName} ({reminder.role}) beginnt in {reminder.minutesUntilStart} Minuten um {reminder.startTime} Uhr.
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
            <span className="text-sm text-muted-foreground ml-2">{activeDiscount.percentage}% Rabatt ist gerade aktiv</span>
            {activeDiscount.minutesRemaining != null && (
              <span className="ml-2 text-sm text-emerald-500 font-mono">({activeDiscount.minutesRemaining} Min. verbleibend)</span>
            )}
          </div>
          <Badge className="bg-emerald-500 text-white border-0 animate-pulse text-xs">LIVE-RABATT</Badge>
        </motion.div>
      )}

      {lowStockItems && lowStockItems.length > 0 && (
        <Alert className="border-rose-500/30 bg-rose-500/10">
          <ShoppingBag className="h-4 w-4 text-rose-500" />
          <AlertTitle className="text-rose-500 font-bold">Handlungsbedarf — Niedriger Lagerbestand</AlertTitle>
          <AlertDescription>
            <p className="mb-4">{lowStockItems.length} Zutat(en) haben den Mindestlagerbestand unterschritten und müssen sofort nachbestellt werden.</p>
            <div className="space-y-2">
              {lowStockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm border-t border-rose-500/10 pt-2 first:border-0 first:pt-0">
                  <span className="font-bold text-rose-500">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-rose-500">{item.quantity} {item.unit}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{item.alertThreshold} {item.unit}</span>
                    <Badge variant="outline" className="text-rose-500 border-rose-500/30 bg-rose-500/5">Unter Minimum</Badge>
                  </div>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Wien Demand Signal Card ────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-xl border border-violet-500/25 bg-gradient-to-r from-violet-500/8 via-primary/5 to-transparent p-4"
      >
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-primary flex items-center justify-center shadow-md shadow-violet-500/25">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-violet-400 uppercase tracking-wider">Wien-Nachfrage</p>
              <p className="text-[11px] text-muted-foreground">Plattform-Aktivität heute</p>
            </div>
          </div>

          <div className="flex gap-6 flex-wrap flex-1">
            <div className="text-center min-w-[64px]">
              <p className="text-xl font-extrabold text-violet-400">
                {localReach?.bookingsThisWeek != null ? localReach.bookingsThisWeek : "–"}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">Buchungen<br/>diese Woche</p>
            </div>
            <div className="text-center min-w-[64px]">
              <p className="text-xl font-extrabold text-emerald-400">
                {localReach?.totalEstimatedImpressions != null ? localReach.totalEstimatedImpressions : "–"}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">Gesch. Reichweite</p>
            </div>
            <div className="text-center min-w-[64px]">
              <p className="text-xl font-extrabold text-amber-400">{localReach?.activeDeals ?? 0}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Aktive<br/>Deals</p>
            </div>
          </div>

          <div className="flex gap-2 items-center flex-wrap shrink-0">
            <Link href="/campaigns">
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-gradient-to-br from-violet-500 to-primary border-0 shadow-md shadow-violet-500/25 hover:opacity-90">
                <Zap className="h-3 w-3" />
                Boost aktivieren
              </Button>
            </Link>
            <Link href="/insights">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-violet-500/30 text-violet-400 hover:bg-violet-500/10">
                Statistiken
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Heutiger Gewinn</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-[100px]" />
              ) : (
                <div className="text-2xl font-bold text-emerald-500">
                  {summary?.todayProfit?.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Umsatz: {summary?.todayRevenue?.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reservierungen</CardTitle>
              <Calendar className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-[60px]" />
              ) : (
                <div className="text-2xl font-bold">{summary?.todayReservations || 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">{summary?.pendingReservations || 0} ausstehend</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktives Personal</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-[60px]" />
              ) : (
                <div className="text-2xl font-bold">{summary?.workingNowCount || summary?.activeStaff || 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Aktuell eingestempelt</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lagerwarnungen</CardTitle>
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
              <p className="text-xs text-muted-foreground mt-1">Artikel unter Schwellenwert</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Auslastung</CardTitle>
              <Utensils className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-[80px]" />
              ) : (
                <div className="text-2xl font-bold text-amber-500">{summary?.tableOccupancyPercent || 0}%</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">{summary?.tableOccupancy || 0} / {summary?.tableTotal || 0} Tische besetzt</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Live-Verkehr</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-[60px]" />
              ) : (
                <div className="text-2xl font-bold text-blue-500">{summary?.liveTraffic ?? 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Buchungen in den nächsten 2 Std.</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gesch. Umsatz</CardTitle>
              <TrendingUp className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-[100px]" />
              ) : (
                <div className="text-2xl font-bold text-indigo-500">
                  {(summary?.expectedRevenue ?? 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Hochrechnung aus Buchungen</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <motion.div className="col-span-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Umsatz vs. Gewinn (monatlich)</CardTitle>
            </CardHeader>
            <CardContent className="pl-0">
              {loadingChart ? (
                <Skeleton className="h-[250px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData ?? []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `€${v}`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      formatter={(value: number, name: string) => [`€${value.toLocaleString("de-DE")}`, name === "revenue" ? "Umsatz" : "Gewinn"]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#colorRevenue)" strokeWidth={2} name="Umsatz" />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#colorProfit)" strokeWidth={2} name="Gewinn" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                Anwesenheit heute
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAttendance ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : !attendanceToday || attendanceToday.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  Keine Schichten für heute geplant
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex gap-3 text-xs">
                      <span className="text-emerald-500 font-semibold">{attendanceToday.filter(a => a.status === "confirmed").length} bestätigt</span>
                      <span className="text-amber-500 font-semibold">{attendanceToday.filter(a => a.status === "pending").length} ausstehend</span>
                      <span className="text-rose-500 font-semibold">{attendanceToday.filter(a => a.status === "missed").length} verpasst</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 gap-1"
                      onClick={() => sendReminders.mutate()}
                      disabled={sendReminders.isPending}
                    >
                      <Send className="h-3 w-3" />
                      Erinnerungen senden
                    </Button>
                  </div>
                  {attendanceToday.slice(0, 5).map((rec) => (
                    <div key={rec.attendanceId} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{rec.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{rec.role} · {rec.startTime}–{rec.endTime}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {rec.status === "confirmed" && <span className="text-xs text-emerald-500 font-semibold">Bestätigt</span>}
                        {rec.status === "late" && <span className="text-xs text-amber-500 font-semibold">Verspätet</span>}
                        {rec.status === "missed" && <span className="text-xs text-rose-500 font-semibold">Verpasst</span>}
                        {rec.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-6 px-2 gap-1"
                            onClick={() => confirmAttendance.mutate(rec.attendanceId)}
                            disabled={confirmAttendance.isPending}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Bestätigen
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {attendanceToday.length > 5 && (
                    <Link href="/staff">
                      <Button variant="ghost" size="sm" className="w-full text-xs gap-1 mt-1">
                        Alle {attendanceToday.length} Mitarbeiter anzeigen
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Lokale Reichweite */}
      {localReach && localReach.totalDeals > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Lokale Reichweite
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Aktive Deals</p>
                  <p className="text-xl font-bold">{localReach.activeDeals}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Buchungen diese Woche</p>
                  <p className="text-xl font-bold">{localReach.bookingsThisWeek}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Geschätzte Reichweite</p>
                  <p className="text-xl font-bold">{localReach.totalEstimatedImpressions.toLocaleString("de-DE")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Konversionsrate</p>
                  <p className="text-xl font-bold">{localReach.overallConversionRate.toFixed(1)}%</p>
                </div>
              </div>
              {localReach.topDeal && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Target className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{localReach.topDeal.label}</p>
                    <p className="text-xs text-muted-foreground">{localReach.topDeal.bookingsDuringPeriod} Buchungen · {localReach.topDeal.conversionRate.toFixed(1)}% Konversion</p>
                  </div>
                  <Badge className="bg-primary/15 text-primary border-primary/30 text-xs shrink-0">Top-Deal</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Pilot-Feedback */}
      {pilotStatus?.pilotMode && !feedbackSent && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
          <Card className="border-violet-500/20 bg-violet-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-violet-400">
                <MessageSquare className="h-4 w-4" />
                Pilot-Feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {FEEDBACK_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setFeedbackCategory(cat.value)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      feedbackCategory === cat.value
                        ? "bg-violet-500/20 border-violet-500/50 text-violet-400"
                        : "border-border text-muted-foreground hover:border-violet-500/30"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {[1,2,3,4,5].map((star) => (
                  <button key={star} onClick={() => setFeedbackRating(star)} className="text-lg transition-transform hover:scale-110">
                    <Star className={`h-5 w-5 ${star <= feedbackRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
              <Textarea
                placeholder="Was läuft gut? Was sollten wir verbessern?"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="resize-none bg-background/50 text-sm"
                rows={3}
              />
              <Button
                size="sm"
                onClick={() => submitFeedback.mutate()}
                disabled={submitFeedback.isPending || !feedbackText.trim()}
                className="gap-2 bg-violet-600 hover:bg-violet-500 text-white"
              >
                <Send className="h-3.5 w-3.5" />
                {submitFeedback.isPending ? "Wird gesendet..." : "Feedback senden"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Promotion Engine (quick access) ──────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Promotion Engine
            </h3>
            <p className="text-xs text-muted-foreground">Boosts aktivieren — Sichtbarkeit sofort erhöhen.</p>
          </div>
          <Link href="/analytics">
            <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5">
              Performance <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
        <PromotionTools />
      </motion.div>
    </div>
  );
}
