import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Bell, X, CheckCheck, Calendar, Users, Star, AlertTriangle,
  CheckCircle2, XCircle, Zap, Info, ChevronRight, Wallet,
  TrendingDown, Clock, MessageSquare, BarChart2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/contexts/session-context";

const API = ((import.meta.env.VITE_API_URL as string | undefined) ?? "") + "/api";

interface SmartNotification {
  id: number;
  type: string;
  priority: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

const TYPE_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  new_reservation:              { icon: Calendar,       color: "text-blue-400",    bg: "bg-blue-500/10"    },
  new_group_request:            { icon: Users,          color: "text-violet-400",  bg: "bg-violet-500/10"  },
  new_review:                   { icon: Star,           color: "text-amber-400",   bg: "bg-amber-500/10"   },
  critical_review:              { icon: AlertTriangle,  color: "text-rose-400",    bg: "bg-rose-500/10"    },
  wallet_low:                   { icon: Wallet,         color: "text-orange-400",  bg: "bg-orange-500/10"  },
  campaign_action:              { icon: Zap,            color: "text-primary",     bg: "bg-primary/10"     },
  campaign_underperforming:     { icon: TrendingDown,   color: "text-amber-400",   bg: "bg-amber-500/10"   },
  reservation_confirmed:        { icon: CheckCircle2,   color: "text-emerald-400", bg: "bg-emerald-500/10" },
  reservation_load:             { icon: Clock,          color: "text-blue-400",    bg: "bg-blue-500/10"    },
  boost_suggestion:             { icon: Zap,            color: "text-primary",     bg: "bg-primary/10"     },
  review_reply_pending:         { icon: MessageSquare,  color: "text-rose-400",    bg: "bg-rose-500/10"    },
  performance_alert:            { icon: BarChart2,      color: "text-amber-400",   bg: "bg-amber-500/10"   },
};

function getMeta(type: string) {
  return TYPE_META[type] ?? { icon: Info, color: "text-muted-foreground", bg: "bg-muted/30" };
}

const PRIORITY_LABEL: Record<string, { label: string; dot: string }> = {
  critical:      { label: "Kritisch",  dot: "bg-rose-500"   },
  important:     { label: "Wichtig",   dot: "bg-sidebar-primary" },
  informational: { label: "Info",      dot: "bg-blue-400"   },
  suggestion:    { label: "Vorschlag", dot: "bg-amber-400"  },
};

function priorityOrder(p: string) {
  return { critical: 0, important: 1, informational: 2, suggestion: 3 }[p] ?? 4;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} Min.`;
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${d} Tag${d > 1 ? "en" : ""}`;
}

function groupByPriority(notifications: SmartNotification[]) {
  const sorted = [...notifications].sort((a, b) =>
    priorityOrder(a.priority) - priorityOrder(b.priority)
  );
  const groups = new Map<string, SmartNotification[]>();
  for (const n of sorted) {
    if (!groups.has(n.priority)) groups.set(n.priority, []);
    groups.get(n.priority)!.push(n);
  }
  return groups;
}

const RESTAURANT_ID = 1;

