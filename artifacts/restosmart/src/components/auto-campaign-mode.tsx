import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const RESTAURANT_ID = 1;
const authHeader = () => ({ "x-user-email": localStorage.getItem("restosmart_owner_email") ?? "" });

const BOOST_META: Record<string, { label: string; emoji: string; window: string }> = {
  breakfast_boost:  { label: "Frühstücks-Boost",  emoji: "☕", window: "05:00–11:00 Uhr" },
  lunch_boost:      { label: "Mittags-Boost",       emoji: "🍽️", window: "10:00–15:00 Uhr" },
  happy_hour_boost: { label: "Happy Hour Boost",    emoji: "🍹", window: "14:00–20:00 Uhr" },
  nightlife_boost:  { label: "Nachtleben-Boost",    emoji: "🌙", window: "18:00–02:00 Uhr" },
  local_spotlight:  { label: "Local Spotlight",     emoji: "⭐", window: "Ganztags" },
  local_heat_boost: { label: "Heat-Map Boost",      emoji: "🔥", window: "Ganztags" },
};

const ACTION_META: Record<string, { label: string; color: string; icon: string }> = {
  activated:           { label: "Automatisch aktiviert",         color: "#22c55e", icon: "▶" },
  paused:              { label: "Automatisch pausiert",          color: "#f97316", icon: "⏸" },
  waiting:             { label: "Wartet auf besseres Zeitfenster", color: "#60a5fa", icon: "⏳" },
  skipped_low_wallet:  { label: "Nicht gestartet — Guthaben",   color: "#ef4444", icon: "💳" },
  skipped_budget_limit:{ label: "Budgetlimit erreicht",          color: "#ef4444", icon: "🚫" },
  already_active:      { label: "Bereits aktiv",                 color: "#a3a3a3", icon: "✓" },
  error:               { label: "Fehler",                        color: "#ef4444", icon: "⚠" },
};

const STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  active:  { label: "Automatisch aktiv",   color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  paused:  { label: "Automatisch pausiert", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  waiting: { label: "Wartet auf Zeitfenster", color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
};

interface AutoCampaignModeProps {
  isPremium: boolean;
  onUpgradeClick: () => void;
}

export function AutoCampaignMode({ isPremium, onUpgradeClick }: AutoCampaignModeProps) {
  const qc = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editSettings, setEditSettings] = useState<any>(null);
  const [runResult, setRunResult] = useState<any>(null);
  const [showLog, setShowLog] = useState(false);

  // ── Load current state ────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["auto-campaign-log", RESTAURANT_ID],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/promotions/auto-campaign/log?restaurantId=${RESTAURANT_ID}`);
      return r.json();
    },
    refetchInterval: 5 * 60 * 1000,
    enabled: isPremium,
  });

  const settings  = data?.settings  ?? null;
  const logItems  = data?.log        ?? [];
  const boostStatus = data?.boostStatus ?? {};

  // ── Init editSettings from loaded data ────────────────────────────────────
  useEffect(() => {
    if (settings && !editSettings) {
      setEditSettings({
        enabled:               settings.enabled ?? false,
        daily_max_cents:       settings.daily_max_cents   ?? 1000,
        weekly_max_cents:      settings.weekly_max_cents  ?? 5000,
        min_wallet_balance_cents: settings.min_wallet_balance_cents ?? 500,
        allowed_boost_types:   settings.allowed_boost_types ?? Object.keys(BOOST_META),
        auto_pause_low_roi:    settings.auto_pause_low_roi ?? true,
      });
    }
  }, [settings, editSettings]);

  // ── Toggle auto mode ──────────────────────────────────────────────────────
  const buildPutBody = (overrides: Record<string, any> = {}) => ({
    restaurantId:        RESTAURANT_ID,
    enabled:             editSettings?.enabled              ?? false,
    dailyMaxEur:         (editSettings?.daily_max_cents     ?? 1000) / 100,
    weeklyMaxEur:        (editSettings?.weekly_max_cents    ?? 5000) / 100,
    minWalletBalanceEur: (editSettings?.min_wallet_balance_cents ?? 500) / 100,
    allowedBoostTypes:   editSettings?.allowed_boost_types  ?? Object.keys(BOOST_META),
    autoPauseLowROI:     editSettings?.auto_pause_low_roi   ?? true,
    ...overrides,
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const r = await fetch(`${API_BASE}/api/promotions/auto-budget-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(buildPutBody({ enabled })),
      });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["auto-campaign-log"] }); refetch(); },
  });

  // ── Save settings ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/api/promotions/auto-budget-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(buildPutBody()),
      });
      return r.json();
    },
    onSuccess: () => { setSettingsOpen(false); refetch(); },
  });

  // ── Run evaluation ────────────────────────────────────────────────────────
  const runMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/api/promotions/auto-campaign/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ restaurantId: RESTAURANT_ID }),
      });
      return r.json();
    },
    onSuccess: (res) => {
      setRunResult(res);
      refetch();
      qc.invalidateQueries({ queryKey: ["promotions"] });
    },
  });

  const isEnabled = editSettings?.enabled ?? settings?.enabled ?? false;

  // ── Premium gate ──────────────────────────────────────────────────────────
  if (!isPremium) {
    return (
      <div style={{
        background: "linear-gradient(135deg,rgba(124,58,237,0.08),rgba(124,58,237,0.04))",
        border: "1px solid rgba(124,58,237,0.25)", borderRadius: 16, padding: 28, marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, flexShrink: 0,
          }}>{"🤖"}</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>
                {"Automatischer Kampagnenmodus"}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: "#7c3aed", background: "rgba(124,58,237,0.2)",
                borderRadius: 6, padding: "2px 8px", letterSpacing: "0.04em",
              }}>{"PREMIUM"}</span>
            </div>
            <div style={{ fontSize: 13, color: "#a3a3a3", marginTop: 3 }}>
              {"Lass das System deine Kampagnen automatisch steuern"}
            </div>
          </div>
        </div>
        <div style={{
          background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: "16px 20px", marginBottom: 18,
        }}>
          <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6 }}>
            {"Mit Premium kann RestoMaster deine Boosts automatisch optimieren — "
             + "es aktiviert Kampagnen zum richtigen Zeitpunkt, pausiert schwache Boosts "
             + "und schützt dein Budget rund um die Uhr."}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          {[
            { icon: "▶", text: "Automatisch aktivieren" },
            { icon: "⏸", text: "Schwache Boosts pausieren" },
            { icon: "💰", text: "Budget schützen" },
            { icon: "📊", text: "ROI maximieren" },
          ].map(f => (
            <div key={f.text} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "7px 12px",
              fontSize: 12, color: "#d1d5db",
            }}>
              <span style={{ color: "#7c3aed" }}>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
        <button onClick={onUpgradeClick} style={{
          background: "linear-gradient(135deg,#f59e0b,#f97316)", color: "#000",
          fontWeight: 700, fontSize: 14, border: "none", borderRadius: 10,
          padding: "11px 22px", cursor: "pointer",
        }}>
          {"🔒 Upgrade auf Premium"}
        </button>
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: "0 0 4px", marginBottom: 24, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 24px", borderBottom: isEnabled ? "1px solid rgba(34,197,94,0.15)" : "1px solid rgba(255,255,255,0.06)",
        background: isEnabled ? "rgba(34,197,94,0.04)" : "transparent",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13,
            background: isEnabled
              ? "linear-gradient(135deg,#22c55e,#16a34a)"
              : "linear-gradient(135deg,#374151,#1f2937)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, transition: "background 0.3s",
          }}>{"🤖"}</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
                {"Automatischer Kampagnenmodus"}
              </span>
              {isEnabled && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: "#22c55e",
                  background: "rgba(34,197,94,0.15)", borderRadius: 5, padding: "2px 7px",
                  letterSpacing: "0.04em",
                }}>{"AKTIV"}</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
              {isEnabled
                ? "System verwaltet deine Kampagnen automatisch"
                : "Kampagnen werden manuell gesteuert"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Settings button */}
          <button onClick={() => setSettingsOpen(o => !o)} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 9, padding: "7px 12px", cursor: "pointer", color: "#9ca3af",
            fontSize: 13, display: "flex", alignItems: "center", gap: 6,
          }}>
            {"⚙"} {"Limits"}
          </button>
          {/* Toggle */}
          <button
            onClick={() => {
              const next = !isEnabled;
              setEditSettings((s: any) => ({ ...s, enabled: next }));
              toggleMutation.mutate(next);
            }}
            disabled={toggleMutation.isPending}
            style={{
              position: "relative", width: 52, height: 28, borderRadius: 14,
              background: isEnabled ? "#22c55e" : "#374151",
              border: "none", cursor: "pointer", transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            <span style={{
              position: "absolute", top: 3,
              left: isEnabled ? 26 : 3, width: 22, height: 22,
              background: "#fff", borderRadius: "50%", transition: "left 0.2s",
              display: "block",
            }} />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {settingsOpen && editSettings && (
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.2)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb", marginBottom: 16 }}>
            {"Ausgabelimits"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
            {[
              { key: "daily_max_cents",         label: "Tageslimit (€)", div: 100 },
              { key: "weekly_max_cents",         label: "Wochenlimit (€)", div: 100 },
              { key: "min_wallet_balance_cents", label: "Mindestguthaben (€)", div: 100 },
            ].map(({ key, label, div }) => (
              <label key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{label}</span>
                <input
                  type="number"
                  min={0}
                  value={editSettings[key] / div}
                  onChange={e => setEditSettings((s: any) => ({ ...s, [key]: Math.round(Number(e.target.value) * div) }))}
                  style={{
                    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 14, width: "100%",
                  }}
                />
              </label>
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb", marginBottom: 12 }}>
            {"Erlaubte Boost-Typen"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {Object.entries(BOOST_META).map(([type, meta]) => {
              const allowed = (editSettings.allowed_boost_types ?? []).includes(type);
              return (
                <button
                  key={type}
                  onClick={() => setEditSettings((s: any) => ({
                    ...s,
                    allowed_boost_types: allowed
                      ? (s.allowed_boost_types ?? []).filter((t: string) => t !== type)
                      : [...(s.allowed_boost_types ?? []), type],
                  }))}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: allowed ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                    border: allowed ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, padding: "7px 12px", cursor: "pointer",
                    color: allowed ? "#22c55e" : "#9ca3af", fontSize: 12,
                  }}
                >
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                  {allowed && <span style={{ fontWeight: 700 }}>{"✓"}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <div
                onClick={() => setEditSettings((s: any) => ({ ...s, auto_pause_low_roi: !s.auto_pause_low_roi }))}
                style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: editSettings.auto_pause_low_roi ? "#22c55e" : "#374151",
                  position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
                }}
              >
                <span style={{
                  position: "absolute", top: 2,
                  left: editSettings.auto_pause_low_roi ? 20 : 2,
                  width: 18, height: 18, background: "#fff", borderRadius: "50%",
                  transition: "left 0.2s", display: "block",
                }} />
              </div>
              <span style={{ fontSize: 13, color: "#d1d5db" }}>
                {"Schwache Boosts automatisch pausieren (ROI-Schutz)"}
              </span>
            </label>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              style={{
                background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
                color: "#fff", border: "none", borderRadius: 9,
                padding: "9px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}
            >
              {saveMutation.isPending ? "Speichern..." : "Speichern"}
            </button>
            <button
              onClick={() => setSettingsOpen(false)}
              style={{
                background: "rgba(255,255,255,0.06)", color: "#9ca3af",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 9, padding: "9px 18px", cursor: "pointer", fontSize: 13,
              }}
            >
              {"Abbrechen"}
            </button>
          </div>
        </div>
      )}

      {/* Live boost status grid */}
      {isEnabled && (
        <div style={{ padding: "18px 24px 0" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
            {"Live-Status"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10, marginBottom: 18 }}>
            {Object.entries(BOOST_META).map(([type, meta]) => {
              const bs   = boostStatus[type];
              const sd   = bs ? STATUS_DISPLAY[bs.status] : null;
              const allowed = (editSettings?.allowed_boost_types ?? Object.keys(BOOST_META)).includes(type);
              return (
                <div key={type} style={{
                  background: sd ? sd.bg : "rgba(255,255,255,0.03)",
                  border: sd
                    ? "1px solid " + sd.color + "30"
                    : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 10, padding: "12px 14px",
                  opacity: !allowed ? 0.45 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                    <span style={{ fontSize: 15 }}>{meta.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>{meta.label}</span>
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 600,
                    color: sd ? sd.color : (allowed ? "#6b7280" : "#4b5563"),
                  }}>
                    {sd
                      ? sd.label
                      : (allowed ? "Wartet auf Zeitfenster" : "Nicht erlaubt")}
                  </div>
                  {bs && (
                    <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>
                      {bs.clicks} Klicks · {bs.impressions} Einbl.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Run now + Last run result */}
      {isEnabled && (
        <div style={{ padding: "0 24px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              style={{
                background: runMutation.isPending
                  ? "rgba(255,255,255,0.06)"
                  : "linear-gradient(135deg,#1d4ed8,#3b82f6)",
                color: runMutation.isPending ? "#6b7280" : "#fff",
                border: "none", borderRadius: 9, padding: "9px 18px",
                cursor: runMutation.isPending ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7,
              }}
            >
              {runMutation.isPending ? "⏳ Analysiere..." : "▶ Jetzt auswerten"}
            </button>
            {runResult && !runMutation.isPending && (
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                {runResult.summary && (
                  <>
                    {runResult.summary.activated > 0 && (
                      <span style={{ color: "#22c55e", marginRight: 10 }}>
                        {"▶ " + runResult.summary.activated + " aktiviert"}
                      </span>
                    )}
                    {runResult.summary.paused > 0 && (
                      <span style={{ color: "#f97316", marginRight: 10 }}>
                        {"⏸ " + runResult.summary.paused + " pausiert"}
                      </span>
                    )}
                    {runResult.summary.waiting > 0 && (
                      <span style={{ color: "#60a5fa" }}>
                        {"⏳ " + runResult.summary.waiting + " wartend"}
                      </span>
                    )}
                  </>
                )}
                {runResult.skipped && (
                  <span style={{ color: "#6b7280" }}>{"Automodus deaktiviert"}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log */}
      <div style={{ padding: "0 24px 20px" }}>
        <button
          onClick={() => setShowLog(o => !o)}
          style={{
            display: "flex", alignItems: "center", gap: 7, background: "none",
            border: "none", cursor: "pointer", color: "#6b7280", fontSize: 12, padding: 0,
          }}
        >
          <span style={{ transform: showLog ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "block" }}>{"▾"}</span>
          {"Entscheidungsprotokoll (" + logItems.length + " Einträge)"}
        </button>

        {showLog && (
          <div style={{ marginTop: 12 }}>
            {logItems.length === 0 ? (
              <div style={{
                fontSize: 13, color: "#4b5563", textAlign: "center",
                padding: "20px 0", background: "rgba(255,255,255,0.02)",
                borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)",
              }}>
                {"Noch keine automatischen Aktionen — starte die Auswertung"}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
                {logItems.map((item: any) => {
                  const am = ACTION_META[item.action] ?? { label: item.action, color: "#9ca3af", icon: "•" };
                  const bm = BOOST_META[item.boost_type];
                  const when = new Date(item.created_at).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={item.id} style={{
                      display: "flex", gap: 12, alignItems: "flex-start",
                      background: "rgba(255,255,255,0.025)", borderRadius: 9,
                      padding: "10px 14px",
                      borderLeft: "3px solid " + am.color,
                    }}>
                      <span style={{ fontSize: 14, flexShrink: 0, color: am.color }}>{am.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: am.color }}>{am.label}</span>
                          {bm && (
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>
                              {bm.emoji + " " + bm.label}
                            </span>
                          )}
                          {item.confidence != null && (
                            <span style={{
                              fontSize: 10, color: "#6b7280",
                              background: "rgba(255,255,255,0.06)",
                              borderRadius: 5, padding: "1px 6px",
                            }}>
                              {"Score " + item.confidence + "%"}
                            </span>
                          )}
                          <span style={{ fontSize: 10, color: "#4b5563", marginLeft: "auto" }}>{when}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>{item.reason}</div>
                        {item.action === "activated" && item.wallet_before != null && (
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                            {"€" + Number(item.wallet_before).toFixed(2) + " → €" + Number(item.wallet_after).toFixed(2) + " Guthaben"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
