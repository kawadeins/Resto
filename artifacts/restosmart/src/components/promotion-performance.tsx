/**
 * PromotionPerformance — ROI dashboard for all business boosts.
 * Shows impressions → clicks → bookings funnel + exposure metrics.
 * Uses /api/promotions/my (auto-discovers restaurant).
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Eye, MousePointer, CalendarCheck, Flame, Users, ArrowRight, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { BOOST_CONFIGS } from "@/lib/monetization-engine";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface Promotion {
  id: number;
  type: string;
  status: string;
  started_at: string;
  impressions: number;
  clicks: number;
  bookings_attributed: number;
  heat_exposure: number;
  group_exposure: number;
}

interface MyPromotionsData {
  restaurantId: number | null;
  businessType: string;
  promotions: Promotion[];
}

function ConversionFunnel({ impressions, clicks, bookings }: { impressions: number; clicks: number; bookings: number }) {
  const clickRate  = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : "0.0";
  const bookRate   = clicks > 0 ? ((bookings / clicks) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex items-center w-full">
      {[
        { label: "Einblendungen", value: impressions.toLocaleString("de"), meta: null },
        { label: `CTR ${clickRate}%`, value: null, arrow: true },
        { label: "Klicks",        value: clicks.toLocaleString("de"),    meta: null },
        { label: `Conv. ${bookRate}%`, value: null, arrow: true },
        { label: "Buchungen",     value: bookings.toLocaleString("de"),  meta: null },
      ].map((item, i) =>
        item.arrow ? (
          <div key={i} className="flex flex-col items-center gap-0.5 px-2 text-center shrink-0">
            <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
            <span className="text-[10px] font-semibold text-primary">{item.label}</span>
          </div>
        ) : (
          <div key={i} className="flex flex-col items-center gap-1 flex-1 text-center">
            <div className="text-2xl font-extrabold text-foreground">{item.value}</div>
            <div className="text-[11px] text-muted-foreground">{item.label}</div>
          </div>
        )
      )}
    </div>
  );
}

export function PromotionPerformance() {
  const { data, isLoading } = useQuery<MyPromotionsData>({
    queryKey: ["promotions-my"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/promotions/my`);
      if (!res.ok) return { restaurantId: null, businessType: "restaurant", promotions: [] };
      return res.json();
    },
    staleTime: 60000,
  });

  const promotions = data?.promotions ?? [];

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" />Performance-Übersicht</CardTitle>
        </CardHeader>
        <CardContent><div className="h-48 bg-muted animate-pulse rounded-xl" /></CardContent>
      </Card>
    );
  }

  if (promotions.length === 0) return null;

  const totals = {
    impressions: promotions.reduce((s, p) => s + (Number(p.impressions) || 0), 0),
    clicks:      promotions.reduce((s, p) => s + (Number(p.clicks) || 0), 0),
    bookings:    promotions.reduce((s, p) => s + (Number(p.bookings_attributed) || 0), 0),
    heat:        promotions.reduce((s, p) => s + (Number(p.heat_exposure) || 0), 0),
    group:       promotions.reduce((s, p) => s + (Number(p.group_exposure) || 0), 0),
  };

  const overallCTR  = totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(1) : "0.0";
  const overallConv = totals.clicks > 0 ? ((totals.bookings / totals.clicks) * 100).toFixed(1) : "0.0";

  const chartData = promotions.map(p => {
    const cfg = BOOST_CONFIGS.find(b => b.type === p.type);
    return {
      name: cfg?.label?.replace("-Boost", "") ?? p.type,
      Einbl: Number(p.impressions) || 0,
      Klicks: Number(p.clicks) || 0,
      Buch: Number(p.bookings_attributed) || 0,
    };
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-primary" />
              Performance-Übersicht
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-[11px]">CTR {overallCTR}%</Badge>
              <Badge variant="outline" className="text-[11px]">Conv. {overallConv}%</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Funnel */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Conversion-Funnel (alle Boosts)</div>
            <ConversionFunnel impressions={totals.impressions} clicks={totals.clicks} bookings={totals.bookings} />
          </div>

          {/* Extra metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card">
              <Flame className="w-8 h-8 text-orange-500 shrink-0" />
              <div>
                <div className="text-xl font-bold">{totals.heat.toLocaleString("de")}</div>
                <div className="text-xs text-muted-foreground">Heat-Map Sichtbarkeit</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card">
              <Users className="w-8 h-8 text-violet-500 shrink-0" />
              <div>
                <div className="text-xl font-bold">{totals.group.toLocaleString("de")}</div>
                <div className="text-xs text-muted-foreground">Gruppen-Vorschläge</div>
              </div>
            </div>
          </div>

          {/* Bar chart */}
          {chartData.length > 1 && (
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Boost-Vergleich</div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
                    />
                    <Bar dataKey="Einbl"  name="Einblendungen" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="Klicks" name="Klicks"        fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="Buch"   name="Buchungen"     fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-auto rounded-xl border border-border/50">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  {["Boost", "Status", "Einbl.", "Klicks", "Buch.", "Heat"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {promotions.map(p => {
                  const cfg = BOOST_CONFIGS.find(b => b.type === p.type);
                  return (
                    <tr key={p.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{cfg?.emoji} {cfg?.label ?? p.type}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          p.status === "active"  ? "bg-emerald-100 text-emerald-700"
                          : p.status === "paused" ? "bg-amber-100 text-amber-700"
                          : "bg-muted text-muted-foreground"
                        }`}>{p.status === "active" ? "Aktiv" : p.status === "paused" ? "Pausiert" : "Beendet"}</span>
                      </td>
                      <td className="px-3 py-2">{(Number(p.impressions)||0).toLocaleString("de")}</td>
                      <td className="px-3 py-2">{(Number(p.clicks)||0).toLocaleString("de")}</td>
                      <td className="px-3 py-2 font-semibold text-emerald-700">{(Number(p.bookings_attributed)||0).toLocaleString("de")}</td>
                      <td className="px-3 py-2">{(Number(p.heat_exposure)||0).toLocaleString("de")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
