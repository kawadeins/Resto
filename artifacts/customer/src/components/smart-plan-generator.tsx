/**
 * SmartPlanGenerator — generates a dining/outing plan in one tap.
 * Triggered as a modal from home page, meal plan page, or group flow.
 * Mobile-first, premium UX with animated steps.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Sparkles, RefreshCw, Users, Calendar, Clock,
  MapPin, Star, ChevronRight, Check, Share2, Loader2,
  Heart, Coffee, Moon, Utensils, Wine, UtensilsCrossed,
  BookOpen, ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const GRAD = "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))";

// ── Plan types ────────────────────────────────────────────────────────────────
const PLAN_TYPES = [
  { id: "dinner",    label: "Dinner",    emoji: "🍽️", Icon: Utensils,        desc: "Abendessen" },
  { id: "brunch",    label: "Brunch",    emoji: "🥂", Icon: Coffee,           desc: "Brunch & Frühstück" },
  { id: "nightlife", label: "Nightlife", emoji: "🌙", Icon: Moon,             desc: "Bar & Nachtleben" },
  { id: "date",      label: "Date Night",emoji: "❤️", Icon: Heart,            desc: "Romantisch" },
  { id: "cafe",      label: "Café",      emoji: "☕", Icon: Coffee,           desc: "Kaffee & Kuchen" },
  { id: "group",     label: "Gruppe",    emoji: "👥", Icon: Users,            desc: "Gruppenplan" },
];

const VIBES = [
  { id: "cozy",        label: "Gemütlich",     emoji: "🕯️" },
  { id: "lively",      label: "Lebendig",      emoji: "⚡" },
  { id: "romantic",    label: "Romantisch",    emoji: "🌹" },
  { id: "traditional", label: "Traditionell",  emoji: "🏛️" },
  { id: "exotic",      label: "Exotisch",      emoji: "🌏" },
  { id: "premium",     label: "Premium",       emoji: "✨" },
];

const GROUP_SIZES = [1, 2, 3, 4, 6, 8, 10, 12];

// ── Types ─────────────────────────────────────────────────────────────────────
interface PlanPlace {
  id: number;
  name: string;
  cuisine: string;
  cuisineEmoji: string;
  address: string;
  rating: number;
  priceRange: number;
  heroImage: string | null;
  reason: string;
  fitLabel: string;
  isFeatured: boolean;
}

interface GeneratedPlan {
  title: string;
  subtitle: string;
  planType: string;
  date: string | null;
  time: string | null;
  groupSize: number;
  vibe: string;
  followUp: string;
  mainPlace: PlanPlace;
  alternativePlace: PlanPlace | null;
  tags: string[];
  isGroupFriendly: boolean;
}

interface GenerateResponse {
  plan: GeneratedPlan;
  hasPersonal: boolean;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface SmartPlanGeneratorProps {
  open: boolean;
  onClose: () => void;
  email: string;
  initialPlanType?: string;
  initialGroupSize?: number;
  /** Called when user taps "Als Gruppenplan verwenden" */
  onConvertToGroupPlan?: (plan: GeneratedPlan) => void;
}

// ── Star row ──────────────────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className={`w-3.5 h-3.5 ${i < full ? "text-amber-400" : "text-muted-foreground/20"}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-xs font-bold text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

