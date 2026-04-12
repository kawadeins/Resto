import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Bell, X, CheckCheck, Calendar, Users, Star, AlertTriangle,
  CheckCircle2, XCircle, Zap, Info, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  group_reservation_confirmed: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
  group_reservation_rejected:  { icon: XCircle,       color: "text-rose-500",    bg: "bg-rose-50"    },
  group_reservation_cancelled: { icon: XCircle,       color: "text-slate-400",   bg: "bg-slate-50"   },
  new_reservation:             { icon: Calendar,      color: "text-blue-500",    bg: "bg-blue-50"    },
  reservation_confirmed:       { icon: CheckCircle2,  color: "text-emerald-500", bg: "bg-emerald-50" },
  suggestion:                  { icon: Zap,           color: "text-primary",     bg: "bg-primary/10" },
  reminder:                    { icon: Bell,          color: "text-amber-500",   bg: "bg-amber-50"   },
};

function getMeta(type: string) {
  return TYPE_META[type] ?? { icon: Info, color: "text-muted-foreground", bg: "bg-muted/50" };
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

export function CustomerNotificationBell({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ["sn-count-customer", email],
    queryFn: async () => {
      if (!email) return { count: 0 };
      const r = await fetch(`${API}/smart-notifications/unread-count?userType=customer&email=${encodeURIComponent(email)}`);
      return r.ok ? r.json() : { count: 0 };
    },
    enabled: !!email,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { data: notifications = [] } = useQuery<SmartNotification[]>({
    queryKey: ["sn-list-customer", email],
    queryFn: async () => {
      if (!email) return [];
      const r = await fetch(`${API}/smart-notifications?userType=customer&email=${encodeURIComponent(email)}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!email && open,
    staleTime: 15000,
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${API}/smart-notifications/${id}/read`, { method: "PATCH" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sn-count-customer", email] });
      qc.invalidateQueries({ queryKey: ["sn-list-customer", email] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch(`${API}/smart-notifications/read-all`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userType: "customer", email }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sn-count-customer", email] });
      qc.invalidateQueries({ queryKey: ["sn-list-customer", email] });
    },
  });

  const handleClickNotification = (n: SmartNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.link) { setOpen(false); navigate(n.link); }
  };

  const unread = countData?.count ?? 0;

  if (!email) return null;

  return (
    <>
      {/* Bell trigger */}
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-full hover:bg-muted/60 transition-colors"
        aria-label="Benachrichtigungen"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
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
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              className="fixed right-0 top-0 bottom-0 z-[90] w-full max-w-sm bg-background border-l border-border shadow-2xl flex flex-col"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-base">Benachrichtigungen</h2>
                  {unread > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5">{unread}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button
                      onClick={() => markAllRead.mutate()}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Alle gelesen
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-20">
                    <Bell className="w-10 h-10 opacity-20" />
                    <p className="text-sm">Keine Benachrichtigungen</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((n) => {
                      const { icon: Icon, color, bg } = getMeta(n.type);
                      const priority = n.priority;
                      return (
                        <button
                          key={n.id}
                          onClick={() => handleClickNotification(n)}
                          className={`w-full text-left flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/40 ${!n.isRead ? "bg-primary/3" : ""}`}
                        >
                          {/* Priority stripe */}
                          {!n.isRead && (
                            <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${
                              priority === "critical" ? "bg-rose-500" :
                              priority === "important" ? "bg-primary" :
                              "bg-muted"
                            }`} style={{ position: "relative", marginLeft: -20, width: 3, borderRadius: 2, flexShrink: 0 }} />
                          )}
                          <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
                            <Icon className={`w-4.5 h-4.5 ${color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-sm font-semibold leading-snug ${!n.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                                {n.title}
                              </p>
                              {n.link && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">{relativeTime(n.createdAt)}</p>
                          </div>
                          {!n.isRead && (
                            <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                          )}
                        </button>
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
