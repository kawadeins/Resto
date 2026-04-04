import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Link } from "wouter";
import {
  User, Mail, Camera, Star, Award, TrendingUp, Calendar, MessageSquare,
  Heart, Settings, ChevronRight, Edit2, Check, X, Loader2, Upload,
  Utensils, Leaf, Beef, Moon, Fish, Minus, AlertTriangle, Sparkles,
  Trophy, ArrowRight, ShoppingBag, Clock, Crown, Store, BarChart2,
  Users, FileText, Megaphone, Zap, Shield, Lock, Bell, Trash2,
  CheckCircle2, ExternalLink, Building2, ChevronLeft,
  Eye, EyeOff, Smartphone, Globe, Flame, Target, Activity,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSeo } from "@/hooks/use-seo";
import { ProfileFeedbackWidget } from "@/components/app-rating-prompt";
import { useHabitLoop } from "@/hooks/use-habit-loop";
import { getActivityFeed, activityLabel, timeAgo, type SocialActivity } from "@/lib/social-api";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomerProfile {
  email: string;
  name: string;
  photoUrl: string | null;
  favoriteCuisines: string[];
  dietaryStyle: string;
  allergies: string[];
  favoriteTags: string[];
  favoriteRestaurantIds: string[];
  loyalty: {
    points: number;
    totalEarned: number;
    tier: "Bronze" | "Silver" | "Gold";
    nextTier: string | null;
    nextTierThreshold: number | null;
    pointsToNext: number;
    tierPct: number;
  };
  stats: {
    totalBookings: number;
    totalReviews: number;
    avgRating: number | null;
  };
  recentBookings: Array<{
    id: number;
    date: string;
    time: string;
    partySize: number;
    status: string;
    restaurantName: string;
  }>;
}

// ─── Food Identity Data ───────────────────────────────────────────────────────

const FOOD_TYPES = [
  { id: "Italian",        emoji: "🍝", label: "Italienisch",   from: "from-rose-400",    to: "to-red-500" },
  { id: "Japanese",       emoji: "🍣", label: "Japanisch",     from: "from-sky-400",     to: "to-blue-600" },
  { id: "French",         emoji: "🥐", label: "Französisch",   from: "from-violet-400",  to: "to-purple-600" },
  { id: "Indian",         emoji: "🍛", label: "Indisch",       from: "from-yellow-400",  to: "to-orange-400" },
  { id: "Mexican",        emoji: "🌮", label: "Mexikanisch",   from: "from-amber-400",   to: "to-orange-500" },
  { id: "Thai",           emoji: "🍜", label: "Thailändisch",  from: "from-emerald-400", to: "to-teal-600" },
  { id: "American",       emoji: "🍔", label: "Amerikanisch",  from: "from-orange-400",  to: "to-red-400" },
  { id: "Middle Eastern", emoji: "🧆", label: "Orientalisch",  from: "from-amber-500",   to: "to-yellow-600" },
  { id: "Chinese",        emoji: "🥟", label: "Chinesisch",    from: "from-red-400",     to: "to-rose-600" },
  { id: "Mediterranean",  emoji: "🫒", label: "Mediterran",    from: "from-green-400",   to: "to-emerald-600" },
  { id: "Seafood",        emoji: "🦞", label: "Meeresfrüchte", from: "from-cyan-400",    to: "to-blue-500" },
  { id: "Steakhouse",     emoji: "🥩", label: "Steakhaus",     from: "from-red-600",     to: "to-rose-800" },
];

const DIETARY_STYLES = [
  { id: "no_preference", icon: Utensils, emoji: "🍽️", label: "Keine Präferenz",   from: "from-slate-400",   to: "to-gray-500",    color: "text-muted-foreground" },
  { id: "vegetarian",    icon: Leaf,     emoji: "🥗",  label: "Vegetarisch",       from: "from-emerald-400", to: "to-green-600",   color: "text-emerald-600" },
  { id: "vegan",         icon: Sparkles, emoji: "🌿",  label: "Vegan",             from: "from-green-400",   to: "to-teal-500",    color: "text-green-600" },
  { id: "meat_lover",    icon: Beef,     emoji: "🥩",  label: "Fleischliebhaber",  from: "from-red-400",     to: "to-rose-600",    color: "text-red-600" },
  { id: "halal",         icon: Moon,     emoji: "🌙",  label: "Halal",             from: "from-violet-400",  to: "to-purple-600",  color: "text-violet-600" },
  { id: "seafood",       icon: Fish,     emoji: "🐟",  label: "Meeresfrüchte",     from: "from-sky-400",     to: "to-blue-600",    color: "text-blue-600" },
];

const ALLERGIES = [
  { id: "gluten",      label: "Gluten",         emoji: "🌾", from: "from-amber-300",   to: "to-yellow-500" },
  { id: "lactose",     label: "Laktose",         emoji: "🥛", from: "from-blue-200",    to: "to-sky-400" },
  { id: "nuts",        label: "Nüsse",           emoji: "🥜", from: "from-amber-500",   to: "to-orange-600" },
  { id: "shellfish",   label: "Schalentiere",    emoji: "🦐", from: "from-rose-300",    to: "to-pink-500" },
  { id: "eggs",        label: "Eier",            emoji: "🥚", from: "from-yellow-300",  to: "to-amber-400" },
  { id: "soy",         label: "Soja",            emoji: "🫘", from: "from-green-300",   to: "to-emerald-500" },
  { id: "fish",        label: "Fisch",           emoji: "🐟", from: "from-cyan-400",    to: "to-blue-500" },
  { id: "no_allergies",label: "Keine Allergien", emoji: "✅", from: "from-emerald-400", to: "to-green-600" },
];

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  Bronze: { color: "text-amber-700", bg: "bg-amber-100/70", border: "border-amber-300/60", gradient: "from-amber-200/60 via-amber-100/30 to-orange-50/20", icon: "🥉" },
  Silver: { color: "text-slate-700", bg: "bg-slate-200/60", border: "border-slate-300/60", gradient: "from-slate-300/50 via-slate-100/30 to-blue-50/10", icon: "🥈" },
  Gold:   { color: "text-yellow-700", bg: "bg-yellow-100/80", border: "border-yellow-400/50", gradient: "from-yellow-300/50 via-amber-200/30 to-orange-100/20", icon: "🥇" },
};

// ─── Premium plan features ────────────────────────────────────────────────────

const PREMIUM_FEATURES = [
  { icon: Calendar, label: "Buchungs- & Reservierungsverwaltung", desc: "Gäste & Buchungen in Echtzeit verwalten" },
  { icon: Store, label: "Verfügbarkeit & Belegungsplan", desc: "Visueller Grundriss, flexible Zeitslots" },
  { icon: Users, label: "Mitarbeiter & Schichten", desc: "Dienstpläne, Zeiterfassung, Erinnerungen" },
  { icon: FileText, label: "Angebots- & Menü-Editor", desc: "Speisekarte oder Getränkekarte digital pflegen" },
  { icon: BarChart2, label: "Analytics & Berichte", desc: "Umsatz, Auslastung, Gästeverhalten" },
  { icon: Megaphone, label: "Marketing & Kampagnen", desc: "E-Mail-Kampagnen, Rückgewinnungs-Tools" },
  { icon: Star, label: "Bewertungsmanagement", desc: "Bewertungen lesen und professionell antworten" },
  { icon: Zap, label: "POS-System", desc: "Kassenbereich direkt im Dashboard" },
  { icon: Crown, label: "Treue-Programme", desc: "Kundenbindung durch Punkte & Prämien" },
];

