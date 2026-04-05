/**
 * PremiumValuePanel — contextual upsell for non-premium businesses.
 * Business-type-aware messaging. Never aggressive — shown once at high-intent moments.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, X, CheckCircle2 } from "lucide-react";
import { PREMIUM_VALUE_BY_TYPE, PREMIUM_PRICE_DISPLAY, PREMIUM_PLAN_NAME } from "@/lib/monetization-engine";

interface PremiumValuePanelProps {
  businessType: string;
  onDismiss?: () => void;
  compact?: boolean;
}

export function PremiumValuePanel({ businessType, onDismiss, compact = false }: PremiumValuePanelProps) {
  const [dismissed, setDismissed] = useState(false);

  const cfg = PREMIUM_VALUE_BY_TYPE[businessType] ?? PREMIUM_VALUE_BY_TYPE.restaurant;

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (compact) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/8 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">{cfg.headline}</div>
            <div className="text-xs text-muted-foreground truncate">{cfg.subline}</div>
          </div>
          <Button size="sm" className="shrink-0 bg-gradient-to-r from-primary to-accent text-white border-0 hover:opacity-90 cursor-pointer"
            onClick={() => {
              const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
              localStorage.setItem("restosmart_owner_premium", "trial");
              localStorage.setItem("restosmart_trial_end", trialEnd);
              window.location.reload();
            }}
          >
            Freischalten
          </Button>
          {onDismiss && (
            <button onClick={handleDismiss} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-accent/5 shadow-lg shadow-primary/10 relative overflow-hidden">
        {/* Decorative gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-accent/15 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        {onDismiss && (
          <button onClick={handleDismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors z-10">
            <X className="w-4 h-4" />
          </button>
        )}

        <CardContent className="p-6 space-y-5 relative z-10">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-lg shadow-primary/25">
              <Crown className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-1">{PREMIUM_PLAN_NAME}</div>
              <h3 className="text-xl font-extrabold leading-tight">{cfg.headline}</h3>
              <p className="text-sm text-muted-foreground mt-1">{cfg.subline}</p>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-lg font-bold text-foreground">{PREMIUM_PRICE_DISPLAY}</span>
                <span className="text-xs text-muted-foreground">/Monat</span>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="grid sm:grid-cols-2 gap-2">
            {cfg.benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                <span className="text-base shrink-0">{b.icon}</span>
                <span className="text-foreground/80 leading-snug">{b.text}</span>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-2.5 py-3 px-4 rounded-xl bg-primary/8 border border-primary/15">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs text-foreground/70 leading-snug">{cfg.socialProof}</p>
          </div>

          {/* CTA */}
          <Button size="lg" className="w-full bg-gradient-to-r from-primary to-accent text-white border-0 hover:opacity-90 shadow-lg shadow-primary/25 font-bold h-12 rounded-xl cursor-pointer"
            onClick={() => {
              const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
              localStorage.setItem("restosmart_owner_premium", "trial");
              localStorage.setItem("restosmart_trial_end", trialEnd);
              window.location.reload();
            }}
          >
            <Crown className="w-4 h-4 mr-2" />
            Premium freischalten
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            14 Tage kostenlos · Jederzeit kündbar
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
