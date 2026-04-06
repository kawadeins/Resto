/**
 * PromotionTools — admin panel for launching, pausing, and monitoring business boosts.
 * Premium-only component. Auto-discovers the owner's restaurant via /api/promotions/my.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Zap, Pause, Play, Square, TrendingUp, Eye, MousePointer, CalendarCheck,
  Flame, Wallet, Info, Activity, Clock, Users, Sparkles, Shield, BarChart3,
  MapPin, Lightbulb, ToggleLeft, ToggleRight, ArrowUpRight,
} from "lucide-react";
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

// ── Premium Status Badge ────────────────────────────────────────────────────────

function BoostStatusBadge({ status }: { status: string }) {
  if (status === "active") return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/25">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      Aktiv
    </span>
  );
  if (status === "paused") return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/25">
      Pausiert
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
      Beendet
    </span>
  );
}

// ── Clean Metric Tile ──────────────────────────────────────────────────────────

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-base font-bold tabular-nums leading-none">{value.toLocaleString("de")}</div>
      <div className="text-[10px] text-muted-foreground mt-1 leading-none">{label}</div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

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
      const label = dailyBudget === 0 ? "unbegrenzt" : `\u20AC${dailyBudget}/Tag`;
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
      toast({ title: `${cfg?.emoji ?? "\uD83D\uDE80"} ${cfg?.label ?? type} gestartet!`, description: "Ihre Sichtbarkeit steigt ab sofort." });
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

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card className="border-white/8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            Promotion Tools
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-52 rounded-2xl bg-muted/40 animate-pulse" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/8 shadow-sm">
      {/* ── Header ── */}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Zap className="w-4 h-4 text-white" />
              </div>
              Promotion Tools
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {"Erh\u00F6hen Sie Ihre Sichtbarkeit zu bestimmten Zeiten \u2014 pr\u00E4zise und messbar."}
            </p>
          </div>
          {activeCount > 0 && (
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/25 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {activeCount} {activeCount === 1 ? "Boost" : "Boosts"} aktiv
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-4">

        {/* ── Boost Cards Grid ── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {relevantBoosts.map((cfg) => {
            const promo = getActivePromo(cfg.type);
            const isLive   = promo?.status === "active";
            const isPaused = promo?.status === "paused";
            const nowActive = isBoostCurrentlyActive(cfg.type);

            return (
              <motion.div
                key={cfg.type}
                layout
                className={`rounded-2xl border flex flex-col gap-4 p-5 transition-all duration-200 ${
                  isLive
                    ? "border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.06] to-transparent shadow-[0_0_32px_rgba(16,185,129,0.07)]"
                    : isPaused
                    ? "border-amber-500/20 bg-amber-500/[0.04]"
                    : "border-white/8 bg-card hover:border-white/15 hover:shadow-md"
                }`}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none mt-0.5 select-none">{cfg.emoji}</span>
                    <div>
                      <div className="font-semibold text-sm leading-snug">{cfg.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {cfg.hours[0]}:00 – {cfg.hours[1] < cfg.hours[0] ? "0" : ""}{cfg.hours[1]}:00 Uhr
                      </div>
                    </div>
                  </div>
                  {promo && <BoostStatusBadge status={promo.status} />}
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                  {cfg.businessCopy[businessType] ?? cfg.description}
                </p>

                {/* Live pulse indicators */}
                {nowActive && !isLive && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-3 py-1.5 w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Jetzt aktive Zeit
                  </div>
                )}
                {nowActive && isLive && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-3 py-1.5 w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {"Live \u0026 aktiv"}
                  </div>
                )}

                {/* Metrics row */}
                {promo && (
                  <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/8">
                    <MiniStat value={promo.impressions}          label="Einbl." />
                    <MiniStat value={promo.clicks}               label="Klicks" />
                    <MiniStat value={promo.bookings_attributed}  label="Buch." />
                    <MiniStat value={promo.heat_exposure}        label="Heat" />
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 mt-auto">
                  {!promo && (
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0 font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
                      disabled={launching === cfg.type || !restaurantId}
                      onClick={() => { setLaunching(cfg.type); launchMutation.mutate(cfg.type); }}
                    >
                      <Zap className="w-3.5 h-3.5 mr-1.5" />
                      {launching === cfg.type ? "Startet\u2026" : "Jetzt aktivieren"}
                    </Button>
                  )}
                  {isLive && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-white/10 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        onClick={() => pauseMutation.mutate(promo!.id)}
                      >
                        <Pause className="w-3 h-3 mr-1.5" /> Pause
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="px-3 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40"
                        onClick={() => stopMutation.mutate(promo!.id)}
                      >
                        <Square className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                  {isPaused && (
                    <>
                      <Button
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0 font-semibold"
                        onClick={() => resumeMutation.mutate(promo!.id)}
                      >
                        <Play className="w-3.5 h-3.5 mr-1.5" /> Fortsetzen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="px-3 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40"
                        onClick={() => stopMutation.mutate(promo!.id)}
                      >
                        <Square className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Smart Pricing ── */}
        <SmartPricingDashboard businessType={businessType} restaurantId={restaurantId} />

        {/* ── Daily Budget ── */}
        {budgets.length > 0 && (
          <div className="rounded-2xl border border-white/8 bg-muted/20 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <Wallet className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-sm">Tagesbudget</span>
              <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                <Info className="w-3 h-3" />
                Boost stoppt automatisch bei Budgetlimit
              </span>
            </div>

            <div className="space-y-3">
              {budgets.map((b) => {
                const cfg = BOOST_CONFIGS.find(c => c.type === b.type);
                const spentPct = b.dailyBudget > 0 ? Math.min(100, (b.spentToday / b.dailyBudget) * 100) : 0;
                const isEditing = editingBudget === b.id;

                return (
                  <div key={b.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <span>{cfg?.emoji}</span>
                        {cfg?.label ?? b.type}
                        {b.budgetExhausted && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                            Budget aufgebraucht
                          </span>
                        )}
                      </span>
                      <button
                        className="text-[11px] text-indigo-400 font-semibold hover:text-indigo-300 transition-colors"
                        onClick={() => {
                          setEditingBudget(isEditing ? null : b.id);
                          setBudgetInput(prev => ({ ...prev, [b.id]: String(b.dailyBudget) }));
                        }}
                      >
                        {isEditing ? "Abbrechen" : "Bearbeiten"}
                      </button>
                    </div>

                    {b.dailyBudget > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>{"\u20AC"}{b.spentToday.toFixed(2)} ausgegeben</span>
                          <span>{"\u20AC"}{b.dailyBudget.toFixed(2)}/Tag</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
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
                      <p className="text-[11px] text-muted-foreground">{"Kein Tagesbudget \u2014 Boost l\u00E4uft unbegrenzt"}</p>
                    )}

                    {isEditing && (
                      <div className="pt-3 border-t border-white/8 space-y-3">
                        <p className="text-[11px] text-muted-foreground">Tagesbudget festlegen (0 = unbegrenzt)</p>
                        <div className="flex gap-2 flex-wrap">
                          {[0, 5, 10, 20, 50].map(amount => (
                            <button
                              key={amount}
                              onClick={() => setBudgetInput(prev => ({ ...prev, [b.id]: String(amount) }))}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                                budgetInput[b.id] === String(amount)
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "border-white/10 bg-white/5 hover:border-white/20 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {amount === 0 ? "Unbegrenzt" : `\u20AC${amount}/Tag`}
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
                            className="flex-1 text-sm border border-white/10 rounded-xl px-3 py-2 bg-white/5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 placeholder:text-muted-foreground"
                            placeholder="Eigener Betrag (€)"
                          />
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0"
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

            <div className="flex items-start gap-2.5 text-[11px] text-muted-foreground bg-indigo-500/8 border border-indigo-500/15 rounded-xl px-3 py-2.5">
              <span className="text-sm mt-0.5">{"\u2139\uFE0F"}</span>
              <span>
                {"Boosted Lokale erhalten das Label "}
                <strong className="text-foreground">{"\u201EGesponsert\u201C"}</strong>
                {" in der Kunden-App \u2014 transparent und vertrauensw\u00FCrdig."}
              </span>
            </div>
          </div>
        )}

        {/* ── Total Performance ── */}
        {promotions.length > 0 && (
          <div className="pt-2 border-t border-white/8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                Gesamtperformance
              </span>
              <span className="text-xs text-muted-foreground">Alle Boosts kombiniert</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Eye,           label: "Einblendungen", val: promotions.reduce((s, p) => s + (p.impressions || 0), 0) },
                { icon: MousePointer,  label: "Klicks",        val: promotions.reduce((s, p) => s + (p.clicks || 0), 0) },
                { icon: CalendarCheck, label: "Buchungen",     val: promotions.reduce((s, p) => s + (p.bookings_attributed || 0), 0) },
                { icon: Flame,         label: "Heat-Expo.",    val: promotions.reduce((s, p) => s + (p.heat_exposure || 0), 0) },
              ].map(({ icon: Ic, label, val }) => (
                <div key={label} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-center space-y-1">
                  <Ic className="w-4 h-4 mx-auto text-indigo-400 mb-2" />
                  <div className="text-xl font-extrabold tabular-nums">{val.toLocaleString("de")}</div>
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

// ─── Smart Pricing Dashboard ────────────────────────────────────────────────────

interface PricingData {
  pricePerImpression: number;
  pricePer1000: number;
  demandLevel: "low" | "normal" | "high" | "very_high";
  totalActivePlatformBoosts: number;
  competingBoosts: number;
  slotPosition: number;
  locationTier: string;
  demandSignal: string;
  timeSignal: string;
  competitionSignal: string;
  locationSignal: string;
  pricingContext: string;
  suggestion: string;
  bestBoostWindow: string;
  slotTiers: { tier: string; label: string; multiplier: number; pricePer1000: number }[];
  breakdown: {
    basePrice: number;
    demandMultiplier: number;
    timeMultiplier: number;
    slotMultiplier: number;
    locationMultiplier: number;
    weekendBonus: number;
    finalPrice: number;
    totalMultiplier: number;
  };
  config: { basePrice: number; maxMultiplier: number; maxPrice: number; maxChangePercent: number };
}

interface SmartSuggestion {
  type: "timing" | "budget" | "opportunity" | "savings";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionLabel?: string;
}

function DemandChip({ level }: { level: PricingData["demandLevel"] }) {
  const map: Record<PricingData["demandLevel"], { label: string; cls: string }> = {
    low:       { label: "Niedrig",   cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
    normal:    { label: "Normal",    cls: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20" },
    high:      { label: "Hoch",      cls: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
    very_high: { label: "Sehr hoch", cls: "text-red-400 bg-red-400/10 border-red-400/20" },
  };
  const { label, cls } = map[level] ?? map.normal;
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

function SuggestionIcon({ type }: { type: string }) {
  const iconMap: Record<string, React.ElementType> = {
    timing:      Clock,
    budget:      BarChart3,
    opportunity: Sparkles,
    savings:     Shield,
  };
  const Icon = iconMap[type] ?? Lightbulb;
  return <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />;
}

function SmartPricingDashboard({ businessType, restaurantId }: { businessType: string; restaurantId: number | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pricing, isLoading: pricingLoading } = useQuery<PricingData>({
    queryKey: ["pricing-current", businessType],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/pricing/current`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const { data: suggestionsData } = useQuery<{ suggestions: SmartSuggestion[] }>({
    queryKey: ["pricing-suggestions", businessType],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/pricing/suggestions`);
      if (!res.ok) return { suggestions: [] };
      return res.json();
    },
    refetchInterval: 300_000,
    staleTime: 120_000,
  });

  const { data: autoOptData } = useQuery<{ enabled: boolean }>({
    queryKey: ["auto-optimize", restaurantId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/pricing/auto-optimize?restaurantId=${restaurantId ?? 1}`);
      if (!res.ok) return { enabled: false };
      return res.json();
    },
    enabled: !!restaurantId,
  });

  const autoOptMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch(`${API_BASE}/api/pricing/auto-optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: restaurantId ?? 1, enabled }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.enabled ? "Automatische Optimierung aktiviert" : "Automatische Optimierung deaktiviert" });
      queryClient.invalidateQueries({ queryKey: ["auto-optimize"] });
    },
  });

  const suggestions = suggestionsData?.suggestions ?? [];
  const autoOptEnabled = autoOptData?.enabled ?? false;

  if (pricingLoading) {
    return (
      <div className="rounded-2xl border border-white/8 p-5 animate-pulse space-y-3">
        <div className="h-4 w-40 bg-muted/60 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted/40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!pricing) return null;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.01] overflow-hidden">
      <div className="p-5 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-sm">Smart Pricing</span>
            <DemandChip level={pricing.demandLevel} />
          </div>
          <span className="text-xs text-muted-foreground">{"Echtzeit \u00B7 alle 2 Min."}</span>
        </div>

        {/* Pricing grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1.5">Aktueller Preis</p>
            <p className="text-lg font-bold">{"\u20AC"}{pricing.pricePer1000.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">pro 1.000 Einbl.</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 text-center flex flex-col items-center gap-1.5">
            <p className="text-[10px] text-muted-foreground">Nachfrage</p>
            <DemandChip level={pricing.demandLevel} />
            <p className="text-[10px] text-muted-foreground">{pricing.totalActivePlatformBoosts} Boosts aktiv</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center justify-center gap-1">
              <Users className="w-2.5 h-2.5" /> Konkurrenz
            </p>
            <p className="text-lg font-bold">{pricing.competingBoosts}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Mitbewerber</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center justify-center gap-1">
              <Clock className="w-2.5 h-2.5" /> {"G\u00FCnstigste Zeit"}
            </p>
            <p className="text-sm font-bold leading-snug">{pricing.bestBoostWindow}</p>
          </div>
        </div>

        {/* Context info */}
        <div className="rounded-xl bg-white/[0.03] border border-white/8 px-4 py-3 space-y-1.5">
          <p className="text-xs font-medium">{pricing.pricingContext}</p>
          <p className="text-[11px] text-muted-foreground">{pricing.timeSignal}</p>
          {pricing.locationSignal && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" /> {pricing.locationSignal}
            </p>
          )}
        </div>

        {/* AI suggestion highlight */}
        <div className="flex items-start gap-2.5 rounded-xl bg-indigo-500/8 border border-indigo-500/20 px-4 py-3">
          <Zap className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-300 leading-relaxed">{pricing.suggestion}</p>
        </div>

        {/* Slot tiers */}
        {pricing.slotTiers && pricing.slotTiers.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> Slot-Preise
            </p>
            <div className="grid grid-cols-3 gap-2">
              {pricing.slotTiers.map((slot, idx) => (
                <div
                  key={slot.tier}
                  className={`rounded-xl border p-3 text-center transition-colors ${
                    idx === 0
                      ? "border-amber-400/30 bg-amber-400/[0.06]"
                      : idx === 1
                      ? "border-indigo-400/25 bg-indigo-400/[0.04]"
                      : "border-white/8 bg-white/[0.02]"
                  }`}
                >
                  <p className="text-[10px] text-muted-foreground font-medium mb-1">{slot.label.split(" — ")[0]}</p>
                  <p className={`text-sm font-bold ${
                    idx === 0 ? "text-amber-400" : idx === 1 ? "text-indigo-400" : "text-foreground"
                  }`}>{"\u20AC"}{slot.pricePer1000.toFixed(2)}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{slot.label.split(" — ")[1]}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI recommendations */}
        {suggestions.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> KI-Empfehlungen
            </p>
            <div className="space-y-2">
              {suggestions.slice(0, 3).map((s, i) => (
                <div
                  key={i}
                  className={`rounded-xl border px-3.5 py-2.5 flex items-start gap-2.5 ${
                    s.priority === "high"
                      ? "border-amber-400/25 bg-amber-400/[0.05]"
                      : s.priority === "medium"
                      ? "border-indigo-400/20 bg-indigo-400/[0.04]"
                      : "border-white/8 bg-white/[0.02]"
                  }`}
                >
                  <SuggestionIcon type={s.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{s.description}</p>
                  </div>
                  {s.priority === "high" && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/20 shrink-0 mt-0.5">
                      Top
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Auto-optimize toggle */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {autoOptEnabled
              ? <ToggleRight className="w-5 h-5 text-emerald-400 shrink-0" />
              : <ToggleLeft className="w-5 h-5 text-muted-foreground shrink-0" />
            }
            <div>
              <p className="text-xs font-semibold">Automatisch optimieren</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {autoOptEnabled
                  ? "System optimiert Timing & Budget automatisch"
                  : "System passt Ausgaben und Timing automatisch an"
                }
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={autoOptEnabled ? "outline" : "default"}
            className={autoOptEnabled
              ? "border-white/10 text-muted-foreground hover:bg-white/5 text-xs"
              : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0 text-xs"
            }
            onClick={() => autoOptMutation.mutate(!autoOptEnabled)}
            disabled={autoOptMutation.isPending}
          >
            {autoOptEnabled ? "Deaktivieren" : "Aktivieren"}
          </Button>
        </div>
      </div>
    </div>
  );
}
