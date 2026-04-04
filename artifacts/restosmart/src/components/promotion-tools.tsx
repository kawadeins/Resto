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
import { Zap, Pause, Play, Square, TrendingUp, Eye, MousePointer, CalendarCheck, Flame } from "lucide-react";
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
  const businessType = data?.businessType ?? "restaurant";
  const promotions = data?.promotions ?? [];

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

        {/* Total row */}
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
