import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const CORRECT_KEY = "rs_founder_2026";
const API_BASE = (import.meta.env?.VITE_API_URL as string | undefined) ?? "";

interface FunnelStep {
  event: string;
  count: number;
  dropoffRate: number;
}
interface BizBreakdown {
  type: string;
  pageViews: number;
  trials: number;
  ctaClicks: number;
  paid: number;
  conversionRate: number;
}
interface CtaStat {
  label: string;
  clicks: number;
}
interface MsgStat {
  label: string;
  views: number;
}
interface CityBreakdown {
  city: string;
  views: number;
  trials: number;
  paid: number;
  conversionRate: number;
}
interface RecentEvent {
  event_type: string;
  business_type: string;
  city: string;
  cta_label: string | null;
  created_at: string;
}
interface ConversionData {
  funnel: FunnelStep[];
  byBusinessType: BizBreakdown[];
  topCtas: CtaStat[];
  topMessages: MsgStat[];
  byCity: CityBreakdown[];
  recentEvents: RecentEvent[];
  totalEvents: number;
  sessions: { gateViews: number; trialStarts: number; ctaClicks: number };
  insights: string[];
}

const EVENT_LABELS: Record<string, string> = {
  premium_gate_viewed: "Premium-Seite gesehen",
  trial_expired_viewed: "Testphase abgelaufen (gesehen)",
  premium_page_opened: "Billing-Seite geöffnet",
  trial_started: "Testphase gestartet",
  dashboard_accessed: "Dashboard genutzt (Trial)",
  analytics_locked_viewed: "Analytics-Sperre gesehen",
  marketing_tools_viewed: "Marketing geöffnet (Trial)",
  trial_banner_viewed: "Trial-Banner gesehen",
  trial_conversion_banner_viewed: "Conversion-Banner gesehen",
  upgrade_cta_clicked: "Upgrade-CTA geklickt",
  checkout_started: "Checkout gestartet",
  payment_completed: "Zahlung abgeschlossen",
};

const BIZ_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  cafe: "Café",
  bar: "Bar",
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/3 px-4 py-3">
      <div className="text-[10px] text-[#444] uppercase tracking-widest font-semibold mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      {sub && <div className="text-[10px] text-[#444] mt-0.5">{sub}</div>}
    </div>
  );
}