type BusinessType = "restaurant" | "cafe" | "bar";

const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string; emoji: string; desc: string }[] = [
  { value: "restaurant", label: "Restaurant", emoji: "🍽️", desc: "Speisekarte, Tische, Reservierungen" },
  { value: "cafe", label: "Café", emoji: "☕", desc: "Frühstück, Take-away, Kaffeespezialitäten" },
  { value: "bar", label: "Bar", emoji: "🍸", desc: "Happy Hour, Getränke, Nachtbetrieb" },
];

function getBusinessLabel(biz?: string | null): string {
  if (biz === "cafe") return "Café";
  if (biz === "bar") return "Bar";
  return "Restaurant";
}

function getOwnerBadgeLabel(biz?: string | null): string {
  if (biz === "cafe") return "Verifizierter Cafébesitzer";
  if (biz === "bar") return "Verifizierter Barbesitzer";
  return "Verifizierter Restaurantbesitzer";
}

function getBusinessEmoji(biz?: string | null): string {
  if (biz === "cafe") return "☕";
  if (biz === "bar") return "🍸";
  return "🍽️";
}

// ─── Smart Insight Generator ──────────────────────────────────────────────────

function getInsight(profile: CustomerProfile): { message: string; cta?: string; ctaHref?: string } {
  const { loyalty, stats, favoriteCuisines, dietaryStyle, allergies } = profile;
  if (loyalty.tier === "Gold")
    return { message: "Glückwunsch! Du bist Gold-Mitglied – unser höchstes Level. Genieße exklusive Vorteile und VIP-Service.", cta: "Tische entdecken", ctaHref: "/explore" };
  if (loyalty.pointsToNext <= 30)
    return { message: `Nur noch ${loyalty.pointsToNext} Punkte bis zum ${loyalty.nextTier}-Status! Deine nächste Buchung könnte es schaffen.`, cta: "Jetzt buchen", ctaHref: "/explore" };
  if (stats.totalBookings === 0)
    return { message: "Willkommen! Deine erste Tischreservierung bringt dir Bonuspunkte und startet deine Treue-Reise.", cta: "Restaurants entdecken", ctaHref: "/explore" };
  if (favoriteCuisines.length === 0)
    return { message: "Teile uns deine Lieblingsküchen mit – wir empfehlen dir dann passende Restaurants in deiner Nähe.", cta: "Geschmack festlegen", ctaHref: undefined };
  if (dietaryStyle === "no_preference" && allergies.length === 0)
    return { message: "Ergänze deine Ernährungsweise und Allergien für personalisierte Restaurant-Empfehlungen.", cta: "Präferenzen setzen", ctaHref: undefined };
  if (stats.totalReviews === 0)
    return { message: "Schreibe deine erste Bewertung und hilf anderen Gästen – du bekommst dafür auch Bonuspunkte.", cta: "Buchungen ansehen", ctaHref: "/my-bookings" };
  return { message: `Du hast ${stats.totalBookings} Buchungen gemacht und ${loyalty.totalEarned} Punkte gesammelt. Weiter so!`, cta: "Weiter entdecken", ctaHref: "/explore" };
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    confirmed: { label: "Bestätigt", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    pending: { label: "Ausstehend", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    cancelled: { label: "Storniert", cls: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
    completed: { label: "Abgeschlossen", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  };
  const c = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${c.cls}`}>{c.label}</span>;
}

// ─── Avatar with upload ───────────────────────────────────────────────────────

function AvatarUpload({
  photoUrl,
  name,
  email,
  onUpload,
  size = "lg",
  isPremium = false,
}: {
  photoUrl: string | null;
  name: string;
  email: string;
  onUpload: (url: string) => void;
  size?: "sm" | "lg";
  isPremium?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const dim = size === "lg" ? "w-24 h-24" : "w-14 h-14";
  const textSize = size === "lg" ? "text-3xl" : "text-lg";

  const handleFile = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch(`${API_BASE}/api/customer-profile/upload`, { method: "POST", body: fd });
      const { url } = await r.json();
      onUpload(`${API_BASE}${url}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative group cursor-pointer shrink-0" onClick={() => inputRef.current?.click()}>
      {/* Premium glow ring */}
      {isPremium && (
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent blur-md opacity-40 scale-110 pointer-events-none" />
      )}
      <div className={`relative ${dim} rounded-full overflow-hidden border-4 ${isPremium ? "border-primary/60 shadow-xl shadow-primary/30" : "border-background shadow-lg"} bg-primary/10 flex items-center justify-center`}>
        {uploading ? (
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        ) : photoUrl ? (
          <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className={`${textSize} font-bold text-primary`}>
            {name ? name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Camera className="w-5 h-5 text-white" />
      </div>
      {/* Premium crown badge */}
      {isPremium && (
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center border-2 border-background shadow-lg shadow-primary/30 pointer-events-none">
          <Crown className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

// ─── Inline editable field ────────────────────────────────────────────────────

function EditableField({
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  icon?: React.ElementType;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const confirm = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  return editing ? (
    <div className="flex items-center gap-2">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        type={type}
        className="h-9 text-sm"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") confirm(); if (e.key === "Escape") cancel(); }}
      />
      <button onClick={confirm} className="p-1.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={cancel} className="p-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"><X className="w-3.5 h-3.5" /></button>
    </div>
  ) : (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className="flex items-center gap-2 text-sm text-left w-full group hover:text-primary transition-colors"
    >
      {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
      <span className={value ? "text-foreground" : "text-muted-foreground italic"}>{value || placeholder}</span>
      <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto" />
    </button>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onEnter }: { onEnter: (email: string) => void }) {
  const [signingIn, setSigningIn] = useState<"apple" | "google" | null>(null);
  const [showEmailFallback, setShowEmailFallback] = useState(false);
  const [draft, setDraft] = useState("");

  const handleSocialLogin = async (provider: "apple" | "google") => {
    setSigningIn(provider);
    await new Promise((r) => setTimeout(r, 1600));
    // Generate a stable per-device demo identity so every user
    // gets their own isolated profile, bookings and social data.
    let deviceId = localStorage.getItem("restosmart_device_id");
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem("restosmart_device_id", deviceId);
    }
    const shortId = deviceId.split("-")[0];
    const demoEmail =
      provider === "apple"
        ? `demo-${shortId}@icloud.com`
        : `demo-${shortId}@gmail.com`;
    setSigningIn(null);
    onEnter(demoEmail);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background overflow-hidden">
      {/* Background gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Top spacer */}
      <div className="flex-1" />

      {/* Center content */}
      <div className="relative w-full max-w-sm mx-auto px-6 flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/30">
            <span className="text-4xl font-black text-white tracking-tighter select-none">R</span>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">RestoSmart</h1>
            <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed max-w-[220px]">
              Dein persönliches Restauranterlebnis — entdecke, buche, genieße.
            </p>
          </div>
        </div>

        {/* Social sign-in buttons */}
        <div className="w-full space-y-3">
          {/* Apple */}
          <button
            onClick={() => handleSocialLogin("apple")}
            disabled={!!signingIn}
            className="w-full h-[54px] rounded-2xl bg-foreground text-background flex items-center justify-center gap-3 font-semibold text-[15px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg shadow-foreground/10 relative"
          >
            {signingIn === "apple" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-background" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
            )}
            <span>{signingIn === "apple" ? "Wird vorbereitet…" : "Als Apple-Gerät fortfahren (Demo)"}</span>
          </button>

          {/* Google */}
          <button
            onClick={() => handleSocialLogin("google")}
            disabled={!!signingIn}
            className="w-full h-[54px] rounded-2xl bg-card border border-border flex items-center justify-center gap-3 font-semibold text-[15px] hover:bg-muted/60 active:scale-[0.98] transition-all disabled:opacity-60 shadow-sm relative"
          >
            {signingIn === "google" ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span>{signingIn === "google" ? "Wird vorbereitet…" : "Als Google-Konto fortfahren (Demo)"}</span>
          </button>
        </div>

        {/* Demo notice */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground/70">
          <span className="flex items-center gap-1"><Smartphone className="w-3 h-3" /> Gerätebezogene Demo-ID</span>
          <span className="w-px h-3 bg-border" />
          <span>Keine Werbung</span>
        </div>

        {/* Email fallback */}
        {!showEmailFallback ? (
          <button
            onClick={() => setShowEmailFallback(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          >
            Andere E-Mail-Adresse verwenden
          </button>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); if (draft.includes("@")) onEnter(draft); }}
            className="w-full space-y-2"
          >
            <Input
              type="email"
              placeholder="deine@email.de"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-11 text-center rounded-xl"
              autoComplete="email"
              autoFocus
            />
            <Button type="submit" variant="outline" className="w-full h-11 rounded-xl" disabled={!draft.includes("@")}>
              Weiter
            </Button>
          </form>
        )}
      </div>

      {/* Bottom spacer */}
      <div className="flex-1 max-h-16" />

      {/* Footer */}
      <p className="relative pb-8 text-[11px] text-muted-foreground/50 text-center px-6">
        Durch die Anmeldung stimmst du unseren Nutzungsbedingungen und der Datenschutzrichtlinie zu.
      </p>
    </div>
  );
}

// ─── Owner Premium Modal ──────────────────────────────────────────────────────

function PremiumModal({
  open,
  onClose,
  onActivate,
}: {
  open: boolean;
  onClose: () => void;
  onActivate: (businessType: BusinessType) => void;
}) {
  const [step, setStep] = useState(0);
  const [selectedBusinessType, setSelectedBusinessType] = useState<BusinessType>("restaurant");
  const [processing, setProcessing] = useState(false);

  const handleActivate = async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 800));
    setProcessing(false);
    setStep(2);
  };

  const handleGoToDashboard = () => {
    onActivate(selectedBusinessType);
    onClose();
    window.location.href = window.location.origin + "/restosmart/";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-3xl border-0 shadow-2xl">
        {/* Step 0 — Plan presentation */}
        {step === 0 && (
          <div className="flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="relative bg-gradient-to-br from-primary via-violet-600 to-accent p-7 text-white">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-bold tracking-widest uppercase text-white/80">Business Premium</span>
                </div>
                <h2 className="font-serif text-2xl font-bold leading-tight mb-1">Alles was Ihr Betrieb braucht</h2>
                <p className="text-white/75 text-sm leading-relaxed">Ein vollständiges Verwaltungssystem für Restaurants, Cafés und Bars — Buchungen, Personal, Marketing und mehr.</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-serif font-bold">€29</span>
                  <span className="text-white/70 text-sm">/Monat</span>
                  <span className="ml-2 text-xs bg-white/20 text-white font-semibold px-2.5 py-1 rounded-full">30 Tage kostenlos</span>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Was Sie erhalten</p>
              <div className="grid grid-cols-1 gap-2.5">
                {PREMIUM_FEATURES.map((f) => (
                  <div key={f.label} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 hover:bg-muted/60 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <f.icon className="w-4.5 h-4.5 text-primary" style={{ width: "18px", height: "18px" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold leading-tight">{f.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{f.desc}</div>
                    </div>
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Business type selector */}
            <div className="px-6 pb-2 space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Für welchen Betrieb?</p>
              <div className="grid grid-cols-3 gap-2">
                {BUSINESS_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedBusinessType(opt.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all text-center ${
                      selectedBusinessType === opt.value
                        ? "border-primary bg-primary/8 shadow-md shadow-primary/15"
                        : "border-border bg-muted/30 hover:border-primary/40"
                    }`}
                  >
                    <span className="text-2xl leading-none">{opt.emoji}</span>
                    <span className={`text-xs font-bold leading-tight ${selectedBusinessType === opt.value ? "text-primary" : "text-foreground"}`}>{opt.label}</span>
                    <span className="text-[9px] text-muted-foreground leading-tight">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="p-5 border-t bg-background/50 backdrop-blur-sm space-y-3">
              <Button
                className="w-full h-12 rounded-2xl text-base font-semibold shadow-lg shadow-primary/25"
                onClick={() => setStep(1)}
              >
                <Crown className="w-4 h-4 mr-2" />
                {getBusinessEmoji(selectedBusinessType)} {getBusinessLabel(selectedBusinessType)} Premium — 30 Tage kostenlos
              </Button>
              <button onClick={onClose} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
                Vielleicht später
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — Pilot-Aktivierung (demo, no payment) */}
        {step === 1 && (
          <div className="flex flex-col">
            <div className="bg-gradient-to-br from-primary to-accent p-6 text-white relative">
              <button
                onClick={() => setStep(0)}
                className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <div className="text-center pt-2">
                <div className="text-xs font-bold tracking-widest uppercase text-white/75 mb-1">Pilot-Zugang</div>
                <div className="font-serif text-xl font-bold">{getBusinessEmoji(selectedBusinessType)} {getBusinessLabel(selectedBusinessType)} Dashboard</div>
                <div className="text-white/80 text-sm mt-1">Demo-Version · Keine Zahlung erforderlich</div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-1">
                <p className="text-sm font-semibold text-amber-900">Demo-Modus</p>
                <p className="text-sm text-amber-800 leading-relaxed">
                  Dies ist eine Pilot-Demo. Es wird <strong>keine Zahlung erhoben</strong> und keine Zahlungsmethode benötigt. Der Zugang ist kostenlos.
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  "Buchungs- & Tischmanagement",
                  "Marketing-Kampagnen & Angebote",
                  "Analytik & Umsatzberichte",
                  "Personal- & Schichtplanung",
                  "Alle 9 Dashboard-Module",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>

              <Button
                className="w-full h-12 rounded-2xl text-base font-semibold shadow-lg shadow-primary/25"
                onClick={handleActivate}
                disabled={processing}
              >
                {processing ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Wird aktiviert…</span>
                ) : (
                  <span className="flex items-center gap-2"><Crown className="w-4 h-4" /> Demo-Zugang freischalten</span>
                )}
              </Button>

              <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
                Pilot-Version ohne Zahlungspflicht. Für kommerzielle Lizenzierung kontaktieren Sie uns.
              </p>
            </div>
          </div>
        )}

        {/* Step 2 — Aktivierung erfolgreich */}
        {step === 2 && (
          <div className="p-8 text-center flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl shadow-primary/30">
                <Crown className="w-12 h-12 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center border-4 border-background">
                <Check className="w-4 h-4 text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-serif text-2xl font-bold mb-2">Dashboard freigeschaltet!</h3>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
                Ihr {getBusinessLabel(selectedBusinessType)}-Dashboard ist jetzt aktiv. Erkunden Sie alle Funktionen der Pilot-Version.
              </p>
            </div>
            <div className="w-full space-y-2.5 pt-2">
              <div className="flex items-center gap-3 text-left p-3 rounded-2xl bg-muted/40">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm">Demo-Zugang aktiviert</span>
              </div>
              <div className="flex items-center gap-3 text-left p-3 rounded-2xl bg-muted/40">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm">Alle 9 Dashboard-Module freigeschaltet</span>
              </div>
              <div className="flex items-center gap-3 text-left p-3 rounded-2xl bg-amber-50 border border-amber-100">
                <Shield className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-sm text-amber-800">Pilot-Version · keine Zahlung</span>
              </div>
            </div>
            <Button
              className="w-full h-12 rounded-2xl text-base font-semibold shadow-lg shadow-primary/25 mt-2"
              onClick={handleGoToDashboard}
            >
              <Building2 className="w-4 h-4 mr-2" />
              Dashboard öffnen
              <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-70" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Owner Premium Card ───────────────────────────────────────────────────────

function OwnerPremiumCard({
  isPremium,
  onOpenModal,
}: {
  isPremium: boolean;
  onOpenModal: () => void;
}) {
  const storedBiz = localStorage.getItem("restosmart_owner_business_type") ?? "restaurant";
  const bizLabel = getBusinessLabel(storedBiz);
  const bizEmoji = getBusinessEmoji(storedBiz);

  if (isPremium) {
    return (
      <button
        onClick={() => { window.location.href = window.location.origin + "/restosmart/"; }}
        className="w-full text-left press-scale"
      >
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-violet-600 to-accent p-5 shadow-xl shadow-primary/25">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 text-2xl">
              {bizEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold tracking-widest uppercase text-white/70">{bizLabel} Premium</span>
                <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">Aktiv</span>
              </div>
              <div className="font-serif text-lg font-bold text-white leading-tight">Mein {bizLabel}-Dashboard</div>
              <div className="text-white/70 text-xs mt-0.5">Tippen zum Öffnen</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <ChevronRight className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button onClick={onOpenModal} className="w-full text-left press-scale">
      <div className="relative overflow-hidden rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-primary/8 via-violet-50/80 to-accent/8 dark:from-primary/15 dark:via-violet-950/30 dark:to-accent/15 p-5 hover:border-primary/40 transition-colors">
        {/* Decorative dots */}
        <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.07]" style={{ background: "radial-gradient(circle, hsl(var(--primary)) 1.5px, transparent 1.5px)", backgroundSize: "12px 12px" }} />

        <div className="relative">
          {/* Label row */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/25">
              <Crown className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest uppercase text-primary">Für Restaurantbesitzer</span>
            </div>
            <span className="ml-auto text-[10px] font-bold bg-gradient-to-r from-primary to-accent text-transparent bg-clip-text border border-primary/30 px-2.5 py-0.5 rounded-full">Premium</span>
          </div>

          {/* Headline */}
          <h3 className="font-serif text-xl font-bold leading-snug mb-1.5">
            Führen Sie Ihr Restaurant professionell
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Reservierungen, Personal, Speisekarte, Kasse und Marketing — alles in einem Dashboard.
          </p>

          {/* Mini feature chips */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {["Reservierungen", "Personal", "Analytics", "Marketing", "POS", "+ 4 weitere"].map((f) => (
              <span key={f} className="text-[11px] font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                {f}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-10 rounded-xl bg-gradient-to-r from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-sm font-bold text-white">Premium freischalten</span>
            </div>
            <div className="h-10 w-10 rounded-xl border border-primary/20 flex items-center justify-center">
              <ChevronRight className="w-4 h-4 text-primary" />
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground mt-2 text-center">30 Tage kostenlos testen · Jederzeit kündbar</p>
        </div>
      </div>
    </button>
  );
}

// ─── Privacy & Security Section ───────────────────────────────────────────────

function PrivacySecuritySection({ onLogout }: { onLogout: () => void }) {
  const { toast } = useToast();
  const [notifBookings, setNotifBookings] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);
  const [notifReviews, setNotifReviews] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="space-y-4">
      {/* Privacy header */}
      <div className="bg-card border rounded-2xl p-5 space-y-5">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Datenschutz &amp; Sicherheit
        </h3>

        {/* Data info */}
        <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2">
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Ihre Daten sind geschützt</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Ihre persönlichen Daten werden verschlüsselt gespeichert und niemals an Dritte weitergegeben. Wir nutzen Ihre Daten ausschließlich zur Verbesserung Ihrer Restauranterlebnisse.
              </p>
            </div>
          </div>
        </div>

        {/* Data points */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gespeicherte Daten</p>
          {[
            { label: "Profilinformationen", detail: "Name, E-Mail, Foto", icon: User },
            { label: "Buchungshistorie", detail: "Restaurantbesuche und Reservierungen", icon: Calendar },
            { label: "Geschmackspräferenzen", detail: "Küchen, Ernährung, Allergien", icon: Utensils },
            { label: "Treuepunkte", detail: "Punkte und Tier-Status", icon: Award },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.detail}</div>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px]">Gespeichert</Badge>
            </div>
          ))}
        </div>

        {/* Data export */}
        <Button
          variant="outline"
          className="w-full rounded-xl h-10 text-sm"
          onClick={() => toast({ title: "Export angefordert", description: "Ihre Daten werden per E-Mail zugesendet." })}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Meine Daten exportieren
        </Button>
      </div>

      {/* Notifications */}
      <div className="bg-card border rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          Benachrichtigungen
        </h3>
        <div className="space-y-3">
          {[
            { label: "Buchungsbestätigungen", detail: "E-Mail bei neuer Reservierung", value: notifBookings, onChange: setNotifBookings },
            { label: "Bewertungserinnerungen", detail: "Nach dem Besuch eine Bewertung hinterlassen", value: notifReviews, onChange: setNotifReviews },
            { label: "Angebote & Neuigkeiten", detail: "Blitzangebote und personalisierte Empfehlungen", value: notifMarketing, onChange: setNotifMarketing },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex-1 mr-4">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.detail}</div>
              </div>
              <Switch
                checked={item.value}
                onCheckedChange={item.onChange}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Sessions */}
      <div className="bg-card border rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />
          Aktive Sitzungen
        </h3>
        <div className="space-y-2.5">
          {[
            { device: "Dieses Gerät", detail: "Zuletzt aktiv: Gerade eben", current: true },
          ].map((s) => (
            <div key={s.device} className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{s.device}</div>
                  <div className="text-xs text-muted-foreground">{s.detail}</div>
                </div>
              </div>
              {s.current && <Badge variant="secondary" className="text-[10px] text-emerald-600 bg-emerald-50">Aktuell</Badge>}
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          className="w-full rounded-xl h-10 text-sm"
          onClick={onLogout}
        >
          Alle Sitzungen beenden
        </Button>
      </div>

      {/* Danger zone */}
      <div className="bg-card border border-red-200 dark:border-red-900/50 rounded-2xl p-5 space-y-3">
        <h3 className="font-bold text-base flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-4 h-4" />
          Gefahrenzone
        </h3>
        {showDeleteConfirm ? (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 space-y-3">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Sind Sie sicher? Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl flex-1"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Abbrechen
              </Button>
              <Button
                size="sm"
                className="rounded-xl flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  toast({ title: "Anfrage eingereicht", description: "Ihr Konto wird innerhalb von 30 Tagen gelöscht." });
                }}
              >
                Endgültig löschen
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left text-sm text-red-600"
          >
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4 text-red-600" />
            </div>
            Konto löschen
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Profile() {
  useSeo({ title: "Mein Profil", description: "Dein persönliches RestoSmart-Profil." });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string>("");
  const [ownerPremium, setOwnerPremium] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("restosmart_email") || "";
    if (saved) setEmail(saved);
  }, []);

  useEffect(() => {
    if (!email) return;
    const premiumEmail = localStorage.getItem("restosmart_owner_email");
    const premiumStatus = localStorage.getItem("restosmart_owner_premium");
    if (premiumEmail === email && premiumStatus === "active") {
      setOwnerPremium(true);
    }
  }, [email]);

  const { data: profile, isLoading } = useQuery<CustomerProfile>({
    queryKey: ["customer-profile", email],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/customer-profile/${encodeURIComponent(email)}`);
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
    enabled: !!email,
  });

  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<CustomerProfile>) => {
      const r = await fetch(`${API_BASE}/api/customer-profile/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!r.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-profile", email] });
      toast({ title: "Gespeichert", description: "Dein Profil wurde aktualisiert." });
    },
  });

  const save = useCallback(
    (updates: Partial<CustomerProfile>) => saveMutation.mutate(updates),
    [saveMutation]
  );

  const handleEnterEmail = (e: string) => {
    setEmail(e);
    localStorage.setItem("restosmart_email", e);
  };

  const handleActivatePremium = (businessType: BusinessType) => {
    localStorage.setItem("restosmart_owner_email", email);
    localStorage.setItem("restosmart_owner_premium", "active");
    localStorage.setItem("restosmart_owner_business_type", businessType);
    setOwnerPremium(true);
    toast({
      title: "Premium aktiviert!",
      description: `Willkommen im ${getBusinessLabel(businessType)}-Dashboard.`,
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("restosmart_email");
    setEmail("");
  };

  // ── Habit Loop (always called — hooks must not be conditional) ───────────
  const habit = useHabitLoop();

  // ── Social activity feed ─────────────────────────────────────────────────
  const { data: activityFeed = [] } = useQuery<SocialActivity[]>({
    queryKey: ["profile-activity-feed", email],
    queryFn: () => getActivityFeed(email, 15),
    enabled: !!email,
    staleTime: 2 * 60 * 1000,
  });

  if (!email) return <LoginScreen onEnter={handleEnterEmail} />;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return <LoginScreen onEnter={handleEnterEmail} />;

  const tierCfg = TIER_CONFIG[profile.loyalty.tier];
  const insight = getInsight(profile);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* ── Hero banner ──────────────────────────────── */}
      <div className={`relative overflow-hidden border-b transition-all duration-500 ${
        ownerPremium
          ? "bg-gradient-to-br from-primary/14 via-violet-500/8 to-accent/12 border-primary/20"
          : "bg-gradient-to-br from-primary/10 via-violet-500/5 to-accent/8 border-primary/10"
      }`}>
        {/* Dot pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        {/* Premium shimmer edge */}
        {ownerPremium && (
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        )}
        <div className="container mx-auto px-4 max-w-4xl py-8 md:py-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
            <AvatarUpload
              photoUrl={profile.photoUrl}
              name={profile.name}
              email={profile.email}
              onUpload={(url) => save({ photoUrl: url } as any)}
              isPremium={ownerPremium}
            />
            <div className="flex-1 text-center sm:text-left space-y-1">
              {/* Verified label — only for premium owners */}
              {ownerPremium && (() => {
                const biz = localStorage.getItem("restosmart_owner_business_type") ?? "restaurant";
                return (
                  <div className="inline-flex items-center gap-1.5 mb-2">
                    <div className="flex items-center gap-1.5 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/25 px-3 py-1 rounded-full">
                      <Shield className="w-3 h-3 text-primary" />
                      <span className="text-[11px] font-bold text-primary tracking-wide uppercase">
                        {getOwnerBadgeLabel(biz)}
                      </span>
                      <CheckCircle2 className="w-3 h-3 text-primary" />
                    </div>
                  </div>
                );
              })()}
              <h1 className="font-serif text-2xl md:text-3xl font-bold leading-tight">
                {profile.name || "Kein Name gesetzt"}
              </h1>
              <p className="text-muted-foreground text-sm">{profile.email}</p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${tierCfg.color} ${tierCfg.bg} ${tierCfg.border}`}>
                  {tierCfg.icon} {profile.loyalty.tier}-Mitglied
                </span>
                {ownerPremium && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-primary to-accent text-white shadow-sm shadow-primary/25">
                    <Crown className="w-3 h-3" /> Premium
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{profile.loyalty.points} Punkte</span>
              </div>
            </div>
            {/* Stats row */}
            <div className="flex gap-6 text-center shrink-0">
              <div>
                <div className="text-xl font-bold font-serif">{profile.stats.totalBookings}</div>
                <div className="text-[11px] text-muted-foreground">Buchungen</div>
              </div>
              <div>
                <div className="text-xl font-bold font-serif">{profile.stats.totalReviews}</div>
                <div className="text-[11px] text-muted-foreground">Bewertungen</div>
              </div>
              <div>
                <div className="text-xl font-bold font-serif">{profile.loyalty.totalEarned}</div>
                <div className="text-[11px] text-muted-foreground">Verdient</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl py-6 space-y-5">

        {/* ── Owner Premium Card (always at top) ──────── */}
        <OwnerPremiumCard
          isPremium={ownerPremium}
          onOpenModal={() => setShowPremiumModal(true)}
        />

        {/* ── Smart Insight card ──────────────────────── */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="p-2.5 rounded-xl bg-primary/10 shrink-0 self-start sm:self-auto">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-foreground leading-relaxed">{insight.message}</p>
          </div>
          {insight.cta && (
            insight.ctaHref ? (
              <Link href={insight.ctaHref} className="shrink-0 text-sm font-semibold text-primary hover:underline flex items-center gap-1 whitespace-nowrap">
                {insight.cta} <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <button className="shrink-0 text-sm font-semibold text-primary flex items-center gap-1 whitespace-nowrap"
                onClick={() => document.getElementById("tab-food")?.click()}>
                {insight.cta} <ArrowRight className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        {/* ── Main Tabs ───────────────────────────────── */}
        <Tabs defaultValue="overview">
          <TabsList className="flex overflow-x-auto gap-1 w-full mb-6 h-auto p-1 scrollbar-hide">
            <TabsTrigger value="overview" className="shrink-0 text-xs sm:text-sm">Übersicht</TabsTrigger>
            <TabsTrigger value="security" className="shrink-0 text-xs sm:text-sm">Konto</TabsTrigger>
            <TabsTrigger id="tab-food" value="food" className="shrink-0 text-xs sm:text-sm">Geschmack</TabsTrigger>
            <TabsTrigger value="activity" className="shrink-0 text-xs sm:text-sm">Verlauf</TabsTrigger>
            <TabsTrigger value="social" className="shrink-0 text-xs sm:text-sm flex items-center gap-1">
              <Activity className="w-3 h-3" /> Sozial
            </TabsTrigger>
            <TabsTrigger value="habits" className="shrink-0 text-xs sm:text-sm flex items-center gap-1">
              <Flame className="w-3 h-3" /> Habits
            </TabsTrigger>
          </TabsList>

          {/* ═══ TAB: ÜBERSICHT ═══════════════════════════════════════════ */}
          <TabsContent value="overview" className="space-y-5">

            {/* Loyalty card */}
            <div className={`rounded-2xl border p-5 md:p-6 bg-gradient-to-br ${tierCfg.gradient}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-base">Treue-Status</h3>
                  <p className={`text-2xl font-serif font-bold mt-0.5 ${tierCfg.color}`}>{tierCfg.icon} {profile.loyalty.tier}</p>
                </div>
                <Trophy className={`w-8 h-8 ${tierCfg.color} opacity-70`} />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{profile.loyalty.points} Punkte</span>
                  {profile.loyalty.nextTier && (
                    <span className="text-muted-foreground">
                      {profile.loyalty.pointsToNext} bis {profile.loyalty.nextTier}
                    </span>
                  )}
                </div>
                <Progress value={profile.loyalty.tierPct} className="h-2.5" />
                {profile.loyalty.nextTier ? (
                  <p className="text-xs text-muted-foreground">
                    Noch <strong>{profile.loyalty.pointsToNext} Punkte</strong> bis zum {profile.loyalty.nextTier}-Status
                  </p>
                ) : (
                  <p className="text-xs text-yellow-600 font-medium">Höchste Stufe erreicht 🌟</p>
                )}
              </div>

              {/* Tier benefits */}
              <div className="mt-4 pt-4 border-t border-current/10 grid grid-cols-3 gap-3 text-center">
                {[
                  { tier: "Bronze", pts: "0–199", icon: "🥉" },
                  { tier: "Silver", pts: "200–499", icon: "🥈" },
                  { tier: "Gold", pts: "500+", icon: "🥇" },
                ].map((t) => (
                  <div key={t.tier} className={`rounded-xl p-2.5 text-xs ${profile.loyalty.tier === t.tier ? "bg-primary/15 font-semibold" : "opacity-50"}`}>
                    <div className="text-base mb-1">{t.icon}</div>
                    <div className="font-medium">{t.tier}</div>
                    <div className="text-muted-foreground">{t.pts} pts</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: Calendar, label: "Buchungen", value: profile.stats.totalBookings, href: "/my-bookings", color: "text-primary" },
                { icon: MessageSquare, label: "Bewertungen", value: profile.stats.totalReviews, href: "/my-bookings", color: "text-amber-500" },
                { icon: Star, label: "Ø Bewertung", value: profile.stats.avgRating?.toFixed(1) ?? "—", href: "/my-bookings", color: "text-yellow-500" },
              ].map((s) => (
                <Link key={s.label} href={s.href}>
                  <div className="bg-card border rounded-2xl p-4 text-center hover:border-primary/50 transition-colors cursor-pointer">
                    <s.icon className={`w-5 h-5 mx-auto mb-2 ${s.color}`} />
                    <div className="text-2xl font-serif font-bold">{s.value}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Food identity summary */}
            {(profile.favoriteCuisines.length > 0 || profile.dietaryStyle !== "no_preference") && (
              <div className="bg-card border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Dein Geschmack</h3>
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => document.getElementById("tab-food")?.click()}
                  >
                    Bearbeiten
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.favoriteCuisines.map((c) => {
                    const ft = FOOD_TYPES.find((f) => f.id === c);
                    return ft ? (
                      <span key={c} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted text-sm font-medium">
                        {ft.emoji} {ft.label}
                      </span>
                    ) : null;
                  })}
                  {profile.dietaryStyle !== "no_preference" && (() => {
                    const ds = DIETARY_STYLES.find((d) => d.id === profile.dietaryStyle);
                    return ds ? (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${ds.bg} ${ds.color} ${ds.border}`}>
                        <ds.icon className="w-3.5 h-3.5" /> {ds.label}
                      </span>
                    ) : null;
                  })()}
                  {profile.allergies.filter(a => a !== "no_allergies").map((a) => {
                    const al = ALLERGIES.find((x) => x.id === a);
                    return al ? (
                      <span key={a} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 text-sm font-medium">
                        {al.emoji} {al.label}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Recent bookings */}
            {profile.recentBookings.length > 0 && (
              <div className="bg-card border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm">Letzte Buchungen</h3>
                  <Link href="/my-bookings" className="text-xs text-primary hover:underline flex items-center gap-1">
                    Alle ansehen <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {profile.recentBookings.slice(0, 3).map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                          <ShoppingBag className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{b.restaurantName}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {b.date} · {b.time} · {b.partySize} Pers.
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═══ TAB: GESCHMACK ══════════════════════════════════════════ */}
          <TabsContent value="food" className="space-y-6">

            {/* Favorite cuisines */}
            <div className="bg-card border rounded-2xl p-5 md:p-6">
              <div className="mb-4">
                <h3 className="font-bold text-base">Lieblingsküchen</h3>
                <p className="text-xs text-muted-foreground mt-1">Wähle bis zu 6 Küchen – wir zeigen dir passende Restaurants.</p>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {FOOD_TYPES.map((ft) => {
                  const selected = profile.favoriteCuisines.includes(ft.id);
                  const atLimit = !selected && profile.favoriteCuisines.length >= 6;
                  return (
                    <button
                      key={ft.id}
                      onClick={() => {
                        const next = selected
                          ? profile.favoriteCuisines.filter((c) => c !== ft.id)
                          : profile.favoriteCuisines.length < 6
                            ? [...profile.favoriteCuisines, ft.id]
                            : profile.favoriteCuisines;
                        save({ favoriteCuisines: next } as any);
                      }}
                      disabled={atLimit}
                      className={`relative flex flex-col items-center gap-2 press-scale group transition-opacity ${atLimit ? "opacity-40" : ""}`}
                    >
                      <div className={`w-full aspect-square rounded-2xl flex items-center justify-center text-2xl transition-all shadow-sm ${selected ? `bg-gradient-to-br ${ft.from} ${ft.to} shadow-md shadow-black/10` : "bg-muted/50 border border-border/50 group-hover:border-primary/30 group-hover:scale-105"}`}>
                        {ft.emoji}
                      </div>
                      {selected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                          <Check className="w-2.5 h-2.5 text-primary" />
                        </div>
                      )}
                      <span className={`text-[11px] font-bold text-center leading-tight ${selected ? "text-primary" : "text-muted-foreground"}`}>{ft.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dietary style */}
            <div className="bg-card border rounded-2xl p-5 md:p-6">
              <div className="mb-4">
                <h3 className="font-bold text-base">Ernährungsweise</h3>
                <p className="text-xs text-muted-foreground mt-1">Deine bevorzugte Ernährungsform – für passende Empfehlungen.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {DIETARY_STYLES.map((ds) => {
                  const selected = profile.dietaryStyle === ds.id;
                  return (
                    <button
                      key={ds.id}
                      onClick={() => save({ dietaryStyle: ds.id } as any)}
                      className="relative flex flex-col items-center gap-2 press-scale group"
                    >
                      <div className={`w-full aspect-square rounded-2xl flex items-center justify-center text-2xl transition-all shadow-sm ${selected ? `bg-gradient-to-br ${ds.from} ${ds.to} shadow-md shadow-black/10` : "bg-muted/50 border border-border/50 group-hover:border-primary/30 group-hover:scale-105"}`}>
                        {ds.emoji}
                      </div>
                      {selected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                          <Check className={`w-2.5 h-2.5 ${ds.color}`} />
                        </div>
                      )}
                      <span className={`text-[11px] font-bold text-center leading-tight ${selected ? ds.color : "text-muted-foreground"}`}>{ds.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Allergies */}
            <div className="bg-card border rounded-2xl p-5 md:p-6">
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <h3 className="font-bold text-base">Allergien &amp; Unverträglichkeiten</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Diese Informationen helfen uns, dir sichere Empfehlungen zu geben.</p>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {ALLERGIES.map((al) => {
                  const selected = profile.allergies.includes(al.id);
                  const isNone = al.id === "no_allergies";
                  return (
                    <button
                      key={al.id}
                      onClick={() => {
                        let next: string[];
                        if (isNone) {
                          next = selected ? [] : ["no_allergies"];
                        } else {
                          next = selected
                            ? profile.allergies.filter((a) => a !== al.id)
                            : [...profile.allergies.filter((a) => a !== "no_allergies"), al.id];
                        }
                        save({ allergies: next } as any);
                      }}
                      className="relative flex flex-col items-center gap-2 press-scale group"
                    >
                      <div className={`w-full aspect-square rounded-2xl flex items-center justify-center text-xl transition-all shadow-sm ${selected ? `bg-gradient-to-br ${al.from} ${al.to} shadow-md shadow-black/10` : "bg-muted/50 border border-border/50 group-hover:border-primary/30 group-hover:scale-105"}`}>
                        {al.emoji}
                      </div>
                      {selected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                          <Check className={`w-2.5 h-2.5 ${isNone ? "text-emerald-600" : "text-orange-600"}`} />
                        </div>
                      )}
                      <span className={`text-[10px] font-bold text-center leading-tight ${selected ? (isNone ? "text-emerald-600" : "text-orange-600") : "text-muted-foreground"}`}>{al.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recommendation preview */}
            {(profile.favoriteCuisines.length > 0 || profile.dietaryStyle !== "no_preference") && (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm text-primary">Empfehlungsprofil aktiv</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  Basierend auf deinen Präferenzen zeigen wir dir beim Entdecken zuerst Restaurants, die zu dir passen.
                  {profile.allergies.length > 0 && profile.allergies[0] !== "no_allergies" &&
                    " Deine Allergien werden bei der Auswahl berücksichtigt."}
                </p>
                <Link href="/explore" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                  Personalisierte Empfehlungen ansehen <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </TabsContent>

          {/* ═══ TAB: AKTIVITÄT ══════════════════════════════════════════ */}
          <TabsContent value="activity" className="space-y-5">
            <div className="bg-card border rounded-2xl p-5">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" /> Buchungsverlauf
              </h3>
              {profile.recentBookings.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <Calendar className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-muted-foreground text-sm">Noch keine Buchungen</p>
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <Link href="/explore">Jetzt Tisch reservieren</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {profile.recentBookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div>
                        <div className="font-medium text-sm">{b.restaurantName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {format(parseISO(b.date), "dd.MM.yyyy")} · {b.time} · {b.partySize} {b.partySize === 1 ? "Person" : "Personen"}
                        </div>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                  ))}
                  <Link href="/my-bookings" className="flex items-center justify-center gap-1.5 mt-4 text-sm text-primary font-medium hover:underline">
                    Alle Buchungen ansehen <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>

            {/* Loyalty history */}
            <div className={`bg-card border rounded-2xl p-5 bg-gradient-to-br ${tierCfg.gradient}`}>
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" /> Punkte-Übersicht
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-background/60 p-4 text-center">
                  <div className="text-3xl font-serif font-bold text-primary">{profile.loyalty.points}</div>
                  <div className="text-xs text-muted-foreground mt-1">Aktuelle Punkte</div>
                </div>
                <div className="rounded-xl bg-background/60 p-4 text-center">
                  <div className="text-3xl font-serif font-bold">{profile.loyalty.totalEarned}</div>
                  <div className="text-xs text-muted-foreground mt-1">Gesamt verdient</div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{profile.loyalty.tier}</span>
                  {profile.loyalty.nextTier && <span>{profile.loyalty.nextTier}</span>}
                </div>
                <Progress value={profile.loyalty.tierPct} className="h-3" />
                {profile.loyalty.nextTier ? (
                  <p className="text-xs text-center text-muted-foreground">
                    {profile.loyalty.pointsToNext} Punkte bis {profile.loyalty.nextTier}
                  </p>
                ) : (
                  <p className="text-xs text-center text-yellow-600 font-medium">Gold-Status erreicht 🌟</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ═══ TAB: KONTO & SICHERHEIT ════════════════════════════════ */}
          <TabsContent value="security" className="space-y-5">

            {/* 1. Privacy & Security — most important, shown first */}
            <PrivacySecuritySection onLogout={handleLogout} />

            {/* 2. Personal identity data */}
            <div className="bg-card border rounded-2xl p-5 md:p-6 space-y-5">
              <h3 className="font-bold text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> Meine Identität
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Profilbild</label>
                  <div className="flex items-center gap-4">
                    <AvatarUpload
                      photoUrl={profile.photoUrl}
                      name={profile.name}
                      email={profile.email}
                      onUpload={(url) => save({ photoUrl: url } as any)}
                      size="sm"
                    />
                    <div className="text-xs text-muted-foreground">Tippen zum Ändern</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Anzeigename</label>
                  <EditableField
                    value={profile.name}
                    onChange={(v) => save({ name: v } as any)}
                    placeholder="Deinen Namen eingeben…"
                    icon={User}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Anmelde-E-Mail</label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span>{profile.email}</span>
                    <Badge variant="secondary" className="text-[10px] ml-auto flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Verifiziert
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Restaurant owner access */}
            <div className="bg-card border rounded-2xl p-5">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <Crown className="w-4 h-4 text-primary" /> Restaurant-Bereich
              </h3>
              {ownerPremium ? (
                <button
                  onClick={() => { window.location.href = window.location.origin + "/restosmart/"; }}
                  className="flex items-center gap-3 w-full p-3 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-sm shadow-primary/20">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">Zum Restaurant-Dashboard</div>
                    <div className="text-xs text-muted-foreground">Premium aktiv · Alle Module verfügbar</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ) : (
                <button
                  onClick={() => setShowPremiumModal(true)}
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Store className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">Restaurant Premium freischalten</div>
                    <div className="text-xs text-muted-foreground">Für Restaurantbesitzer und Betreiber</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* 4. Feedback & Bewertung */}
            <div className="bg-card border rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Star className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-none">Feedback & Bewertung</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Teile deine Erfahrung mit RestoSmart</p>
                </div>
              </div>
              <ProfileFeedbackWidget email={email} />
            </div>

            {/* 5. Sign out — lowest priority */}
            <div className="bg-card border rounded-2xl p-5">
              <h3 className="font-bold text-base mb-3 text-muted-foreground/70 text-sm">Sitzung</h3>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted/50 transition-colors text-left text-sm text-muted-foreground hover:text-foreground"
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <X className="w-4 h-4" />
                </div>
                Abmelden / Konto wechseln
              </button>
            </div>
          </TabsContent>

          {/* ═══ TAB: SOZIAL ══════════════════════════════════════════════ */}
          <TabsContent value="social" className="space-y-5">
            {/* Activity feed */}
            <div className="bg-card border rounded-2xl p-5">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Meine Aktivitäten
              </h3>
              {activityFeed.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <Users className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-muted-foreground text-sm">Noch keine öffentlichen Aktivitäten</p>
                  <p className="text-xs text-muted-foreground/60">
                    Buche ein Restaurant oder schreibe eine Bewertung — deine Aktivitäten erscheinen dann hier
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activityFeed.slice(0, 10).map((a) => {
                    const label = activityLabel(a.activityType);
                    return (
                      <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-base">
                          {label.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug">
                            Du {label.verb} bei <span className="text-primary">{a.restaurantName}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(a.createdAt)}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
                          a.visibility === "public"
                            ? "bg-green-500/10 text-green-700 border-green-500/20"
                            : a.visibility === "friends"
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-muted text-muted-foreground border-border"
                        }`}>
                          {a.visibility === "public" ? "Öffentlich" : a.visibility === "friends" ? "Freunde" : "Privat"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Social privacy notice */}
            <div className="bg-muted/30 border border-border/50 rounded-2xl p-4 flex items-start gap-3">
              <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground mb-1">Datenschutz-Tipp</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Du kannst in den Konto-Einstellungen festlegen, ob deine Aktivitäten öffentlich, nur für Freunde oder privat sichtbar sind.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* ═══ TAB: HABITS ══════════════════════════════════════════════ */}
          <TabsContent value="habits" className="space-y-5">
            {/* Streak card */}
            <div className="bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-500" /> Tages-Streak
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Täglich einloggen um deinen Streak zu halten</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-serif font-black text-orange-500">{habit.data.currentStreak}</div>
                  <div className="text-xs text-muted-foreground">Tage</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-background/60 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold">{habit.data.longestStreak}</div>
                  <div className="text-xs text-muted-foreground">Bester Streak</div>
                </div>
                <div className="bg-background/60 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold">{habit.data.totalPoints}</div>
                  <div className="text-xs text-muted-foreground">Habit-Punkte</div>
                </div>
              </div>
              {habit.nextMilestone && (
                <div className="mt-3 text-xs text-muted-foreground text-center">
                  Nächster Meilenstein bei <strong>{habit.nextMilestone.target} Tagen</strong>: {habit.nextMilestone.reward}
                </div>
              )}
            </div>

            {/* Daily missions */}
            {habit.dailyMissions.length > 0 && (
              <div className="bg-card border rounded-2xl p-5">
                <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> Tagesmissionen
                </h3>
                <div className="space-y-3">
                  {habit.dailyMissions.map((m) => (
                    <div key={m.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="text-base">{m.icon}</span>
                          <span className="font-medium">{m.label}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {Math.min(m.progress, m.target)}/{m.target}
                          {m.completed && <span className="ml-1 text-green-600 font-bold">✓</span>}
                        </span>
                      </div>
                      <Progress value={Math.min((m.progress / m.target) * 100, 100)} className="h-2" />
                      {m.completed && (
                        <p className="text-xs text-green-600 font-medium">+{m.reward} Punkte erzielt!</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weekly missions */}
            {habit.weeklyMissions.length > 0 && (
              <div className="bg-card border rounded-2xl p-5">
                <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent" /> Wochenmissionen
                </h3>
                <div className="space-y-3">
                  {habit.weeklyMissions.map((m) => (
                    <div key={m.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="text-base">{m.icon}</span>
                          <span className="font-medium">{m.label}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {Math.min(m.progress, m.target)}/{m.target}
                          {m.completed && <span className="ml-1 text-green-600 font-bold">✓</span>}
                        </span>
                      </div>
                      <Progress value={Math.min((m.progress / m.target) * 100, 100)} className="h-2" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Achievements */}
            <div className="bg-card border rounded-2xl p-5">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" /> Errungenschaften
              </h3>
              {habit.unlockedAchievements.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <Trophy className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">Noch keine Errungenschaften</p>
                  <p className="text-xs text-muted-foreground/60">Buche Restaurants & pflege deinen Streak um Abzeichen zu verdienen</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {habit.unlockedAchievements.map((ach) => (
                    <div key={ach.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <span className="text-2xl shrink-0">{ach.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-snug truncate">{ach.label}</p>
                        <p className="text-[10px] text-muted-foreground">{ach.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* All locked achievements preview */}
              {habit.allAchievements && Object.values(habit.allAchievements).filter((a: any) => !a.unlockedAt).length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-3 font-medium">Noch zu freischalten</p>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.values(habit.allAchievements).filter((a: any) => !a.unlockedAt).slice(0, 4).map((ach: any) => (
                      <div key={ach.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 opacity-50">
                        <span className="text-2xl shrink-0 grayscale">{ach.icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold leading-snug truncate">{ach.label}</p>
                          <p className="text-[10px] text-muted-foreground">{ach.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Local-only notice */}
            <div className="bg-muted/30 border border-border/50 rounded-2xl p-4 flex items-start gap-3">
              <Smartphone className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Deine Habit-Daten werden lokal auf diesem Gerät gespeichert. Sie werden nicht mit anderen Geräten synchronisiert.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Premium Modal */}
      <PremiumModal
        open={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        onActivate={handleActivatePremium}
      />
    </div>
  );
}
