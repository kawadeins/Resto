/**
 * PromotionPerformance — ROI dashboard for all business boosts.
 * Shows impressions → clicks → bookings funnel + exposure metrics.
 * Uses /api/promotions/my (auto-discovers restaurant).
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// ── Conversion Funnel ──────────────────────────────────────────────────────────

function ConversionFunnel({ impressions, clicks, bookings }: {
  impressions: number; clicks: number; bookings: number;
}) {
  const clickRate = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : "0.0";
  const bookRate  = clicks > 0 ? ((bookings / clicks) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex items-center w-full">
      {[
        { label: "Einblendungen", value: impressions.toLocaleString("de"), arrow: false },
        { label: `CTR ${clickRate}%`,  value: null,                         arrow: true  },
        { label: "Klicks",        value: clicks.toLocaleString("de"),    arrow: false },
        { label: `Conv. ${bookRate}%`, value: null,                         arrow: true  },
        { label: "Buchungen",     value: bookings.toLocaleString("de"),  arrow: false },
      ].map((item, i) =>
        item.arrow ? (
          <div key={i} className="flex flex-col items-center gap-1 px-2 shrink-0">
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
            <span className="text-[10px] font-semibold text-indigo-400">{item.label}</span>
          </div>
        ) : (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-1 text-center min-w-0">
            <div className="text-2xl font-extrabold tabular-nums leading-none">{item.value}</div>
            <div className="text-[11px] text-muted-foreground leading-none">{item.label}</div>
          </div>
        )
      )}
    </div>
  );
}

// ── Status pill ────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  if (status === "active") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
      Aktiv
    </span>
  );
  if (status === "paused") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
      Pausiert
    </span>
  );
  return (
    <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
      Beendet
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

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

  // Loading state
  if (isLoading) {
    return (
      <Card className="border-white/8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            {"Performance-\u00DCbersicht"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-muted/30 animate-pulse rounded-2xl" />
        </CardContent>
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
      name:   cfg?.label?.replace("-Boost", "") ?? p.type,
      Einbl:  Number(p.impressions) || 0,
      Klicks: Number(p.clicks) || 0,
      Buch:   Number(p.bookings_attributed) || 0,
    };
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-white/8 shadow-sm">

        {/* ── Header ── */}
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              {"Performance-\u00DCbersicht"}
            </CardTitle>
            <div className="flex gap-2">
              <span className="inline-flex items-center text-[11px] font-semibold text-indigo-400 bg-indigo-400/10 px-2.5 py-1 rounded-full border border-indigo-400/20">
                CTR {overallCTR}%
              </span>
              <span className="inline-flex items-center text-[11px] font-semibold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
                Conv. {overallConv}%
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-4">

          {/* ── Conversion Funnel ── */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
              Conversion-Funnel — alle Boosts
            </p>
            <ConversionFunnel
              impressions={totals.impressions}
              clicks={totals.clicks}
              bookings={totals.bookings}
            />
          </div>

          {/* ── Extra metrics ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-white/[0.02]">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <div className="text-xl font-extrabold tabular-nums">{totals.heat.toLocaleString("de")}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Heat-Map Sichtbarkeit</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-white/[0.02]">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <div className="text-xl font-extrabold tabular-nums">{totals.group.toLocaleString("de")}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{"Gruppen-Vorschl\u00E4ge"}</div>
              </div>
            </div>
          </div>

          {/* ── Bar Chart ── */}
          {chartData.length > 1 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                Boost-Vergleich
              </p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "hsl(var(--foreground))",
                      }}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Bar dataKey="Einbl"  name="Einblendungen" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={24} opacity={0.85} />
                    <Bar dataKey="Klicks" name="Klicks"        fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={24} opacity={0.85} />
                    <Bar dataKey="Buch"   name="Buchungen"     fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Data Table ── */}
          <div className="rounded-2xl border border-white/8 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/8 bg-white/[0.02]">
                  {["Boost", "Status", "Einbl.", "Klicks", "Buch.", "Heat"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {promotions.map((p, i) => {
                  const cfg = BOOST_CONFIGS.find(b => b.type === p.type);
                  return (
                    <tr
                      key={p.id}
                      className={`border-t border-white/5 transition-colors hover:bg-white/[0.02] ${
                        i % 2 === 0 ? "" : "bg-white/[0.01]"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {cfg?.emoji} {cfg?.label ?? p.type}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={p.status} />
                      </td>
                      <td className="px-4 py-3 tabular-nums">{(Number(p.impressions) || 0).toLocaleString("de")}</td>
                      <td className="px-4 py-3 tabular-nums">{(Number(p.clicks) || 0).toLocaleString("de")}</td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-emerald-400">
                        {(Number(p.bookings_attributed) || 0).toLocaleString("de")}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{(Number(p.heat_exposure) || 0).toLocaleString("de")}</td>
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
