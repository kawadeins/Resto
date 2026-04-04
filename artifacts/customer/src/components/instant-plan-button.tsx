/**
 * InstantPlanButton — the "⚡ Plan starten" action button.
 * Premium, pulsing, and action-oriented.
 * Shown prominently on home, map, and social surfaces.
 */
import { useState } from "react";
import { Zap } from "lucide-react";
import { InstantPlanModal } from "@/components/instant-plan-modal";
import type { MarketplaceRestaurant, MarketplaceFlashDeal } from "@workspace/api-client-react";
import type { LifestyleMode } from "@/hooks/use-lifestyle-mode";
import type { FriendProfile, RadarZone, SocialCue } from "@/lib/social-api";
import type { PlanMode, InstantPlanSuggestion } from "@/lib/instant-plan-engine";

interface InstantPlanButtonProps {
  email: string;
  restaurants: MarketplaceRestaurant[];
  flashDeals: MarketplaceFlashDeal[];
  friends: FriendProfile[];
  radarZones: RadarZone[];
  cues: Record<string, SocialCue>;
  mode: LifestyleMode;
  variant?: "hero" | "fab" | "inline" | "card";
  initialPlanMode?: PlanMode;
  initialSuggestion?: InstantPlanSuggestion | null;
  onPlanCreated?: (planId: number) => void;
  className?: string;
}

export function InstantPlanButton({
  email, restaurants, flashDeals, friends, radarZones, cues, mode,
  variant = "inline", initialPlanMode, initialSuggestion, onPlanCreated, className,
}: InstantPlanButtonProps) {
  const [open, setOpen] = useState(false);

  if (!email) return null;

  const handleClick = () => setOpen(true);

  const button = (() => {
    switch (variant) {
      case "hero":
        return (
          <button
            onClick={handleClick}
            className={`group relative overflow-hidden flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-extrabold text-lg shadow-2xl shadow-primary/40 press-scale hover:shadow-3xl transition-all duration-200 ${className ?? ""}`}
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Zap className="w-6 h-6" />
            <span>Plan starten</span>
            {/* Pulse ring */}
            <span className="absolute -inset-0.5 rounded-2xl animate-ping opacity-20 bg-primary pointer-events-none" />
          </button>
        );

      case "fab":
        return (
          <button
            onClick={handleClick}
            className={`fixed bottom-24 right-5 z-40 flex items-center gap-2 px-5 py-3.5 rounded-full bg-gradient-to-r from-primary to-accent text-white font-extrabold shadow-2xl shadow-primary/40 press-scale active:scale-95 transition-all duration-200 ${className ?? ""}`}
          >
            <Zap className="w-5 h-5" />
            <span className="text-sm">Plan</span>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-accent" />
            </span>
          </button>
        );

      case "card":
        return (
          <button
            onClick={handleClick}
            className={`flex items-center justify-center gap-2 w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-bold text-sm shadow-lg shadow-primary/25 press-scale transition-all duration-200 ${className ?? ""}`}
          >
            <Zap className="w-4 h-4" />
            Plan starten
          </button>
        );

      default: // inline
        return (
          <button
            onClick={handleClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-bold text-sm shadow-md shadow-primary/25 press-scale transition-all duration-200 ${className ?? ""}`}
          >
            <Zap className="w-4 h-4" />
            Plan starten
          </button>
        );
    }
  })();

  return (
    <>
      {button}
      {open && (
        <InstantPlanModal
          email={email}
          restaurants={restaurants}
          flashDeals={flashDeals}
          friends={friends}
          radarZones={radarZones}
          cues={cues}
          mode={mode}
          initialPlanMode={initialPlanMode}
          initialSuggestion={initialSuggestion}
          onClose={() => setOpen(false)}
          onPlanCreated={onPlanCreated}
        />
      )}
    </>
  );
}
