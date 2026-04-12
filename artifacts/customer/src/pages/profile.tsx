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
  MapPin, CalendarDays, Plus, UserPlus, BookOpen, Bookmark, Compass,
  Image, MessageCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { getActivityFeed, getFriends, activityLabel, timeAgo, type SocialActivity, type FriendProfile } from "@/lib/social-api";
import { RestoLogo } from "@/components/resto-logo";
import { FriendsPanel } from "@/components/friends-panel";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomerProfile {
  email: string;
  name: string;
  photoUrl: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  age: number | null;
  isPrivate: boolean;
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

// ─── Level / XP System ────────────────────────────────────────────────────────

interface LevelInfo {
  level: number;
  title: string;
  emoji: string;
  xp: number;
  nextXP: number;
  pct: number;
  color: string;
}

const LEVELS = [
  { level: 1, title: "Neuer Entdecker",  emoji: "🔍", minXP: 0,   maxXP: 49,  color: "text-slate-600"  },
  { level: 2, title: "Food Explorer",    emoji: "🍕", minXP: 50,  maxXP: 149, color: "text-emerald-600" },
  { level: 3, title: "City Insider",     emoji: "🏙️", minXP: 150, maxXP: 349, color: "text-blue-600"   },
  { level: 4, title: "Social Planner",   emoji: "🎉", minXP: 350, maxXP: 699, color: "text-violet-600" },
  { level: 5, title: "Wiener Kenner",    emoji: "🌟", minXP: 700, maxXP: 9999,color: "text-yellow-600" },
];

function computeLevel(bookings: number, reviews: number, friendCount: number): LevelInfo {
  const xp = bookings * 10 + reviews * 5 + friendCount * 3;
  const cur = LEVELS.slice().reverse().find((l) => xp >= l.minXP) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.level === cur.level + 1);
  const rangeStart = cur.minXP;
  const rangeEnd   = next ? next.minXP : cur.maxXP;
  const pct = Math.min(100, Math.round(((xp - rangeStart) / (rangeEnd - rangeStart)) * 100));
  return { level: cur.level, title: cur.title, emoji: cur.emoji, xp, nextXP: rangeEnd, pct: isNaN(pct) ? 100 : pct, color: cur.color };
}

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
  const { toast } = useToast();
  const dim = size === "lg" ? "w-24 h-24" : "w-14 h-14";
  const textSize = size === "lg" ? "text-3xl" : "text-lg";

  const handleFile = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch(
        `${API_BASE}/api/customer-profile/upload?email=${encodeURIComponent(email)}`,
        { method: "POST", body: fd }
      );
      const data = await r.json();
      if (!r.ok) {
        if (data.moderated) {
          toast({ title: "Bild blockiert", description: data.error, variant: "destructive" });
        } else {
          toast({ title: "Fehler", description: "Upload fehlgeschlagen." });
        }
        return;
      }
      onUpload(`${API_BASE}${data.url}`);
    } catch {
      toast({ title: "Fehler", description: "Upload fehlgeschlagen." });
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
  const [otpStep, setOtpStep] = useState<"email" | "code">("email");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const handleSocialLogin = async (provider: "apple" | "google") => {
    setSigningIn(provider);
    await new Promise((r) => setTimeout(r, 1600));
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
    // Create server-side session so API endpoints can authenticate this customer
    try {
      await fetch(`${API_BASE}/api/auth/customer-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: demoEmail, deviceToken: deviceId }),
      });
    } catch {
      // Non-fatal — local fallback still works
    }
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
          <RestoLogo size="xl" showText={false} />
          <div className="text-center">
            <div className="text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Resto</span>
              <span className="text-foreground">Smart</span>
            </div>
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

        {/* Email fallback — two-step OTP flow for real email addresses */}
        {!showEmailFallback ? (
          <button
            onClick={() => setShowEmailFallback(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          >
            Andere E-Mail-Adresse verwenden
          </button>
        ) : otpStep === "email" ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!draft.includes("@")) return;
              setOtpLoading(true);
              setOtpError(null);
              try {
                const res = await fetch(`${API_BASE}/api/auth/customer-otp-request`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ email: draft.trim().toLowerCase() }),
                });
                const data = await res.json();
                if (data.devCode) setDevCode(data.devCode);
                setOtpStep("code");
              } catch {
                setOtpError("Fehler beim Senden. Bitte versuche es erneut.");
              } finally {
                setOtpLoading(false);
              }
            }}
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
            {otpError && <p className="text-xs text-destructive text-center">{otpError}</p>}
            <Button type="submit" variant="outline" className="w-full h-11 rounded-xl" disabled={!draft.includes("@") || otpLoading}>
              {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Code senden"}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (otpCode.length !== 6) return;
              setOtpLoading(true);
              setOtpError(null);
              try {
                const res = await fetch(`${API_BASE}/api/auth/customer-otp-verify`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ email: draft.trim().toLowerCase(), code: otpCode }),
                });
                if (!res.ok) {
                  const data = await res.json();
                  setOtpError(data.error ?? "Ungültiger Code.");
                  return;
                }
                onEnter(draft.trim().toLowerCase());
              } catch {
                setOtpError("Fehler beim Verifizieren. Bitte erneut versuchen.");
              } finally {
                setOtpLoading(false);
              }
            }}
            className="w-full space-y-2"
          >
            <p className="text-sm text-center text-muted-foreground">
              {"Code gesendet an "}<span className="font-medium text-foreground">{draft}</span>
            </p>
            {devCode && (
              <p className="text-xs text-center text-primary font-mono bg-primary/10 rounded-lg py-2">
                {"DEV: "}{devCode}
              </p>
            )}
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="6-stelliger Code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-11 text-center rounded-xl tracking-[0.4em] text-lg font-mono"
              autoFocus
            />
            {otpError && <p className="text-xs text-destructive text-center">{otpError}</p>}
            <Button type="submit" className="w-full h-11 rounded-xl" disabled={otpCode.length !== 6 || otpLoading}>
              {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verifizieren"}
            </Button>
            <button
              type="button"
              onClick={() => { setOtpStep("email"); setOtpCode(""); setOtpError(null); setDevCode(null); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Andere E-Mail verwenden
            </button>
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
  onActivate: (businessType: BusinessType, mode: "trial" | "active", trialEndDate?: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [selectedBusinessType, setSelectedBusinessType] = useState<BusinessType>("restaurant");
  const [processing, setProcessing] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState<string | null>(null);
  const [trialError, setTrialError] = useState<string | null>(null);

  const handleActivate = async () => {
    setProcessing(true);
    setTrialError(null);
    try {
      const r = await fetch(`${API_BASE}/api/billing/trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (data.success && data.trialEndDate) {
        setTrialEndDate(data.trialEndDate);
      } else if (data.error === "trial_used") {
        setTrialError("Ihre Testphase wurde bereits genutzt. Sie können direkt ein Abonnement starten.");
        setProcessing(false);
        return;
      } else if (data.error === "trial_active") {
        setTrialEndDate(data.subscription?.currentPeriodEnd ?? null);
      }
    } catch {
      // Network error — still proceed optimistically
      const fallbackEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      setTrialEndDate(fallbackEnd);
    }
    setProcessing(false);
    setStep(2);
  };

  const handleGoToDashboard = () => {
    onActivate(selectedBusinessType, "trial", trialEndDate ?? undefined);
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
                  <span className="text-xs font-bold tracking-widest uppercase text-white/80">RestoSmart Business Premium</span>
                </div>
                <h2 className="font-serif text-2xl font-bold leading-tight mb-1">Mehr Sichtbarkeit. Mehr Kunden. Mehr Wachstum.</h2>
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-2">Für Restaurants, Cafés &amp; Bars</p>
                <p className="text-white/75 text-sm leading-relaxed">Mit RestoSmart Premium erreichst du mehr Kunden in deiner Nähe, wirst häufiger gefunden und stärkst die Präsenz deines Betriebs im Alltag.</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-2xl font-serif font-bold">14 Tage kostenlos</span>
                  <span className="text-xs bg-white/20 text-white font-semibold px-2.5 py-1 rounded-full">danach 39,90€ / Monat</span>
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

            {/* Missed opportunity nudge */}
            <div className="px-6 pb-3">
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-destructive/20 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-2.5 h-2.5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                </div>
                <p className="text-xs text-destructive/80 leading-relaxed">
                  <span className="font-semibold text-destructive">Dein Betrieb ist aktuell weniger sichtbar.</span> Du verpasst potenzielle Kunden in deiner Nähe. Premium-Betriebe werden häufiger angezeigt.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="p-5 border-t bg-background/50 backdrop-blur-sm space-y-2">
              <Button
                className="w-full h-12 rounded-2xl text-base font-bold shadow-lg shadow-primary/25"
                onClick={() => setStep(1)}
              >
                Jetzt 14 Tage kostenlos starten
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Keine Zahlung heute · danach 39,90€ / Monat
              </p>
              <p className="text-center text-[11px] text-muted-foreground/60">
                Jederzeit kündbar. Keine langfristige Verpflichtung.
              </p>
              <button onClick={onClose} className="w-full text-xs text-muted-foreground/50 hover:text-foreground transition-colors py-1">
                Vielleicht später
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — 14-Tage Testphase Bestätigung */}
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
                <div className="text-xs font-bold tracking-widest uppercase text-white/75 mb-1">14 Tage kostenlos</div>
                <div className="font-serif text-xl font-bold">{getBusinessEmoji(selectedBusinessType)} {getBusinessLabel(selectedBusinessType)} Dashboard</div>
                <div className="text-white/80 text-sm mt-1">Vollzugriff · Keine Zahlung heute</div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-1.5">
                <p className="text-sm font-semibold text-emerald-900">Was Sie heute bekommen</p>
                <p className="text-sm text-emerald-800 leading-relaxed">
                  Voller Premium-Zugang für <strong>14 Tage — kostenlos</strong>. Keine Zahlungsmethode heute. Nach der Testphase können Sie für €39,90/Monat upgraden.
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  { text: "Vollständiges Analytics-Dashboard", sub: "Umsatz, Gäste, Trends" },
                  { text: "Buchungs- & Tischmanagement", sub: "Alle Reservierungen verwalten" },
                  { text: "Marketing, Kampagnen & Smart Offers", sub: "Sichtbarkeit steigern" },
                  { text: "Personal, Schichten & Gehaltsabrechnung", sub: "Team organisieren" },
                  { text: "Revenue Optimizer & Boost", sub: "Umsatz automatisch optimieren" },
                ].map((item) => (
                  <div key={item.text} className="flex items-start gap-3 p-3 rounded-2xl bg-muted/40">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">{item.text}</div>
                      <div className="text-xs text-muted-foreground">{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {trialError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                  {trialError}
                </div>
              )}

              <Button
                className="w-full h-12 rounded-2xl text-base font-semibold shadow-lg shadow-primary/25"
                onClick={handleActivate}
                disabled={processing}
              >
                {processing ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Testphase wird gestartet…</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3"/></svg>
                    Kostenlos starten
                  </span>
                )}
              </Button>

              <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
                Keine Kreditkarte erforderlich · Nach 14 Tagen: €39,90/Monat oder kostenlos kündigen.
              </p>
            </div>
          </div>
        )}

        {/* Step 2 — Testphase gestartet */}
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
              <div className="text-xs font-bold tracking-widest uppercase text-primary mb-1">14-Tage Testphase</div>
              <h3 className="font-serif text-2xl font-bold mb-2">Testphase gestartet!</h3>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
                Ihr {getBusinessLabel(selectedBusinessType)}-Dashboard ist jetzt aktiv. Vollzugriff für 14 Tage — kostenlos.
              </p>
            </div>
            <div className="w-full space-y-2.5">
              <div className="flex items-center gap-3 text-left p-3 rounded-2xl bg-muted/40">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm">Vollständiger Premium-Zugang aktiviert</span>
              </div>
              <div className="flex items-center gap-3 text-left p-3 rounded-2xl bg-muted/40">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm">Alle Dashboard-Module freigeschaltet</span>
              </div>
              {trialEndDate && (
                <div className="flex items-center gap-3 text-left p-3 rounded-2xl bg-violet-50 border border-violet-100">
                  <svg className="w-4 h-4 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3"/></svg>
                  <span className="text-sm text-violet-800">
                    Testphase läuft bis {new Date(trialEndDate).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 text-left p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm text-emerald-800">Keine Zahlung heute · kein Risiko</span>
              </div>
            </div>
            <Button
              className="w-full h-12 rounded-2xl text-base font-semibold shadow-lg shadow-primary/25 mt-2"
              onClick={handleGoToDashboard}
            >
              <Building2 className="w-4 h-4 mr-2" />
              Dashboard jetzt öffnen
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
              <span className="text-[10px] font-bold tracking-widest uppercase text-primary">Für {bizLabel}besitzer</span>
            </div>
            <span className="ml-auto text-[10px] font-bold bg-gradient-to-r from-primary to-accent text-transparent bg-clip-text border border-primary/30 px-2.5 py-0.5 rounded-full">Business Premium</span>
          </div>

          {/* Headline */}
          <h3 className="font-serif text-xl font-bold leading-snug mb-1.5">
            {bizEmoji} {bizLabel} professionell führen
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Sichtbarkeit, Buchungen, Personal, Marketing und Analytics — alles in einem Betriebsdashboard.
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

// ─── Edit Profile Sheet ───────────────────────────────────────────────────────

function EditProfileSheet({
  open,
  onClose,
  profile,
  email,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  profile: CustomerProfile;
  email: string;
  onSave: (updates: Partial<CustomerProfile & { bio: string | null; city: string | null; country: string | null; age: number | null }>) => void;
}) {
  const [draft, setDraft] = useState({
    name: profile.name,
    bio: profile.bio ?? "",
    city: profile.city ?? "",
    country: profile.country ?? "",
    age: profile.age ? String(profile.age) : "",
    photoUrl: profile.photoUrl,
    favoriteCuisines: [...profile.favoriteCuisines],
    dietaryStyle: profile.dietaryStyle,
    isPrivate: profile.isPrivate ?? false,
  });

  useEffect(() => {
    if (open) {
      setDraft({
        name: profile.name,
        bio: profile.bio ?? "",
        city: profile.city ?? "",
        country: profile.country ?? "",
        age: profile.age ? String(profile.age) : "",
        photoUrl: profile.photoUrl,
        favoriteCuisines: [...profile.favoriteCuisines],
        dietaryStyle: profile.dietaryStyle,
        isPrivate: profile.isPrivate ?? false,
      });
    }
  }, [open]);

  const handleSave = () => {
    const updates: any = {
      name: draft.name.trim() || profile.name,
      bio: draft.bio.trim() || null,
      city: draft.city.trim() || null,
      country: draft.country.trim() || null,
      age: draft.age ? parseInt(draft.age) : null,
      favoriteCuisines: draft.favoriteCuisines,
      dietaryStyle: draft.dietaryStyle,
      isPrivate: draft.isPrivate,
    };
    if (draft.photoUrl !== profile.photoUrl && draft.photoUrl) {
      updates.photoUrl = draft.photoUrl;
    }
    onSave(updates);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-3xl border-0 shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b shrink-0">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          <h2 className="text-base font-bold">{"Profil bearbeiten"}</h2>
          <button
            onClick={handleSave}
            className="text-sm font-bold text-primary hover:opacity-80 transition-opacity"
          >
            {"Speichern"}
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2 pb-2">
            <AvatarUpload
              photoUrl={draft.photoUrl}
              name={draft.name}
              email={email}
              onUpload={(url) => setDraft((d) => ({ ...d, photoUrl: url }))}
              isPremium={false}
            />
            <p className="text-xs text-muted-foreground">{"Profilbild ändern"}</p>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{"Anzeigename"}</Label>
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Dein Name"
              className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{"Über mich"}</Label>
            <textarea
              value={draft.bio}
              onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
              placeholder={"z.B. Immer auf der Suche nach neuen Cafés."}
              maxLength={160}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
            />
            <p className="text-[11px] text-muted-foreground text-right">{draft.bio.length}/160</p>
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{"Stadt"}</Label>
              <input
                value={draft.city}
                onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                placeholder="Wien"
                className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{"Land"}</Label>
              <input
                value={draft.country}
                onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
                placeholder={"Österreich"}
                className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Age */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{"Alter"}</Label>
            <input
              type="number"
              value={draft.age}
              onChange={(e) => setDraft((d) => ({ ...d, age: e.target.value }))}
              placeholder={"Optional"}
              min={13}
              max={120}
              className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
            />
          </div>

          {/* Taste tags */}
          <div className="space-y-2.5">
            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{"Geschmack (bis zu 6)"}</Label>
            <div className="flex flex-wrap gap-2">
              {FOOD_TYPES.map((ft) => {
                const selected = draft.favoriteCuisines.includes(ft.id);
                const atLimit = !selected && draft.favoriteCuisines.length >= 6;
                return (
                  <button
                    key={ft.id}
                    type="button"
                    disabled={atLimit}
                    onClick={() => {
                      setDraft((d) => ({
                        ...d,
                        favoriteCuisines: selected
                          ? d.favoriteCuisines.filter((c) => c !== ft.id)
                          : d.favoriteCuisines.length < 6
                          ? [...d.favoriteCuisines, ft.id]
                          : d.favoriteCuisines,
                      }));
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selected
                        ? "bg-primary text-white shadow-sm shadow-primary/25"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    } ${atLimit ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {ft.emoji} {ft.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dietary style */}
          <div className="space-y-2.5">
            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{"Ernährungsweise"}</Label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_STYLES.map((ds) => {
                const selected = draft.dietaryStyle === ds.id;
                return (
                  <button
                    key={ds.id}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, dietaryStyle: ds.id }))}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selected
                        ? "bg-primary text-white shadow-sm shadow-primary/25"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {ds.emoji} {ds.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Privacy toggle ─────────── */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{"Datenschutz"}</Label>
            <button
              type="button"
              onClick={() => setDraft(d => ({ ...d, isPrivate: !d.isPrivate }))}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all text-left ${
                draft.isPrivate
                  ? "bg-muted/60 border-border/60"
                  : "bg-emerald-50 border-emerald-200"
              }`}
            >
              <span className="text-xl">{draft.isPrivate ? "🔒" : "🌍"}</span>
              <div className="flex-1">
                <p className="text-sm font-bold">{draft.isPrivate ? "Profil privat" : "Profil öffentlich"}</p>
                <p className="text-xs text-muted-foreground">
                  {draft.isPrivate
                    ? "Nur Freunde können deine Beiträge sehen"
                    : "Alle können dein Profil und deine Beiträge sehen"}
                </p>
              </div>
              <div className={`w-11 h-6 rounded-full transition-all relative ${draft.isPrivate ? "bg-muted-foreground/30" : "bg-emerald-500"}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${draft.isPrivate ? "left-0.5" : "left-5"}`} />
              </div>
            </button>
          </div>

          <div className="pb-2" />
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 pb-6 pt-3 border-t space-y-2.5">
          <Button
            className="w-full h-12 rounded-2xl text-base font-bold shadow-lg shadow-primary/20"
            style={{ background: "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))" }}
            onClick={handleSave}
          >
            {"Profil aktualisieren"}
          </Button>
          <button
            onClick={onClose}
            className="w-full text-sm text-muted-foreground py-1.5 hover:text-foreground transition-colors"
          >
            {"Abbrechen"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
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
  const [showEditProfile, setShowEditProfile] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("restosmart_email") || "";
    if (saved) setEmail(saved);
  }, []);

  useEffect(() => {
    if (!email) return;
    const premiumEmail = localStorage.getItem("restosmart_owner_email");
    const premiumStatus = localStorage.getItem("restosmart_owner_premium");
    if (premiumEmail !== email) return;
    if (premiumStatus === "active") {
      setOwnerPremium(true);
    } else if (premiumStatus === "trial") {
      const trialEnd = localStorage.getItem("restosmart_trial_end");
      if (trialEnd && new Date(trialEnd) > new Date()) {
        setOwnerPremium(true);
      }
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
      const data = await r.json();
      if (!r.ok) {
        const err: any = new Error(data.error || "Failed to save");
        err.moderated = data.moderated;
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-profile", email] });
      toast({ title: "Gespeichert", description: "Dein Profil wurde aktualisiert." });
    },
    onError: (err: any) => {
      if (err.moderated) {
        toast({ title: "Inhalt blockiert", description: err.message, variant: "destructive" });
      } else {
        toast({ title: "Fehler", description: "Profil konnte nicht gespeichert werden." });
      }
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

  const handleActivatePremium = (businessType: BusinessType, mode: "trial" | "active" = "trial", trialEndDate?: string) => {
    localStorage.setItem("restosmart_owner_email", email);
    localStorage.setItem("restosmart_owner_premium", mode);
    localStorage.setItem("restosmart_owner_business_type", businessType);
    if (mode === "trial" && trialEndDate) {
      localStorage.setItem("restosmart_trial_end", trialEndDate);
      localStorage.setItem("restosmart_trial_started", new Date().toISOString());
    }
    setOwnerPremium(true);
    toast({
      title: mode === "trial" ? "14-Tage Testphase gestartet!" : "Premium aktiviert!",
      description: mode === "trial"
        ? `Vollzugriff auf Ihr ${getBusinessLabel(businessType)}-Dashboard für 14 Tage.`
        : `Willkommen im ${getBusinessLabel(businessType)}-Dashboard.`,
    });
  };

  const handleLogout = () => {
    fetch(`${API_BASE}/api/auth/customer-logout`, { method: "POST", credentials: "include" }).catch(() => {});
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

  const { data: friends = [] } = useQuery<FriendProfile[]>({
    queryKey: ["friends", email],
    queryFn: () => getFriends(email),
    enabled: !!email,
    staleTime: 60 * 1000,
  });

  const { data: instantPlans = [] } = useQuery<any[]>({
    queryKey: ["instant-plans-active", email],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/instant-plans/active/${encodeURIComponent(email)}`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!email,
    staleTime: 60 * 1000,
  });

  const { data: userPosts = [] } = useQuery<any[]>({
    queryKey: ["user-posts", email],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/posts/user/${encodeURIComponent(email)}?viewer=${encodeURIComponent(email)}`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!email,
    staleTime: 30 * 1000,
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
  const levelInfo = computeLevel(profile.stats.totalBookings, profile.stats.totalReviews, friends.length);
  const visitedRestaurants = profile.recentBookings.filter((b) =>
    b.status === "completed" || b.status === "confirmed"
  );

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
        {/* Settings gear icon */}
        <Link href="/settings" className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-background/60 hover:bg-background/80 border border-border/50 flex items-center justify-center transition-colors z-10" title="Einstellungen">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </Link>
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
              {/* Food identity status / bio */}
              <p className="text-muted-foreground text-sm flex items-center gap-1.5 justify-center sm:justify-start">
                <span className="text-base">{levelInfo.emoji}</span>
                <span>{levelInfo.title}</span>
                {profile.favoriteCuisines.length > 0 && (() => {
                  const ft = FOOD_TYPES.find(f => f.id === profile.favoriteCuisines[0]);
                  return ft ? <span className="text-muted-foreground/60">· {ft.emoji} {ft.label}</span> : null;
                })()}
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 flex-wrap">
                {/* Level badge */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 border border-primary/20 ${levelInfo.color}`}>
                  Lv. {levelInfo.level} · {levelInfo.xp} XP
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${tierCfg.color} ${tierCfg.bg} ${tierCfg.border}`}>
                  {tierCfg.icon} {profile.loyalty.tier}
                </span>
                {ownerPremium && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-primary to-accent text-white shadow-sm shadow-primary/25">
                    <Crown className="w-3 h-3" /> Premium
                  </span>
                )}
              </div>
              {/* Bio */}
              {profile.bio && (
                <p className="text-sm text-muted-foreground mt-2 text-center sm:text-left leading-relaxed max-w-xs">
                  {profile.bio}
                </p>
              )}
              {/* Location */}
              {(profile.city || profile.country) && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground/70 mt-1 justify-center sm:justify-start">
                  <MapPin className="w-3 h-3" />
                  {[profile.city, profile.country].filter(Boolean).join(", ")}
                </p>
              )}
              {/* Edit button */}
              <button
                onClick={() => setShowEditProfile(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-border bg-background/80 hover:bg-muted transition-colors text-xs font-semibold text-foreground shadow-sm"
              >
                <Edit2 className="w-3 h-3" /> {"Profil bearbeiten"}
              </button>
            </div>
            {/* Social stats row */}
            <div className="flex gap-5 sm:gap-6 text-center shrink-0">
              <div>
                <div className="text-xl font-bold font-serif">{friends.length}</div>
                <div className="text-[11px] text-muted-foreground">Freunde</div>
              </div>
              <div>
                <div className="text-xl font-bold font-serif">{instantPlans.length}</div>
                <div className="text-[11px] text-muted-foreground">{"Pläne"}</div>
              </div>
              <div>
                <div className="text-xl font-bold font-serif">{visitedRestaurants.length}</div>
                <div className="text-[11px] text-muted-foreground">{"Besuche"}</div>
              </div>
              <div>
                <div className="text-xl font-bold font-serif">{profile.favoriteRestaurantIds.length}</div>
                <div className="text-[11px] text-muted-foreground">{"Gespeichert"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl py-6 space-y-5">

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
                onClick={() => setShowEditProfile(true)}>
                {insight.cta} <ArrowRight className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        {/* ── Profile Sections ─────────────────────────── */}
        <div className="space-y-5">

          {/* ── 1. MEINE PLÄNE ──────────────────────────────────────────── */}
            <div className="bg-card border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" /> {"Meine Pläne"}
                </h3>
                <Link href="/meal-plan" className="text-xs text-primary hover:underline flex items-center gap-1">
                  {"Alle ansehen"} <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Link href="/meal-plan">
                  <div className="flex flex-col gap-2 p-4 rounded-xl bg-primary/5 border border-primary/15 hover:border-primary/40 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-primary" />
                      <span className="text-sm font-bold">{"Solo-Pläne"}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{"Wochenplan & persönliche Slots"}</p>
                    <span className="text-xs font-semibold text-primary">{"Öffnen →"}</span>
                  </div>
                </Link>
                <Link href="/meal-plan">
                  <div className="flex flex-col gap-2 p-4 rounded-xl bg-accent/5 border border-accent/15 hover:border-accent/40 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-accent" />
                      <span className="text-sm font-bold">{"Gruppenpläne"}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{"Gemeinsam planen & abstimmen"}</p>
                    <span className="text-xs font-semibold text-accent">{"Öffnen →"}</span>
                  </div>
                </Link>
              </div>
              {instantPlans.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1">{"Aktive Pläne"}</p>
                  {instantPlans.slice(0, 3).map((plan: any) => (
                    <Link key={plan.id} href="/meal-plan">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="w-8 h-8 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{plan.title || plan.restaurantName || "Gruppenplan"}</div>
                          <div className="text-[11px] text-muted-foreground">{plan.partySize || plan.memberCount || "—"} {"Personen"}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-dashed border-border/60">
                  <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">{"Noch kein Plan aktiv – starte einen neuen Solo- oder Gruppenplan"}</p>
                </div>
              )}
            </div>

            {/* ── 2. FREUNDE ──────────────────────────────── */}
            <div className="bg-card border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" /> {"Freunde"}
                  {friends.length > 0 && (
                    <span className="text-xs font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">{friends.length}</span>
                  )}
                </h3>
                <Link href="/friends" className="text-xs text-primary hover:underline flex items-center gap-1">
                  {"Verwalten"} <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {friends.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{"Noch keine Freunde"}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{"Lade Freunde ein und plane gemeinsame Abende"}</p>
                  </div>
                  <Link href="/friends" className="text-xs font-semibold text-white bg-gradient-to-r from-primary to-accent px-4 py-2 rounded-xl hover:opacity-90 transition-opacity">
                    {"+ Freund hinzufügen"}
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Avatar row */}
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {friends.slice(0, 7).map((f) => (
                        <div key={f.email} className="w-10 h-10 rounded-full ring-2 ring-background overflow-hidden bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                          {f.photoUrl ? (
                            <img src={f.photoUrl} alt={f.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white font-bold text-xs">{(f.name || f.email).charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                      ))}
                      {friends.length > 7 && (
                        <div className="w-10 h-10 rounded-full ring-2 ring-background bg-muted flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-muted-foreground">+{friends.length - 7}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground ml-1">
                      {friends.length === 1 ? "1 Freund" : `${friends.length} Freunde`}
                    </p>
                  </div>
                  {/* Friend list preview */}
                  <div className="space-y-1">
                    {friends.slice(0, 4).map((f) => (
                      <div key={f.email} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/40 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 overflow-hidden">
                          {f.photoUrl ? (
                            <img src={f.photoUrl} alt={f.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-[11px] font-bold">{(f.name || f.email).charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{f.name || f.email.split("@")[0]}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{f.email}</p>
                        </div>
                        <Link href="/friends">
                          <span className="text-[11px] text-primary font-medium hover:underline">{"Plan →"}</span>
                        </Link>
                      </div>
                    ))}
                  </div>
                  {friends.length > 4 && (
                    <Link href="/friends" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary py-2 rounded-xl hover:bg-primary/5 transition-colors">
                      {"Alle"} {friends.length} {"Freunde ansehen"} <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* ── 3. BESUCHTE ORTE ────────────────────────── */}
            <div className="bg-card border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-rose-500" /> {"Besuchte Orte"}
                  {visitedRestaurants.length > 0 && (
                    <span className="text-xs font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">{visitedRestaurants.length}</span>
                  )}
                </h3>
                <Link href="/my-bookings" className="text-xs text-primary hover:underline flex items-center gap-1">
                  {"Alle"} <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {visitedRestaurants.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{"Noch kein Besuch"}</p>
                    <p className="text-[11px] text-muted-foreground">{"Deine besuchten Restaurants erscheinen hier"}</p>
                  </div>
                  <Link href="/explore" className="text-xs font-semibold text-white bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2 rounded-xl hover:opacity-90 transition-opacity">
                    {"Restaurants entdecken"}
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {visitedRestaurants.slice(0, 5).map((b) => (
                    <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center shrink-0">
                        <MapPin className="w-4.5 h-4.5 text-rose-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{b.restaurantName}</div>
                        <div className="text-[11px] text-muted-foreground">{b.date} · {b.partySize} Pers.</div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 font-medium shrink-0">
                        Besucht
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── 4. GESPEICHERT ──────────────────────────── */}
            <div className="bg-card border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-amber-500" /> {"Gespeichert"}
                  {profile.favoriteRestaurantIds.length > 0 && (
                    <span className="text-xs font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">{profile.favoriteRestaurantIds.length}</span>
                  )}
                </h3>
                <Link href="/explore" className="text-xs text-primary hover:underline flex items-center gap-1">
                  {"Entdecken"} <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {profile.favoriteRestaurantIds.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
                    <Bookmark className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{"Noch nichts gespeichert"}</p>
                    <p className="text-[11px] text-muted-foreground">{"Tippe auf ♡ auf einem Restaurant, um es zu merken"}</p>
                  </div>
                  <Link href="/explore" className="text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 rounded-xl hover:opacity-90 transition-opacity">
                    {"Restaurants entdecken"}
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground mb-3">
                    {"Du hast"} <strong>{profile.favoriteRestaurantIds.length}</strong> {"Restaurant(s) gespeichert."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {profile.favoriteRestaurantIds.slice(0, 6).map((id) => (
                      <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <Bookmark className="w-3 h-3" /> {"Favorit"}
                      </span>
                    ))}
                    {profile.favoriteRestaurantIds.length > 6 && (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-muted text-xs text-muted-foreground">
                        +{profile.favoriteRestaurantIds.length - 6} {"weitere"}
                      </span>
                    )}
                  </div>
                  <Link href="/explore" className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-primary hover:underline">
                    {"Gespeicherte Orte ansehen"} <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>

            {/* ── 5. AKTIVITÄTS-FEED (mini) ─────────────────── */}
            <div className="bg-card border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> {"Letzte Aktivitäten"}
                </h3>
                <Link href="/my-bookings" className="text-xs text-primary hover:underline flex items-center gap-1">
                  {"Alle"} <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {activityFeed.length === 0 ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-dashed border-border/60">
                  <Activity className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  <p className="text-xs text-muted-foreground">{"Buche ein Restaurant oder schreibe eine Bewertung – Aktivitäten erscheinen dann hier"}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activityFeed.slice(0, 5).map((a) => {
                    const label = activityLabel(a.activityType);
                    return (
                      <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm">
                          {label.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug">
                            {"Du"} {label.verb} {"bei"} <span className="text-primary">{a.restaurantName}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── 6. GESCHMACK-SUMMARY ─────────────────────── */}
            <div className="bg-card border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-primary" /> {"Mein Geschmack"}
                </h3>
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setShowEditProfile(true)}
                >
                  {"Bearbeiten"}
                </button>
              </div>
              {profile.favoriteCuisines.length === 0 && profile.dietaryStyle === "no_preference" ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-dashed border-border/60">
                  <Utensils className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  <p className="text-xs text-muted-foreground">{"Noch kein Geschmack gesetzt – tippe auf Bearbeiten, um deine Lieblingsküchen zu wählen"}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {profile.favoriteCuisines.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">{"Lieblingsküchen"}</p>
                      <div className="flex flex-wrap gap-2">
                        {profile.favoriteCuisines.map((c) => {
                          const ft = FOOD_TYPES.find((f) => f.id === c);
                          return ft ? (
                            <span key={c} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted text-sm font-medium">
                              {ft.emoji} {ft.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                  {profile.dietaryStyle !== "no_preference" && (() => {
                    const ds = DIETARY_STYLES.find((d) => d.id === profile.dietaryStyle);
                    return ds ? (
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{"Ernährungsweise:"}</p>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${ds.color}`}>
                          {ds.emoji} {ds.label}
                        </span>
                      </div>
                    ) : null;
                  })()}
                  {profile.allergies.filter(a => a !== "no_allergies").length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">{"Allergien"}</p>
                      <div className="flex flex-wrap gap-2">
                        {profile.allergies.filter(a => a !== "no_allergies").map((a) => {
                          const al = ALLERGIES.find((x) => x.id === a);
                          return al ? (
                            <span key={a} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 text-xs font-medium">
                              {al.emoji} {al.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>


            {/* Header CTA */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Image className="w-4 h-4 text-primary" /> {"Meine Beiträge"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {userPosts.length === 0 ? "Noch keine Beiträge veröffentlicht" : `${userPosts.length} ${userPosts.length === 1 ? "Beitrag" : "Beiträge"}`}
                </p>
              </div>
              <Link href="/feed" className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-primary to-accent px-3 py-2 rounded-xl hover:opacity-90 transition-opacity">
                <Plus className="w-3.5 h-3.5" /> {"Neuer Post"}
              </Link>
            </div>

            {userPosts.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-12 text-center bg-card border rounded-2xl">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-4xl">
                  {"📸"}
                </div>
                <div>
                  <p className="font-bold">{"Noch keine Beiträge"}</p>
                  <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                    {"Teile dein Food-Erlebnis mit der Community – Fotos, Orte, Momente."}
                  </p>
                </div>
                <Link href="/feed" className="flex items-center gap-2 text-sm font-bold text-white bg-gradient-to-r from-primary to-accent px-5 py-2.5 rounded-xl hover:opacity-90">
                  <Plus className="w-4 h-4" /> {"Ersten Beitrag erstellen"}
                </Link>
              </div>
            ) : (
              <>
                {/* Posts grid */}
                <div className="grid grid-cols-3 gap-1.5">
                  {userPosts.map((post: any) => (
                    <Link key={post.id} href="/feed">
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-muted group">
                        <img
                          src={post.image_url.startsWith("/api")
                            ? `${API_BASE}${post.image_url}`
                            : post.image_url}
                          alt="Post"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        {/* Like / comment overlay on hover */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 text-white text-xs font-bold">
                          <span className="flex items-center gap-1">
                            <Heart className="w-3.5 h-3.5 fill-white" /> {post.likeCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-3.5 h-3.5" /> {post.commentCount}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Post stats summary */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Beiträge", value: userPosts.length, icon: Image },
                    { label: "Gefällt mir", value: userPosts.reduce((sum: number, p: any) => sum + p.likeCount, 0), icon: Heart },
                    { label: "Kommentare", value: userPosts.reduce((sum: number, p: any) => sum + p.commentCount, 0), icon: MessageCircle },
                  ].map((s) => (
                    <div key={s.label} className="bg-card border rounded-2xl p-4 text-center">
                      <s.icon className="w-4 h-4 mx-auto mb-1.5 text-primary" />
                      <div className="text-xl font-bold font-serif">{s.value}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                <Link href="/feed" className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-primary hover:bg-primary/5 rounded-xl transition-colors">
                  {"Feed öffnen"} <ChevronRight className="w-4 h-4" />
                </Link>
              </>
            )}
            {/* Booking history */}
            <div className="bg-card border rounded-2xl p-5">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" /> {"Buchungsverlauf"}
              </h3>
              {profile.recentBookings.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <Calendar className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-muted-foreground text-sm">{"Noch keine Buchungen"}</p>
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <Link href="/explore">{"Jetzt Tisch reservieren"}</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {profile.recentBookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div>
                        <div className="font-medium text-sm">{b.restaurantName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {format(parseISO(b.date), "dd.MM.yyyy")} {" · "} {b.time} {" · "} {b.partySize} {b.partySize === 1 ? "Person" : "Personen"}
                        </div>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                  ))}
                  <Link href="/my-bookings" className="flex items-center justify-center gap-1.5 mt-4 text-sm text-primary font-medium hover:underline">
                    {"Alle Buchungen ansehen"} <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>

            {/* Loyalty points overview */}
            <div className={`bg-card border rounded-2xl p-5 bg-gradient-to-br ${tierCfg.gradient}`}>
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" /> {"Punkte-Übersicht"}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-background/60 p-4 text-center">
                  <div className="text-3xl font-serif font-bold text-primary">{profile.loyalty.points}</div>
                  <div className="text-xs text-muted-foreground mt-1">{"Aktuelle Punkte"}</div>
                </div>
                <div className="rounded-xl bg-background/60 p-4 text-center">
                  <div className="text-3xl font-serif font-bold">{profile.loyalty.totalEarned}</div>
                  <div className="text-xs text-muted-foreground mt-1">{"Gesamt verdient"}</div>
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
                    {profile.loyalty.pointsToNext} {"Punkte bis"} {profile.loyalty.nextTier}
                  </p>
                ) : (
                  <p className="text-xs text-center text-yellow-600 font-medium">{"Gold-Status erreicht ⭐"}</p>
                )}
              </div>
            </div>

          {/* ── Business / Premium card ─────────────── */}
          <OwnerPremiumCard isPremium={ownerPremium} onOpenModal={() => setShowPremiumModal(true)} />

        </div>
      </div>

      {/* Premium Modal */}
      <PremiumModal
        open={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        onActivate={handleActivatePremium}
      />

      {/* Edit Profile Sheet */}
      <EditProfileSheet
        open={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        profile={profile}
        email={email}
        onSave={save}
      />
    </div>
  );
}