function FunnelBar({ step, maxCount, idx }: { step: FunnelStep; maxCount: number; idx: number }) {
  const pct = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
  const isDropoff = step.dropoffRate > 50;
  return (
    <div className="flex items-center gap-3">
      <div className="w-5 h-5 rounded-full bg-white/4 flex items-center justify-center shrink-0">
        <span className="text-[9px] text-[#555] font-bold">{idx + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[#888] truncate pr-2">{EVENT_LABELS[step.event] ?? step.event}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-white">{step.count.toLocaleString()}</span>
            {step.dropoffRate > 0 && (
              <span className={`text-[10px] font-semibold ${isDropoff ? "text-red-400" : "text-amber-400"}`}>
                -{step.dropoffRate}%
              </span>
            )}
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function PremiumConversionPanel() {
  const [data, setData] = useState<ConversionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/conversion/analytics`, {
      headers: { "x-founder-key": CORRECT_KEY },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Unauthorized");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-[#444] text-sm">
        Fehler beim Laden der Conversion-Daten.
      </div>
    );
  }

  const maxFunnelCount = data.funnel[0]?.count ?? 1;
  const trialConvRate =
    data.sessions.gateViews > 0
      ? Math.round((data.sessions.trialStarts / data.sessions.gateViews) * 100)
      : 0;
  const ctaConvRate =
    data.sessions.trialStarts > 0
      ? Math.round((data.sessions.ctaClicks / data.sessions.trialStarts) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-10"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Premium Conversion Analytics</h2>
          <p className="text-xs text-[#444] mt-1">
            Letzte 30 Tage · {data.totalEvents.toLocaleString()} Events · Echtzeit
          </p>
        </div>
        <div className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 rounded-full font-semibold uppercase tracking-widest">
          Live Intelligence
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Gate-Besuche" value={data.sessions.gateViews} sub="Unique Sessions" />
        <StatCard label="Trial-Starts" value={data.sessions.trialStarts} sub={`${trialConvRate}% Rate`} />
        <StatCard label="CTA-Klicks" value={data.sessions.ctaClicks} sub={`${ctaConvRate}% von Trials`} />
        <StatCard label="Events gesamt" value={data.totalEvents.toLocaleString()} sub="30 Tage" />
      </div>

      {/* Actionable Insights */}
      {data.insights.length > 0 && (
        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/4 p-5 space-y-3">
          <p className="text-[10px] text-amber-400/60 uppercase tracking-widest font-bold">Insights</p>
          <ul className="space-y-2">
            {data.insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-[#888]">
                <span className="shrink-0 mt-0.5 text-amber-400">→</span>
                {ins}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Funnel */}
      <div className="rounded-2xl border border-white/6 bg-white/2 p-5">
        <p className="text-[10px] text-[#444] uppercase tracking-widest font-bold mb-5">Conversion Funnel (30 Tage)</p>
        <div className="space-y-4">
          {data.funnel.map((step, idx) => (
            <FunnelBar key={step.event} step={step} maxCount={maxFunnelCount} idx={idx} />
          ))}
        </div>
      </div>

      {/* Business Type Breakdown */}
      <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/6">
          <p className="text-[10px] text-[#444] uppercase tracking-widest font-bold">Conversion nach Betriebstyp</p>
        </div>
        {data.byBusinessType.length === 0 ? (
          <div className="px-5 py-6 text-xs text-[#333] text-center">Noch keine Daten</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/4">
                <th className="px-5 py-2.5 text-left text-[10px] text-[#333] font-semibold uppercase tracking-wider">Typ</th>
                <th className="px-5 py-2.5 text-right text-[10px] text-[#333] font-semibold uppercase tracking-wider">Besuche</th>
                <th className="px-5 py-2.5 text-right text-[10px] text-[#333] font-semibold uppercase tracking-wider">Trials</th>
                <th className="px-5 py-2.5 text-right text-[10px] text-[#333] font-semibold uppercase tracking-wider">CTA-Klicks</th>
                <th className="px-5 py-2.5 text-right text-[10px] text-[#333] font-semibold uppercase tracking-wider">Bezahlt</th>
                <th className="px-5 py-2.5 text-right text-[10px] text-[#333] font-semibold uppercase tracking-wider">Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.byBusinessType.map((r) => (
                <tr key={r.type} className="border-b border-white/3 hover:bg-white/2">
                  <td className="px-5 py-2.5 font-semibold text-white">{BIZ_LABELS[r.type] ?? r.type}</td>
                  <td className="px-5 py-2.5 text-right text-[#666]">{r.pageViews}</td>
                  <td className="px-5 py-2.5 text-right text-violet-400">{r.trials}</td>
                  <td className="px-5 py-2.5 text-right text-amber-400">{r.ctaClicks}</td>
                  <td className="px-5 py-2.5 text-right text-emerald-400 font-bold">{r.paid}</td>
                  <td className="px-5 py-2.5 text-right">
                    <span className={`font-bold ${r.conversionRate >= 20 ? "text-emerald-400" : r.conversionRate >= 10 ? "text-amber-400" : "text-red-400"}`}>
                      {r.conversionRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CTA Performance + Messages side by side */}
      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/6">
            <p className="text-[10px] text-[#444] uppercase tracking-widest font-bold">Top Upgrade-CTAs</p>
          </div>
          {data.topCtas.length === 0 ? (
            <div className="px-4 py-5 text-xs text-[#333] text-center">Noch keine Klicks</div>
          ) : (
            <div className="divide-y divide-white/3">
              {data.topCtas.map((c) => (
                <div key={c.label} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-xs text-[#777] truncate">{c.label}</span>
                  <span className="text-xs font-bold text-white shrink-0">{c.clicks} Klicks</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/6">
            <p className="text-[10px] text-[#444] uppercase tracking-widest font-bold">Top Nachrichten</p>
          </div>
          {data.topMessages.length === 0 ? (
            <div className="px-4 py-5 text-xs text-[#333] text-center">Noch keine Daten</div>
          ) : (
            <div className="divide-y divide-white/3">
              {data.topMessages.map((m) => (
                <div key={m.label} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-xs text-[#777] truncate">{m.label}</span>
                  <span className="text-xs font-bold text-white shrink-0">{m.views} Aufrufe</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* City breakdown */}
      {data.byCity.length > 0 && (
        <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/6">
            <p className="text-[10px] text-[#444] uppercase tracking-widest font-bold">Conversion nach Stadt</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/4">
                <th className="px-5 py-2.5 text-left text-[10px] text-[#333] font-semibold uppercase tracking-wider">Stadt</th>
                <th className="px-5 py-2.5 text-right text-[10px] text-[#333] font-semibold uppercase tracking-wider">Besuche</th>
                <th className="px-5 py-2.5 text-right text-[10px] text-[#333] font-semibold uppercase tracking-wider">Trials</th>
                <th className="px-5 py-2.5 text-right text-[10px] text-[#333] font-semibold uppercase tracking-wider">Bezahlt</th>
                <th className="px-5 py-2.5 text-right text-[10px] text-[#333] font-semibold uppercase tracking-wider">Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.byCity.map((c) => (
                <tr key={c.city} className="border-b border-white/3 hover:bg-white/2">
                  <td className="px-5 py-2.5 font-semibold text-white">{c.city}</td>
                  <td className="px-5 py-2.5 text-right text-[#666]">{c.views}</td>
                  <td className="px-5 py-2.5 text-right text-violet-400">{c.trials}</td>
                  <td className="px-5 py-2.5 text-right text-emerald-400 font-bold">{c.paid}</td>
                  <td className="px-5 py-2.5 text-right">
                    <span className={`font-bold ${c.conversionRate >= 20 ? "text-emerald-400" : c.conversionRate >= 10 ? "text-amber-400" : "text-red-400"}`}>
                      {c.conversionRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent events stream */}
      <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/6 flex items-center justify-between">
          <p className="text-[10px] text-[#444] uppercase tracking-widest font-bold">Live Event-Stream</p>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">Live</span>
        </div>
        {data.recentEvents.length === 0 ? (
          <div className="px-5 py-8 text-xs text-[#333] text-center">Noch keine Events — interagiere mit der Premium-Seite, um Daten zu sehen.</div>
        ) : (
          <div className="divide-y divide-white/3 max-h-64 overflow-y-auto">
            {data.recentEvents.map((e: any, i) => (
              <div key={i} className="px-5 py-2 flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500/60 shrink-0" />
                <span className="text-xs text-[#666] flex-1 truncate">
                  {EVENT_LABELS[e.event_type] ?? e.event_type}
                  {e.cta_label && <span className="text-violet-400/60"> · {e.cta_label}</span>}
                </span>
                <span className="text-[10px] text-[#333] shrink-0">
                  {e.business_type ? (BIZ_LABELS[e.business_type] ?? e.business_type) : ""}
                  {e.city ? ` · ${e.city}` : ""}
                </span>
                <span className="text-[10px] text-[#222] shrink-0">
                  {new Date(e.created_at).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
