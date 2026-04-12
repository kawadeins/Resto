/**
 * XpToast — floating XP gain animation system
 *
 * Usage:
 *   const { gainXp } = useXpGain();
 *   gainXp(15, "Buchung");   // shows "+15 XP" floating up and fading out
 *
 * Mount <XpToastLayer /> once at App root.
 */

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────

interface XpEntry {
  id: number;
  amount: number;
  label?: string;
}

interface XpCtx {
  gainXp: (amount: number, label?: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const XpContext = createContext<XpCtx>({ gainXp: () => {} });

export function useXpGain() {
  return useContext(XpContext);
}

// ── Provider + Layer ──────────────────────────────────────────────────────────

export function XpToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<XpEntry[]>([]);
  const nextId = useRef(0);

  const gainXp = useCallback((amount: number, label?: string) => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, amount, label }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 1600);
  }, []);

  return (
    <XpContext.Provider value={{ gainXp }}>
      {children}
      <XpToastLayer toasts={toasts} />
    </XpContext.Provider>
  );
}

// ── Toast Layer ───────────────────────────────────────────────────────────────

function XpToastLayer({ toasts }: { toasts: XpEntry[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-24 right-4 z-[200] flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 0, scale: 0.85 }}
            animate={{ opacity: 1, y: -16, scale: 1 }}
            exit={{ opacity: 0, y: -48, scale: 0.8 }}
            transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-primary to-accent text-white text-[13px] font-extrabold shadow-xl shadow-primary/30"
          >
            <span className="text-[15px] leading-none">⭐</span>
            <span>+{t.amount} XP</span>
            {t.label && (
              <span className="text-white/70 text-[11px] font-semibold">· {t.label}</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Standalone inline XP pop (for use directly next to a button) ───────────────

export function XpPop({ amount, label }: { amount: number; label?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 4, scale: 0.7 }}
      animate={{ opacity: 1, y: -6, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.6 }}
      transition={{ duration: 0.5 }}
      className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-black text-primary whitespace-nowrap pointer-events-none"
    >
      +{amount} XP{label ? ` · ${label}` : ""}
    </motion.span>
  );
}
