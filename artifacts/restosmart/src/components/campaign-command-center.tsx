/**
 * Kampagnenzentrale — unified Campaign Command Center.
 * Aggregates wallet, ROI, recommendations, auto mode, and promotion tools
 * into one decision-oriented control panel.
 */

import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AutoCampaignMode } from "./auto-campaign-mode";
import { SmartBoostRecommendations } from "./smart-boost-recommendations";
import { PromotionTools } from "./promotion-tools";
import { BoostROIPanel } from "./boost-roi-panel";
import { getBizType } from "@/lib/biz-copy";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const RESTAURANT_ID = 1;
const authHdr = () => ({ "x-user-email": localStorage.getItem("restosmart_owner_email") ?? "" });

// ── Boost label map ──────────────────────────────────────────────────────────
const BOOST_LABELS: Record<string, string> = {
  breakfast_boost:  "Frühstücks-Boost",
  lunch_boost:      "Mittags-Boost",
  happy_hour_boost: "Happy Hour Boost",
  nightlife_boost:  "Nachtleben-Boost",
  local_spotlight:  "Local Spotlight",
  local_heat_boost: "Heat-Map Boost",
};

// ── Stat chip ────────────────────────────────────────────────────────────────
function StatChip({
  label, value, sub, accent, icon,
}: {
  label: string; value: string; sub?: string;
  accent?: "green" | "orange" | "red" | "blue" | "default";
  icon: string;
}) {
  const colors: Record<string, { val: string; dot: string }> = {
    green:   { val: "#22c55e", dot: "#22c55e" },
    orange:  { val: "#f97316", dot: "#f97316" },
    red:     { val: "#ef4444", dot: "#ef4444" },
    blue:    { val: "#60a5fa", dot: "#60a5fa" },
    default: { val: "#e5e7eb", dot: "#6b7280" },
  };
  const c = colors[accent ?? "default"];
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12, padding: "14px 18px", flex: "1 1 140px", minWidth: 130,
    }}>
      <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: c.val, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#4b5563", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Alert chip ───────────────────────────────────────────────────────────────
function AlertChip({ icon, text, level }: { icon: string; text: string; level: "warn" | "info" | "good" }) {
  const styles: Record<string, { bg: string; border: string; color: string }> = {
    warn: { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.3)", color: "#f97316" },
    info: { bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.3)", color: "#60a5fa" },
    good: { bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.3)",  color: "#22c55e" },
  };
  const s = styles[level];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: s.bg, border: "1px solid " + s.border,
      borderRadius: 8, padding: "8px 14px",
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 12, color: s.color, fontWeight: 500 }}>{text}</span>
    </div>
  );
}

// ── Business-type header copy ─────────────────────────────────────────────────
const BIZ_COPY: Record<string, { title: string; sub: string }> = {
  restaurant: {
    title: "Kampagnenzentrale",
    sub: "Alle Boost-Kampagnen — Mittags- und Abendzeit maximieren.",
  },
  cafe: {
    title: "Kampagnenzentrale",
    sub: "Alle Boost-Kampagnen — Frühstücks- und Kaffeepausen-Sichtbarkeit.",
  },
  bar: {
    title: "Kampagnenzentrale",
    sub: "Alle Boost-Kampagnen — Abend- und Happy-Hour-Sichtbarkeit.",
  },
};

