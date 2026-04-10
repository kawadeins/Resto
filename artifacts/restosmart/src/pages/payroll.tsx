import { useState } from "react";
import { useSession } from "@/contexts/session-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  DollarSign, Clock, TrendingUp, Users, CheckCircle, XCircle, AlertCircle,
  Edit2, Check, X, Trophy, Medal, Award, Star
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface EmployeePerformance {
  id: number;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: string;
  hourlyRate: number;
  shiftsPerWeek: number;
  weeklyScheduledHours: number;
  monthlyScheduledHours: number;
  actualHoursThisMonth: number;
  projectedMonthlyPay: number;
  actualPayThisMonth: number;
  totalAttendanceRecords: number;
  confirmedCount: number;
  missedCount: number;
  attendanceRate: number | null;
}

interface LeaderboardEntry {
  id: number;
  name: string;
  role: string;
  totalShiftsTracked: number;
  confirmedCount: number;
  lateCount: number;
  missedCount: number;
  attendanceRate: number | null;
  reliabilityScore: number | null;
}

function AttendanceBar({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-xs text-muted-foreground">Keine Daten</span>;
  const color = rate >= 85 ? "bg-emerald-500" : rate >= 65 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${rate}%` }} />
      </div>
      <span className="text-xs font-semibold w-9 text-right">{rate}%</span>
    </div>
  );
}

export default function Payroll() {
  const { toast } = useToast();
  const { csrfToken } = useSession();
  const queryClient = useQueryClient();
  const [editingRate, setEditingRate] = useState<number | null>(null);
  const [rateInput, setRateInput] = useState("");

  const { data: summary, isLoading: loadingSummary } = useQuery<EmployeePerformance[]>({
    queryKey: ["performance-summary"],
    queryFn: () => fetch(`${API_BASE}/api/performance/summary`).then(r => r.json()),
    refetchInterval: 30_000,
  });

  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ["performance-leaderboard"],
    queryFn: () => fetch(`${API_BASE}/api/performance/leaderboard`).then(r => r.json()),
    refetchInterval: 30_000,
  });

  const setRateMutation = useMutation({
    mutationFn: (vars: { employeeId: number; hourlyRate: number }) => {
      const csrfHdr = csrfToken ? { "X-CSRF-Token": csrfToken } : {};
      return fetch(`${API_BASE}/api/performance/set-rate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHdr },
        body: JSON.stringify(vars),
      }).then(r => r.json());
    },
    onSuccess: () => {
      toast({ title: "Stundenlohn aktualisiert" });
      setEditingRate(null);
      queryClient.invalidateQueries({ queryKey: ["performance-summary"] });
    },
    onError: () => toast({ title: "Stundenlohn konnte nicht aktualisiert werden", variant: "destructive" }),
  });

  const totalMonthlyPayroll = summary?.reduce((s, e) => s + e.projectedMonthlyPay, 0) ?? 0;
  const totalActualPay = summary?.reduce((s, e) => s + e.actualPayThisMonth, 0) ?? 0;
  const avgAttendanceRate = summary?.filter(e => e.attendanceRate !== null).length
    ? Math.round(
        summary!.filter(e => e.attendanceRate !== null).reduce((s, e) => s + (e.attendanceRate ?? 0), 0) /
        summary!.filter(e => e.attendanceRate !== null).length
      )
    : null;

  const medalIcons = [
    <Trophy className="w-4 h-4 text-yellow-500" />,
    <Medal className="w-4 h-4 text-slate-400" />,
    <Award className="w-4 h-4 text-amber-600" />,
  ];

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Personalleistung & Gehaltsabrechnung</h2>
        <p className="text-muted-foreground mt-2">Anwesenheit, Stunden und Gehaltsprognosen für Ihr Team im Überblick.</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Geplante Gehaltsabrechnung (Mo.)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€{totalMonthlyPayroll.toFixed(0)}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Basierend auf geplanten Schichten
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tatsächlicher Lohn (Dieser Monat)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€{totalActualPay.toFixed(0)}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                Aus bestätigten Schichten
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Team-Anwesenheitsrate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgAttendanceRate !== null ? `${avgAttendanceRate}%` : "—"}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Users className="w-3 h-3" />
                Durchschnitt aller Mitarbeiter
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aktive Mitarbeiter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Eingeplante Mitarbeiter
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Leaderboard */}
        {leaderboard && leaderboard.length > 0 && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  Zuverlässigkeits-Rangliste
                </CardTitle>
                <CardDescription>Sortiert nach Zuverlässigkeitspunktzahl</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {leaderboard.slice(0, 8).map((entry, idx) => (
                  <div key={entry.id} className="flex items-start gap-3">
                    <div className="w-6 flex justify-center pt-0.5">
                      {idx < 3 ? medalIcons[idx] : (
                        <span className="text-xs font-bold text-muted-foreground">{idx + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{entry.name}</div>
                      <div className="text-xs text-muted-foreground">{entry.role}</div>
                      <div className="mt-1.5">
                        <AttendanceBar rate={entry.reliabilityScore} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {entry.confirmedCount} bestätigt · {entry.lateCount} verspätet · {entry.missedCount} verpasst
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Staff payroll table */}
        <motion.div
          className={leaderboard && leaderboard.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Gehaltsdetails</CardTitle>
              <CardDescription>
                Stunden und Lohnberechnungen für den aktuellen Monat. Klicken Sie auf den Stundenlohn zum Bearbeiten.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingSummary ? (
                <div className="p-8 text-center text-muted-foreground">Gehaltsdaten werden geladen…</div>
              ) : !summary?.length ? (
                <div className="p-8 text-center text-muted-foreground">Keine aktiven Mitarbeiter gefunden.</div>
              ) : (
                <div className="divide-y divide-border">
                  {summary.map((emp) => {
                    const isEditing = editingRate === emp.id;
                    const attendanceColor = emp.attendanceRate !== null
                      ? emp.attendanceRate >= 85 ? "text-emerald-500" : emp.attendanceRate >= 65 ? "text-amber-500" : "text-red-500"
                      : "text-muted-foreground";

                    return (
                      <div key={emp.id} className="p-5 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start gap-4">
                          {/* Avatar + name */}
                          <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center text-primary font-bold shrink-0">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold">{emp.name}</div>
                                <div className="text-xs text-muted-foreground">{emp.role}</div>
                              </div>

                              {/* Hourly rate edit */}
                              <div className="flex items-center gap-2 shrink-0">
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm text-muted-foreground">€</span>
                                    <Input
                                      type="number"
                                      value={rateInput}
                                      onChange={(e) => setRateInput(e.target.value)}
                                      className="w-20 h-7 text-sm"
                                      min="0"
                                      step="0.5"
                                      autoFocus
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-emerald-500 hover:text-emerald-600"
                                      onClick={() => {
                                        const rate = parseFloat(rateInput);
                                        if (!isNaN(rate) && rate > 0) {
                                          setRateMutation.mutate({ employeeId: emp.id, hourlyRate: rate });
                                        }
                                      }}
                                    >
                                      <Check className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-muted-foreground"
                                      onClick={() => setEditingRate(null)}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setEditingRate(emp.id); setRateInput(String(emp.hourlyRate)); }}
                                    className="flex items-center gap-1.5 text-sm font-medium bg-muted px-2 py-1 rounded-lg hover:bg-muted/80 transition-colors"
                                  >
                                    €{emp.hourlyRate.toFixed(2)}/Std.
                                    <Edit2 className="w-3 h-3 text-muted-foreground" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Metrics grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                              <div className="bg-muted/40 rounded-lg p-2.5">
                                <div className="text-xs text-muted-foreground mb-0.5">Geplante Std./Mo.</div>
                                <div className="font-bold text-sm">{emp.monthlyScheduledHours}h</div>
                              </div>
                              <div className="bg-muted/40 rounded-lg p-2.5">
                                <div className="text-xs text-muted-foreground mb-0.5">Tatsächliche Std.</div>
                                <div className="font-bold text-sm">{emp.actualHoursThisMonth}h</div>
                              </div>
                              <div className="bg-muted/40 rounded-lg p-2.5">
                                <div className="text-xs text-muted-foreground mb-0.5">Geplanter Lohn</div>
                                <div className="font-bold text-sm">€{emp.projectedMonthlyPay.toFixed(0)}</div>
                              </div>
                              <div className="bg-muted/40 rounded-lg p-2.5">
                                <div className="text-xs text-muted-foreground mb-0.5">Tatsächlicher Lohn</div>
                                <div className="font-bold text-sm text-emerald-600">€{emp.actualPayThisMonth.toFixed(0)}</div>
                              </div>
                            </div>

                            {/* Attendance row */}
                            <div className="mt-3 flex items-center gap-3">
                              <div className="flex-1">
                                <AttendanceBar rate={emp.attendanceRate} />
                              </div>
                              <div className="flex items-center gap-2 text-xs shrink-0">
                                <span className="flex items-center gap-0.5 text-emerald-600">
                                  <CheckCircle className="w-3 h-3" /> {emp.confirmedCount}
                                </span>
                                <span className="flex items-center gap-0.5 text-red-500">
                                  <XCircle className="w-3 h-3" /> {emp.missedCount}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
