/**
 * WalletPanel — Boost Guthaben system.
 * Shows current balance, top-up options, and transaction history.
 * Balance must be positive before a boost can be activated.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Plus, TrendingDown, TrendingUp, Clock, AlertTriangle,
  CheckCircle, ChevronDown, ChevronUp, Zap, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ── Design tokens (mirror promotion-tools) ────────────────────────────────────
const C = {
  card:   "#121826",
  border: "rgba(255,255,255,0.06)",
  grad:   "linear-gradient(135deg,#4F8CFF,#7B5CFF)",
  active: "#22C55E",
  paused: "#F59E0B",
  danger: "#EF4444",
  text:   "#FFFFFF",
  muted:  "#9CA3AF",
  shadow: "0 10px 30px rgba(0,0,0,0.35)",
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface WalletTransaction {
  id: number;
  type: "topup" | "boost_spend" | "refund";
  amount: string;
  description: string;
  boost_type: string | null;
  balance_after: string | null;
  created_at: string;
}

interface WalletData {
  restaurantId: number;
  balance: number;
  isLow: boolean;
  isEmpty: boolean;
  transactions: WalletTransaction[];
}

// ── Quick top-up amounts ──────────────────────────────────────────────────────
const TOPUP_PRESETS = [5, 10, 20, 50];

// ── Format helpers ────────────────────────────────────────────────────────────

function fmtEur(val: number | string): string {
  return "\u20AC" + parseFloat(String(val)).toFixed(2);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-AT", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// ── Transaction row ───────────────────────────────────────────────────────────

function TxRow({ tx, i }: { tx: WalletTransaction; i: number }) {
  const isTopup = tx.type === "topup" || tx.type === "refund";
  const amount  = parseFloat(tx.amount);

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.04 }}
      className="flex items-center gap-3"
      style={{ padding: "10px 0", borderTop: i > 0 ? `1px solid ${C.border}` : undefined }}
    >
      {/* Icon */}
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        backgroundColor: isTopup ? "rgba(34,197,94,0.1)" : "rgba(79,140,255,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {isTopup
          ? <TrendingUp  style={{ width: 14, height: 14, color: C.active }} />
          : <TrendingDown style={{ width: 14, height: 14, color: "#7B8CFF" }} />
        }
      </div>

      {/* Label + date */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="text-xs font-medium leading-snug truncate" style={{ color: C.text }}>
          {tx.description}
        </p>
        <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: C.muted }}>
          <Clock style={{ width: 10, height: 10 }} />
          {fmtDate(tx.created_at)}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className="text-sm font-bold tabular-nums" style={{ color: isTopup ? C.active : "#a5b4fc" }}>
          {isTopup ? "+" : "-"}{fmtEur(amount)}
        </p>
        {tx.balance_after !== null && (
          <p className="text-[10px] mt-0.5 tabular-nums" style={{ color: C.muted }}>
            {"= "}{fmtEur(tx.balance_after)}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface WalletPanelProps {
  restaurantId: number | null;
  compact?: boolean;
}

function getOwnerEmail(): string {
  return localStorage.getItem("restosmart_owner_email") ?? "";
}

export function WalletPanel({ restaurantId, compact = false }: WalletPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [customAmount, setCustomAmount]     = useState<string>("");
  const [showHistory, setShowHistory]       = useState(false);
  const [showTopup, setShowTopup]           = useState(false);

  const { data: wallet, isLoading } = useQuery<WalletData>({
    queryKey: ["wallet", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return { restaurantId: 0, balance: 0, isLow: false, isEmpty: true, transactions: [] };
      const res = await fetch(`${API_BASE}/api/wallet?restaurantId=${restaurantId}`, {
        headers: { "x-user-email": getOwnerEmail() },
      });
      if (!res.ok) return { restaurantId: restaurantId ?? 0, balance: 0, isLow: false, isEmpty: true, transactions: [] };
      return res.json();
    },
    enabled: !!restaurantId,
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const topupMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch(`${API_BASE}/api/wallet/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": getOwnerEmail() },
        body: JSON.stringify({ restaurantId, amount }),
      });
      if (!res.ok) throw new Error("Top-up fehlgeschlagen");
      return res.json() as Promise<{ balance: number; transaction: WalletTransaction }>;
    },
    onSuccess: (data) => {
      toast({
        title: `\u2705 Guthaben aufgeladen!`,
        description: `Neues Guthaben: ${fmtEur(data.balance)}`,
      });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      setShowTopup(false);
      setCustomAmount("");
    },
    onError: () => toast({ title: "Aufladung fehlgeschlagen", variant: "destructive" }),
  });

  const finalAmount = customAmount ? parseFloat(customAmount) : selectedAmount;
  const balance     = wallet?.balance ?? 0;
  const balanceColor = balance <= 0 ? C.danger : wallet?.isLow ? C.paused : C.active;

  // ── Compact mode: just the balance chip (used inside boost page header) ──────
  if (compact) {
    if (isLoading) return (
      <div className="h-8 w-28 rounded-full animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
    );
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 12px", borderRadius: 999,
        backgroundColor: balance <= 0 ? "rgba(239,68,68,0.1)" : wallet?.isLow ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)",
        border: `1px solid ${balance <= 0 ? "rgba(239,68,68,0.3)" : wallet?.isLow ? "rgba(245,158,11,0.3)" : "rgba(34,197,94,0.3)"}`,
      }}>
        <Wallet style={{ width: 13, height: 13, color: balanceColor }} />
        <span className="text-xs font-bold tabular-nums" style={{ color: balanceColor }}>
          {fmtEur(balance)}
        </span>
        {balance <= 0 && (
          <span className="text-[10px] font-semibold" style={{ color: C.danger }}>Aufladen</span>
        )}
      </div>
    );
  }

  // ── Full panel ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        backgroundColor: C.card, borderRadius: 20,
        border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden",
      }}
    >
      {/* ── Panel header ── */}
      <div style={{ padding: "20px 24px 16px" }} className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div style={{ background: C.grad, borderRadius: 12, width: 38, height: 38, flexShrink: 0, boxShadow: "0 4px 14px rgba(79,140,255,0.28)" }} className="flex items-center justify-center">
            <Wallet style={{ width: 16, height: 16, color: "#fff" }} />
          </div>
          <div>
            <div className="text-base font-bold" style={{ color: C.text }}>Boost-Guthaben</div>
            <div className="text-xs mt-0.5" style={{ color: C.muted }}>
              Guthaben wird beim Aktivieren von Boosts abgezogen
            </div>
          </div>
        </div>

        {/* Balance chip */}
        {!isLoading && (
          <motion.div
            key={balance}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 999,
              backgroundColor: balance <= 0 ? "rgba(239,68,68,0.1)" : wallet?.isLow ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.08)",
              border: `1px solid ${balance <= 0 ? "rgba(239,68,68,0.3)" : wallet?.isLow ? "rgba(245,158,11,0.3)" : "rgba(34,197,94,0.25)"}`,
              flexShrink: 0,
            }}
          >
            {balance <= 0
              ? <AlertTriangle style={{ width: 14, height: 14, color: C.danger }} />
              : wallet?.isLow
              ? <AlertTriangle style={{ width: 14, height: 14, color: C.paused }} />
              : <CheckCircle style={{ width: 14, height: 14, color: C.active }} />
            }
            <span className="text-sm font-extrabold tabular-nums" style={{ color: balanceColor }}>
              {fmtEur(balance)}
            </span>
          </motion.div>
        )}
        {isLoading && <div className="h-9 w-24 rounded-full animate-pulse" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />}
      </div>

      <div style={{ padding: "0 24px 24px" }} className="space-y-4">

        {/* ── Low / empty balance warning ── */}
        <AnimatePresence>
          {!isLoading && (balance <= 0 || (wallet?.isLow ?? false)) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                borderRadius: 12, padding: "12px 14px",
                backgroundColor: balance <= 0 ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                border: `1px solid ${balance <= 0 ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`,
                display: "flex", alignItems: "flex-start", gap: 10,
              }}
            >
              <AlertTriangle style={{ width: 15, height: 15, color: balance <= 0 ? C.danger : C.paused, flexShrink: 0, marginTop: 1 }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: balance <= 0 ? C.danger : C.paused }}>
                  {balance <= 0 ? "Kein Guthaben vorhanden" : "Niedriges Guthaben"}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>
                  {balance <= 0
                    ? "Du ben\u00F6tigst Guthaben, um Boosts zu aktivieren. Lade jetzt auf."
                    : "Dein Guthaben reicht bald nicht mehr aus. Jetzt Guthaben aufladen."
                  }
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Quick top-up trigger ── */}
        <motion.button
          onClick={() => setShowTopup(v => !v)}
          whileHover={{ boxShadow: "0 0 20px rgba(79,140,255,0.35)", scale: 1.005 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: "100%", height: 48, borderRadius: 14,
            background: showTopup ? "rgba(255,255,255,0.06)" : C.grad,
            border: showTopup ? `1px solid ${C.border}` : "none",
            color: "#fff", fontWeight: 600, fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            cursor: "pointer",
          }}
        >
          <Plus style={{ width: 16, height: 16 }} />
          Guthaben aufladen
          {showTopup
            ? <ChevronUp  style={{ width: 14, height: 14, marginLeft: 4, opacity: 0.7 }} />
            : <ChevronDown style={{ width: 14, height: 14, marginLeft: 4, opacity: 0.7 }} />
          }
        </motion.button>

        {/* ── Top-up panel ── */}
        <AnimatePresence>
          {showTopup && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ borderRadius: 14, border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.02)", padding: 18 }} className="space-y-4">

                {/* Premium ≠ free boosts notice */}
                <div className="flex items-start gap-2 text-[11px] rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: "rgba(79,140,255,0.07)", border: "1px solid rgba(79,140,255,0.14)", color: C.muted }}>
                  <Info style={{ width: 12, height: 12, color: "#7B8CFF", flexShrink: 0, marginTop: 1 }} />
                  <span>
                    {"Premium schaltet die Boost-Tools frei \u2014 das Guthaben bezahlt die tats\u00E4chliche Schaltung."}
                  </span>
                </div>

                {/* Preset amounts */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: C.muted }}>
                    Schnellauswahl
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {TOPUP_PRESETS.map(amt => (
                      <motion.button
                        key={amt}
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => { setSelectedAmount(amt); setCustomAmount(""); }}
                        style={{
                          height: 44, borderRadius: 12, fontSize: 13, fontWeight: 700,
                          cursor: "pointer",
                          background: selectedAmount === amt && !customAmount ? C.grad : "rgba(255,255,255,0.04)",
                          border: selectedAmount === amt && !customAmount ? "none" : `1px solid ${C.border}`,
                          color: selectedAmount === amt && !customAmount ? "#fff" : C.muted,
                          boxShadow: selectedAmount === amt && !customAmount ? "0 0 14px rgba(79,140,255,0.25)" : "none",
                        }}
                      >
                        {"\u20AC"}{amt}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Custom amount */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>
                    Eigener Betrag
                  </p>
                  <input
                    type="number" min={1} max={500} step={0.5}
                    placeholder={`Betrag in \u20AC (1 \u2013 500)`}
                    value={customAmount}
                    onChange={e => { setCustomAmount(e.target.value); }}
                    style={{
                      width: "100%", height: 42, borderRadius: 10,
                      border: `1px solid ${customAmount ? "rgba(79,140,255,0.4)" : C.border}`,
                      backgroundColor: "rgba(255,255,255,0.04)",
                      color: C.text, fontSize: 13, padding: "0 12px", outline: "none",
                    }}
                  />
                </div>

                {/* Confirm button */}
                <motion.button
                  whileHover={{ boxShadow: "0 0 20px rgba(79,140,255,0.4)" }}
                  whileTap={{ scale: 0.97 }}
                  disabled={topupMutation.isPending || !finalAmount || finalAmount < 1}
                  onClick={() => {
                    if (!restaurantId || !finalAmount || finalAmount < 1) return;
                    topupMutation.mutate(finalAmount);
                  }}
                  style={{
                    width: "100%", height: 46, borderRadius: 12,
                    background: (!finalAmount || finalAmount < 1) ? "rgba(255,255,255,0.06)" : C.grad,
                    border: "none", color: "#fff", fontWeight: 700, fontSize: 14,
                    cursor: (!finalAmount || finalAmount < 1) ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    opacity: topupMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {topupMutation.isPending ? (
                    "Wird aufgeladen\u2026"
                  ) : (
                    <>
                      <Zap style={{ width: 15, height: 15 }} />
                      {finalAmount >= 1 ? `Jetzt \u20AC${finalAmount.toFixed(2)} aufladen` : "Betrag w\u00E4hlen"}
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Transaction history ── */}
        {(wallet?.transactions?.length ?? 0) > 0 && (
          <div style={{ borderRadius: 14, border: `1px solid ${C.border}`, backgroundColor: "rgba(255,255,255,0.015)", overflow: "hidden" }}>
            <button
              onClick={() => setShowHistory(v => !v)}
              className="w-full flex items-center justify-between gap-2 text-left"
              style={{ padding: "12px 16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <span className="text-xs font-semibold flex items-center gap-2" style={{ color: C.text }}>
                <Clock style={{ width: 13, height: 13, color: "#7B8CFF" }} />
                Verlauf ({wallet!.transactions.length})
              </span>
              {showHistory
                ? <ChevronUp  style={{ width: 14, height: 14, color: C.muted }} />
                : <ChevronDown style={{ width: 14, height: 14, color: C.muted }} />
              }
            </button>

            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: "hidden", padding: "0 16px 12px", borderTop: `1px solid ${C.border}` }}
                >
                  {wallet!.transactions.map((tx, i) => (
                    <TxRow key={tx.id} tx={tx} i={i} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (wallet?.transactions?.length ?? 0) === 0 && (
          <p className="text-center text-xs py-2" style={{ color: C.muted }}>
            Noch keine Transaktionen
          </p>
        )}
      </div>
    </motion.div>
  );
}