// ── Main component ───────────────────────────────────────────────────────────
export function CampaignCommandCenter() {
  const biz = getBizType();
  const [, setLocation] = useLocation();
  const premiumVal = typeof window !== "undefined" ? localStorage.getItem("restosmart_owner_premium") : null;
  const isPremium  = premiumVal === "true" || premiumVal === "trial";

  const copy = BIZ_COPY[biz] ?? BIZ_COPY.restaurant;

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: wallet } = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/wallet?restaurantId=${RESTAURANT_ID}`, { headers: authHdr() });
      if (!r.ok) return null;
      return r.json() as Promise<{ balance: number; isLow: boolean; isEmpty: boolean }>;
    },
    refetchInterval: 60_000,
  });

  const { data: promos } = useQuery({
    queryKey: ["promotions-all", RESTAURANT_ID],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/promotions?restaurantId=${RESTAURANT_ID}`);
      return r.json() as Promise<Array<{
        id: number; type: string; status: string;
        impressions: number; clicks: number; bookings_attributed: number;
        created_at: string;
      }>>;
    },
    refetchInterval: 30_000,
  });

  const { data: roi } = useQuery({
    queryKey: ["roi-week", RESTAURANT_ID],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/promotions/roi?restaurantId=${RESTAURANT_ID}&period=week`);
      return r.json() as Promise<{
        summary: {
          totalSpent: number; totalEstReturn: number;
          netProfit: number; overallROI: number | null;
          activeCount: number; boostCount: number;
        };
        boosts: Array<{ type: string; totalSpent: number; roi: number | null }>;
      }>;
    },
    refetchInterval: 60_000,
  });

  const { data: autoCampaign } = useQuery({
    queryKey: ["auto-campaign-log", RESTAURANT_ID],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/promotions/auto-campaign/log?restaurantId=${RESTAURANT_ID}`);
      return r.json() as Promise<{ settings: { enabled: boolean; daily_max_cents: number; weekly_max_cents: number } | null; log: any[] }>;
    },
    refetchInterval: 60_000,
  });

  const { data: recs } = useQuery({
    queryKey: ["recommendations-cmd", RESTAURANT_ID],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/promotions/recommendations?restaurantId=${RESTAURANT_ID}`);
      return r.json() as Promise<{
        demandScore: number; currentHour: number;
        recommendations: Array<{ label: string; confidence: number; window: string; emoji: string }>;
        globalWarning?: string;
      }>;
    },
    refetchInterval: 5 * 60_000,
  });

  // ── Derived values ──────────────────────────────────────────────────────────
  const active      = (promos ?? []).filter(p => p.status === "active");
  const walletBal   = wallet?.balance ?? null;
  const weeklySpent = roi?.summary?.totalSpent ?? null;
  const weeklyRet   = roi?.summary?.totalEstReturn ?? null;
  const overallROI  = roi?.summary?.overallROI ?? null;
  const autoEnabled = autoCampaign?.settings?.enabled ?? false;
  const topRec      = recs?.recommendations?.[0];
  const demandPct   = recs?.demandScore ?? null;

  const bestBoost = (roi?.boosts ?? [])
    .filter(b => b.roi !== null && b.roi > 0)
    .sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0))[0];

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const alerts: Array<{ icon: string; text: string; level: "warn" | "info" | "good" }> = [];

  if (wallet?.isEmpty)
    alerts.push({ icon: "🔴", text: "Guthaben leer — Boosts können nicht aktiviert werden.", level: "warn" });
  else if (wallet?.isLow)
    alerts.push({ icon: "⚠️", text: "Niedriges Guthaben — bitte Wallet aufladen.", level: "warn" });

  if (demandPct !== null && demandPct >= 70 && active.length === 0)
    alerts.push({ icon: "📈", text: "Hohe Nachfrage — jetzt guter Zeitpunkt für Sichtbarkeit.", level: "good" });

  if (topRec && topRec.confidence >= 70)
    alerts.push({ icon: "💡", text: `Empfohlen: ${topRec.emoji} ${topRec.label} · ${topRec.window}`, level: "info" });

  if (!autoEnabled && isPremium && active.length === 0)
    alerts.push({ icon: "🤖", text: "Auto-Kampagnenmodus inaktiv — aktivieren für automatische Steuerung.", level: "info" });

  if (weeklySpent !== null && overallROI !== null && overallROI < -50 && weeklySpent > 1)
    alerts.push({ icon: "📉", text: "Schwache Boost-Performance diese Woche — ROI überprüfen.", level: "warn" });

  const dailyMaxCents = autoCampaign?.settings?.daily_max_cents ?? 0;
  if (dailyMaxCents > 0) {
    const todaySpentEur = (promos ?? [])
      .filter(p => {
        const today = new Date().toDateString();
        return new Date(p.created_at).toDateString() === today;
      }).length * 2.5;
    if (todaySpentEur / (dailyMaxCents / 100) > 0.8)
      alerts.push({ icon: "🚫", text: "Tageslimit fast erreicht.", level: "warn" });
  }

  // ── History ─────────────────────────────────────────────────────────────────
  const history = (promos ?? [])
    .filter(p => p.status !== "active")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  return (
    <div style={{ maxWidth: 1100, paddingBottom: 48 }}>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, flexShrink: 0,
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, boxShadow: "0 8px 24px rgba(99,102,241,0.3)",
        }}>{"🎯"}</div>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
            {copy.title}
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 5, margin: "5px 0 0" }}>
            {copy.sub}
          </p>
        </div>
      </div>

      {/* ── Summary strip ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
        <StatChip
          icon="💰"
          label="Guthaben"
          value={walletBal !== null ? "€" + walletBal.toFixed(2) : "—"}
          sub={wallet?.isLow ? "Niedrig" : wallet?.isEmpty ? "Leer" : undefined}
          accent={wallet?.isEmpty ? "red" : wallet?.isLow ? "orange" : "green"}
        />
        <StatChip
          icon="▶"
          label="Aktive Kampagnen"
          value={active.length > 0 ? String(active.length) : "0"}
          sub={active.length > 0 ? active.map(a => BOOST_LABELS[a.type] ?? a.type).join(", ").slice(0, 30) : "Keine aktiv"}
          accent={active.length > 0 ? "green" : "default"}
        />
        <StatChip
          icon="💸"
          label="Wochenausgaben"
          value={weeklySpent !== null ? "€" + weeklySpent.toFixed(2) : "—"}
          sub="Diese Woche"
          accent="default"
        />
        <StatChip
          icon="📊"
          label="Gesch. Wochenertrag"
          value={weeklyRet !== null ? "€" + weeklyRet.toFixed(2) : "—"}
          sub={overallROI !== null ? "ROI " + overallROI + "%" : undefined}
          accent={overallROI !== null && overallROI > 0 ? "green" : overallROI !== null && overallROI < -50 ? "orange" : "default"}
        />
        <StatChip
          icon="🤖"
          label="Auto-Modus"
          value={autoEnabled ? "Aktiv" : "Aus"}
          sub={autoEnabled
            ? (autoCampaign?.settings?.daily_max_cents
               ? "Max. €" + (autoCampaign.settings.daily_max_cents / 100).toFixed(0) + "/Tag"
               : "Keine Limits")
            : "Manuell gesteuert"}
          accent={autoEnabled ? "green" : "default"}
        />
        {topRec && (
          <StatChip
            icon={topRec.emoji}
            label="Empfehlung"
            value={topRec.confidence + "%"}
            sub={topRec.label + " · " + topRec.window}
            accent={topRec.confidence >= 70 ? "green" : topRec.confidence >= 50 ? "blue" : "default"}
          />
        )}
      </div>

      {/* ── Alerts ───────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: "16px 20px", marginBottom: 22,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "#6b7280",
            textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12,
          }}>
            {"Benötigt Aufmerksamkeit"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {alerts.map((a, i) => (
              <AlertChip key={i} icon={a.icon} text={a.text} level={a.level} />
            ))}
          </div>
        </div>
      )}

      {/* ── Active campaigns quick view ───────────────────────────────────── */}
      {active.length > 0 && (
        <div style={{
          background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)",
          borderRadius: 14, padding: "16px 20px", marginBottom: 22,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "#6b7280",
            textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12,
          }}>
            {"Aktive Kampagnen"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {active.map((p) => {
              const since = new Date(p.created_at);
              const hoursAgo = Math.round((Date.now() - since.getTime()) / 3_600_000);
              const ctr = p.impressions > 0 ? ((p.clicks / p.impressions) * 100).toFixed(1) : "0.0";
              return (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  flexWrap: "wrap", gap: 10,
                  background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%", background: "#22c55e",
                      display: "inline-block", boxShadow: "0 0 6px #22c55e",
                    }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                      {BOOST_LABELS[p.type] ?? p.type}
                    </span>
                    <span style={{
                      fontSize: 10, color: "#22c55e", background: "rgba(34,197,94,0.12)",
                      borderRadius: 5, padding: "2px 7px", fontWeight: 700,
                    }}>
                      {"AKTIV"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                    {[
                      { label: "Einblendungen", value: p.impressions.toLocaleString("de") },
                      { label: "Klicks", value: p.clicks.toLocaleString("de") },
                      { label: "CTR", value: ctr + "%" },
                      { label: "Buchungen", value: String(p.bookings_attributed) },
                      { label: "Seit", value: hoursAgo < 1 ? "Gerade eben" : hoursAgo + "h" },
                    ].map(stat => (
                      <div key={stat.label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#e5e7eb" }}>{stat.value}</div>
                        <div style={{ fontSize: 10, color: "#6b7280" }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Auto Campaign Mode ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <SectionLabel>{"Automatischer Kampagnenmodus"}</SectionLabel>
      </div>
      <AutoCampaignMode
        isPremium={isPremium}
        onUpgradeClick={() => setLocation("/billing")}
      />

      {/* ── Smart Boost Recommendations ───────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <SectionLabel>{"Smart Boost-Empfehlungen"}</SectionLabel>
      </div>
      <SmartBoostRecommendations />

      {/* ── Promotion Tools ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <SectionLabel>{"Schnellzugriff & Kampagnen starten"}</SectionLabel>
      </div>
      <PromotionTools />

      {/* ── ROI & Performance ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <SectionLabel>{"ROI & Performance"}</SectionLabel>
      </div>
      <BoostROIPanel />

      {/* ── Campaign History ─────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <SectionLabel>{"Kampagnenverlauf"}</SectionLabel>
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14, overflow: "hidden", marginTop: 12,
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Boost-Typ", "Status", "Einblendungen", "Klicks", "Buchungen", "Datum"].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px", textAlign: "left",
                      fontSize: 10, fontWeight: 700, color: "#6b7280",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((p, i) => {
                  const statusColor = p.status === "paused" ? "#f97316" : p.status === "completed" ? "#22c55e" : "#9ca3af";
                  const statusLabel = p.status === "paused" ? "Pausiert" : p.status === "stopped" ? "Gestoppt" : "Abgeschlossen";
                  return (
                    <tr key={p.id} style={{
                      borderBottom: i < history.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                    }}>
                      <td style={{ padding: "11px 16px", fontSize: 13, color: "#e5e7eb", fontWeight: 500 }}>
                        {BOOST_LABELS[p.type] ?? p.type}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: statusColor,
                          background: statusColor + "18", borderRadius: 5, padding: "2px 8px",
                        }}>{statusLabel}</span>
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 13, color: "#9ca3af" }}>
                        {p.impressions.toLocaleString("de")}
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 13, color: "#9ca3af" }}>
                        {p.clicks.toLocaleString("de")}
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 13, color: "#9ca3af" }}>
                        {p.bookings_attributed}
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 12, color: "#6b7280" }}>
                        {new Date(p.created_at).toLocaleDateString("de-AT", { day: "2-digit", month: "short", year: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section label helper ─────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: "#6b7280",
      textTransform: "uppercase", letterSpacing: "0.07em",
      paddingBottom: 2,
    }}>
      {children}
    </div>
  );
}
