/**
 * SmartBoostRecommendations — recommendation engine UI.
 *
 * Shows ranked boost recommendations based on real data:
 * business type, current hour, demand, wallet balance, historical ROI.
 *
 * Advanced features (best-time, budget optimization, auto mode,
 * weak-spend warnings, reasoning) are Premium-only.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Clock, Wallet, TrendingUp, TrendingDown, AlertTriangle,
  Crown, Lock, ChevronDown, ChevronUp, Settings2, CheckCircle2,
  Zap, BrainCircuit, Target, BarChart2, Power, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const C = {
  card:      "#121826",
  border:    "rgba(255,255,255,0.06)",
  borderGold:"rgba(245,158,11,0.2)",
  grad:      "linear-gradient(135deg,#8b5cf6,#ec4899)",
  gradGold:  "linear-gradient(135deg,#F59E0B,#f97316)",
  gradGreen: "linear-gradient(135deg,#22C55E,#16A34A)",
  green:     "#22C55E",
  amber:     "#F59E0B",
  red:       "#EF4444",
  blue:      "#a78bfa",
  text:      "#FFFFFF",
  textSoft:  "#E5E7EB",
  muted:     "#9CA3AF",
  shadow:    "0 12px 36px rgba(0,0,0,0.4)",
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Recommendation {
  type: string;
  label: string;
  emoji: string;
  window: string;
  confidence: number;
  suggestedBudget: number;
  reason: string;
  warning: string | null;
  isActive: boolean;
  hourScore: number;
  demandScore: number;
  hasHistory: boolean;
  historicalClicks: number;
  historicalImpressions: number;
  historicalCost: number;
}

interface RecoData {
  restaurantId: number;
  bizType: string;
  currentHour: number;
  demandScore: number;
  walletEur: number;
  globalWarning: string | null;
  recommendations: Recommendation[];
  allScored: Recommendation[];
}

interface AutoBudgetSettings {
  restaurantId: number;
  enabled: boolean;
  dailyMaxEur: number;
  weeklyMaxEur: number;
  minWalletBalanceEur: number;
  allowedBoostTypes: string[];
  autoPauseLowROI: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPremiumUser(): boolean {
  const v = localStorage.getItem("restosmart_owner_premium");
  return v === "true" || v === "trial";
}

function ConfidenceMeter({ value }: { value: number }) {
  const color = value >= 70 ? C.green : value >= 45 ? C.amber : C.red;
  return (
    <div className="flex items-center gap-2">
      <div style={{ flex: 1, height: 5, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.07)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ height: "100%", borderRadius: 99, backgroundColor: color }}
        />
      </div>
      <span style={{ color, fontSize: 11, fontWeight: 700, minWidth: 32, textAlign: "right" }}>{value}%</span>
    </div>
  );
}

function DemandBadge({ score }: { score: number }) {
  const label  = score >= 70 ? "Hoch" : score >= 45 ? "Mittel" : "Niedrig";
  const color  = score >= 70 ? C.green : score >= 45 ? C.amber : C.red;
  const bg     = score >= 70 ? "rgba(34,197,94,0.1)" : score >= 45 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";
  const border = score >= 70 ? "rgba(34,197,94,0.2)" : score >= 45 ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)";
  return (
    <span style={{ color, backgroundColor: bg, border: `1px solid ${border}`, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>
      {label}
    </span>
  );
}

function PremiumGate({ label, onUpgrade }: { label: string; onUpgrade: () => void }) {
  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", minHeight: 120 }}>
      <div style={{ filter: "blur(3px)", opacity: 0.25, pointerEvents: "none", userSelect: "none", padding: 16 }}>
        {[1,2,3].map(i => <div key={i} className="h-8 rounded-xl mb-2 animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.07)" }} />)}
      </div>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 10,
        background: "rgba(18,24,38,0.78)", backdropFilter: "blur(2px)",
      }}>
        <Lock style={{ width: 18, height: 18, color: C.amber }} />
        <p style={{ color: C.textSoft, fontSize: 12, textAlign: "center", paddingInline: 20 }}>{label}</p>
        <motion.button
          whileHover={{ boxShadow: "0 0 20px rgba(245,158,11,0.4)" }}
          whileTap={{ scale: 0.97 }}
          onClick={onUpgrade}
          style={{ background: C.gradGold, border: "none", borderRadius: 9, padding: "8px 18px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <Crown style={{ width: 12, height: 12 }} /> Jetzt upgraden
        </motion.button>
      </div>
    </div>
  );
}

// ── Recommendation Card ───────────────────────────────────────────────────────

function RecoCard({ rec, rank, isPremium }: { rec: Recommendation; rank: number; isPremium: boolean }) {
  const [expanded, setExpanded] = useState(rank === 0);
  const isTop     = rank === 0;
  const hasWarning = !!rec.warning;

  const borderColor = isTop && !hasWarning
    ? "rgba(34,197,94,0.3)"
    : hasWarning
    ? "rgba(239,68,68,0.2)"
    : C.border;
  const bgColor = isTop && !hasWarning
    ? "rgba(34,197,94,0.04)"
    : hasWarning
    ? "rgba(239,68,68,0.03)"
    : "rgba(255,255,255,0.02)";

  return (
    <motion.div
      layout
      style={{ borderRadius: 16, border: `1px solid ${borderColor}`, backgroundColor: bgColor, overflow: "hidden" }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "16px 20px", textAlign: "left" }}
      >
        <div className="flex items-start gap-3">
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: isTop && !hasWarning ? C.gradGreen : hasWarning ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, boxShadow: isTop && !hasWarning ? "0 4px 14px rgba(34,197,94,0.25)" : undefined,
          }}>
            {rec.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{rec.label}</span>
              {isTop && !hasWarning && (
                <span style={{ fontSize: 9, fontWeight: 800, color: C.green, background: "rgba(34,197,94,0.12)", borderRadius: 5, padding: "2px 6px", letterSpacing: "0.05em" }}>
                  EMPFOHLEN
                </span>
              )}
              {rec.isActive && (
                <span style={{ fontSize: 9, fontWeight: 800, color: C.blue, background: "rgba(123,140,255,0.12)", borderRadius: 5, padding: "2px 6px" }}>
                  AKTIV
                </span>
              )}
              {hasWarning && (
                <span style={{ fontSize: 9, fontWeight: 800, color: C.red, background: "rgba(239,68,68,0.1)", borderRadius: 5, padding: "2px 6px" }}>
                  WARNUNG
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="flex items-center gap-1" style={{ color: C.muted, fontSize: 11 }}>
                <Clock style={{ width: 10, height: 10 }} /> {rec.window}
              </span>
              {isPremium && (
                <span className="flex items-center gap-1" style={{ color: C.amber, fontSize: 11 }}>
                  <Wallet style={{ width: 10, height: 10 }} /> €{rec.suggestedBudget}
                </span>
              )}
              <DemandBadge score={rec.demandScore} />
            </div>
          </div>
          <div style={{ flexShrink: 0, color: C.muted }}>
            {expanded ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${C.border}` }} className="pt-4 space-y-4">

              {/* Confidence meter */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Empfehlungs-Score</span>
                </div>
                {isPremium ? (
                  <ConfidenceMeter value={rec.confidence} />
                ) : (
                  <div style={{ height: 5, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.07)" }} />
                )}
              </div>

              {/* Reason */}
              {isPremium ? (
                <div className="rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: "rgba(79,140,255,0.05)", border: "1px solid rgba(139,92,246,0.14)" }}>
                  <div className="flex items-start gap-2">
                    <BrainCircuit style={{ width: 13, height: 13, color: C.blue, flexShrink: 0, marginTop: 1 }} />
                    <p style={{ color: C.textSoft, fontSize: 12, lineHeight: 1.55 }}>
                      <strong style={{ color: C.text }}>Grund:</strong> {rec.reason}
                    </p>
                  </div>
                </div>
              ) : (
                <PremiumGate label="Upgrade auf Premium für Begründungen und detaillierte Timing-Empfehlungen." onUpgrade={() => { window.location.href = "/billing"; }} />
              )}

              {/* Warning */}
              {rec.warning && (
                <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
                  style={{ backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)" }}>
                  <AlertTriangle style={{ width: 13, height: 13, color: C.red, flexShrink: 0, marginTop: 1 }} />
                  <p style={{ color: "#FCA5A5", fontSize: 12, lineHeight: 1.55 }}>{rec.warning}</p>
                </div>
              )}

              {/* Budget recommendation */}
              {isPremium && !rec.warning && (
                <div className="flex items-center gap-4 flex-wrap">
                  <div style={{ flex: 1, borderRadius: 12, padding: "10px 14px", backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
                    <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Empfohlenes Budget</div>
                    <div style={{ color: C.amber, fontSize: 18, fontWeight: 800 }}>€{rec.suggestedBudget}</div>
                    <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>basierend auf Nachfrage + Zeitfenster</div>
                  </div>
                  <div style={{ flex: 1, borderRadius: 12, padding: "10px 14px", backgroundColor: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.18)" }}>
                    <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Zeitfenster</div>
                    <div style={{ color: C.green, fontSize: 14, fontWeight: 700 }}>{rec.window}</div>
                    <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>optimales Boost-Zeitfenster</div>
                  </div>
                </div>
              )}

              {/* History signal */}
              {isPremium && rec.hasHistory && rec.historicalClicks > 0 && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: C.muted }}>
                  <BarChart2 style={{ width: 11, height: 11, color: C.blue }} />
                  Letzte 30 Tage: {rec.historicalClicks} Klicks · €{rec.historicalCost.toFixed(2)} ausgegeben
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Auto Budget Settings Panel ────────────────────────────────────────────────

const ALL_BOOST_TYPES = [
  { type: "breakfast_boost",  label: "Frühstücks-Boost", emoji: "☕" },
  { type: "lunch_boost",      label: "Mittags-Boost",     emoji: "🍽️" },
  { type: "happy_hour_boost", label: "Happy Hour Boost",  emoji: "🍹" },
  { type: "nightlife_boost",  label: "Nachtleben-Boost",  emoji: "🌙" },
  { type: "local_spotlight",  label: "Local Spotlight",   emoji: "⭐" },
  { type: "local_heat_boost", label: "Heat-Map Boost",    emoji: "🔥" },
];

function AutoBudgetPanel({ restaurantId, isPremium }: { restaurantId: number; isPremium: boolean }) {
  const [open, setOpen]         = useState(false);
  const { toast }               = useToast();
  const qc                      = useQueryClient();

  const { data: settings } = useQuery<AutoBudgetSettings>({
    queryKey: ["auto-budget-settings", restaurantId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/promotions/auto-budget-settings?restaurantId=${restaurantId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60000,
  });

  const [form, setForm] = useState<AutoBudgetSettings | null>(null);
  const current = form ?? settings;

  const saveMutation = useMutation({
    mutationFn: async (data: AutoBudgetSettings) => {
      const res = await fetch(`${API_BASE}/api/promotions/auto-budget-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern");
    },
    onSuccess: () => {
      toast({ title: "Gespeichert", description: "Auto-Budget-Einstellungen wurden aktualisiert." });
      qc.invalidateQueries({ queryKey: ["auto-budget-settings", restaurantId] });
      setForm(null);
    },
    onError: (err: Error) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  if (!current) return null;

  const dirty = form !== null;

  const toggleType = (type: string) => {
    if (!current) return;
    const allowed = current.allowedBoostTypes;
    const next = allowed.includes(type) ? allowed.filter(t => t !== type) : [...allowed, type];
    if (next.length === 0) return;
    setForm({ ...current, allowedBoostTypes: next });
  };

  return (
    <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.02)", overflow: "hidden" }}>
      {/* Header toggle */}
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "16px 20px" }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: current.enabled ? C.gradGold : "rgba(255,255,255,0.06)" }} className="flex items-center justify-center">
            <Power style={{ width: 15, height: 15, color: current.enabled ? "#fff" : C.muted }} />
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div className="flex items-center gap-2">
              <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>Budget automatisch optimieren</span>
              {current.enabled
                ? <span style={{ fontSize: 9, fontWeight: 800, color: C.green, background: "rgba(34,197,94,0.12)", borderRadius: 5, padding: "2px 6px" }}>AN</span>
                : <span style={{ fontSize: 9, fontWeight: 800, color: C.muted, background: "rgba(255,255,255,0.07)", borderRadius: 5, padding: "2px 6px" }}>AUS</span>}
            </div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
              System verteilt Budget auf die besten Zeitfenster und Boost-Typen
            </div>
          </div>
          <Settings2 style={{ width: 15, height: 15, color: C.muted }} />
          {open ? <ChevronUp style={{ width: 15, height: 15, color: C.muted }} /> : <ChevronDown style={{ width: 15, height: 15, color: C.muted }} />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            {isPremium ? (
              <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${C.border}` }} className="pt-4 space-y-5">

                {/* Enable/disable toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Automatischer Modus</div>
                    <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>System aktiviert und pausiert Boosts selbst</div>
                  </div>
                  <button
                    onClick={() => setForm({ ...current, enabled: !current.enabled })}
                    style={{
                      width: 44, height: 24, borderRadius: 99, border: "none", cursor: "pointer",
                      background: current.enabled ? C.gradGreen : "rgba(255,255,255,0.1)",
                      position: "relative", transition: "background 0.2s",
                    }}
                  >
                    <motion.div
                      animate={{ x: current.enabled ? 22 : 2 }}
                      transition={{ duration: 0.18 }}
                      style={{ position: "absolute", top: 2, width: 20, height: 20, borderRadius: "50%", background: "#fff" }}
                    />
                  </button>
                </div>

                {/* Limits */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Max. pro Tag", key: "dailyMaxEur",         min: 1,  max: 100 },
                    { label: "Max. pro Woche", key: "weeklyMaxEur",      min: 1,  max: 500 },
                    { label: "Min. Wallet-Guthaben", key: "minWalletBalanceEur", min: 0, max: 50 },
                  ].map(({ label, key, min, max }) => (
                    <div key={key}>
                      <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                        {label}
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ color: C.muted, fontSize: 12 }}>€</span>
                        <input
                          type="number" min={min} max={max} step={1}
                          value={(current as any)[key]}
                          onChange={e => setForm({ ...current, [key]: Number(e.target.value) })}
                          style={{
                            width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`,
                            borderRadius: 8, padding: "6px 10px", color: C.text, fontSize: 13, fontWeight: 600,
                            outline: "none",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Allowed boost types */}
                <div>
                  <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    Erlaubte Boost-Typen
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ALL_BOOST_TYPES.map(({ type, label, emoji }) => {
                      const active = current.allowedBoostTypes.includes(type);
                      return (
                        <button
                          key={type}
                          onClick={() => toggleType(type)}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "5px 12px", borderRadius: 99, border: "none", cursor: "pointer",
                            fontSize: 12, fontWeight: 600,
                            background: active ? C.grad : "rgba(255,255,255,0.05)",
                            color: active ? "#fff" : C.muted,
                          }}
                        >
                          <span style={{ fontSize: 13 }}>{emoji}</span> {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Auto-pause low ROI */}
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Schlechte Boosts automatisch pausieren</div>
                    <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Boosts mit negativem ROI werden automatisch gestoppt</div>
                  </div>
                  <button
                    onClick={() => setForm({ ...current, autoPauseLowROI: !current.autoPauseLowROI })}
                    style={{
                      width: 44, height: 24, borderRadius: 99, border: "none", cursor: "pointer",
                      background: current.autoPauseLowROI ? C.gradGreen : "rgba(255,255,255,0.1)",
                      position: "relative", transition: "background 0.2s",
                    }}
                  >
                    <motion.div
                      animate={{ x: current.autoPauseLowROI ? 22 : 2 }}
                      transition={{ duration: 0.18 }}
                      style={{ position: "absolute", top: 2, width: 20, height: 20, borderRadius: "50%", background: "#fff" }}
                    />
                  </button>
                </div>

                {/* Transparency note */}
                <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: "rgba(79,140,255,0.05)", border: "1px solid rgba(79,140,255,0.13)" }}>
                  <Info style={{ width: 13, height: 13, color: C.blue, flexShrink: 0, marginTop: 1 }} />
                  <p style={{ color: C.muted, fontSize: 11, lineHeight: 1.5 }}>
                    Das System überschreitet nie Ihre Limits und deaktiviert sich automatisch bei schwacher Performance.
                    Alle Aktionen werden im Boost-Verlauf protokolliert.
                  </p>
                </div>

                {/* Save */}
                {dirty && (
                  <motion.button
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ boxShadow: "0 0 18px rgba(79,140,255,0.3)" }}
                    whileTap={{ scale: 0.97 }}
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate(current)}
                    style={{
                      width: "100%", padding: "11px 0", borderRadius: 12,
                      background: C.grad, border: "none", color: "#fff",
                      fontWeight: 700, fontSize: 13, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      opacity: saveMutation.isPending ? 0.7 : 1,
                    }}
                  >
                    <CheckCircle2 style={{ width: 15, height: 15 }} />
                    {saveMutation.isPending ? "Speichern…" : "Einstellungen speichern"}
                  </motion.button>
                )}
              </div>
            ) : (
              <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${C.border}` }} className="pt-4">
                <PremiumGate
                  label="Upgrade auf Premium für Budget-Automatisierung, Timing-Optimierung und automatisches Pausieren."
                  onUpgrade={() => { window.location.href = "/billing"; }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SmartBoostRecommendations() {
  const [showAll, setShowAll] = useState(false);
  const isPremium = isPremiumUser();

  const { data: myData } = useQuery<{ restaurantId: number | null }>({
    queryKey: ["promotions-my"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/promotions/my`);
      if (!res.ok) return { restaurantId: null };
      return res.json();
    },
    staleTime: 60000,
  });
  const restaurantId = myData?.restaurantId ?? null;

  const { data, isLoading } = useQuery<RecoData>({
    queryKey: ["boost-recommendations", restaurantId],
    queryFn: async () => {
      if (!restaurantId) throw new Error("No restaurantId");
      const res = await fetch(`${API_BASE}/api/promotions/recommendations?restaurantId=${restaurantId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!restaurantId,
    staleTime: 120000,
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  });

  // ── Loading ──
  if (isLoading) return (
    <div style={{ backgroundColor: C.card, borderRadius: 20, border: `1px solid ${C.border}`, padding: 24, boxShadow: C.shadow }}>
      <div className="flex items-center gap-3 mb-5">
        <div style={{ background: C.grad, borderRadius: 12, width: 40, height: 40 }} className="flex items-center justify-center">
          <Sparkles style={{ width: 17, height: 17, color: "#fff" }} />
        </div>
        <div className="h-5 w-52 rounded animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.07)" }} />
      </div>
      {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl mb-3 animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />)}
    </div>
  );

  if (!data) return null;

  const displayed = showAll ? data.allScored : data.recommendations;
  const topReco   = data.recommendations[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ backgroundColor: C.card, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}
    >
      {/* ── Header ── */}
      <div style={{ padding: "24px 24px 0" }} className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div style={{ background: C.grad, borderRadius: 13, width: 44, height: 44, flexShrink: 0, boxShadow: "0 4px 16px rgba(79,140,255,0.3)" }} className="flex items-center justify-center">
            <Sparkles style={{ width: 20, height: 20, color: "#fff" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span style={{ color: C.text, fontWeight: 700, fontSize: 18 }}>Smart Boost-Empfehlungen</span>
            </div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
              Basierend auf Betriebstyp · Uhrzeit · Nachfrage · Verlauf
            </div>
          </div>
        </div>

        {/* Context chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5" style={{ color: C.muted, fontSize: 11, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 99, padding: "4px 10px" }}>
            <Clock style={{ width: 10, height: 10 }} /> {String(data.currentHour).padStart(2,"0")}:00 Uhr
          </span>
          <span className="flex items-center gap-1.5" style={{ color: C.muted, fontSize: 11, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 99, padding: "4px 10px" }}>
            Nachfrage: <DemandBadge score={data.demandScore} />
          </span>
          <span className="flex items-center gap-1.5" style={{ color: C.amber, fontSize: 11, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 99, padding: "4px 10px" }}>
            <Wallet style={{ width: 10, height: 10 }} /> €{data.walletEur.toFixed(2)}
          </span>
        </div>
      </div>

      <div style={{ padding: "0 24px 28px" }} className="space-y-4">

        {/* ── Global warning ── */}
        {data.globalWarning && (
          <div className="flex items-start gap-3 rounded-2xl px-4 py-3"
            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.22)" }}>
            <AlertTriangle style={{ width: 16, height: 16, color: C.red, flexShrink: 0, marginTop: 1 }} />
            <p style={{ color: "#FCA5A5", fontSize: 13, lineHeight: 1.5 }}>{data.globalWarning}</p>
          </div>
        )}

        {/* ── Top pick headline ── */}
        {!data.globalWarning && topReco && (
          <div className="flex items-center gap-2 rounded-2xl px-4 py-3 flex-wrap"
            style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <Target style={{ width: 14, height: 14, color: C.green, flexShrink: 0 }} />
            <p style={{ color: C.textSoft, fontSize: 12.5, lineHeight: 1.5 }}>
              <strong style={{ color: C.green }}>Heute empfohlen:</strong>{" "}
              {topReco.emoji} {topReco.label} · Zeitfenster {topReco.window}
              {isPremium && ` · Budget €${topReco.suggestedBudget}`}
            </p>
          </div>
        )}

        {/* ── Recommendation Cards ── */}
        <div className="space-y-3">
          {displayed.map((rec, i) => (
            <RecoCard key={rec.type} rec={rec} rank={i} isPremium={isPremium} />
          ))}
        </div>

        {/* ── Show all toggle ── */}
        <button
          onClick={() => setShowAll(s => !s)}
          style={{
            width: "100%", padding: "9px", borderRadius: 12, border: `1px solid ${C.border}`,
            background: "transparent", color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}
        >
          {showAll ? <><ChevronUp style={{ width: 13, height: 13 }} /> Weniger anzeigen</> : <><ChevronDown style={{ width: 13, height: 13 }} /> Alle Boost-Typen anzeigen ({data.allScored.length})</>}
        </button>

        {/* ── Auto Budget Optimization ── */}
        {restaurantId && (
          <AutoBudgetPanel restaurantId={restaurantId} isPremium={isPremium} />
        )}

        {/* ── Performance learning note ── */}
        {isPremium && (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
            style={{ backgroundColor: "rgba(79,140,255,0.04)", border: "1px solid rgba(79,140,255,0.12)" }}>
            <BrainCircuit style={{ width: 13, height: 13, color: C.blue, flexShrink: 0, marginTop: 1 }} />
            <p style={{ color: C.muted, fontSize: 11, lineHeight: 1.5 }}>
              Empfehlungen verbessern sich mit jedem Boost. Je mehr Daten gesammelt werden,
              desto präziser werden Timing- und Budget-Vorschläge.
            </p>
          </div>
        )}

      </div>
    </motion.div>
  );
}
