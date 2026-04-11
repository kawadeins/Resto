/**
 * WalletPanel — Boost Guthaben system.
 * Shows current balance, top-up options, and transaction history.
 * Balance must be positive before a boost can be activated.
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Plus, TrendingDown, TrendingUp, Clock, AlertTriangle,
  CheckCircle, ChevronDown, ChevronUp, Zap, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/contexts/session-context";
import { getCsrfToken } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

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
      className={cn("flex items-center gap-3 py-2.5", i > 0 && "border-t border-border/40")}
    >
      {/* Icon */}
      <div className={cn(
        "w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center",
        isTopup ? "bg-emerald-500/10" : "bg-primary/10"
      )}>
        {isTopup
          ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          : <TrendingDown className="w-3.5 h-3.5 text-primary" />
        }
      </div>

      {/* Label + date */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-snug truncate text-foreground">
          {tx.description}
        </p>
        <p className="text-[10px] mt-0.5 flex items-center gap-1 text-muted-foreground">
          <Clock className="w-2.5 h-2.5" />
          {fmtDate(tx.created_at)}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className={cn(
          "text-sm font-bold tabular-nums",
          isTopup ? "text-emerald-400" : "text-primary"
        )}>
          {isTopup ? "+" : "-"}{fmtEur(amount)}
        </p>
        {tx.balance_after !== null && (
          <p className="text-[10px] mt-0.5 tabular-nums text-muted-foreground">
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

export function WalletPanel({ restaurantId, compact = false }: WalletPanelProps) {
  const { toast } = useToast();
  const { csrfToken, refresh: refreshSession } = useSession();
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [customAmount, setCustomAmount]     = useState<string>("");
  const [showHistory, setShowHistory]       = useState(false);
  const [showTopup, setShowTopup]           = useState(false);

  const { data: wallet, isLoading } = useQuery<WalletData>({
    queryKey: ["wallet", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return { restaurantId: 0, balance: 0, isLow: false, isEmpty: true, transactions: [] };
      const res = await fetch(`${API_BASE}/api/wallet?restaurantId=${restaurantId}`, {
        credentials: "include",
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
      const token = getCsrfToken() ?? csrfToken;
      const res = await fetch(`${API_BASE}/api/wallet/topup`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-CSRF-Token": token } : {}),
        },
        body: JSON.stringify({ restaurantId, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Aufladung fehlgeschlagen");
      return data as { checkoutUrl: string; sessionId: string; amount: number };
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (err: Error) => toast({
      title: "Aufladung fehlgeschlagen",
      description: err.message ?? "Guthaben konnte nicht aufgeladen werden.",
      variant: "destructive",
    }),
  });

  const balance     = wallet?.balance ?? 0;
  const finalAmount = customAmount ? parseFloat(customAmount) : selectedAmount;
  const balanceCls  = balance <= 0 ? "text-destructive" : wallet?.isLow ? "text-amber-400" : "text-emerald-400";

  // ── Compact mode: just the balance chip ──────────────────────────────────────
  if (compact) {
    if (isLoading) return (
      <div className="h-8 w-28 rounded-full animate-pulse bg-muted/30" />
    );
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border",
        balance <= 0
          ? "bg-destructive/10 border-destructive/30 text-destructive"
          : wallet?.isLow
          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
          : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
      )}>
        <Wallet className="w-3.5 h-3.5" />
        <span className="tabular-nums">{fmtEur(balance)}</span>
        {balance <= 0 && <span className="font-semibold">Aufladen</span>}
      </div>
    );
  }

  // ── Full panel ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden"
    >
      {/* ── Panel header ── */}
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="gradient-btn w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center shadow-lg shadow-primary/25">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-base font-bold text-foreground">Boost-Guthaben</div>
            <div className="text-xs mt-0.5 text-muted-foreground">
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
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-full border flex-shrink-0",
              balance <= 0
                ? "bg-destructive/10 border-destructive/25"
                : wallet?.isLow
                ? "bg-amber-500/10 border-amber-500/25"
                : "bg-emerald-500/8 border-emerald-500/20"
            )}
          >
            {balance <= 0
              ? <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              : wallet?.isLow
              ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              : <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            }
            <span className={cn("text-sm font-extrabold tabular-nums", balanceCls)}>
              {fmtEur(balance)}
            </span>
          </motion.div>
        )}
        {isLoading && <div className="h-9 w-24 rounded-full animate-pulse bg-muted/30" />}
      </div>

      <div className="px-6 pb-6 space-y-4">

        {/* ── Low / empty balance warning ── */}
        <AnimatePresence>
          {!isLoading && (balance <= 0 || (wallet?.isLow ?? false)) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={cn(
                "rounded-xl p-3 flex items-start gap-2.5 border",
                balance <= 0
                  ? "bg-destructive/8 border-destructive/20"
                  : "bg-amber-500/8 border-amber-500/20"
              )}
            >
              <AlertTriangle className={cn("w-4 h-4 flex-shrink-0 mt-0.5", balance <= 0 ? "text-destructive" : "text-amber-400")} />
              <div>
                <p className={cn("text-xs font-semibold", balance <= 0 ? "text-destructive" : "text-amber-400")}>
                  {balance <= 0 ? "Kein Guthaben vorhanden" : "Niedriges Guthaben"}
                </p>
                <p className="text-[11px] mt-0.5 text-muted-foreground">
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
          whileTap={{ scale: 0.98 }}
          className={cn(
            "w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all",
            showTopup
              ? "bg-muted/50 border border-border text-foreground hover:bg-muted"
              : "gradient-btn shadow-lg shadow-primary/20 hover:shadow-primary/30"
          )}
        >
          <Plus className="w-4 h-4" />
          Guthaben aufladen
          {showTopup
            ? <ChevronUp className="w-3.5 h-3.5 ml-1 opacity-60" />
            : <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-60" />
          }
        </motion.button>

        {/* ── Top-up panel ── */}
        <AnimatePresence>
          {showTopup && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              style={{ overflow: "hidden" }}
            >
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">

                {/* Premium notice */}
                <div className="flex items-start gap-2 text-[11px] rounded-lg px-3 py-2.5 bg-primary/7 border border-primary/15 text-muted-foreground">
                  <Info className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                  <span>
                    {"Premium schaltet die Boost-Tools frei \u2014 das Guthaben bezahlt die tats\u00E4chliche Schaltung."}
                  </span>
                </div>

                {/* Preset amounts */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-3 text-muted-foreground">
                    Schnellauswahl
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {TOPUP_PRESETS.map(amt => (
                      <motion.button
                        key={amt}
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                        onClick={() => { setSelectedAmount(amt); setCustomAmount(""); }}
                        className={cn(
                          "h-11 rounded-xl text-sm font-bold cursor-pointer transition-all border",
                          selectedAmount === amt && !customAmount
                            ? "gradient-btn border-transparent shadow-md shadow-primary/20 text-white"
                            : "bg-muted/30 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {"\u20AC"}{amt}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Confirm button */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={topupMutation.isPending || !selectedAmount}
                  onClick={async () => {
                    if (!restaurantId || !selectedAmount) return;
                    if (!getCsrfToken() && !csrfToken) {
                      await refreshSession();
                    }
                    topupMutation.mutate(selectedAmount);
                  }}
                  className="w-full h-12 rounded-xl gradient-btn font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-lg shadow-primary/20"
                >
                  {topupMutation.isPending ? (
                    "Weiterleitung zu Stripe\u2026"
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      {`\u20AC${(finalAmount || selectedAmount).toFixed(2)} via Stripe aufladen`}
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Transaction history ── */}
        {(wallet?.transactions?.length ?? 0) > 0 && (
          <div className="rounded-xl border border-border bg-muted/10 overflow-hidden">
            <button
              onClick={() => setShowHistory(v => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/20 transition-colors cursor-pointer"
            >
              <span className="text-xs font-semibold flex items-center gap-2 text-foreground">
                <Clock className="w-3.5 h-3.5 text-primary" />
                Verlauf ({wallet!.transactions.length})
              </span>
              {showHistory
                ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </button>

            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden px-4 pb-3 border-t border-border/40"
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
          <p className="text-center text-xs py-2 text-muted-foreground">
            Noch keine Transaktionen
          </p>
        )}
      </div>
    </motion.div>
  );
}
