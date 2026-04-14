/**
 * VibeOnboarding — Light first-visit vibe picker
 *
 * Appears once (after 1.5 s) for first-time visitors.
 * Three quick options map to a vibe preference stored in localStorage.
 * No blockers: user can always skip. Sets `restosmart_vibe` key.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { X, ArrowRight } from "lucide-react";

const VIBE_KEY = "restosmart_vibe";
const DONE_KEY = "restosmart_vibe_done";

export type VibeType = "cafe" | "restaurant" | "bar";

interface Vibe {
  id: VibeType;
  emoji: string;
  labelKey: string;
  sublabelKey: string;
  exploreLink: string;
  bg: string;
  border: string;
  text: string;
}

const VIBES: Vibe[] = [
  {
    id: "cafe",
    emoji: "☕",
    labelKey: "vibe.mode_cafe",
    sublabelKey: "vibe.mode_cafe_sub",
    exploreLink: "/explore?businessType=cafe",
    bg: "bg-amber-50 hover:bg-amber-100",
    border: "border-amber-200 hover:border-amber-400",
    text: "text-amber-800",
  },
  {
    id: "restaurant",
    emoji: "🍽️",
    labelKey: "vibe.mode_dining",
    sublabelKey: "vibe.mode_dining_sub",
    exploreLink: "/explore?businessType=restaurant",
    bg: "bg-violet-50 hover:bg-violet-100",
    border: "border-violet-200 hover:border-violet-400",
    text: "text-violet-800",
  },
  {
    id: "bar",
    emoji: "🍸",
    labelKey: "vibe.mode_bar",
    sublabelKey: "vibe.mode_bar_sub",
    exploreLink: "/explore?businessType=bar",
    bg: "bg-rose-50 hover:bg-rose-100",
    border: "border-rose-200 hover:border-rose-400",
    text: "text-rose-800",
  },
];

interface VibeOnboardingProps {
  onSelect?: (vibe: VibeType) => void;
}

export function VibeOnboarding({ onSelect }: VibeOnboardingProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = localStorage.getItem(DONE_KEY);
    if (done) return;

    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DONE_KEY, "1");
    setVisible(false);
  };

  const handleSelect = (vibe: VibeType) => {
    localStorage.setItem(VIBE_KEY, vibe);
    localStorage.setItem(DONE_KEY, "1");
    onSelect?.(vibe);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-4 duration-300">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Wien entdecken</p>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground leading-snug">
              Was suchst du heute?
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Wir zeigen dir sofort die passenden Spots.
            </p>
          </div>
          <button
            onClick={dismiss}
            className="mt-0.5 w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors shrink-0 ml-3"
            aria-label={t("common.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Vibe options */}
        <div className="space-y-2.5">
          {VIBES.map((v) => (
            <Link key={v.id} href={v.exploreLink} onClick={() => handleSelect(v.id)}>
              <div
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 press-scale ${v.bg} ${v.border}`}
              >
                <div className="text-2xl w-10 h-10 flex items-center justify-center rounded-xl bg-white shadow-sm shrink-0">
                  {v.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${v.text}`}>{t(v.labelKey)}</p>
                  <p className="text-xs text-muted-foreground truncate">{t(v.sublabelKey)}</p>
                </div>
                <ArrowRight className={`w-4 h-4 shrink-0 ${v.text} opacity-60`} />
              </div>
            </Link>
          ))}
        </div>

        {/* Skip */}
        <button
          onClick={dismiss}
          className="w-full mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Alles anzeigen — Auswahl überspringen
        </button>
      </div>
    </div>
  );
}
