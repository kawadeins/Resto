import { useState } from "react";
import { useCancelSubscription } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, Crown, Calendar, ExternalLink, AlertTriangle, Shield,
} from "lucide-react";
import {
  getBizType,
  BIZ_LABEL,
  BIZ_POSSESSIVE,
  BIZ_MENU_EDITOR_LABEL,
  BIZ_TABLE_MODULE_LABEL,
  BIZ_RESERVATION_LABEL,
} from "@/lib/biz-copy";
import { PREMIUM_PRICE_DISPLAY, PREMIUM_PLAN_NAME, FEATURE_TIERS } from "@/lib/monetization-engine";

export default function Billing() {
  const { toast } = useToast();
  const cancelSubscription = useCancelSubscription();
  const biz = getBizType();
  const bizLabel = BIZ_LABEL[biz];
  const bizPossessive = BIZ_POSSESSIVE[biz];
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const customerProfileUrl = window.location.origin + "/customer/profile";

  const handleCancel = () => {
    cancelSubscription.mutate({}, {
      onSuccess: () => {
        localStorage.removeItem("restosmart_owner_premium");
        localStorage.removeItem("restosmart_owner_email");
        setCancelled(true);
        toast({ title: "Abonnement gekündigt", description: "Ihr Zugang bleibt bis zum Ende des Abrechnungszeitraums aktiv." });
      },
      onError: () => {
        localStorage.removeItem("restosmart_owner_premium");
        localStorage.removeItem("restosmart_owner_email");
        setCancelled(true);
        toast({ title: "Abonnement beendet" });
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
          <h2 className="text-xl font-bold mb-2">Abonnement gekündigt</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {bizLabel} Premium-Abonnement wurde beendet. Sie können es jederzeit über Ihr Kundenprofil reaktivieren.
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
          {bizPossessive} aktiver Premium-Plan und Abrechnungsdetails.
        </p>
      </div>

      {/* Active plan card */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-violet-950/20 to-pink-950/10 p-6 space-y-5">
        {/* Plan header */}
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

        {/* Plan details */}
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
              {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("de-DE", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
        </div>

        {/* Included modules */}
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

      {/* Where to manage */}
      <div className="rounded-2xl border border-border bg-muted/20 p-5 flex items-start gap-4">
        <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="font-semibold text-sm mb-1">Abonnement wird im Kundenprofil verwaltet</div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Pläne, Zahlungsmethoden und Upgrades werden ausschließlich über das Kundenprofil gesteuert — dem zentralen Ort für Ihre Premium-Mitgliedschaft.
          </p>
          <a
            href={customerProfileUrl}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            Zum Kundenprofil
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Cancel zone */}
      <div className="rounded-2xl border border-red-900/30 bg-red-950/10 p-5">
        <h3 className="font-bold text-sm text-red-400 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Abonnement kündigen
        </h3>

        {showCancelConfirm ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sind Sie sicher? Nach der Kündigung verlieren Sie den Zugang zum Dashboard am Ende des aktuellen Abrechnungszeitraums.
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
                {cancelSubscription.isPending ? "Wird verarbeitet…" : "Endgültig kündigen"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Das Kündigen beendet Ihren Premium-Zugang zum Dashboard und alle damit verbundenen Funktionen.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-red-800/40 text-red-400 hover:bg-red-950/30 hover:border-red-700/50"
              onClick={() => setShowCancelConfirm(true)}
            >
              Abonnement kündigen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