// ── Place card ────────────────────────────────────────────────────────────────
function PlaceCard({
  place,
  isAlternative = false,
}: {
  place: PlanPlace;
  isAlternative?: boolean;
}) {
  const imgSrc = place.heroImage?.startsWith("/api")
    ? `${API_BASE}${place.heroImage}`
    : place.heroImage ?? null;

  return (
    <Link href={`/restaurant/${place.id}`}>
      <div
        className={`group relative overflow-hidden rounded-3xl border transition-all duration-200 hover:shadow-lg active:scale-[0.98] cursor-pointer ${
          isAlternative
            ? "border-border/40 bg-muted/30"
            : "border-primary/20 bg-card shadow-sm"
        }`}
      >
        {/* Image */}
        {imgSrc ? (
          <div className="relative h-[160px] overflow-hidden">
            <img
              src={imgSrc}
              alt={place.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {!isAlternative && (
              <div
                className="absolute top-3 left-3 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-white px-3 py-1 rounded-full shadow-lg"
                style={{ background: GRAD }}
              >
                <Sparkles className="w-3 h-3" />
                {place.fitLabel}
              </div>
            )}
            {isAlternative && (
              <div className="absolute top-3 left-3 inline-flex items-center gap-1 text-[11px] font-bold bg-black/50 text-white px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                Alternative
              </div>
            )}
          </div>
        ) : (
          <div
            className="relative h-[160px] flex items-center justify-center text-6xl"
            style={{
              background: isAlternative
                ? "hsl(0 0% 95%)"
                : "linear-gradient(135deg,hsl(263,70%,52%,0.15),hsl(330,85%,58%,0.15))",
            }}
          >
            {place.cuisineEmoji}
            {!isAlternative && (
              <div
                className="absolute top-3 left-3 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-white px-3 py-1 rounded-full shadow-lg"
                style={{ background: GRAD }}
              >
                <Sparkles className="w-3 h-3" />
                {place.fitLabel}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base leading-tight line-clamp-1">{place.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="line-clamp-1">{place.address}</span>
              </p>
            </div>
            <span className="text-xl leading-none shrink-0">{place.cuisineEmoji}</span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <Stars rating={place.rating} />
            <span className="text-xs font-semibold text-muted-foreground">
              {"€".repeat(place.priceRange)}{"·".repeat(Math.max(0, 3 - place.priceRange))}
            </span>
          </div>

          <div
            className="text-xs font-semibold px-3 py-1.5 rounded-full text-center"
            style={{
              background: isAlternative ? "hsl(0 0% 95%)" : "hsl(263 70% 52% / 0.09)",
              color: isAlternative ? "hsl(0 0% 40%)" : "hsl(263,70%,48%)",
            }}
          >
            {place.reason}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function SmartPlanGenerator({
  open,
  onClose,
  email,
  initialPlanType = "dinner",
  initialGroupSize = 2,
  onConvertToGroupPlan,
}: SmartPlanGeneratorProps) {
  const [step, setStep] = useState<"form" | "result">("form");
  const [planType, setPlanType] = useState(initialPlanType);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [groupSize, setGroupSize] = useState(initialGroupSize);
  const [vibe, setVibe] = useState("cozy");
  const [showAlternative, setShowAlternative] = useState(false);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation<GenerateResponse, Error>({
    mutationFn: () =>
      fetch(`${API_BASE}/api/smart-plan/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, planType, date, time, groupSize, vibe }),
      }).then(async r => {
        if (!r.ok) throw new Error("Generierung fehlgeschlagen");
        return r.json();
      }),
    onSuccess: () => setStep("result"),
  });

  const plan = mutation.data?.plan;

  const handleRegenerate = () => {
    setShowAlternative(false);
    setSaved(false);
    mutation.mutate();
  };

  const handleBack = () => {
    setStep("form");
    mutation.reset();
    setShowAlternative(false);
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleShare = async () => {
    if (!plan) return;
    const text = `${plan.title} 🍽️\n${plan.mainPlace.name}\n${plan.mainPlace.address}\n\nErstellt mit RestoSmart`;
    try {
      if (navigator.share) {
        await navigator.share({ title: plan.title, text });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch { /* noop */ }
  };

  const handleConvertToGroup = () => {
    if (plan && onConvertToGroupPlan) {
      onConvertToGroupPlan(plan);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-background shadow-2xl"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md"
                  style={{ background: GRAD }}
                >
                  <Sparkles className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h2 className="font-extrabold text-lg leading-none">Smart Plan</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step === "form" ? "Was planst du?" : plan?.title ?? ""}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              {step === "form" ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="px-5 pb-8 space-y-6"
                >
                  {/* Plan type */}
                  <div>
                    <p className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wide text-[11px]">
                      Art des Plans
                    </p>
                    <div className="grid grid-cols-3 gap-2.5">
                      {PLAN_TYPES.map(pt => (
                        <button
                          key={pt.id}
                          onClick={() => setPlanType(pt.id)}
                          className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 font-semibold text-sm transition-all active:scale-95 ${
                            planType === pt.id
                              ? "border-primary/60 text-primary shadow-sm"
                              : "border-border/50 bg-muted/30 text-muted-foreground hover:border-primary/30"
                          }`}
                          style={planType === pt.id ? { background: "hsl(263 70% 52% / 0.07)" } : {}}
                        >
                          <span className="text-2xl">{pt.emoji}</span>
                          <span className="text-[12px] font-bold leading-tight text-center">{pt.label}</span>
                          {planType === pt.id && (
                            <div
                              className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ background: GRAD }}
                            >
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date + Time */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                        Datum
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <input
                          type="date"
                          value={date}
                          onChange={e => setDate(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 rounded-2xl border border-border/60 bg-muted/30 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                        Uhrzeit
                      </label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <input
                          type="time"
                          value={time}
                          onChange={e => setTime(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 rounded-2xl border border-border/60 bg-muted/30 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Group size */}
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
                      Gruppengröße
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {GROUP_SIZES.map(n => (
                        <button
                          key={n}
                          onClick={() => setGroupSize(n)}
                          className={`shrink-0 w-11 h-11 rounded-2xl border-2 font-bold text-sm transition-all active:scale-95 ${
                            groupSize === n
                              ? "border-primary/60 text-primary shadow-sm"
                              : "border-border/50 bg-muted/30 text-muted-foreground"
                          }`}
                          style={groupSize === n ? { background: "hsl(263 70% 52% / 0.07)" } : {}}
                        >
                          {n === 1 ? "👤" : n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vibe */}
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
                      Stimmung
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {VIBES.map(v => (
                        <button
                          key={v.id}
                          onClick={() => setVibe(v.id)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 text-sm font-semibold transition-all active:scale-95 ${
                            vibe === v.id
                              ? "border-primary/60 text-primary shadow-sm"
                              : "border-border/50 bg-muted/30 text-muted-foreground"
                          }`}
                          style={vibe === v.id ? { background: "hsl(263 70% 52% / 0.07)" } : {}}
                        >
                          <span>{v.emoji}</span>
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate CTA */}
                  <button
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending}
                    className="w-full py-4 rounded-3xl font-extrabold text-white text-base shadow-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-60"
                    style={{ background: GRAD }}
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Plan wird erstellt…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Plan automatisch erstellen
                      </>
                    )}
                  </button>

                  {mutation.isError && (
                    <p className="text-center text-sm text-destructive font-semibold">
                      {(mutation.error as Error).message}
                    </p>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="px-5 pb-8 space-y-5"
                >
                  {/* Plan meta banner */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{ background: "linear-gradient(135deg,hsl(263,70%,52%,0.1),hsl(330,85%,58%,0.08))" }}
                  >
                    <div>
                      <p className="font-extrabold text-base leading-tight">{plan?.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{plan?.subtitle}</p>
                    </div>
                  </div>

                  {/* Meta chips */}
                  <div className="flex flex-wrap gap-2">
                    {plan?.date && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-muted/60 px-2.5 py-1 rounded-full">
                        <Calendar className="w-3 h-3" />
                        {new Date(plan.date).toLocaleDateString("de-AT", { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                    )}
                    {plan?.time && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-muted/60 px-2.5 py-1 rounded-full">
                        <Clock className="w-3 h-3" />
                        {plan.time} Uhr
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-muted/60 px-2.5 py-1 rounded-full">
                      <Users className="w-3 h-3" />
                      {plan?.groupSize} {plan?.groupSize === 1 ? "Person" : "Personen"}
                    </span>
                    {plan?.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: "hsl(263 70% 52% / 0.09)", color: "hsl(263,70%,48%)" }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Main place */}
                  {plan?.mainPlace && <PlaceCard place={plan.mainPlace} />}

                  {/* Follow-up hint */}
                  {plan?.followUp && (
                    <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-muted/40 border border-border/30">
                      <span className="text-lg leading-none shrink-0">{plan.followUp.slice(0, 2)}</span>
                      <p className="text-xs font-semibold text-muted-foreground leading-relaxed">{plan.followUp.slice(2).trim()}</p>
                    </div>
                  )}

                  {/* Alternative */}
                  {plan?.alternativePlace && (
                    <div>
                      {showAlternative ? (
                        <div>
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Alternative Option</p>
                          <PlaceCard place={plan.alternativePlace} isAlternative />
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAlternative(true)}
                          className="w-full py-3 rounded-2xl border-2 border-dashed border-border/60 text-sm font-bold text-muted-foreground hover:border-primary/40 hover:text-primary transition-all flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Alternative anzeigen
                        </button>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleRegenerate}
                      disabled={mutation.isPending}
                      className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-border/60 font-bold text-sm hover:border-primary/40 transition-all active:scale-[0.97] disabled:opacity-50"
                    >
                      {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Neu generieren
                    </button>

                    <button
                      onClick={handleSave}
                      className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all active:scale-[0.97] ${
                        saved
                          ? "bg-emerald-500 text-white border-2 border-emerald-500"
                          : "border-2 border-border/60 hover:border-primary/40"
                      }`}
                    >
                      {saved ? <Check className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                      {saved ? "Gespeichert!" : "Plan speichern"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleShare}
                      className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-border/60 font-bold text-sm hover:border-primary/40 transition-all active:scale-[0.97]"
                    >
                      <Share2 className="w-4 h-4" />
                      Teilen
                    </button>

                    {(plan?.isGroupFriendly || onConvertToGroupPlan) && (
                      <button
                        onClick={handleConvertToGroup}
                        className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-white active:scale-[0.97] transition-all"
                        style={{ background: GRAD }}
                      >
                        <Users className="w-4 h-4" />
                        Gruppenplan
                      </button>
                    )}
                  </div>

                  {/* Reserve CTA */}
                  {plan?.mainPlace && (
                    <Link href={`/restaurant/${plan.mainPlace.id}`}>
                      <button
                        className="w-full py-3.5 rounded-2xl font-extrabold text-sm border-2 flex items-center justify-center gap-2 hover:bg-primary/5 transition-all active:scale-[0.98]"
                        style={{ borderColor: "hsl(263,70%,52%)", color: "hsl(263,70%,52%)" }}
                      >
                        Jetzt reservieren
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </Link>
                  )}

                  {/* Back */}
                  <button
                    onClick={handleBack}
                    className="w-full py-2.5 rounded-2xl text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Einstellungen ändern
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Trigger button (reusable small CTA) ───────────────────────────────────────
export function SmartPlanTriggerButton({
  onOpen,
  variant = "default",
}: {
  onOpen: () => void;
  variant?: "default" | "pill" | "card";
}) {
  if (variant === "pill") {
    return (
      <button
        onClick={onOpen}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm text-white shadow-md hover:opacity-90 active:scale-95 transition-all"
        style={{ background: GRAD }}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Smart Plan erzeugen
      </button>
    );
  }

  if (variant === "card") {
    return (
      <button
        onClick={onOpen}
        className="group relative overflow-hidden rounded-3xl p-5 text-left w-full shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
        style={{ background: GRAD }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-2 right-2 w-24 h-24 rounded-full bg-white/20 blur-2xl" />
        </div>
        <div className="relative z-10">
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center mb-3 backdrop-blur-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <p className="font-extrabold text-white text-base leading-tight">Plan automatisch erstellen</p>
          <p className="text-white/75 text-xs mt-1 font-medium">Dinner, Brunch, Date Night & mehr</p>
          <div className="mt-3 inline-flex items-center gap-1 text-white/90 text-xs font-bold">
            Vorschlag generieren <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onOpen}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm text-white shadow-md hover:opacity-90 active:scale-95 transition-all"
      style={{ background: GRAD }}
    >
      <Sparkles className="w-4 h-4" />
      Plan automatisch erstellen
    </button>
  );
}
