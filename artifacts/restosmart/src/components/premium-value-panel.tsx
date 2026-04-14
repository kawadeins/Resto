/**
 * PremiumValuePanel — high-conversion upgrade block.
 * Animated gradient, glass overlay, glow, pulsing CTA.
 * Business-type-aware — used across the restosmart dashboard.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Crown, X, Check, Zap } from "lucide-react";

interface PremiumValuePanelProps {
  businessType?: string;
  onDismiss?: () => void;
  onUpgrade?: () => void;
  compact?: boolean;
}

const FEATURES = [
  "premium.feature_visibility",
  "premium.feature_instant_bookings",
  "premium.feature_marketing",
  "premium.feature_analytics",
];

function triggerUpgrade() {
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  localStorage.setItem("restosmart_owner_premium", "trial");
  localStorage.setItem("restosmart_trial_end", trialEnd);
  localStorage.setItem("restosmart_trial_started", new Date().toISOString());
  window.location.reload();
}

/* ── Compact inline variant ─────────────────────────────────────────────────── */
function CompactPanel({ onDismiss, onUpgrade }: { onDismiss?: () => void; onUpgrade?: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl"
    >
      {/* Animated gradient bg */}
      <div className="absolute inset-0 premium-gradient-bg rounded-2xl" />
      {/* Glass layer */}
      <div className="absolute inset-0 rounded-2xl bg-black/10 backdrop-blur-[2px]" />

      <div className="relative z-10 flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
          <Crown className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-white leading-tight">
            {t("premium.grow_headline", { defaultValue: "Grow faster with Premium" })}
          </p>
          <p className="text-[11px] text-white/70 truncate">{t("billing.activate_cta", { defaultValue: "14 days free trial" })}</p>
        </div>
        <button
          onClick={onUpgrade ?? triggerUpgrade}
          className="shrink-0 px-4 py-2 rounded-xl bg-white text-[13px] font-extrabold hover:scale-[1.02] active:scale-[0.97] transition-transform cursor-pointer"
          style={{ color: "hsl(263,70%,42%)" }}
        >
          {t("premium.cta_start", { defaultValue: "Get started" })}
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
          >
            <X className="w-3 h-3 text-white/80" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ── Full upgrade card ───────────────────────────────────────────────────────── */
export function PremiumValuePanel({
  onDismiss,
  onUpgrade,
  compact = false,
}: PremiumValuePanelProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleUpgrade = () => {
    (onUpgrade ?? triggerUpgrade)();
  };

  if (compact) {
    return dismissed ? null : (
      <CompactPanel onDismiss={onDismiss ? handleDismiss : undefined} onUpgrade={handleUpgrade} />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl"
      style={{
        boxShadow:
          "0 0 0 1px rgba(124,58,237,0.25), 0 8px 40px rgba(124,58,237,0.30), 0 20px 80px rgba(236,72,153,0.15)",
      }}
    >
      {/* ── Animated gradient background ── */}
      <div className="absolute inset-0 premium-gradient-bg rounded-3xl" />

      {/* ── Outer glow layer (pulsing) ── */}
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none premium-glow"
        style={{
          boxShadow: "inset 0 0 60px rgba(255,255,255,0.06)",
        }}
      />

      {/* ── Glass overlay ── */}
      <div className="absolute inset-0 rounded-3xl backdrop-blur-[1px] bg-black/8" />

      {/* ── Decorative orb top-right ── */}
      <div
        className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)" }}
      />

      {/* ── Dismiss button ── */}
      {onDismiss && (
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 z-20 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5 text-white/70" />
        </button>
      )}

      {/* ── Content ── */}
      <div className="relative z-10 p-6 space-y-5">

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 backdrop-blur-sm">
          <span className="text-[12px]">{"🔥"}</span>
          <span className="text-[11px] font-black text-white tracking-wide">
            {"14 Tage kostenlos testen"}
          </span>
        </div>

        {/* Title + subtext */}
        <div>
          <h3 className="text-[22px] font-extrabold text-white leading-tight">
            {"Wachse schneller mit Premium"}
          </h3>
          <p className="text-sm text-white/65 mt-1.5 leading-relaxed">
            {"Mehr Gäste, mehr Umsatz \u2013 automatisiert."}
          </p>
        </div>

        {/* Feature list */}
        <div className="space-y-2.5">
          {FEATURES.map((f) => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
              <span className="text-sm font-semibold text-white/90">{t(f)}</span>
            </div>
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={handleUpgrade}
          className="premium-cta-pulse w-full py-4 rounded-2xl bg-white font-extrabold text-[15px] hover:scale-[1.02] active:scale-[0.97] transition-transform cursor-pointer mt-1"
          style={{ color: "hsl(263,70%,42%)" }}
        >
          <span className="flex items-center justify-center gap-2">
            <Zap className="w-4 h-4" />
            {t("premium.cta_free", { defaultValue: "Start free now" })}
          </span>
        </button>

        {/* Trust signal */}
        <p className="text-center text-[11px] text-white/45 leading-relaxed">
          {"Jederzeit k\u00FCndbar \u2013 keine versteckten Kosten"}
        </p>
      </div>
    </motion.div>
  );
}

export default PremiumValuePanel;
