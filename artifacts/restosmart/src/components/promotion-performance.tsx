/**
 * PromotionPerformance — ROI dashboard for all business boosts.
 * Shows impressions → clicks → bookings funnel + exposure metrics.
 * Uses /api/promotions/my (auto-discovers restaurant).
 */

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Eye, MousePointer, CalendarCheck, Flame, Users, ArrowRight, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { BOOST_CONFIGS } from "@/lib/monetization-engine";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ── Design tokens (mirror promotion-tools) ─────────────────────────────────────
const C = {
  card:   "#121826",
  border: "rgba(255,255,255,0.06)",
  grad:   "linear-gradient(135deg,#8b5cf6,#ec4899)",
  active: "#22C55E",
  text:   "#FFFFFF",
  muted:  "#9CA3AF",
  shadow: "0 10px 30px rgba(0,0,0,0.35)",
} as const;

// ── Interfaces ─────────────────────────────────────────────────────────────────

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

  const items = [
    { label: "Einblendungen", value: impressions.toLocaleString("de"), arrow: false },
    { label: `CTR ${clickRate}%`,  value: null,                        arrow: true  },
    { label: "Klicks",        value: clicks.toLocaleString("de"),   arrow: false },
    { label: `Conv. ${bookRate}%`, value: null,                        arrow: true  },
    { label: "Buchungen",     value: bookings.toLocaleString("de"), arrow: false },
  ];

  return (
    <div className="flex items-center w-full">
      {items.map((item, i) =>
        item.arrow ? (
          <div key={i} className="flex flex-col items-center gap-1 px-2 shrink-0">
            <ArrowRight style={{ width: 13, height: 13, color: C.muted }} />
            <span className="text-[10px] font-semibold" style={{ color: "#a78bfa" }}>{item.label}</span>
          </div>
        ) : (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex flex-col items-center gap-1.5 flex-1 text-center min-w-0"
          >
            <div className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: C.text }}>{item.value}</div>
            <div className="text-[11px] leading-none" style={{ color: C.muted }}>{item.label}</div>
          </motion.div>
        )
      )}
    </div>
  );
}

// ── Status pill ────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  if (status === "active") return (
    <span style={{ color: "#22C55E", backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.22)" }}
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full">
      <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: "#22C55E" }} />
      Aktiv
    </span>
  );
  if (status === "paused") return (
    <span style={{ color: "#F59E0B", backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}
      className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full">
      Pausiert
    </span>
  );
  return (
    <span style={{ color: C.muted, backgroundColor: "rgba(156,163,175,0.08)" }}
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full">
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

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ backgroundColor: C.card, borderRadius: 20, border: `1px solid ${C.border}`, padding: 24, boxShadow: C.shadow }}>
        <div className="flex items-center gap-3 mb-5">
          <div style={{ background: C.grad, borderRadius: 12, width: 36, height: 36 }} className="flex items-center justify-center">
            <TrendingUp style={{ width: 16, height: 16, color: "#fff" }} />
          </div>
          <div className="h-5 w-40 rounded animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.07)" }} />
        </div>
        <div className="h-48 rounded-2xl animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
      </div>
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ backgroundColor: C.card, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}
    >
      {/* ── Header ── */}
      <div style={{ padding: "24px 24px 16px" }} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div style={{ background: C.grad, borderRadius: 12, width: 38, height: 38, boxShadow: "0 4px 14px rgba(79,140,255,0.28)", flexShrink: 0 }} className="flex items-center justify-center">
            <TrendingUp style={{ width: 16, height: 16, color: "#fff" }} />
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: C.text }}>{"Performance-\u00DCbersicht"}</div>
            <div className="text-xs mt-0.5" style={{ color: C.muted }}>Alle aktiven Boosts kombiniert</div>
          </div>
        </div>
        <div className="flex gap-2">
          <span style={{ color: "#a78bfa", backgroundColor: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}
            className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full">
            CTR {overallCTR}%
          </span>
          <span style={{ color: C.active, backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.22)" }}
            className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full">
            Conv. {overallConv}%
          </span>
        </div>
      </div>

      <div style={{ padding: "0 24px 24px" }} className="space-y-5">

        {/* ── Conversion Funnel ── */}
        <div style={{ borderRadius: 14, border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.02)", padding: 20 }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-5" style={{ color: C.muted }}>
            Conversion-Funnel
          </p>
          <ConversionFunnel
            impressions={totals.impressions}
            clicks={totals.clicks}
            bookings={totals.bookings}
          />
        </div>

        {/* ── Extra metrics ── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Flame, label: "Heat-Map Sichtbarkeit", val: totals.heat,  bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.2)", iconColor: "#fb923c" },
            { icon: Users, label: "Gruppen-Vorschl\u00E4ge", val: totals.group, bg: "rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.2)", iconColor: "#a78bfa" },
          ].map(({ icon: Ic, label, val, bg, border, iconColor }) => (
            <motion.div
              key={label}
              whileHover={{ y: -2 }}
              style={{ borderRadius: 14, border: `1px solid ${border}`, backgroundColor: bg, padding: 16 }}
              className="flex items-center gap-4"
            >
              <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.2)", flexShrink: 0 }} className="flex items-center justify-center">
                <Ic style={{ width: 18, height: 18, color: iconColor }} />
              </div>
              <div>
                <div className="text-xl font-extrabold tabular-nums" style={{ color: C.text }}>{val.toLocaleString("de")}</div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>{label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Bar chart ── */}
        {chartData.length > 1 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: C.muted }}>
              Boost-Vergleich
            </p>
            <div style={{ height: 192 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: C.muted }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: C.muted }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1a2235",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: C.text,
                    }}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar dataKey="Einbl"  name="Einblendungen" fill="#8b5cf6" radius={[4,4,0,0]} maxBarSize={22} opacity={0.9} />
                  <Bar dataKey="Klicks" name="Klicks"        fill="#a855f7" radius={[4,4,0,0]} maxBarSize={22} opacity={0.9} />
                  <Bar dataKey="Buch"   name="Buchungen"     fill="#22C55E" radius={[4,4,0,0]} maxBarSize={22} opacity={0.9} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Data Table ── */}
        <div style={{ borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${C.border}` }}>
                {["Boost", "Status", "Einbl.", "Klicks", "Buch.", "Heat"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap" style={{ color: C.muted }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {promotions.map((p, i) => {
                const cfg = BOOST_CONFIGS.find(b => b.type === p.type);
                return (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    style={{ borderTop: i > 0 ? `1px solid ${C.border}` : undefined }}
                    className="transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: C.text }}>
                      {cfg?.emoji} {cfg?.label ?? p.type}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: C.muted }}>
                      {(Number(p.impressions) || 0).toLocaleString("de")}
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: C.muted }}>
                      {(Number(p.clicks) || 0).toLocaleString("de")}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: C.active }}>
                      {(Number(p.bookings_attributed) || 0).toLocaleString("de")}
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: C.muted }}>
                      {(Number(p.heat_exposure) || 0).toLocaleString("de")}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </motion.div>
  );
}
