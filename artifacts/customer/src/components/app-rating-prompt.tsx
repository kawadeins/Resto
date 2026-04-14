import { useState, useEffect, useCallback, useRef } from "react";
import { X, Star, Send, ExternalLink, Sparkles, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

// ── Config ──────────────────────────────────────────────────────────────────
const TRIGGER_MS = 7 * 60 * 1000;      // 7 minutes of active time
const COOLDOWN_DAYS = 14;               // don't re-show for 14 days
const SESSION_KEY = "rs_rating_shown";  // sessionStorage – once per tab
const DATE_KEY    = "rs_rating_last";   // localStorage – last shown date

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ── Helpers ──────────────────────────────────────────────────────────────────
function canShowPrompt(): boolean {
  if (typeof window === "undefined") return false;
  if (sessionStorage.getItem(SESSION_KEY)) return false;
  const last = localStorage.getItem(DATE_KEY);
  if (!last) return true;
  const daysSince = (Date.now() - Number(last)) / 86_400_000;
  return daysSince >= COOLDOWN_DAYS;
}

function markShown() {
  sessionStorage.setItem(SESSION_KEY, "1");
  localStorage.setItem(DATE_KEY, String(Date.now()));
}

// ── Star Rating ─────────────────────────────────────────────────────────────
function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-2 justify-center">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= (hovered || value);
        return (
          <button
            key={n}
            type="button"
            className="group transition-transform active:scale-90 hover:scale-110 focus:outline-none"
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(n)}
            aria-label={t("restaurant.star_aria", { count: n })}
          >
            <Star
              className={`w-10 h-10 transition-all duration-150 ${
                active
                  ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                  : "fill-none text-muted-foreground/30 group-hover:text-amber-300"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

// ── Main Modal ───────────────────────────────────────────────────────────────
function RatingModal({
  email,
  onClose,
}: {
  email: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [step, setStep] = useState<"rate" | "high" | "low">("rate");
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [feedEmail, setFeedEmail] = useState(email);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleRatingSelect = (r: number) => {
    setRating(r);
    setTimeout(() => {
      setStep(r >= 4 ? "high" : "low");
    }, 320);
  };

  const submitFeedback = useCallback(
    async (source = "prompt") => {
      setLoading(true);
      try {
        await fetch(`${API_BASE}/api/app-feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: feedEmail || null,
            rating,
            feedbackText: text || null,
            source,
          }),
        });
        setSubmitted(true);
      } catch {
        toast({ title: t("restaurant.rating_error"), description: t("restaurant.rating_error_desc"), variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [feedEmail, rating, text, toast]
  );

  const handleHighConfirm = async () => {
    await submitFeedback("prompt");
    // simulate opening app store
    setTimeout(() => {
      toast({ title: t("restaurant.rating_trust_title"), description: t("restaurant.rating_trust_desc") });
      onClose();
    }, 400);
  };

  const handleLowSubmit = async () => {
    await submitFeedback("prompt");
  };

  // submitted state
  if (submitted && step === "low") {
    return (
      <ModalShell onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25">
            <Heart className="w-7 h-7 text-white fill-white" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-xl font-bold font-serif">{t("restaurant.rating_thanks_title")}</h3>
            <p className="text-sm text-muted-foreground">{t("restaurant.rating_thanks_desc")}</p>
          </div>
          <Button onClick={onClose} className="rounded-2xl px-8 bg-gradient-to-r from-primary to-accent text-white border-0 shadow-md shadow-primary/20">
            {t("restaurant.rating_done")}
          </Button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose}>
      {/* Step: Rate */}
      {step === "rate" && (
        <div className="flex flex-col items-center gap-5 py-2">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Star className="w-3 h-3 text-white fill-white" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-xl font-bold font-serif">{t("restaurant.rating_how")}</h3>
            <p className="text-sm text-muted-foreground">{t("restaurant.rating_subtitle")}</p>
          </div>
          <StarPicker value={rating} onChange={handleRatingSelect} />
          {rating > 0 && (
            <p className="text-sm font-semibold text-primary animate-fade-in">{t(`restaurant.star_label_${rating}`)}</p>
          )}
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("restaurant.rating_skip")}
          </button>
        </div>
      )}

      {/* Step: High rating (4–5 ★) */}
      {step === "high" && (
        <div className="flex flex-col items-center gap-5 py-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].slice(0, rating).map((i) => (
              <Star key={i} className="w-6 h-6 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-xl font-bold font-serif">{t("restaurant.rating_high_title")}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("restaurant.rating_high_desc")}
            </p>
          </div>
          <div className="w-full space-y-3">
            <Button
              onClick={handleHighConfirm}
              disabled={loading}
              className="w-full rounded-2xl h-12 bg-gradient-to-r from-primary to-accent text-white border-0 font-semibold shadow-md shadow-primary/20 flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              {t("restaurant.rating_rate_appstore")}
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
              className="w-full rounded-2xl h-10 text-muted-foreground"
            >
              {t("restaurant.rating_maybe_later")}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Low rating (1–3 ★) */}
      {step === "low" && (
        <div className="flex flex-col gap-4 py-1">
          <div className="text-center space-y-1">
            <h3 className="text-lg font-bold font-serif">{t("restaurant.rating_low_title")}</h3>
            <p className="text-sm text-muted-foreground">{t("restaurant.rating_low_sub")}</p>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("restaurant.rating_low_ph")}
            className="rounded-xl resize-none min-h-[100px] text-sm"
            maxLength={2000}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t("restaurant.rating_email_label")}
            </label>
            <Input
              type="email"
              value={feedEmail}
              onChange={(e) => setFeedEmail(e.target.value)}
              placeholder={t("restaurant.rating_email_ph")}
              className="rounded-xl text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1 rounded-2xl"
            >
              {t("restaurant.rating_cancel")}
            </Button>
            <Button
              onClick={() => handleLowSubmit()}
              disabled={loading}
              className="flex-1 rounded-2xl bg-gradient-to-r from-primary to-accent text-white border-0 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {loading ? t("restaurant.rating_sending") : t("restaurant.rating_send")}
            </Button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// ── Modal shell (bottom-sheet style) ─────────────────────────────────────────
function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="relative z-10 w-full sm:max-w-sm mx-auto sm:mx-4 bg-card border border-border/60 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl shadow-black/20 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mb-5 sm:hidden" />
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        {children}
      </div>
    </div>
  );
}