export function OwnerNotificationBell() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { csrfToken } = useSession();
  const qc = useQueryClient();

  // ── Auto-trigger prediction on mount ──────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/smart-notifications/predict/business`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: RESTAURANT_ID }),
    })
      .then(() => qc.invalidateQueries({ queryKey: ["sn-count-business"] }))
      .catch(() => {/* silent */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: countData } = useQuery({
    queryKey: ["sn-count-business"],
    queryFn: async () => {
      const r = await fetch(`${API}/smart-notifications/unread-count?userType=business&restaurantId=${RESTAURANT_ID}`);
      return r.ok ? r.json() : { count: 0 };
    },
    refetchInterval: 120000,
    staleTime: 60000,
  });

  const { data: notifications = [] } = useQuery<SmartNotification[]>({
    queryKey: ["sn-list-business"],
    queryFn: async () => {
      const r = await fetch(`${API}/smart-notifications?userType=business&restaurantId=${RESTAURANT_ID}`);
      return r.ok ? r.json() : [];
    },
    enabled: open,
    staleTime: 15000,
  });

  const csrfHdr = csrfToken ? { "X-CSRF-Token": csrfToken } : {};

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${API}/smart-notifications/${id}/read`, {
        method: "PATCH",
        headers: csrfHdr,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sn-count-business"] });
      qc.invalidateQueries({ queryKey: ["sn-list-business"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch(`${API}/smart-notifications/read-all`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHdr },
        body: JSON.stringify({ userType: "business", restaurantId: String(RESTAURANT_ID) }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sn-count-business"] });
      qc.invalidateQueries({ queryKey: ["sn-list-business"] });
    },
  });

  const handleClickNotification = (n: SmartNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.link) { setOpen(false); navigate(n.link); }
  };

  const unread = countData?.count ?? 0;
  const groups = groupByPriority(notifications);

  return (
    <>
      {/* Bell trigger */}
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-lg hover:bg-sidebar-accent/60 transition-colors"
        aria-label="Benachrichtigungen"
      >
        <Bell className="w-5 h-5 text-sidebar-foreground/60" />
        {unread > 0 && (
          <motion.span
            key={unread}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
          >
            {unread > 99 ? "99+" : unread}
          </motion.span>
        )}
      </button>

      {/* Sheet */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-[80] bg-black/50"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed right-0 top-0 bottom-0 z-[90] w-full max-w-sm bg-sidebar border-l border-sidebar-border shadow-2xl flex flex-col"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border shrink-0">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-sidebar-primary" />
                  <h2 className="font-bold text-base text-sidebar-foreground">Benachrichtigungen</h2>
                  {unread > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5">{unread}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button
                      onClick={() => markAllRead.mutate()}
                      className="flex items-center gap-1 text-xs text-sidebar-foreground/50 hover:text-sidebar-primary transition-colors font-medium"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Alle gelesen
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-sidebar-accent/60 transition-colors text-sidebar-foreground/50">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-sidebar-foreground/40 py-20">
                    <Bell className="w-10 h-10 opacity-20" />
                    <p className="text-sm font-medium text-sidebar-foreground/50">Alles im grünen Bereich</p>
                    <p className="text-xs text-sidebar-foreground/30 text-center max-w-[200px] leading-relaxed">
                      Wir informieren dich bei Reservierungen, Bewertungen und Wallet-Ereignissen.
                    </p>
                  </div>
                ) : (
                  <div>
                    {Array.from(groups.entries()).map(([priority, items]) => {
                      const meta = PRIORITY_LABEL[priority] ?? { label: priority, dot: "bg-muted" };
                      return (
                        <div key={priority}>
                          <div className="flex items-center gap-2 px-5 py-2 bg-sidebar-accent/30 sticky top-0 z-10">
                            <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
                            <span className="text-[11px] font-bold text-sidebar-foreground/40 uppercase tracking-wide">{meta.label}</span>
                            <span className="text-[11px] text-sidebar-foreground/25">· {items.length}</span>
                          </div>
                          <div className="divide-y divide-sidebar-border">
                            {items.map((n) => {
                              const { icon: Icon, color, bg } = getMeta(n.type);
                              const borderCls =
                                priority === "critical" ? "border-l-[3px] border-rose-500" :
                                priority === "important" && !n.isRead ? "border-l-[3px] border-sidebar-primary" :
                                "";
                              return (
                                <button
                                  key={n.id}
                                  onClick={() => handleClickNotification(n)}
                                  className={`w-full text-left flex items-start gap-3 px-5 py-4 transition-colors hover:bg-sidebar-accent/40 ${!n.isRead ? "bg-sidebar-primary/5" : ""} ${borderCls}`}
                                >
                                  <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                    <Icon className={`w-[18px] h-[18px] ${color}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className={`text-sm font-semibold leading-snug ${!n.isRead ? "text-sidebar-foreground" : "text-sidebar-foreground/60"}`}>
                                        {n.title}
                                      </p>
                                      {n.link && <ChevronRight className="w-3.5 h-3.5 text-sidebar-foreground/30 shrink-0 mt-0.5" />}
                                    </div>
                                    <p className="text-xs text-sidebar-foreground/50 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                                    <p className="text-[10px] text-sidebar-foreground/30 mt-1">{relativeTime(n.createdAt)}</p>
                                  </div>
                                  {!n.isRead && (
                                    <div className="w-2 h-2 rounded-full bg-sidebar-primary mt-2 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
