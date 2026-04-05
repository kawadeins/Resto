/**
 * PromotionTools — admin panel for launching, pausing, and monitoring business boosts.
 * Premium-only component. Auto-discovers the owner's restaurant via /api/promotions/my.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Pause, Play, Square, TrendingUp, Eye, MousePointer, CalendarCheck, Flame, Wallet, Info, Activity, Clock, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BOOST_CONFIGS, type BoostConfig, isBoostCurrentlyActive } from "@/lib/monetization-engine";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface Promotion {
  id: number;
  restaurant_id: number;
  type: string;
  status: "active" | "paused" | "ended";
  started_at: string;
  ends_at: string | null;
  impressions: number;
  clicks: number;
  bookings_attributed: number;
  heat_exposure: number;
  group_exposure: number;
}

interface MyPromotionsData {
  restaurantId: number | null;
  restaurantName: string;
  businessType: string;
  promotions: Promotion[];
}

interface BudgetState {
  id: number;
  type: string;
  status: string;
  dailyBudget: number;
  spentToday: number;
  budgetRemaining: number | null;
  budgetExhausted: boolean;
}

function BoostStatusBadge({ status }: { status: string }) {
  if (status === "active")  return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[11px]">Aktiv</Badge>;
  if (status === "paused")  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[11px]">Pausiert</Badge>;
  return <Badge variant="secondary" className="text-[11px]">Beendet</Badge>;
}

function MiniStat({ icon: Icon, value, label, cls = "" }: {
  icon: React.ElementType; value: number; label: string; cls?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <Icon className={`w-4 h-4 ${cls || "text-muted-foreground"}`} />
      <span className="text-sm font-bold">{value.toLocaleString("de")}</span>
      <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
    </div>
  );
}

export function PromotionTools() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [launching, setLaunching] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState<number | null>(null);
  const [budgetInput, setBudgetInput] = useState<Record<number, string>>({});

  const { data, isLoading } = useQuery<MyPromotionsData>({
    queryKey: ["promotions-my"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/promotions/my`);
      if (!res.ok) return { restaurantId: null, restaurantName: "", businessType: "restaurant", promotions: [] };
      return res.json();
    },
    staleTime: 60000,
  });

  const restaurantId = data?.restaurantId ?? null;
  const localBizType = typeof window !== "undefined" ? localStorage.getItem("restosmart_owner_business_type") : null;
  const businessType = localBizType || data?.businessType || "restaurant";
  const promotions = data?.promotions ?? [];

  const { data: budgetData } = useQuery<{ restaurantId: number; budgets: BudgetState[] }>({
    queryKey: ["promotions-budget", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return { restaurantId: 0, budgets: [] };
      const res = await fetch(`${API_BASE}/api/promotions/budget?restaurantId=${restaurantId}`);
      if (!res.ok) return { restaurantId: restaurantId ?? 0, budgets: [] };
      return res.json();
    },
    enabled: !!restaurantId,
    staleTime: 30000,
  });
  const budgets = budgetData?.budgets ?? [];

  const budgetMutation = useMutation({
    mutationFn: async ({ promoId, dailyBudget }: { promoId: number; dailyBudget: number }) => {
      const res = await fetch(`${API_BASE}/api/promotions/${promoId}/budget`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyBudget }),
      });
      if (!res.ok) throw new Error("Fehler");
      return res.json();
    },
    onSuccess: (_, { dailyBudget }) => {
      const label = dailyBudget === 0 ? "unbegrenzt" : `€${dailyBudget}/Tag`;
      toast({ title: `Tagesbudget gesetzt: ${label}` });
      setEditingBudget(null);
      queryClient.invalidateQueries({ queryKey: ["promotions-budget"] });
    },
    onError: () => toast({ title: "Budget konnte nicht gespeichert werden", variant: "destructive" }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["promotions-my"] });

  const launchMutation = useMutation({
    mutationFn: async (type: string) => {
      if (!restaurantId) throw new Error("Kein Restaurant");
      const res = await fetch(`${API_BASE}/api/promotions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, type }),
      });
      if (!res.ok) throw new Error("Fehler");
      return res.json();
    },
    onSuccess: (_, type) => {
      const cfg = BOOST_CONFIGS.find(b => b.type === type);
      toast({ title: `${cfg?.emoji ?? "🚀"} ${cfg?.label ?? type} gestartet!`, description: "Ihre Sichtbarkeit steigt ab sofort." });
      setLaunching(null);
      invalidate();
    },
    onError: () => { toast({ title: "Boost konnte nicht gestartet werden", variant: "destructive" }); setLaunching(null); },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/api/promotions/${id}/pause`, { method: "PUT" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Boost pausiert" }); invalidate(); },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/api/promotions/${id}/resume`, { method: "PUT" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Boost fortgesetzt" }); invalidate(); },
  });

  const stopMutation = useMutation({
    mutationFn: (id: number) => fetch(`${API_BASE}/api/promotions/${id}/stop`, { method: "PUT" }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Boost beendet" }); invalidate(); },
  });

  const relevantBoosts = BOOST_CONFIGS.filter(b => b.bizTypes.includes(businessType));
  const getActivePromo = (type: string) =>
    promotions.find(p => p.type === type && (p.status === "active" || p.status === "paused"));
  const activeCount = promotions.filter(p => p.status === "active").length;

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" />Promotion Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-44 rounded-xl bg-muted animate-pulse" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="w-5 h-5 text-amber-500" />
              Promotion Tools
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Erhöhen Sie Ihre Sichtbarkeit zu bestimmten Zeiten — präzise und messbar.
            </p>
          </div>
          {activeCount > 0 && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0">
              {activeCount} Aktiv
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {relevantBoosts.map((cfg) => {
            const promo = getActivePromo(cfg.type);
            const isLive    = promo?.status === "active";
            const isPaused  = promo?.status === "paused";
            const nowActive = isBoostCurrentlyActive(cfg.type);

            return (
              <motion.div
                key={cfg.type}
                layout
                className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${
                  isLive   ? "border-emerald-200 bg-emerald-50/50 shadow-sm shadow-emerald-100"
                  : isPaused ? "border-amber-200 bg-amber-50/50"
                  : "border-border bg-card hover:border-primary/30"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cfg.emoji}</span>
                    <div>
                      <div className="font-semibold text-sm leading-tight">{cfg.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {cfg.hours[0]}–{cfg.hours[1] < cfg.hours[0] ? `0${cfg.hours[1]}` : cfg.hours[1]} Uhr
                      </div>
                    </div>
                  </div>
                  {promo && <BoostStatusBadge status={promo.status} />}
                </div>

                {/* Value prop */}
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                  {cfg.businessCopy[businessType] ?? cfg.description}
                </p>

                {/* "Active time" indicator */}
                {nowActive && !isLive && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Jetzt aktive Zeit
                  </div>
                )}
                {nowActive && isLive && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live & aktiv
                  </div>
                )}

                {/* Stats */}
                {promo && (
                  <div className="grid grid-cols-4 gap-1 py-2 border-t border-border/50">
                    <MiniStat icon={Eye}          value={promo.impressions}           label="Einbl."  cls="text-violet-500" />
                    <MiniStat icon={MousePointer} value={promo.clicks}                label="Klicks"  cls="text-blue-500" />
                    <MiniStat icon={CalendarCheck} value={promo.bookings_attributed}  label="Buch."   cls="text-emerald-500" />
                    <MiniStat icon={Flame}         value={promo.heat_exposure}         label="Heat"    cls="text-orange-500" />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {!promo && (
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-primary to-accent text-white border-0 hover:opacity-90 font-semibold"
                      disabled={launching === cfg.type || !restaurantId}
                      onClick={() => { setLaunching(cfg.type); launchMutation.mutate(cfg.type); }}
                    >
                      <Zap className="w-3.5 h-3.5 mr-1.5" />
                      {launching === cfg.type ? "Startet…" : "Aktivieren"}
                    </Button>
                  )}
                  {isLive && (
                    <>
                      <Button size="sm" variant="outline" className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => pauseMutation.mutate(promo!.id)}>
                        <Pause className="w-3 h-3 mr-1" /> Pause
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50" onClick={() => stopMutation.mutate(promo!.id)}>
                        <Square className="w-3 h-3 mr-1" /> Stopp
                      </Button>
                    </>
                  )}
                  {isPaused && (
                    <>
                      <Button size="sm" className="flex-1 bg-gradient-to-r from-primary to-accent text-white border-0 hover:opacity-90" onClick={() => resumeMutation.mutate(promo!.id)}>
                        <Play className="w-3.5 h-3.5 mr-1" /> Fortsetzen
                      </Button>
                      <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => stopMutation.mutate(promo!.id)}>
                        <Square className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Dynamic Pricing Panel ─────────────────────────────────────────── */}
        <DynamicPricingPanel businessType={businessType} />

        {/* ── Budget Management ─────────────────────────────────────────────── */}
        {budgets.length > 0 && (
          <div className="border border-border/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Tagesbudget</span>
              <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                <Info className="w-3 h-3" />
                Boost stoppt automatisch wenn Budget erreicht
              </span>
            </div>

            <div className="space-y-2">
              {budgets.map((b) => {
                const cfg = BOOST_CONFIGS.find(c => c.type === b.type);
                const spentPct = b.dailyBudget > 0 ? Math.min(100, (b.spentToday / b.dailyBudget) * 100) : 0;
                const isEditing = editingBudget === b.id;

                return (
                  <div key={b.id} className="rounded-lg border border-border/40 bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium flex items-center gap-1.5">
                        <span>{cfg?.emoji}</span> {cfg?.label ?? b.type}
                        {b.budgetExhausted && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
                            Budget aufgebraucht
                          </span>
                        )}
                      </span>
                      <button
                        className="text-[11px] text-primary font-semibold hover:underline"
                        onClick={() => {
                          setEditingBudget(isEditing ? null : b.id);
                          setBudgetInput(prev => ({ ...prev, [b.id]: String(b.dailyBudget) }));
                        }}
                      >
                        {isEditing ? "Abbrechen" : "Bearbeiten"}
                      </button>
                    </div>

                    {/* Budget bar */}
                    {b.dailyBudget > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>Heute: €{b.spentToday.toFixed(2)} ausgegeben</span>
                          <span>Budget: €{b.dailyBudget.toFixed(2)}/Tag</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              spentPct >= 100 ? "bg-red-500" : spentPct > 70 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${spentPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {b.dailyBudget === 0 && (
                      <p className="text-[11px] text-muted-foreground">Kein Tagesbudget — Boost läuft unbegrenzt</p>
                    )}

                    {/* Budget editor */}
                    {isEditing && (
                      <div className="pt-2 border-t border-border/40 space-y-2">
                        <p className="text-[11px] text-muted-foreground">Tagesbudget festlegen (0 = unbegrenzt)</p>
                        <div className="flex gap-2 flex-wrap">
                          {[0, 5, 10, 20, 50].map(amount => (
                            <button
                              key={amount}
                              onClick={() => setBudgetInput(prev => ({ ...prev, [b.id]: String(amount) }))}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                                budgetInput[b.id] === String(amount)
                                  ? "bg-primary text-white border-primary"
                                  : "border-border bg-card hover:border-primary/40"
                              }`}
                            >
                              {amount === 0 ? "Unbegrenzt" : `€${amount}/Tag`}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={0}
                            max={500}
                            value={budgetInput[b.id] ?? ""}
                            onChange={e => setBudgetInput(prev => ({ ...prev, [b.id]: e.target.value }))}
                            className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                            placeholder="Eigener Betrag"
                          />
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-primary to-accent text-white border-0 hover:opacity-90"
                            onClick={() => {
                              const val = parseFloat(budgetInput[b.id] ?? "0") || 0;
                              budgetMutation.mutate({ promoId: b.id, dailyBudget: val });
                            }}
                            disabled={budgetMutation.isPending}
                          >
                            Speichern
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              <span className="text-base">ℹ️</span>
              <span>
                Boosted Lokale erhalten das Label <strong className="text-foreground">„Gesponsert"</strong> in der Kunden-App — transparent und vertrauenswürdig.
              </span>
            </div>
          </div>
        )}

        {/* ── Performance Total ──────────────────────────────────────────────── */}
        {promotions.length > 0 && (
          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-primary" /> Gesamtperformance
              </span>
              <span className="text-xs text-muted-foreground">Alle Boosts kombiniert</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[
                { icon: Eye,          label: "Einblendungen", val: promotions.reduce((s, p) => s + (p.impressions || 0), 0),          cls: "text-violet-500" },
                { icon: MousePointer, label: "Klicks",        val: promotions.reduce((s, p) => s + (p.clicks || 0), 0),               cls: "text-blue-500" },
                { icon: CalendarCheck,label: "Buchungen",     val: promotions.reduce((s, p) => s + (p.bookings_attributed || 0), 0),   cls: "text-emerald-500" },
                { icon: Flame,         label: "Heat-Expo.",   val: promotions.reduce((s, p) => s + (p.heat_exposure || 0), 0),         cls: "text-orange-500" },
              ].map(({ icon: Ic, label, val, cls }) => (
                <div key={label} className="text-center space-y-1">
                  <Ic className={`w-5 h-5 mx-auto ${cls}`} />
                  <div className="text-xl font-bold">{val.toLocaleString("de")}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Dynamic Pricing Panel ────────────────────────────────────────────────────

interface PricingData {
  pricePerImpression: number;
  pricePer1000: number;
  demandLevel: "low" | "normal" | "high" | "very_high";
  totalActivePlatformBoosts: number;
  competingBoosts: number;
  slotPosition: number;
  demandSignal: string;
  timeSignal: string;
  competitionSignal: string;
  pricingContext: string;
  suggestion: string;
  bestBoostWindow: string;
  breakdown: {
    basePrice: number;
    demandMultiplier: number;
    timeMultiplier: number;
    slotMultiplier: number;
    weekendBonus: number;
    finalPrice: number;
    totalMultiplier: number;
  };
}

function DemandChip({ level }: { level: PricingData["demandLevel"] }) {
  const map: Record<PricingData["demandLevel"], { label: string; cls: string }> = {
    low:       { label: "Niedrige Nachfrage",      cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    normal:    { label: "Normale Nachfrage",        cls: "bg-blue-100 text-blue-700 border-blue-200" },
    high:      { label: "Hohe Nachfrage",           cls: "bg-amber-100 text-amber-700 border-amber-200" },
    very_high: { label: "Sehr hohe Nachfrage",      cls: "bg-red-100 text-red-700 border-red-200" },
  };
  const { label, cls } = map[level] ?? map.normal;
  return <Badge className={`text-[10px] font-semibold ${cls}`}>{label}</Badge>;
}

function DynamicPricingPanel({ businessType }: { businessType: string }) {
  const { data, isLoading } = useQuery<PricingData>({
    queryKey: ["pricing-current", businessType],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/pricing/current`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="border border-border/50 rounded-xl p-4 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-3" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-16 bg-muted rounded-lg" />
          <div className="h-16 bg-muted rounded-lg" />
          <div className="h-16 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const bd = data.breakdown;

  return (
    <div className="border border-border/50 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-violet-500" />
          <span className="font-semibold text-sm">Preise & Nachfrage</span>
          <DemandChip level={data.demandLevel} />
        </div>
        <span className="text-xs text-muted-foreground">Echtzeit · aktualisiert alle 2 Min.</span>
      </div>

      {/* Price + signals row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-muted/30 border border-border/40 p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">Preis / 1.000 Einbl.</p>
          <p className="text-lg font-bold text-foreground">€{data.pricePer1000.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">({bd.totalMultiplier.toFixed(2)}× Basis)</p>
        </div>
        <div className="rounded-lg bg-muted/30 border border-border/40 p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1 flex items-center justify-center gap-0.5">
            <Users className="w-2.5 h-2.5" /> Wettbewerb
          </p>
          <p className="text-base font-bold text-foreground">{data.competingBoosts}</p>
          <p className="text-[10px] text-muted-foreground">Konkurrenten aktiv</p>
        </div>
        <div className="rounded-lg bg-muted/30 border border-border/40 p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1 flex items-center justify-center gap-0.5">
            <Clock className="w-2.5 h-2.5" /> Günstigste Zeit
          </p>
          <p className="text-sm font-bold text-foreground leading-tight">{data.bestBoostWindow}</p>
        </div>
      </div>

      {/* Pricing context */}
      <div className="rounded-lg bg-muted/20 border border-border/30 px-3 py-2 space-y-1.5">
        <p className="text-xs text-foreground font-medium">{data.pricingContext}</p>
        <p className="text-[11px] text-muted-foreground">{data.timeSignal}</p>
      </div>

      {/* Suggestion */}
      <div className="flex items-start gap-2 rounded-lg bg-violet-500/8 border border-violet-500/20 px-3 py-2">
        <Zap className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
        <p className="text-xs text-violet-300">{data.suggestion}</p>
      </div>

      {/* Multiplier breakdown */}
      <details className="group">
        <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
          Preisberechnung anzeigen ▸
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          {[
            { label: "Basispreis",       value: `€${bd.basePrice.toFixed(3)}` },
            { label: "Nachfrage ×",      value: `${bd.demandMultiplier.toFixed(2)}×` },
            { label: "Tageszeit ×",      value: `${bd.timeMultiplier.toFixed(2)}×` },
            { label: "Wettbewerb ×",     value: `${bd.slotMultiplier.toFixed(2)}×` },
            { label: "Wochenend-Bonus",  value: `${bd.weekendBonus.toFixed(2)}×` },
            { label: "Gesamtfaktor",     value: `${bd.totalMultiplier.toFixed(2)}×` },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between rounded bg-muted/30 px-2 py-1">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono font-semibold text-foreground">{value}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Maximaler Faktor: {data.breakdown ? `${(data as any).config?.maxMultiplier ?? 2.5}×` : "2.50×"} — Preis wird nie darüber steigen.
        </p>
      </details>
    </div>
  );
}