// ── Profile inline widget (for manual rating in profile page) ─────────────────
export function ProfileFeedbackWidget({ email }: { email: string }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!rating) return;
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/app-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email || null,
          rating,
          feedbackText: text || null,
          source: "profile",
        }),
      });
      setDone(true);
      toast({ title: t("restaurant.rating_feedback_thanks_title"), description: t("restaurant.rating_feedback_thanks_desc") });
    } catch {
      toast({ title: t("restaurant.rating_error"), description: t("restaurant.rating_feedback_error_desc"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Heart className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">{t("restaurant.review_success")}</p>
          <p className="text-xs text-muted-foreground">{t("restaurant.rating_thanks_title")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("restaurant.rating_how")}</p>
        <p className="text-xs text-muted-foreground">{t("restaurant.rating_subtitle")}</p>
      </div>
      <StarPicker value={rating} onChange={setRating} />
      {rating > 0 && (
        <>
          <p className="text-xs text-center font-medium text-primary">{t(`restaurant.star_label_${rating}`)}</p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("restaurant.rating_feedback_ph")}
            className="rounded-xl resize-none text-sm min-h-[80px]"
            maxLength={2000}
          />
          <Button
            onClick={submit}
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-primary to-accent text-white border-0 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {loading ? t("restaurant.rating_sending") : t("restaurant.rating_feedback_send")}
          </Button>
        </>
      )}
    </div>
  );
}

// ── Smart Prompt — mounted globally in App ────────────────────────────────────
export function AppRatingPrompt({ email }: { email: string }) {
  const [visible, setVisible] = useState(false);
  const activeMs = useRef(0);
  const lastTick = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggered = useRef(false);

  const show = useCallback(() => {
    if (triggered.current) return;
    if (!canShowPrompt()) return;
    triggered.current = true;
    markShown();
    setVisible(true);
  }, []);

  // Accumulate active time (skip when tab is hidden)
  useEffect(() => {
    const tick = () => {
      if (document.hidden) {
        lastTick.current = null;
        return;
      }
      const now = Date.now();
      if (lastTick.current !== null) {
        activeMs.current += now - lastTick.current;
      }
      lastTick.current = now;
      if (activeMs.current >= TRIGGER_MS) {
        show();
      }
    };

    timerRef.current = setInterval(tick, 5_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [show]);

  // Also trigger after a booking is completed
  useEffect(() => {
    const handle = () => show();
    window.addEventListener("restosmart:booking-complete", handle);
    return () => window.removeEventListener("restosmart:booking-complete", handle);
  }, [show]);

  if (!visible) return null;
  return <RatingModal email={email} onClose={() => setVisible(false)} />;
}
