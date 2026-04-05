import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { track } from "@/lib/conversion-tracking";
import { useCancelSubscription, useGetSubscription } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, Crown, Calendar, ExternalLink, AlertTriangle, Shield,
  Clock, TrendingUp, Eye, Zap, ArrowRight, MousePointer,
} from "lucide-react";
import {
  getBizType,
  BIZ_LABEL,
  BIZ_POSSESSIVE,
  BIZ_MENU_EDITOR_LABEL,
  BIZ_TABLE_MODULE_LABEL,
  BIZ_RESERVATION_LABEL,
} from "@/lib/biz-copy";
import { PREMIUM_PRICE_DISPLAY, PREMIUM_PLAN_NAME } from "@/lib/monetization-engine";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface MyPromotionsData {
  restaurantId: number | null;
  restaurantName: string;
  businessType: string;
  promotions: {
    id: number;
    type: string;
    status: string;
    impressions: number;
    clicks: number;
    bookings_attributed: number;
  }[];
}

function useTrialStats() {
  return useQuery<MyPromotionsData>({
    queryKey: ["promotions-my-billing"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/promotions/my`);
      if (!res.ok) return { restaurantId: null, restaurantName: "", businessType: "restaurant", promotions: [] };
      return res.json();
    },
    staleTime: 120_000,
  });
}

function getTrialInfo() {
  const premium = localStorage.getItem("restosmart_owner_premium");
  const trialEndStr = localStorage.getItem("restosmart_trial_end");
  if (premium !== "trial" || !trialEndStr) return null;
  const trialEnd = new Date(trialEndStr);
  const now = new Date();
  if (trialEnd <= now) return null;
  const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000);
  return { daysLeft, trialEnd };
}

export default function Billing() {
  useEffect(() => { track("premium_page_opened"); }, []);
  const { toast } = useToast();
  const cancelSubscription = useCancelSubscription();
  const { data: subscription } = useGetSubscription({});
  const { data: promoData } = useTrialStats();
  const biz = getBizType();
  const bizLabel = BIZ_LABEL[biz];
  const bizPossessive = BIZ_POSSESSIVE[biz];
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const customerProfileUrl = window.location.origin + "/customer/profile";
  const trial = getTrialInfo();
  const isTrial = !!trial;

  const handleCancel = () => {
    cancelSubscription.mutate({}, {
      onSuccess: () => {
        localStorage.removeItem("restosmart_owner_premium");
        localStorage.removeItem("restosmart_owner_email");
        localStorage.removeItem("restosmart_trial_end");
        localStorage.removeItem("restosmart_trial_started");
        setCancelled(true);
        toast({ title: "Testphase beendet", description: "Ihr Zugang wurde deaktiviert." });
      },
      onError: () => {
        localStorage.removeItem("restosmart_owner_premium");
        localStorage.removeItem("restosmart_owner_email");
        localStorage.removeItem("restosmart_trial_end");
        localStorage.removeItem("restosmart_trial_started");
        setCancelled(true);
        toast({ title: "Zugang beendet" });
      },
    });
    setShowCancelConfirm(false);
  };

  if (cancelled) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Zugang beendet</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {bizLabel} Premium-Zugang wurde beendet. Sie können jederzeit über Ihr Kundenprofil wieder einsteigen.
          </p>
        </div>
        <a
          href={customerProfileUrl}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
        >
          Zum Kundenprofil
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-10">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Abonnement</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {bizPossessive} aktiver Plan und Abrechnungsdetails.
        </p>
      </div>

      {/* ── TRIAL MODE ── */}
      {isTrial && trial && (
        <>
          {/* Trial Countdown Card */}
          <div className={`rounded-2xl border p-6 space-y-5 ${
            trial.daysLeft <= 3
              ? "border-red-700/40 bg-gradient-to-br from-red-950/40 via-red-950/20 to-background"
              : trial.daysLeft <= 7
              ? "border-amber-700/40 bg-gradient-to-br from-amber-950/40 via-amber-950/20 to-background"
              : "border-violet-700/30 bg-gradient-to-br from-violet-950/30 via-violet-950/10 to-background"
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg ${
                  trial.daysLeft <= 3
                    ? "bg-gradient-to-br from-red-500 to-orange-600 shadow-red-500/20"
                    : "bg-gradient-to-br from-primary to-accent shadow-primary/20"
                }`}>
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-base">14-Tage Testphase</div>
                  <div className="text-sm text-muted-foreground">{PREMIUM_PLAN_NAME} · Vollzugriff</div>
                </div>
              </div>
              <Badge className={`text-xs font-bold shrink-0 ${
                trial.daysLeft <= 3
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}>
                <Clock className="w-3 h-3 mr-1" />
                {trial.daysLeft === 1 ? "Letzter Tag" : `${trial.daysLeft} Tage`}
              </Badge>
            </div>

            {/* Countdown bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Verbleibend</span>
                <span className="font-semibold text-foreground">
                  {trial.daysLeft === 1
                    ? "Letzter Tag — upgrade jetzt"
                    : trial.daysLeft <= 3
                    ? `Nur noch ${trial.daysLeft} Tage — jetzt upgraden`
                    : `${trial.daysLeft} von 14 Tagen verbleibend`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    trial.daysLeft <= 3 ? "bg-red-500" : trial.daysLeft <= 7 ? "bg-amber-500" : "bg-primary"
                  }`}
                  style={{ width: `${(trial.daysLeft / 14) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground/60">
                <span>Tag 1</span>
                <span>Tag 14</span>
              </div>
            </div>

            {/* Urgency message */}
            {trial.daysLeft <= 7 && (
              <div className={`rounded-xl p-4 border ${
                trial.daysLeft <= 3
                  ? "bg-red-950/30 border-red-800/40 text-red-200"
                  : "bg-amber-950/30 border-amber-800/40 text-amber-200"
              }`}>
                <p className="text-sm font-semibold mb-1">
                  {trial.daysLeft <= 1
                    ? "Letzter Tag deiner Testphase — Sichtbarkeit jetzt sichern"
                    : trial.daysLeft <= 3
                    ? "Testphase endet bald — aktiviere Premium, um sichtbar zu bleiben"
                    : "Deine Testphase endet bald — Sichtbarkeit sichern"}
                </p>
                <p className="text-xs opacity-80 leading-relaxed">
                  Dein {bizLabel} ist ohne Premium weniger sichtbar in deiner Umgebung. Du verpasst potenzielle Kunden — Premium-Betriebe werden häufiger angezeigt.
                </p>
              </div>
            )}

            {/* Trial end date */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4 shrink-0" />
              <span>
                Testphase endet am{" "}
                <span className="font-semibold text-foreground">
                  {trial.trialEnd.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </span>
            </div>

            {/* Upgrade CTA */}
            <a
              href={customerProfileUrl}
              className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm shadow-lg shadow-violet-500/20 hover:opacity-90 transition-opacity"
            >
              Jetzt für 39,90€ / Monat fortsetzen
              <ArrowRight className="w-4 h-4" />
            </a>
            <p className="text-[11px] text-center text-muted-foreground/60">
              Jederzeit kündbar. Keine langfristige Verpflichtung.
            </p>
          </div>

          {/* Value Summary Card — real data from promotions */}
          {(() => {
            const promos = promoData?.promotions ?? [];
            const totalImpressions = promos.reduce((s, p) => s + (p.impressions || 0), 0);
            const totalClicks = promos.reduce((s, p) => s + (p.clicks || 0), 0);
            const totalBookings = promos.reduce((s, p) => s + (p.bookings_attributed || 0), 0);
            const totalBoosts = promos.length;
            const hasData = totalImpressions > 0 || totalBoosts > 0;
            const realStats = [
              { icon: Eye, label: "Boost-Einblendungen", value: totalImpressions.toLocaleString("de") },
              { icon: MousePointer, label: "Klicks auf dein Profil", value: totalClicks.toLocaleString("de") },
              { icon: CheckCircle2, label: "Buchungen über Boosts", value: totalBookings.toLocaleString("de") },
              { icon: Zap, label: "Boosts gestartet", value: String(totalBoosts) },
            ];
            return (
              <div className="rounded-2xl border border-border bg-muted/10 p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm">Was deine Testphase gebracht hat</h3>
                  </div>
                  <span className="text-[10px] text-primary/70 font-bold uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full">
                    Echtdaten
                  </span>
                </div>
                {hasData ? (
                  <div className="grid grid-cols-2 gap-3">
                    {realStats.map((stat) => (
                      <div key={stat.label} className="rounded-xl bg-background/50 border border-white/5 p-4">
                        <div className="text-2xl font-bold text-primary mb-0.5">{stat.value}</div>
                        <div className="text-xs text-muted-foreground leading-snug">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-muted/30 border border-white/5 p-4 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">Noch keine Boost-Aktivität in deiner Testphase.</p>
                    <p className="text-xs text-muted-foreground/60">Starte einen Boost unter Marketing, um deine Sichtbarkeit zu messen.</p>
                  </div>
                )}
                <div className="rounded-xl bg-primary/5 border border-primary/10 p-3">
                  <p className="text-xs text-primary/80 font-medium leading-relaxed">
                    Mit aktivem Premium behältst du diesen Sichtbarkeits-Vorteil dauerhaft — und erreichst noch mehr Kunden in deiner Nähe.
                  </p>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* ── ACTIVE PAID PLAN ── */}
      {!isTrial && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-violet-950/20 to-pink-950/10 p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-base">{PREMIUM_PLAN_NAME}</div>
                <div className="text-sm text-muted-foreground">RestoSmart · {bizLabel} · Vollzugriff</div>
              </div>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs font-bold">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Aktiv
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-background/40 border border-white/5 p-4">
              <div className="text-xs text-muted-foreground mb-1">Monatlicher Betrag</div>
              <div className="text-2xl font-bold">{PREMIUM_PRICE_DISPLAY}</div>
              <div className="text-xs text-muted-foreground">/Monat · inkl. MwSt.</div>
            </div>
            <div className="rounded-xl bg-background/40 border border-white/5 p-4">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Nächste Abrechnung
              </div>
              <div className="text-lg font-bold">
                {subscription?.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })
                  : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Enthaltene Features</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                BIZ_RESERVATION_LABEL[biz],
                BIZ_TABLE_MODULE_LABEL[biz],
                "Personal & Schichten",
                BIZ_MENU_EDITOR_LABEL[biz],
                "Analytics & Berichte",
                "Marketing & Kampagnen",
                "Boost-Sichtbarkeit",
                "Smart Offers & Deals",
                "Kassenterminal (POS)",
                "Revenue Optimizer",
                "Treue-Programme",
                "Premium-Badge",
              ].map((m) => (
                <div key={m} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
                  {m}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Where to manage */}
      <div className="rounded-2xl border border-border bg-muted/20 p-5 flex items-start gap-4">
        <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="font-semibold text-sm mb-1">
            {isTrial ? "Auf Premium upgraden" : "Abonnement wird im Kundenprofil verwaltet"}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            {isTrial
              ? "Schalten Sie für €39,90/Monat frei und behalten Sie dauerhaften Zugang zu allen Premium-Funktionen. Keine automatische Abbuchung — Sie bestätigen die Zahlung manuell."
              : "Pläne, Zahlungsmethoden und Upgrades werden ausschließlich über das Kundenprofil gesteuert — dem zentralen Ort für Ihre Premium-Mitgliedschaft."}
          </p>
          <a
            href={customerProfileUrl}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            {isTrial ? "Jetzt upgraden" : "Zum Kundenprofil"}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Cancel / End Trial zone */}
      <div className="rounded-2xl border border-red-900/30 bg-red-950/10 p-5">
        <h3 className="font-bold text-sm text-red-400 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {isTrial ? "Testphase beenden" : "Abonnement kündigen"}
        </h3>

        {showCancelConfirm ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isTrial
                ? "Sind Sie sicher? Die Testphase wird sofort beendet und Sie verlieren den Zugang zum Dashboard."
                : "Sind Sie sicher? Nach der Kündigung verlieren Sie den Zugang zum Dashboard am Ende des aktuellen Abrechnungszeitraums."}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl flex-1"
                onClick={() => setShowCancelConfirm(false)}
              >
                Abbrechen
              </Button>
              <Button
                size="sm"
                className="rounded-xl flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
                onClick={handleCancel}
                disabled={cancelSubscription.isPending}
              >
                {cancelSubscription.isPending ? "Wird verarbeitet…" : isTrial ? "Testphase beenden" : "Endgültig kündigen"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isTrial
                ? "Das Beenden der Testphase deaktiviert sofort den Zugang zum Dashboard."
                : "Das Kündigen beendet Ihren Premium-Zugang zum Dashboard und alle damit verbundenen Funktionen."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-red-800/40 text-red-400 hover:bg-red-950/30 hover:border-red-700/50"
              onClick={() => setShowCancelConfirm(true)}
            >
              {isTrial ? "Testphase beenden" : "Abonnement kündigen"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
