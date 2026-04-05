/**
 * growth-activation-hub.tsx
 * 
 * Shown in the restosmart overview for new/trial users.
 * Provides a guided activation checklist, value signals,
 * and a clear CTA to upgrade to Premium.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Circle, ArrowRight, Eye, Users, TrendingUp,
  Zap, Building2, Star, Clock, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { getBizType } from "@/lib/biz-copy";
import { track } from "@/lib/conversion-tracking";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step {
  id: string;
  label: string;
  desc: string;
  href?: string;
  action?: "upgrade";
  doneKey: string;
}

// ─── Business-type copy ───────────────────────────────────────────────────────

const BIZ_LABELS: Record<string, { name: string; emoji: string; greeting: string }> = {
  restaurant: { name: "Restaurant",   emoji: "\uD83C\uDF7D\uFE0F", greeting: "Dein Restaurant ist online \u2014 werde jetzt sichtbar." },
  cafe:        { name: "Caf\u00e9",         emoji: "\u2615",  greeting: "Dein Caf\u00e9 ist online \u2014 werde jetzt sichtbar." },
  bar:         { name: "Bar",          emoji: "\uD83C\uDF78",  greeting: "Deine Bar ist online \u2014 werde jetzt sichtbar." },
};

// ─── Activation steps ─────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    id: "registered",
    label: "Profil aktiviert",
    desc: "Dein Betrieb ist auf der Plattform eingetragen und für Gäste sichtbar.",
    doneKey: "rs_act_registered",
  },
  {
    id: "settings",
    label: "Profil vervollständigen",
    desc: "Öffnungszeiten, Adresse und Details eintragen — erhöht deine Sichtbarkeit.",
    href: "/settings",
    doneKey: "rs_act_settings",
  },
  {
    id: "offers",
    label: "Erstes Angebot erstellen",
    desc: "Erstelle ein Smart-Angebot oder Flash-Deal — sofort in der App sichtbar.",
    href: "/discounts",
    doneKey: "rs_act_offers",
  },
  {
    id: "premium",
    label: "Jetzt sichtbar werden",
    desc: "Mehr Sichtbarkeit = mehr Kunden. Teste 14 Tage kostenlos, danach 39,90\u20ac/Monat.",
    action: "upgrade",
    doneKey: "rs_act_premium",
  },
];

// ─── Value signals (real data or honest empty state) ─────────────────────────

function getValueSignals(bizType: string) {
  const hour = new Date().getHours();

  const peakLabel = bizType === "cafe"
    ? (hour >= 6 && hour < 12 ? "Frühstücks-Peak" : "Café-Stunden")
    : bizType === "bar"
    ? (hour >= 19 ? "Nachtleben-Stunden" : "Happy-Hour-Fenster")
    : (hour >= 11 && hour < 14 ? "Mittagszeit" : "Abend-Fenster");

  return [
    { icon: Eye,        color: "text-blue-500",   bg: "bg-blue-50 border-blue-100",   value: "Aktiv",     label: "Profil sichtbar" },
    { icon: Users,      color: "text-violet-500",  bg: "bg-violet-50 border-violet-100", value: "Wien",    label: "Marktplatz-Region" },
    { icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-50 border-emerald-100", value: peakLabel, label: "Aktuelles Zeitfenster" },
  ];
}

// ─── Trial countdown helper ───────────────────────────────────────────────────

function getTrialDaysLeft(): number {
  const end = localStorage.getItem("restosmart_trial_end");
  if (!end) return 14;
  const diff = new Date(end).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function isNewUser(): boolean {
  const started = localStorage.getItem("restosmart_trial_started");
  if (!started) return false;
  const diff = Date.now() - new Date(started).getTime();
  return diff < 7 * 24 * 60 * 60 * 1000;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GrowthActivationHub({ onUpgrade }: { onUpgrade?: () => void }) {
  const [doneSteps, setDoneSteps]     = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed]     = useState(false);
  const [dismissed, setDismissed]     = useState(false);
  const [daysLeft, setDaysLeft]       = useState(14);
  const bizType = getBizType();
  const bizCfg  = BIZ_LABELS[bizType] ?? BIZ_LABELS.restaurant;

  useEffect(() => {
    if (localStorage.getItem("restosmart_owner_premium") !== "trial") return;

    setDaysLeft(getTrialDaysLeft());

    const done = new Set<string>(["rs_act_registered"]);
    STEPS.forEach(s => {
      if (localStorage.getItem(s.doneKey) === "1") done.add(s.doneKey);
    });
    done.add("rs_act_registered");
    setDoneSteps(done);

    const wasDismissed = sessionStorage.getItem("rs_activation_hub_dismissed") === "1";
    setDismissed(wasDismissed);
    const wasCollapsed = sessionStorage.getItem("rs_activation_hub_collapsed") === "1";
    setCollapsed(wasCollapsed);
  }, []);

  const isPremium  = localStorage.getItem("restosmart_owner_premium") === "active";
  const isTrial    = localStorage.getItem("restosmart_owner_premium") === "trial";

  if (!isTrial || isPremium || dismissed) return null;

  const completedCount = STEPS.filter(s => doneSteps.has(s.doneKey)).length;
  const progressPct    = Math.round((completedCount / STEPS.length) * 100);

  const markDone = (step: Step) => {
    if (step.doneKey) {
      localStorage.setItem(step.doneKey, "1");
      setDoneSteps(prev => new Set([...prev, step.doneKey]));
    }
  };

  const handleStepClick = (step: Step) => {
    markDone(step);
    if (step.action === "upgrade" && onUpgrade) {
      track("upgrade_cta_clicked", { source: "activation_hub" });
      onUpgrade();
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem("rs_activation_hub_dismissed", "1");
    setDismissed(true);
  };

  const handleCollapse = () => {
    const next = !collapsed;
    sessionStorage.setItem("rs_activation_hub_collapsed", next ? "1" : "0");
    setCollapsed(next);
  };

  const signals = getValueSignals(bizType);

  const urgencyColor = daysLeft <= 3
    ? "border-rose-300 bg-gradient-to-br from-rose-50 to-orange-50"
    : daysLeft <= 7
    ? "border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50"
    : "border-primary/20 bg-gradient-to-br from-primary/3 to-accent/3";

  const urgencyBadgeColor = daysLeft <= 3
    ? "bg-rose-100 text-rose-700"
    : daysLeft <= 7
    ? "bg-amber-100 text-amber-700"
    : "bg-primary/10 text-primary";

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-2xl border-2 ${urgencyColor} mb-6 overflow-hidden`}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md shadow-primary/20 mt-0.5">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h2 className="font-extrabold text-sm text-foreground leading-tight">
              {bizCfg.emoji} {bizCfg.greeting}
            </h2>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${urgencyBadgeColor}`}>
              {daysLeft > 0 ? `Noch ${daysLeft} Tage kostenlos` : "Testphase endet heute"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">
            Kunden in deiner Umgebung suchen genau jetzt nach Angeboten wie deinem.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCollapse}
            className="w-7 h-7 rounded-lg bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
            aria-label={collapsed ? "Aufklappen" : "Einklappen"}
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          <button
            onClick={handleDismiss}
            className="w-7 h-7 rounded-lg bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
            aria-label="Schließen"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {!collapsed && (
        <div className="px-5 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground font-medium">Aktivierungsfortschritt</span>
            <span className="text-[11px] font-bold text-foreground">{completedCount}/{STEPS.length}</span>
          </div>
          <div className="h-1.5 bg-black/8 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
            />
          </div>
        </div>
      )}

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {/* Activation checklist */}
            <div className="px-5 mb-4 space-y-2">
              {STEPS.map((step) => {
                const isDone = doneSteps.has(step.doneKey);
                const isPremiumStep = step.action === "upgrade";

                const content = (
                  <div
                    className={`flex items-start gap-3 rounded-xl px-3.5 py-3 border transition-all cursor-pointer ${
                      isDone
                        ? "border-emerald-200 bg-emerald-50/60 opacity-75"
                        : isPremiumStep
                        ? "border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/8"
                        : "border-border/60 bg-white/60 hover:border-primary/30 hover:bg-white/90"
                    }`}
                    onClick={() => !isDone && handleStepClick(step)}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isDone
                        ? <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
                        : isPremiumStep
                        ? <Star className="w-4.5 h-4.5 text-primary" />
                        : <Circle className="w-4.5 h-4.5 text-muted-foreground/40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-semibold leading-tight ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {step.label}
                        </p>
                        {isPremiumStep && !isDone && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-gradient-to-r from-primary to-accent text-white">
                            PREMIUM
                          </span>
                        )}
                      </div>
                      {!isDone && (
                        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{step.desc}</p>
                      )}
                    </div>
                    {!isDone && !isPremiumStep && (
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                  </div>
                );

                if (step.href && !isDone) {
                  return (
                    <Link key={step.id} href={step.href} onClick={() => markDone(step)}>
                      {content}
                    </Link>
                  );
                }
                return <div key={step.id}>{content}</div>;
              })}
            </div>

            {/* Value signals */}
            <div className="px-5 mb-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Dein Betrieb in Zahlen
              </p>
              <div className="grid grid-cols-3 gap-2">
                {signals.map(({ icon: Icon, color, bg, value, label }) => (
                  <div key={label} className={`rounded-xl border ${bg} p-3 text-center`}>
                    <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
                    <p className="text-sm font-extrabold text-foreground leading-tight">{value}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Upgrade CTA */}
            {progressPct >= 50 && (
              <div className="px-5 mb-4">
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground leading-tight">Jetzt sichtbar werden</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      {"Mehr Sichtbarkeit = mehr Kunden — 39,90€/Monat"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 px-3 rounded-lg text-xs font-bold bg-gradient-to-r from-primary to-accent text-white border-0 shrink-0"
                    onClick={() => {
                      track("upgrade_cta_clicked", { source: "activation_hub_cta" });
                      onUpgrade?.();
                    }}
                  >
                    Starten
                  </Button>
                </div>
              </div>
            )}

            {/* Footer note */}
            <div className="px-5 pb-4">
              <p className="text-[11px] text-muted-foreground text-center">
                <Clock className="w-3 h-3 inline mr-1 opacity-60" />
                Testphase endet in {daysLeft} {daysLeft === 1 ? "Tag" : "Tagen"} — jederzeit upgradebar
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
