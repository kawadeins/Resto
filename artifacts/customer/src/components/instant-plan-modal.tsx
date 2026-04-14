/**
 * InstantPlanModal — the "Plan in 1 Tap" confirm flow.
 *
 * Step 1: Mode picker (quick_coffee / lunch / dinner / night_out / trending)
 * Step 2: Review generated suggestion (venue, friends, time)
 * Step 3: Confirming... → success
 *
 * Designed to feel fast, premium, and social.
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, ChevronRight, Check, Loader2, Users, Clock, MapPin, Zap, RefreshCw, Star } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import type { MarketplaceRestaurant, MarketplaceFlashDeal } from "@workspace/api-client-react";
import type { LifestyleMode } from "@/hooks/use-lifestyle-mode";
import type { FriendProfile, RadarZone, SocialCue } from "@/lib/social-api";
import { PLAN_MODES, generateInstantPlan, getAutoMode, type PlanMode, type InstantPlanSuggestion } from "@/lib/instant-plan-engine";
import { createInstantPlan } from "@/lib/instant-plans-api";
import { nameInitials } from "@/lib/social-api";

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModeChip({ cfg, selected, onClick }: {
  cfg: typeof PLAN_MODES[0];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 press-scale flex-1 min-w-[80px]
        ${selected
          ? "border-primary bg-primary/8 shadow-md shadow-primary/20"
          : "border-border/50 bg-card hover:border-primary/30 hover:bg-muted/30"
        }`}
    >
      <span className="text-2xl">{cfg.emoji}</span>
      <span className={`text-[11px] font-extrabold text-center leading-tight ${selected ? "text-primary" : "text-muted-foreground"}`}>
        {cfg.shortLabel}
      </span>
    </button>
  );
}

function FriendAvatar({ friend }: { friend: FriendProfile }) {
  if (friend.photoUrl) {
    return (
      <div className="flex flex-col items-center gap-1">
        <img src={friend.photoUrl} alt={friend.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20" />
        <span className="text-[10px] font-semibold text-muted-foreground truncate max-w-[48px] text-center">
          {friend.name?.split(" ")[0]}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center ring-2 ring-primary/20">
        <span className="text-white font-bold text-xs">{nameInitials(friend.name || friend.email)}</span>
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground truncate max-w-[48px] text-center">
        {(friend.name || friend.email)?.split(" ")[0]}
      </span>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

type Step = "mode" | "review" | "confirming" | "success";

interface InstantPlanModalProps {
  email: string;
  restaurants: MarketplaceRestaurant[];
  flashDeals: MarketplaceFlashDeal[];
  friends: FriendProfile[];
  radarZones: RadarZone[];
  cues: Record<string, SocialCue>;
  mode: LifestyleMode;
  initialPlanMode?: PlanMode;
  initialSuggestion?: InstantPlanSuggestion | null;
  onClose: () => void;
  onPlanCreated?: (planId: number) => void;
}

export function InstantPlanModal({
  email, restaurants, flashDeals, friends, radarZones, cues, mode,
  initialPlanMode, initialSuggestion, onClose, onPlanCreated,
}: InstantPlanModalProps) {
  const { t } = useTranslation();
  const hour = new Date().getHours();
  const [step, setStep] = useState<Step>(initialSuggestion ? "review" : "mode");
  const [planMode, setPlanMode] = useState<PlanMode>(initialPlanMode ?? getAutoMode(hour));
  const [suggestion, setSuggestion] = useState<InstantPlanSuggestion | null>(initialSuggestion ?? null);
  const [selectedFriends, setSelectedFriends] = useState<FriendProfile[]>(initialSuggestion?.invitedFriends ?? []);
  const [createdPlanId, setCreatedPlanId] = useState<number | null>(null);

  // Generate suggestion when mode changes
  function regenerate(pm: PlanMode) {
    const s = generateInstantPlan({ restaurants, flashDeals, friends, radarZones, cues, mode, planMode: pm });
    setSuggestion(s);
    if (s) setSelectedFriends(s.invitedFriends);
  }

  const handleModeSelect = (pm: PlanMode) => {
    setPlanMode(pm);
    regenerate(pm);
    setStep("review");
  };

  const handleRegenerate = () => regenerate(planMode);

  const toggleFriend = (f: FriendProfile) => {
    setSelectedFriends(prev =>
      prev.find(x => x.email === f.email)
        ? prev.filter(x => x.email !== f.email)
        : [...prev, f]
    );
  };

  const confirm = useMutation({
    mutationFn: async () => {
      if (!suggestion) throw new Error("No suggestion");
      return createInstantPlan({
        creatorEmail: email,
        restaurantId: suggestion.restaurant.id,
        restaurantName: suggestion.restaurant.name,
        restaurantEmoji: suggestion.restaurant.cuisineEmoji ?? "🍽️",
        restaurantAddress: `${(suggestion.restaurant as any).address ?? ""}, ${suggestion.restaurant.city}`,
        mode: planMode,
        suggestedTime: suggestion.suggestedTimeRaw,
        invitedEmails: selectedFriends.map(f => f.email),
        data: { urgencyLabel: suggestion.urgencyLabel, score: suggestion.score },
      });
    },
    onSuccess: (plan) => {
      setCreatedPlanId(plan.id);
      setStep("success");
      setTimeout(() => {
        onPlanCreated?.(plan.id);
        onClose();
      }, 2200);
    },
  });

  // Step: mode picker
  const renderModeStep = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold mb-1">{t("meal_plan.modal_what")}</h2>
        <p className="text-sm text-muted-foreground">{t("meal_plan.modal_pick_style")}</p>
      </div>
      <div className="flex gap-3 flex-wrap">
        {PLAN_MODES.map(cfg => (
          <ModeChip
            key={cfg.id}
            cfg={cfg}
            selected={planMode === cfg.id}
            onClick={() => handleModeSelect(cfg.id)}
          />
        ))}
      </div>
    </div>
  );

  // Step: review suggestion
  const renderReviewStep = () => {
    if (!suggestion) {
      return (
        <div className="text-center py-8 space-y-3">
          <div className="text-4xl">😔</div>
          <p className="font-bold">{t("meal_plan.modal_no_places")}</p>
          <p className="text-sm text-muted-foreground">{t("meal_plan.modal_no_places_hint")}</p>
          <button onClick={() => setStep("mode")} className="text-primary font-bold text-sm underline">
            {t("meal_plan.modal_other_style")}
          </button>
        </div>
      );
    }

    const r = suggestion.restaurant;
    const biz = (r as any).businessType ?? "restaurant";
    const bgCls = biz === "cafe" ? "from-amber-100 to-orange-100"
      : biz === "bar"  ? "from-rose-100 to-purple-100"
      : "from-primary/15 to-accent/15";

    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-extrabold mb-0.5">{t("meal_plan.modal_your_plan")}</h2>
            <p className="text-sm text-muted-foreground">{suggestion.modeConfig.emoji} {suggestion.modeConfig.label}</p>
          </div>
          <button
            onClick={handleRegenerate}
            className="p-2 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            title={t("meal_plan.modal_suggest_other")}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Venue card */}
        <div className="rounded-2xl overflow-hidden border border-border/50 shadow-md">
          <div className={`relative aspect-[16/7] bg-gradient-to-br ${bgCls} flex items-center justify-center`}>
            {r.heroImage ? (
              <img src={r.heroImage} alt={r.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-5xl">{r.cuisineEmoji}</span>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <h3 className="text-white font-extrabold text-lg leading-tight drop-shadow">{r.name}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-white/80 text-xs">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {r.rating.toFixed(1)}
                </span>
                {suggestion.urgencyLabel && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-white border border-white/30">
                    {suggestion.urgencyLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-3 space-y-2 bg-card">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              <span className="line-clamp-1">{(r as any).address}, {r.city}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              <span>{r.openTime} – {r.closeTime}</span>
              <span className="ml-auto font-bold text-primary">{suggestion.suggestedTime}</span>
            </div>
          </div>
        </div>

        {/* Friend selector */}
        {friends.length > 0 && (
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground/60 mb-3">
              {t("meal_plan.modal_invite", { selected: selectedFriends.length, total: friends.length })}
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {friends.map(f => {
                const sel = !!selectedFriends.find(x => x.email === f.email);
                return (
                  <div
                    key={f.email}
                    onClick={() => toggleFriend(f)}
                    className={`relative cursor-pointer transition-all duration-150 press-scale ${sel ? "opacity-100" : "opacity-50 hover:opacity-75"}`}
                  >
                    <FriendAvatar friend={f} />
                    {sel && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary border-2 border-background flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Confirm */}
        <button
          onClick={() => confirm.mutate()}
          disabled={confirm.isPending}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-extrabold text-base shadow-xl shadow-primary/30 press-scale hover:shadow-2xl transition-all"
        >
          {confirm.isPending ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> {t("meal_plan.modal_creating")}</>
          ) : (
            <><Zap className="w-5 h-5" /> {t("meal_plan.modal_confirm", { time: suggestion.suggestedTime })}</>
          )}
        </button>

        <button
          onClick={() => setStep("mode")}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          {t("meal_plan.modal_other_style")}
        </button>
      </div>
    );
  };

  const renderSuccess = () => (
    <div className="text-center py-8 space-y-4">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl mx-auto shadow-2xl shadow-primary/30 animate-bounce">
        🚀
      </div>
      <div>
        <h2 className="text-2xl font-extrabold mb-1">{t("meal_plan.modal_created")}</h2>
        <p className="text-sm text-muted-foreground">
          {selectedFriends.length > 0
            ? t("meal_plan.modal_invited_other", { count: selectedFriends.length })
            : t("meal_plan.modal_ready")}
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-2xl py-3 px-4">
        <Check className="w-5 h-5" />
        <span className="font-bold text-sm">{t("meal_plan.modal_invites_sent")}</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-md sm:mx-4 bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Handle */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pt-3 pb-4 px-6 border-b border-border/30">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/25 mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <span className="font-extrabold text-base">{t("meal_plan.modal_header")}</span>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-muted/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress dots */}
          {step !== "success" && (
            <div className="flex items-center gap-1.5 mt-3">
              {(["mode", "review"] as Step[]).map((s, i) => (
                <div
                  key={s}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    step === s ? "bg-primary flex-[2]" : "bg-muted-foreground/20 flex-1"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-6">
          {step === "mode"       && renderModeStep()}
          {step === "review"     && renderReviewStep()}
          {step === "confirming" && <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
          {step === "success"    && renderSuccess()}
        </div>
      </div>
    </div>
  );
}
