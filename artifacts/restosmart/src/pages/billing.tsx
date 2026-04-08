import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { track } from "@/lib/conversion-tracking";
import { useCancelSubscription, useGetSubscription } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, Crown, Calendar, AlertTriangle, Shield,
  Clock, TrendingUp, Eye, Zap, ArrowRight, MousePointer,
  Loader2, ExternalLink, XCircle, RefreshCw,
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

function getOwnerEmail(): string {
  return localStorage.getItem("restosmart_owner_email") ?? "owner@restosmart.app";
}

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

function getUrlParams() {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return {
    stripe: p.get("stripe"),
    topup: p.get("topup"),
    sessionId: p.get("session_id"),
  };
}

export default function Billing() {
  useEffect(() => { track("premium_page_opened"); }, []);
  const { toast } = useToast();
  const cancelSubscription = useCancelSubscription();
  const { data: subscription, refetch: refetchSubscription } = useGetSubscription({});
  const { data: promoData } = useTrialStats();
  const biz = getBizType();
  const bizLabel = BIZ_LABEL[biz];
  const bizPossessive = BIZ_POSSESSIVE[biz];
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const params = getUrlParams();
  const stripeReturn = params.stripe;
  const topupReturn = params.topup;
  const returnSessionId = params.sessionId;

  // Auto-refetch subscription status after returning from Stripe
  useEffect(() => {
    if (stripeReturn === "success" || topupReturn === "success") {
      // Poll up to 5 times over 10s to catch webhook processing
      let attempts = 0;
      const poll = setInterval(() => {
        refetchSubscription();
        attempts++;
        if (attempts >= 5) clearInterval(poll);
      }, 2000);
      return () => clearInterval(poll);
    }
  }, [stripeReturn, topupReturn]);

  const trial = getTrialInfo();
  const isTrial = !!trial;

  const handleCheckout = useCallback(async () => {
    setCheckoutLoading(true);
    track("checkout_started");
    try {
      const res = await fetch(`${API_BASE}/api/billing/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": getOwnerEmail(),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Fehler",
          description: data.message ?? "Checkout konnte nicht gestartet werden.",
          variant: "destructive",
        });
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast({ title: "Netzwerkfehler", description: "Bitte versuchen Sie es erneut.", variant: "destructive" });
    } finally {
      setCheckoutLoading(false);
    }
  }, [toast]);

  const handlePortal = useCallback(async () => {
    setPortalLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing/portal`, {
        headers: { "x-user-email": getOwnerEmail() },
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Fehler", description: data.message ?? "Kundenportal nicht verfügbar.", variant: "destructive" });
        return;
      }
      if (data.url) window.open(data.url, "_blank");
    } catch {
      toast({ title: "Netzwerkfehler", variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  }, [toast]);

  const handleCancel = () => {
    cancelSubscription.mutate({}, {
      onSuccess: () => {
        localStorage.removeItem("restosmart_owner_premium");
        localStorage.removeItem("restosmart_owner_email");
        localStorage.removeItem("restosmart_trial_end");
        localStorage.removeItem("restosmart_trial_started");
        setCancelled(true);
        toast({ title: "Abonnement beendet", description: "Ihr Zugang wurde deaktiviert." });
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
        <button
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors cursor-pointer"
          onClick={handleCheckout}
          disabled={checkoutLoading}
        >
          {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Jetzt Premium aktivieren
        </button>
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

      {/* ── Stripe return: payment cancelled ── */}
      {stripeReturn === "cancel" && (
        <div className="rounded-2xl border border-amber-700/30 bg-amber-950/20 p-5 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm text-amber-300 mb-1">Zahlung abgebrochen</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {"Der Checkout wurde abgebrochen. Ihr Abonnement wurde noch nicht aktiviert. Sie k\u00f6nnen es jederzeit erneut versuchen."}
            </p>
          </div>
        </div>
      )}

      {/* ── Stripe return: payment success (pending webhook) ── */}
      {stripeReturn === "success" && subscription?.status !== "active" && (
        <div className="rounded-2xl border border-violet-700/30 bg-violet-950/20 p-5 flex items-start gap-3">
          <RefreshCw className="w-5 h-5 text-violet-400 mt-0.5 shrink-0 animate-spin" />
          <div>
            <p className="font-semibold text-sm text-violet-300 mb-1">Zahlung wird verarbeitet</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {"Ihre Zahlung wurde erfolgreich \u00fcbermittelt. Das Premium-Abonnement wird in wenigen Sekunden aktiviert. Bitte warten Sie oder laden Sie die Seite neu."}
            </p>
            <button
              className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
              onClick={() => refetchSubscription()}
            >
              <RefreshCw className="w-3 h-3" />
              {"Status aktualisieren"}
            </button>
          </div>
        </div>
      )}

      {/* ── Stripe return: subscription successfully activated ── */}
      {stripeReturn === "success" && subscription?.status === "active" && (
        <div className="rounded-2xl border border-emerald-700/30 bg-emerald-950/20 p-5 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm text-emerald-300 mb-1">Premium aktiviert!</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {"Zahlung best\u00e4tigt. Ihr RestoSmart Business Premium-Abonnement ist jetzt aktiv."}
            </p>
          </div>
        </div>
      )}

      {/* ── Topup return: success ── */}
      {topupReturn === "success" && (
        <div className="rounded-2xl border border-emerald-700/30 bg-emerald-950/20 p-5 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm text-emerald-300 mb-1">Wallet-Aufladung erfolgreich!</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {"Zahlung best\u00e4tigt. Das Guthaben wird Ihrem Boost-Wallet gutgeschrieben."}
            </p>
          </div>
        </div>
      )}

      {/* ── Topup return: cancelled ── */}
      {topupReturn === "cancel" && (
        <div className="rounded-2xl border border-amber-700/30 bg-amber-950/20 p-5 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm text-amber-300 mb-1">Aufladung abgebrochen</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {"Die Wallet-Aufladung wurde abgebrochen. Ihr Guthaben wurde nicht \u00e4ndern."}
            </p>
          </div>
        </div>
      )}

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
                  {`Dein ${bizLabel} ist ohne Premium weniger sichtbar in deiner Umgebung. Du verpasst potenzielle Kunden — Premium-Betriebe werden h\u00e4ufiger angezeigt.`}
                </p>
              </div>
            )}

            {/* Trial end date */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4 shrink-0" />
              <span>
                {"Testphase endet am "}
                <span className="font-semibold text-foreground">
                  {trial.trialEnd.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </span>
            </div>

            {/* Upgrade CTA */}
            <button
              className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm shadow-lg shadow-violet-500/20 hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
              onClick={handleCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Weiterleitung zu Stripe…</>
                : <>{`Jetzt f\u00fcr 39,90\u20AC / Monat fortsetzen`} <ArrowRight className="w-4 h-4" /></>
              }
            </button>
            <p className="text-[11px] text-center text-muted-foreground/60">
              Sichere Zahlung via Stripe. Jederzeit kündbar.
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
      {!isTrial && subscription?.status === "active" && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-violet-950/20 to-pink-950/10 p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-base">{PREMIUM_PLAN_NAME}</div>
                <div className="text-sm text-muted-foreground">{`RestoSmart \u00b7 ${bizLabel} \u00b7 Vollzugriff`}</div>
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
                <Calendar className="w-3 h-3" /> {`N\u00e4chste Abrechnung`}
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

          {/* Stripe Customer Portal */}
          {subscription?.stripeCustomerId && (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="flex items-center gap-2 text-xs text-primary/70 hover:text-primary transition-colors cursor-pointer"
            >
              {portalLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
              Zahlungsdetails & Rechnungen verwalten
            </button>
          )}
        </div>
      )}

      {/* ── PAST DUE state ── */}
      {subscription?.status === "past_due" && (
        <div className="rounded-2xl border border-red-700/40 bg-red-950/20 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div>
              <div className="font-bold text-base text-red-300">Zahlung fehlgeschlagen</div>
              <div className="text-sm text-muted-foreground">Bitte aktualisieren Sie Ihre Zahlungsmethode.</div>
            </div>
          </div>
          {subscription?.stripeCustomerId && (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Zahlungsmethode aktualisieren
            </button>
          )}
        </div>
      )}

      {/* ── INACTIVE / EXPIRED — show upgrade CTA ── */}
      {(!subscription || subscription.status === "inactive" || subscription.status === "expired" || subscription.status === "cancelled") && !isTrial && (
        <div className="rounded-2xl border border-border bg-muted/10 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-bold text-base">{PREMIUM_PLAN_NAME}</div>
              <div className="text-sm text-muted-foreground">{`39,90\u20AC / Monat`}</div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {subscription?.status === "expired"
              ? "Ihre Testphase ist abgelaufen. Abonnieren Sie, um wieder vollen Zugang zu erhalten."
              : subscription?.status === "cancelled"
              ? "Ihr Abonnement wurde gekündigt. Jetzt erneut aktivieren."
              : "Aktivieren Sie Premium, um Zugang zu allen Dashboard-Funktionen zu erhalten."}
          </p>
          <button
            className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm shadow-lg hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
            onClick={handleCheckout}
            disabled={checkoutLoading}
          >
            {checkoutLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Weiterleitung zu Stripe…</>
              : <>{`Premium aktivieren \u2014 39,90\u20AC/Monat`} <ArrowRight className="w-4 h-4" /></>
            }
          </button>
          <p className="text-[11px] text-center text-muted-foreground/60">
            Sichere Zahlung via Stripe. Jederzeit kündbar.
          </p>
        </div>
      )}

      {/* Where to manage */}
      <div className="rounded-2xl border border-border bg-muted/20 p-5 flex items-start gap-4">
        <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="font-semibold text-sm mb-1">
            {isTrial ? "Auf Premium upgraden" : "Abonnement verwalten"}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            {isTrial
              ? `Schalten Sie f\u00fcr \u20AC39,90/Monat frei und behalten Sie dauerhaften Zugang zu allen Premium-Funktionen. Zahlung \u00fcber Stripe \u2014 sicher und jederzeit k\u00fcndbar.`
              : subscription?.status === "active"
              ? "Ihr Premium-Abonnement ist aktiv. Alle Funktionen stehen Ihnen uneingeschränkt zur Verfügung."
              : "Aktivieren Sie Premium für vollen Zugang."}
          </p>
          {isTrial && (
            <button
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer disabled:opacity-60"
              onClick={handleCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
              Jetzt upgraden
            </button>
          )}
        </div>
      </div>

      {/* Cancel / End Trial zone */}
      {(isTrial || subscription?.status === "active") && (
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
      )}
    </div>
  );
}
