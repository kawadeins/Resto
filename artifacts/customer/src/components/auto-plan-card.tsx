/**
 * AutoPlanCard — proactive "the app knows what you want" suggestion card.
 * Shown on home page when Auto Plans engine says conditions are right.
 * Subtle, premium, and single-tap actionable.
 */
import { useState } from "react";
import { X, Zap, Users, MapPin, ChevronRight } from "lucide-react";
import type { MarketplaceRestaurant, MarketplaceFlashDeal } from "@workspace/api-client-react";
import type { LifestyleMode } from "@/hooks/use-lifestyle-mode";
import type { FriendProfile, RadarZone, SocialCue } from "@/lib/social-api";
import type { AutoPlanResult } from "@/lib/auto-plans-engine";
import { recordOutcome } from "@/lib/auto-plans-engine";
import { InstantPlanButton } from "@/components/instant-plan-button";
import { nameInitials } from "@/lib/social-api";
import { Star } from "lucide-react";

interface AutoPlanCardProps {
  autoPlan: AutoPlanResult;
  email: string;
  restaurants: MarketplaceRestaurant[];
  flashDeals: MarketplaceFlashDeal[];
  friends: FriendProfile[];
  radarZones: RadarZone[];
  cues: Record<string, SocialCue>;
  mode: LifestyleMode;
  onPlanCreated?: (planId: number) => void;
}

export function AutoPlanCard({
  autoPlan, email, restaurants, flashDeals, friends, radarZones, cues, mode, onPlanCreated,
}: AutoPlanCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !autoPlan.isReady || !autoPlan.suggestion) return null;

  const { suggestion, triggerReason } = autoPlan;
  const r = suggestion.restaurant;
  const biz = (r as any).businessType ?? "restaurant";
  const bgCls = biz === "cafe" ? "from-amber-400/20 to-orange-400/10"
    : biz === "bar"  ? "from-indigo-400/20 to-violet-400/10"
    : "from-primary/15 to-accent/10";

  const handleDismiss = () => {
    recordOutcome(suggestion.mode, "dismissed");
    setDismissed(true);
  };

  const handlePlanCreated = (planId: number) => {
    recordOutcome(suggestion.mode, "accepted");
    onPlanCreated?.(planId);
  };

  return (
    <section className="px-4 py-4">
      <div className="container mx-auto max-w-6xl">
        <div className={`relative overflow-hidden rounded-3xl border border-primary/15 shadow-xl bg-gradient-to-br ${bgCls} backdrop-blur-sm`}>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/70 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="p-5 space-y-4">
            {/* Header label */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-background/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border/30 shadow-sm">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-extrabold text-primary">Vorschlag für heute</span>
              </div>
              <span className="text-xs text-muted-foreground">{triggerReason}</span>
            </div>

            {/* Main content row */}
            <div className="flex gap-4 items-start">
              {/* Restaurant image/emoji */}
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-muted shadow-lg">
                  {r.heroImage ? (
                    <img src={r.heroImage} alt={r.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      {r.cuisineEmoji}
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl bg-white shadow-md border border-border/30 flex items-center justify-center text-base">
                  {suggestion.modeConfig.emoji}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-base leading-tight line-clamp-1">{r.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{suggestion.modeConfig.label}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-white/60 backdrop-blur-sm px-2 py-1 rounded-full shrink-0 shadow-sm">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold">{r.rating.toFixed(1)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0 text-primary/50" />
                  <span className="line-clamp-1">{r.city}</span>
                </div>

                {/* Friend avatars */}
                {suggestion.invitedFriends.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex -space-x-2">
                      {suggestion.invitedFriends.slice(0, 3).map(f => (
                        <div
                          key={f.email}
                          className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent border-2 border-background flex items-center justify-center"
                        >
                          {f.photoUrl
                            ? <img src={f.photoUrl} alt={f.name} className="w-full h-full rounded-full object-cover" />
                            : <span className="text-white text-[8px] font-bold">{nameInitials(f.name || f.email)}</span>
                          }
                        </div>
                      ))}
                    </div>
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      {suggestion.invitedFriends.length === 1
                        ? suggestion.invitedFriends[0].name?.split(" ")[0]
                        : `${suggestion.invitedFriends.length} Freunde einladen`}
                    </span>
                  </div>
                )}

                {/* Urgency */}
                {suggestion.urgencyLabel && (
                  <div className="mt-2">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-background/60 border border-border/30 text-foreground/80">
                      {suggestion.urgencyLabel}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* CTA row */}
            <div className="flex items-center gap-3">
              <InstantPlanButton
                email={email}
                restaurants={restaurants}
                flashDeals={flashDeals}
                friends={friends}
                radarZones={radarZones}
                cues={cues}
                mode={mode}
                variant="card"
                initialPlanMode={suggestion.mode}
                initialSuggestion={suggestion}
                onPlanCreated={handlePlanCreated}
                className="flex-1"
              />
              <div className="text-xs font-bold text-muted-foreground bg-background/60 px-3 py-3 rounded-2xl border border-border/30 text-center leading-tight">
                {suggestion.suggestedTime}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
