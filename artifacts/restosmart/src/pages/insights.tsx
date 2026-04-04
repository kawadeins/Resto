import {
  useGetInsightsHeatmap,
  getGetInsightsHeatmapQueryKey,
  useGetInsightsSuggestions,
  getGetInsightsSuggestionsQueryKey,
  useGetInsightsDailySummary,
  getGetInsightsDailySummaryQueryKey,
  useGetInsightsOutcomes,
  getGetInsightsOutcomesQueryKey,
  useActivateFlashDeal,
  useCreateScheduledDeal,
  getGetInsightsSuggestionsQueryKey as suggestionsKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Lightbulb,
  ArrowUpRight,
  Activity,
} from "lucide-react";

// ─── Heatmap ─────────────────────────────────────────────────────────────────

function HeatmapCell({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? value / max : 0;
  let bg: string;
  if (ratio === 0) bg = "hsl(var(--muted)/0.2)";
  else if (ratio < 0.2) bg = "hsl(160 60% 20% / 0.4)";
  else if (ratio < 0.4) bg = "hsl(160 70% 28% / 0.6)";
  else if (ratio < 0.65) bg = "hsl(160 78% 34% / 0.75)";
  else if (ratio < 0.85) bg = "hsl(160 84% 39% / 0.88)";
  else bg = "hsl(160 84% 39%)";

  return (
    <div
      className="rounded-sm h-7 flex items-center justify-center text-[10px] font-medium transition-colors"
      style={{ backgroundColor: bg, color: ratio > 0.4 ? "white" : "hsl(var(--muted-foreground))" }}
      title={`${value.toFixed(1)} Ø/Woche`}
    >
      {value > 0 ? value.toFixed(1) : ""}
    </div>
  );
}

function Heatmap() {
  const { data, isLoading } = useGetInsightsHeatmap({
    query: { queryKey: getGetInsightsHeatmapQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Hour labels */}
        <div
          className="grid gap-1 mb-1"
          style={{ gridTemplateColumns: `80px repeat(${data.hours.length}, 1fr)` }}
        >
          <div />
          {data.hours.map((h) => (
            <div key={h.hour} className="text-center text-[10px] text-muted-foreground font-medium">
              {h.label}
            </div>
          ))}
        </div>

        {/* Day rows */}
        {data.days.map((day) => (
          <div
            key={day.day}
            className="grid gap-1 mb-1"
            style={{ gridTemplateColumns: `80px repeat(${day.hours.length}, 1fr)` }}
          >
            <div className="flex items-center text-xs font-medium text-muted-foreground pr-2">
              {day.day.slice(0, 3)}
            </div>
            {day.hours.map((cell) => (
              <HeatmapCell key={cell.hour} value={cell.avgPerWeek} max={data.maxValue} />
            ))}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 justify-end">
          <span className="text-[10px] text-muted-foreground">Dead</span>
          {[0, 0.2, 0.5, 0.8, 1].map((r) => {
            let bg: string;
            if (r === 0) bg = "hsl(var(--muted)/0.2)";
            else if (r <= 0.2) bg = "hsl(160 60% 20% / 0.4)";
            else if (r <= 0.5) bg = "hsl(160 70% 28% / 0.6)";
            else if (r <= 0.8) bg = "hsl(160 78% 34% / 0.75)";
            else bg = "hsl(160 84% 39%)";
            return <div key={r} className="w-5 h-4 rounded-sm" style={{ backgroundColor: bg }} />;
          })}
          <span className="text-[10px] text-muted-foreground">Busy</span>
        </div>
      </div>
    </div>
  );
}

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    high: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return (
    <Badge variant="outline" className={`text-xs ${map[severity] ?? map.low}`}>
      {severity === "high" ? "High priority" : severity === "medium" ? "Medium" : "Low"}
    </Badge>
  );
}

// ─── Suggestions panel ────────────────────────────────────────────────────────

function SuggestionsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: suggestions, isLoading } = useGetInsightsSuggestions({
    query: { queryKey: getGetInsightsSuggestionsQueryKey() },
  });

  const flashMutation = useActivateFlashDeal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInsightsSuggestionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetInsightsOutcomesQueryKey() });
        toast({ title: "Blitzangebot aktiviert", description: "Ihr Rabatt ist jetzt im Marktplatz live." });
      },
      onError: () => toast({ title: "Blitzangebot konnte nicht aktiviert werden", variant: "destructive" }),
    },
  });

  const scheduledMutation = useCreateScheduledDeal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInsightsSuggestionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetInsightsOutcomesQueryKey() });
        toast({ title: "Geplanter Rabatt erstellt", description: "Ihr wiederkehrender Rabatt ist jetzt aktiv." });
      },
      onError: () => toast({ title: "Rabatt konnte nicht erstellt werden", variant: "destructive" }),
    },
  });

  function handleApply(sug: NonNullable<typeof suggestions>[number]) {
    if (sug.type === "flash") {
      flashMutation.mutate({ data: { label: sug.title, percentage: sug.suggestedPercentage } });
    } else {
      scheduledMutation.mutate({
        data: {
          label: sug.title,
          percentage: sug.suggestedPercentage,
          startTime: sug.startTime,
          endTime: sug.endTime,
          days: sug.days,
          notes: sug.reason,
        },
      });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <CheckCircle2 className="h-10 w-10 mb-3 text-emerald-500/50" />
        <p className="font-medium">Keine Leerstunden erkannt</p>
        <p className="text-sm mt-1">Ihr Buchungsplan sieht gut verteilt aus. Prüfen Sie nach weiteren Buchungen erneut.</p>
      </div>
    );
  }

  const isPending = flashMutation.isPending || scheduledMutation.isPending;

  return (
    <div className="space-y-3">
      {suggestions.map((sug, i) => (
        <motion.div
          key={sug.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <div className="border border-border rounded-lg p-4 bg-card hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-sm">{sug.title}</span>
                  <SeverityBadge severity={sug.severity} />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{sug.description}</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {sug.dayOfWeek}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {sug.startTime} – {sug.endTime}
                  </span>
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                    {sug.suggestedPercentage}% off
                  </Badge>
                </div>
              </div>
              <Button
                size="sm"
                className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                onClick={() => handleApply(sug)}
                disabled={isPending}
              >
                <Zap className="h-3.5 w-3.5" />
                Jetzt anwenden
              </Button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Outcome tracking ─────────────────────────────────────────────────────────

function OutcomesSection() {
  const { data: outcomes, isLoading } = useGetInsightsOutcomes({
    query: { queryKey: getGetInsightsOutcomesQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  if (!outcomes || outcomes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
        <Activity className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-sm">Noch keine Rabatte gestartet. Wenden Sie oben eine Empfehlung an.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {outcomes.map((o) => {
        const lift = o.liftPercent;
        const isPositive = lift != null && lift > 0;
        const isNeutral = lift == null || lift === 0;
        const isActive = o.status === "active";

        return (
          <div key={o.id} className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{o.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{o.periodLabel}</p>
              </div>
              <Badge
                variant="outline"
                className={
                  isActive
                    ? "text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "text-xs bg-muted/50 text-muted-foreground"
                }
              >
                {isActive ? "Aktiv" : o.status === "completed" ? "Abgeschlossen" : "Pausiert"}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Rabatt</p>
                <p className="font-bold text-primary">{o.percentage}% off</p>
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Buchungen</p>
                <p className="font-bold">
                  {o.bookingsDuringDiscount != null ? o.bookingsDuringDiscount : "—"}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Steigerung</p>
                {isNeutral ? (
                  <p className="font-bold text-muted-foreground flex items-center gap-1">
                    <Minus className="h-3 w-3" />
                    {isActive ? "Läuft" : "Keine Daten"}
                  </p>
                ) : isPositive ? (
                  <p className="font-bold text-emerald-500 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    +{lift}%
                  </p>
                ) : (
                  <p className="font-bold text-rose-500 flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" />
                    {lift}%
                  </p>
                )}
              </div>
            </div>

            {o.historicalBaseline != null && (
              <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border">
                Basis: Ø {o.historicalBaseline} Buchungen
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Daily insight banner ─────────────────────────────────────────────────────

function DailyInsightBanner() {
  const { data, isLoading } = useGetInsightsDailySummary({
    query: { queryKey: getGetInsightsDailySummaryQueryKey() },
  });
  const { toast } = useToast();
  const flashMutation = useActivateFlashDeal({
    mutation: {
      onSuccess: () => toast({ title: "Blitzangebot aktiviert", description: "Jetzt im Marktplatz live." }),
      onError: () => toast({ title: "Aktivierung fehlgeschlagen", variant: "destructive" }),
    },
  });

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!data) return null;

  const severityStyles: Record<string, string> = {
    high: "bg-rose-500/10 border-rose-500/30 text-rose-400",
    medium: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    low: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  };
  const icons: Record<string, React.ReactNode> = {
    high: <AlertTriangle className="h-5 w-5 shrink-0" />,
    medium: <Lightbulb className="h-5 w-5 shrink-0" />,
    low: <Lightbulb className="h-5 w-5 shrink-0" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-3 px-4 py-3.5 rounded-lg border ${severityStyles[data.severity] ?? severityStyles.low}`}
    >
      <span className={severityStyles[data.severity]}>{icons[data.severity]}</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{data.message}</p>
      </div>
      {data.actionType === "flash" && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 border-current gap-1.5 text-xs"
          onClick={() =>
            flashMutation.mutate({
              data: {
                label: `${data.todayDayName} Flash Deal`,
                percentage: data.suggestedPercentage,
              },
            })
          }
          disabled={flashMutation.isPending}
        >
          <Zap className="h-3 w-3" />
          Blitzangebot
        </Button>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Insights() {
  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Leerstunden-Killer</h2>
        <p className="text-muted-foreground mt-2">
          Regelbasierte Besucheranalyse, die Ihnen genau sagt, wann und wie Sie freie Tische füllen.
        </p>
      </div>

      <DailyInsightBanner />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Heatmap */}
        <motion.div
          className="lg:col-span-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5 text-primary" />
                Wöchentliche Aktivitäts-Heatmap
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Ø Buchungen pro Zeitfenster der letzten 90 Tage. Dunkler = mehr Betrieb, heller = Chance.
              </p>
            </CardHeader>
            <CardContent>
              <Heatmap />
            </CardContent>
          </Card>
        </motion.div>

        {/* Suggestions */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-5 w-5 text-amber-500" />
                Clevere Empfehlungen
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Ein Klick erstellt den Rabatt und macht ihn sofort im Marktplatz live.
              </p>
            </CardHeader>
            <CardContent>
              <SuggestionsPanel />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Outcome tracking */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpRight className="h-5 w-5 text-emerald-500" />
              Rabatt-Ergebnisse
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Buchungssteigerung und Leistung für Rabatte der letzten 30 Tage.
            </p>
          </CardHeader>
          <CardContent>
            <OutcomesSection />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
