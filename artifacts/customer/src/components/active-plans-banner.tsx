/**
 * ActivePlansBanner — shows active/incoming instant plans on the home page.
 * Compact, live-feeling, with join/decline for invited plans.
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Zap, Users, Clock, X, Check, ChevronRight, Bell } from "lucide-react";
import {
  getActivePlans, getIncomingPlans, respondToPlan, cancelPlan,
  getModeLabel, countdownLabel, type InstantPlan,
} from "@/lib/instant-plans-api";
import { nameInitials } from "@/lib/social-api";
import { useToast } from "@/hooks/use-toast";

function Dot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${color}`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </span>
  );
}

function IncomingPlanCard({ plan, email }: { plan: InstantPlan; email: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const modeLabel = getModeLabel(plan.mode);

  const respond = useMutation({
    mutationFn: (r: "join" | "decline") => respondToPlan(plan.id, email, r),
    onSuccess: (_, r) => {
      qc.invalidateQueries({ queryKey: ["incoming-plans", email] });
      qc.invalidateQueries({ queryKey: ["active-plans", email] });
      toast({ title: r === "join" ? "Du bist dabei! 🎉" : "Einladung abgelehnt" });
    },
  });

  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-primary/8 to-accent/5 border border-primary/20 shadow-md">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-lg shrink-0">
        {modeLabel.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Dot color="bg-primary" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary/70">Einladung</span>
        </div>
        <p className="text-sm font-bold truncate">{plan.restaurantName ?? modeLabel.label}</p>
        <p className="text-xs text-muted-foreground">
          {plan.suggestedTime && `Um ${plan.suggestedTime} · `}
          {(plan.joinedEmails as string[]).length} dabei
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => respond.mutate("join")}
          disabled={respond.isPending}
          className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-md shadow-primary/30 press-scale"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => respond.mutate("decline")}
          disabled={respond.isPending}
          className="w-9 h-9 rounded-xl bg-muted/80 text-muted-foreground flex items-center justify-center hover:bg-red-50 hover:text-red-500 press-scale"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ActivePlanCard({ plan, email }: { plan: InstantPlan; email: string }) {
  const modeLabel = getModeLabel(plan.mode);
  const joined = plan.joinedEmails as string[];
  const invited = plan.invitedEmails as string[];
  const pending = invited.filter(e => !joined.includes(e) && !(plan.declinedEmails as string[]).includes(e));

  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border/50 shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-lg shrink-0">
        {modeLabel.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Dot color="bg-emerald-500" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600/80">Aktiver Plan</span>
          {plan.expiresAt && (
            <span className="text-[10px] text-muted-foreground/60 ml-auto">{countdownLabel(plan.expiresAt)}</span>
          )}
        </div>
        <p className="text-sm font-bold truncate">{plan.restaurantName ?? modeLabel.label}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="w-3 h-3" />
          <span>{joined.length} dabei</span>
          {pending.length > 0 && <span className="text-amber-600">· {pending.length} ausstehend</span>}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
    </div>
  );
}

interface ActivePlansBannerProps {
  email: string;
}

export function ActivePlansBanner({ email }: ActivePlansBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const { data: active = [] } = useQuery({
    queryKey: ["active-plans", email],
    queryFn: () => getActivePlans(email),
    enabled: !!email,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: incoming = [] } = useQuery({
    queryKey: ["incoming-plans", email],
    queryFn: () => getIncomingPlans(email),
    enabled: !!email,
    staleTime: 20000,
    refetchInterval: 30000,
  });

  if (!email || dismissed) return null;
  if (incoming.length === 0 && active.length === 0) return null;

  const totalCount = incoming.length + active.length;

  return (
    <section className="px-4 py-3">
      <div className="container mx-auto max-w-6xl">
        <div className="relative bg-card rounded-3xl border border-primary/15 shadow-lg overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/4 to-accent/4 pointer-events-none" />
          <div className="relative p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/30">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-extrabold leading-tight">
                    {incoming.length > 0
                      ? `${incoming.length} neue Einladung${incoming.length > 1 ? "en" : ""}`
                      : `${active.length} aktiver Plan`}
                  </p>
                  {incoming.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">Reagiere jetzt</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setDismissed(true)}
                className="p-1.5 rounded-full hover:bg-muted/60 text-muted-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Incoming */}
            {incoming.map(p => <IncomingPlanCard key={p.id} plan={p} email={email} />)}

            {/* Active */}
            {active.filter(p => !incoming.find(i => i.id === p.id)).slice(0, 2).map(p =>
              <ActivePlanCard key={p.id} plan={p} email={email} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
