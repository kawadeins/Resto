/**
 * Revenue Optimizer — Auto Revenue Optimization Engine
 * Analyzes real promotion data and generates actionable recommendations
 * to help businesses spend smarter and earn more.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, TrendingUp, Eye, MousePointer, CalendarCheck,
  ArrowUpRight, AlertTriangle, CheckCircle2, Clock,
  Lightbulb, Flame, Target, BarChart3, Wallet,
  ChevronRight, Activity, Radio,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AnalysisData {
  restaurantId: number;
  restaurantName: string;
  businessType: string;
  metrics: {
    totalImpressions: number;
    totalClicks: number;
    totalBookings: number;
    avgCTR: number;
    avgBookingRate: number;
    activeBoostCount: number;
    budgetUtilization: number;
  };
  peakHours: { hour: number; count: number }[];
  recommendations: Recommendation[];
  platformDemand: {
    level: "low" | "medium" | "high";
    activePlatformBoosts: number;
    signal: string;
  };
  roiFeedback: {
    bestBoostType: string | null;
    bestBoostLabel: string | null;
    bestImpressions: number;
    bestCTR: number;
    insight: string;
  };
}

interface Recommendation {
  type: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action: string | null;
  actionValue?: string;
  metric: string | null;
}

interface MyPromosData {
  restaurantId: number | null;
  businessType: string;
  promotions: any[];
}

// ─── Priority helpers ────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  if (priority === "high")
    return <Badge className="bg-red-500/15 text-red-400 border-red-500/25 text-[10px] font-semibold">Dringend</Badge>;
  if (priority === "medium")
    return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-[10px] font-semibold">Empfohlen</Badge>;
  return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px] font-semibold">Info</Badge>;
}

function RecoIcon({ type }: { type: string }) {
  const cls = "w-5 h-5 shrink-0";
  if (type === "missing_boost" || type === "boost_time_window") return <Zap className={`${cls} text-violet-400`} />;
  if (type === "low_ctr") return <MousePointer className={`${cls} text-amber-400`} />;
  if (type === "low_conversion") return <Target className={`${cls} text-amber-400`} />;
  if (type === "budget_exhausted") return <Wallet className={`${cls} text-red-400`} />;
  if (type === "budget_shift") return <BarChart3 className={`${cls} text-blue-400`} />;
  if (type === "demand_spike") return <Flame className={`${cls} text-orange-400`} />;
  if (type === "winner_confirmation") return <CheckCircle2 className={`${cls} text-emerald-400`} />;
  return <Lightbulb className={`${cls} text-violet-400`} />;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, iconCls = "text-muted-foreground",
}: { icon: React.ElementType; label: string; value: string; sub?: string; iconCls?: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon className={`w-4 h-4 ${iconCls}`} />
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Recommendation Card ─────────────────────────────────────────────────────

function RecommendationCard({
  rec, restaurantId, autoMode, onActivated,
}: {
  rec: Recommendation;
  restaurantId: number | null;
  autoMode: boolean;
  onActivated: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const activateMutation = useMutation({
    mutationFn: async (boostType: string) => {
      if (!restaurantId) throw new Error("No restaurant");
      const res = await fetch(`${API_BASE}/api/promotions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, type: boostType }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (_, boostType) => {
      toast({ title: "Boost aktiviert", description: `${boostType.replace(/_/g, " ")} ist jetzt aktiv.` });
      queryClient.invalidateQueries({ queryKey: ["optimizer-analysis"] });
      queryClient.invalidateQueries({ queryKey: ["my-promos"] });
      onActivated();
    },
    onError: () => toast({ title: "Fehler", description: "Boost konnte nicht aktiviert werden.", variant: "destructive" }),
  });

  const isAutoHighlight = autoMode && rec.priority === "high" && rec.action === "boost_activate";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 flex gap-4 items-start transition-colors ${
        isAutoHighlight
          ? "border-violet-500/40 bg-violet-500/5 shadow-sm shadow-violet-500/10"
          : "border-border bg-card/60"
      }`}
    >
      <div className="mt-0.5">
        <RecoIcon type={rec.type} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <PriorityBadge priority={rec.priority} />
          {isAutoHighlight && (
            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[10px]">
              Auto-Optimierung
            </Badge>
          )}
          {rec.metric && (
            <span className="text-[10px] font-mono text-muted-foreground border border-border/60 rounded px-1.5 py-0.5">
              {rec.metric}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-foreground mb-1">{rec.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
        {rec.action && (
          <div className="mt-3">
            {rec.action === "boost_activate" && rec.actionValue ? (
              <Button
                size="sm"
                className="h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                onClick={() => activateMutation.mutate(rec.actionValue!)}
                disabled={activateMutation.isPending}
              >
                <Zap className="w-3 h-3 mr-1.5" />
                {activateMutation.isPending ? "Aktiviere…" : isAutoHighlight ? "Auto-Aktivieren" : "Jetzt aktivieren"}
              </Button>
            ) : rec.action === "go_to_marketing" ? (
              <Link href="/marketing">
                <Button size="sm" variant="outline" className="h-8 text-xs">
                  Marketing öffnen <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            ) : rec.action === "go_to_insights" ? (
              <Link href="/insights">
                <Button size="sm" variant="outline" className="h-8 text-xs">
                  Tote Stunden öffnen <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Peak Hours bar ─────────────────────────────────────────────────────────

function PeakHoursBar({ peakHours }: { peakHours: { hour: number; count: number }[] }) {
  if (peakHours.length === 0) return null;
  const max = Math.max(...peakHours.map(h => h.count), 1);
  return (
    <div className="flex items-end gap-3 mt-2">
      {peakHours.map((h, i) => (
        <div key={h.hour} className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{h.count}</span>
          <div
            className="w-8 rounded-sm"
            style={{
              height: `${Math.max(8, (h.count / max) * 48)}px`,
              background: i === 0
                ? "hsl(var(--primary))"
                : "hsl(var(--primary)/0.5)",
            }}
          />
          <span className="text-[10px] text-muted-foreground">{h.hour}:00</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Optimizer() {
  const [autoMode, setAutoMode] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setAutoMode(localStorage.getItem("restosmart_auto_optimize") === "true");
  }, []);

  const toggleAutoMode = (val: boolean) => {
    setAutoMode(val);
    localStorage.setItem("restosmart_auto_optimize", String(val));
    toast({
      title: val ? "Auto-Optimierung aktiviert" : "Auto-Optimierung deaktiviert",
      description: val
        ? "Hochpriorisierte Empfehlungen werden hervorgehoben. Ein Klick genügt zur Aktivierung."
        : "Auto-Optimierung wurde deaktiviert.",
    });
  };

  const { data: analysis, isLoading: loadingAnalysis, refetch } = useQuery<AnalysisData>({
    queryKey: ["optimizer-analysis"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/promotions/analysis`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const { data: myPromos } = useQuery<MyPromosData>({
    queryKey: ["my-promos"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/promotions/my`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const restaurantId = myPromos?.restaurantId ?? null;
  const demand = analysis?.platformDemand;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Revenue Optimizer</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Echtzeit-Analyse Ihrer Boost-Performance mit smarten Empfehlungen zum Wachstum.
          </p>
        </div>

        {/* Auto-Optimize toggle */}
        <Card className="border-border bg-card/80 shrink-0">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Auto-Optimierung</span>
              <span className="text-[11px] text-muted-foreground">
                {autoMode ? "Aktiv — hebt beste Aktion hervor" : "Inaktiv"}
              </span>
            </div>
            <Switch checked={autoMode} onCheckedChange={toggleAutoMode} />
          </CardContent>
        </Card>
      </div>

      {/* Platform demand banner */}
      {demand && demand.level !== "low" && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
            demand.level === "high"
              ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/8 text-amber-300"
          }`}
        >
          <Radio className="w-4 h-4 shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{demand.signal}</span>
            <span className="text-[11px] opacity-70 ml-2">
              {demand.activePlatformBoosts} aktive Boosts auf der Plattform
            </span>
          </div>
          <Badge className={demand.level === "high"
            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
            : "bg-amber-500/20 text-amber-300 border-amber-500/30"
          }>
            {demand.level === "high" ? "Hohe Nachfrage" : "Mittlere Nachfrage"}
          </Badge>
        </motion.div>
      )}

      {/* KPI row */}
      {loadingAnalysis ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : analysis ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={Eye} label="Gesamt-Impressionen" iconCls="text-blue-400"
            value={analysis.metrics.totalImpressions.toLocaleString("de-AT")}
            sub="Alle Boosts gesamt"
          />
          <KpiCard
            icon={MousePointer} label="Ø Klickrate (CTR)" iconCls="text-violet-400"
            value={`${(analysis.metrics.avgCTR * 100).toFixed(1)}%`}
            sub={analysis.metrics.avgCTR >= 0.03 ? "Über Durchschnitt" : "Unter Durchschnitt (3%)"}
          />
          <KpiCard
            icon={CalendarCheck} label="Buchungsrate" iconCls="text-emerald-400"
            value={`${(analysis.metrics.avgBookingRate * 100).toFixed(1)}%`}
            sub="Klicks → Buchungen"
          />
          <KpiCard
            icon={Activity} label="Aktive Boosts" iconCls="text-orange-400"
            value={String(analysis.metrics.activeBoostCount)}
            sub={analysis.metrics.activeBoostCount === 0 ? "Kein Boost aktiv" : "Laufen gerade"}
          />
        </div>
      ) : null}

      {/* Smart Recommendations */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-violet-400" />
            <h2 className="text-base font-semibold">Smart Empfehlungen</h2>
            {analysis?.recommendations.length ? (
              <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/25 text-[10px]">
                {analysis.recommendations.length}
              </Badge>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={() => refetch()}>
            Aktualisieren
          </Button>
        </div>

        {loadingAnalysis ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : !analysis?.recommendations.length ? (
          <div className="rounded-xl border border-border bg-card/40 px-6 py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Alles optimal eingestellt</p>
            <p className="text-xs text-muted-foreground mt-1">
              Derzeit keine Empfehlungen — weiter so!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {analysis.recommendations.map((rec, i) => (
              <RecommendationCard
                key={i} rec={rec} restaurantId={restaurantId}
                autoMode={autoMode} onActivated={() => refetch()}
              />
            ))}
          </div>
        )}
      </section>

      {/* Two-column: ROI Feedback + Peak Hours */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* ROI Feedback */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              ROI Feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingAnalysis ? (
              <Skeleton className="h-20" />
            ) : analysis?.roiFeedback ? (
              <>
                {analysis.roiFeedback.bestBoostLabel && (
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-foreground">Bester Boost</span>
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px]">
                        {analysis.roiFeedback.bestBoostLabel}
                      </Badge>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {analysis.roiFeedback.bestImpressions} Impressionen
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointer className="w-3 h-3" />
                        {(analysis.roiFeedback.bestCTR * 100).toFixed(1)}% CTR
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {analysis.roiFeedback.insight}
                </p>
                {analysis.roiFeedback.bestCTR > 0.04 && (
                  <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/20 px-3 py-2">
                    <p className="text-xs text-emerald-400 font-medium">
                      +{((analysis.roiFeedback.bestCTR - 0.03) * 100).toFixed(1)}% über Plattform-Durchschnitt
                    </p>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Peak Hours */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Peak-Stunden (letzte 7 Tage)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAnalysis ? (
              <Skeleton className="h-20" />
            ) : !analysis?.peakHours.length ? (
              <p className="text-xs text-muted-foreground">
                Noch keine Stundenanalyse verfügbar — mehr Boost-Aktivität sammelt Daten.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  Stunden mit den meisten Impressionen — ideal für Budget-Planung.
                </p>
                <PeakHoursBar peakHours={analysis.peakHours} />
                <p className="text-[11px] text-muted-foreground mt-3">
                  Beste Stunde: <span className="text-foreground font-medium">{analysis.peakHours[0]?.hour}:00 Uhr</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Business Type Intelligence */}
      {analysis && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-violet-400" />
              Betriebstyp-Strategie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BizTypeStrategy bizType={analysis.businessType} metrics={analysis.metrics} />
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      <div className="grid sm:grid-cols-3 gap-3">
        <Link href="/marketing">
          <div className="rounded-xl border border-border bg-card/60 hover:bg-card/90 transition-colors p-4 flex items-center gap-3 cursor-pointer group">
            <Zap className="w-4 h-4 text-violet-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Promotion Tools</p>
              <p className="text-[11px] text-muted-foreground">Boosts verwalten</p>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </Link>
        <Link href="/insights">
          <div className="rounded-xl border border-border bg-card/60 hover:bg-card/90 transition-colors p-4 flex items-center gap-3 cursor-pointer group">
            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Tote Stunden</p>
              <p className="text-[11px] text-muted-foreground">Flash Deals erstellen</p>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </Link>
        <Link href="/analytics">
          <div className="rounded-xl border border-border bg-card/60 hover:bg-card/90 transition-colors p-4 flex items-center gap-3 cursor-pointer group">
            <BarChart3 className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Analyse</p>
              <p className="text-[11px] text-muted-foreground">Umsatz & Buchungen</p>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}

// ─── Business Type Strategy panel ────────────────────────────────────────────

function BizTypeStrategy({ bizType, metrics }: { bizType: string; metrics: AnalysisData["metrics"] }) {
  const strategies: Record<string, { title: string; tips: { icon: string; text: string }[]; focus: string }> = {
    restaurant: {
      title: "Restaurant-Strategie",
      focus: "Mittag + Abend | Buchungskonversion",
      tips: [
        { icon: "🍽️", text: "Mittags-Boost 11–14 Uhr für mehr Mittagsgäste" },
        { icon: "🌇", text: "Happy Hour Boost 15–19 Uhr für frühe Abendgäste" },
        { icon: "📊", text: "Buchungsrate unter 5%? Flash Deal erstellen" },
        { icon: "⭐", text: "Local Spotlight für ganzwöchige Sichtbarkeit" },
      ],
    },
    cafe: {
      title: "Café-Strategie",
      focus: "Morgen + Mittag | Laufkundschaft",
      tips: [
        { icon: "☕", text: "Frühstücks-Boost 6–10 Uhr für Morgengäste" },
        { icon: "💼", text: "Mittags-Boost für Homeoffice-Gäste 11–14 Uhr" },
        { icon: "🗺️", text: "Heat-Map Boost für Laufkundschaft auf der Karte" },
        { icon: "📸", text: "Hohe CTR durch starke Bilder in Ihrem Profil" },
      ],
    },
    bar: {
      title: "Bar-Strategie",
      focus: "Abend + Wochenende | Gruppen",
      tips: [
        { icon: "🌙", text: "Nachtleben-Boost ab 19 Uhr für Abendgäste" },
        { icon: "🍹", text: "Happy Hour Boost 15–19 Uhr für frühe Gäste" },
        { icon: "👥", text: "Gruppen-Vorschlag Priorität an Wochenenden" },
        { icon: "🔥", text: "Heat-Map Boost — sichtbar wenn Gäste suchen" },
      ],
    },
  };

  const strategy = strategies[bizType] ?? strategies.restaurant;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-foreground">{strategy.title}</span>
        <Badge variant="secondary" className="text-[11px]">{strategy.focus}</Badge>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {strategy.tips.map((tip, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            <span className="text-sm shrink-0 mt-0.5">{tip.icon}</span>
            <p className="text-xs text-muted-foreground leading-relaxed">{tip.text}</p>
          </div>
        ))}
      </div>
      {metrics.activeBoostCount === 0 && (
        <div className="rounded-lg bg-violet-500/8 border border-violet-500/20 px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <p className="text-xs text-violet-300">
            Kein Boost aktiv — starten Sie mit dem empfohlenen Boost oben.
          </p>
        </div>
      )}
    </div>
  );
}
