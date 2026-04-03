import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Link } from "wouter";
import {
  User, Mail, Camera, Star, Award, TrendingUp, Calendar, MessageSquare,
  Heart, Settings, ChevronRight, Edit2, Check, X, Loader2, Upload,
  Utensils, Leaf, Beef, Moon, Fish, Minus, AlertTriangle, Sparkles,
  Trophy, ArrowRight, ShoppingBag, Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useSeo } from "@/hooks/use-seo";

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
  { id: "Italian", emoji: "🍝", label: "Italienisch" },
  { id: "Japanese", emoji: "🍣", label: "Japanisch" },
  { id: "French", emoji: "🥐", label: "Französisch" },
  { id: "Indian", emoji: "🍛", label: "Indisch" },
  { id: "Mexican", emoji: "🌮", label: "Mexikanisch" },
  { id: "Thai", emoji: "🍜", label: "Thailändisch" },
  { id: "American", emoji: "🍔", label: "Amerikanisch" },
  { id: "Middle Eastern", emoji: "🧆", label: "Orientalisch" },
  { id: "Chinese", emoji: "🥟", label: "Chinesisch" },
  { id: "Mediterranean", emoji: "🫒", label: "Mediterran" },
  { id: "Seafood", emoji: "🦞", label: "Meeresfrüchte" },
  { id: "Steakhouse", emoji: "🥩", label: "Steakhaus" },
];

const DIETARY_STYLES = [
  { id: "no_preference", icon: Utensils, label: "Keine Präferenz", color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border" },
  { id: "vegetarian", icon: Leaf, label: "Vegetarisch", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-300 dark:border-emerald-700" },
  { id: "vegan", icon: Sparkles, label: "Vegan", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-300 dark:border-green-700" },
  { id: "meat_lover", icon: Beef, label: "Fleischliebhaber", color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-300 dark:border-red-700" },
  { id: "halal", icon: Moon, label: "Halal", color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-300 dark:border-violet-700" },
  { id: "seafood", icon: Fish, label: "Meeresfrüchte", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-300 dark:border-blue-700" },
];

const ALLERGIES = [
  { id: "gluten", label: "Gluten", emoji: "🌾" },
  { id: "lactose", label: "Laktose", emoji: "🥛" },
  { id: "nuts", label: "Nüsse", emoji: "🥜" },
  { id: "shellfish", label: "Schalentiere", emoji: "🦐" },
  { id: "eggs", label: "Eier", emoji: "🥚" },
  { id: "soy", label: "Soja", emoji: "🫘" },
  { id: "fish", label: "Fisch", emoji: "🐟" },
  { id: "no_allergies", label: "Keine Allergien", emoji: "✅" },
];

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  Bronze: { color: "text-amber-700", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", gradient: "from-amber-100 to-amber-50 dark:from-amber-950/40 dark:to-amber-900/10", icon: "🥉" },
  Silver: { color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800/30", border: "border-slate-300 dark:border-slate-600", gradient: "from-slate-100 to-slate-50 dark:from-slate-800/40 dark:to-slate-700/10", icon: "🥈" },
  Gold: { color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-700", gradient: "from-yellow-100 to-yellow-50 dark:from-yellow-950/40 dark:to-yellow-900/10", icon: "🥇" },
};

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
}: {
  photoUrl: string | null;
  name: string;
  email: string;
  onUpload: (url: string) => void;
  size?: "sm" | "lg";
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
    <div className="relative group cursor-pointer" onClick={() => inputRef.current?.click()}>
      <div className={`${dim} rounded-full overflow-hidden border-4 border-background shadow-lg bg-primary/10 flex items-center justify-center`}>
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

// ─── Email gate ───────────────────────────────────────────────────────────────

function EmailGate({ onEnter }: { onEnter: (email: string) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <User className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h2 className="font-serif text-2xl font-bold mb-2">Dein Profil</h2>
          <p className="text-muted-foreground text-sm">Gib deine E-Mail-Adresse ein, um dein Profil aufzurufen.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (draft.includes("@")) onEnter(draft); }} className="space-y-3">
          <Input
            type="email"
            placeholder="deine@email.de"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-12 text-center"
            autoComplete="email"
          />
          <Button type="submit" className="w-full h-12 rounded-full" disabled={!draft.includes("@")}>
            Profil aufrufen
          </Button>
        </form>
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

  useEffect(() => {
    const saved = localStorage.getItem("restosmart_email") || "";
    if (saved) setEmail(saved);
  }, []);

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

  if (!email) return <EmailGate onEnter={handleEnterEmail} />;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return <EmailGate onEnter={handleEnterEmail} />;

  const tierCfg = TIER_CONFIG[profile.loyalty.tier];
  const insight = getInsight(profile);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* ── Hero banner ──────────────────────────────── */}
      <div className={`bg-gradient-to-br ${tierCfg.gradient} border-b`}>
        <div className="container mx-auto px-4 max-w-4xl py-8 md:py-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
            <AvatarUpload
              photoUrl={profile.photoUrl}
              name={profile.name}
              email={profile.email}
              onUpload={(url) => save({ photoUrl: url } as any)}
            />
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h1 className="font-serif text-2xl md:text-3xl font-bold leading-tight">
                {profile.name || "Kein Name gesetzt"}
              </h1>
              <p className="text-muted-foreground text-sm">{profile.email}</p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${tierCfg.color} ${tierCfg.bg} ${tierCfg.border}`}>
                  {tierCfg.icon} {profile.loyalty.tier}-Mitglied
                </span>
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

      <div className="container mx-auto px-4 max-w-4xl py-6 space-y-6">

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
          <TabsList className="grid grid-cols-4 w-full mb-6">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger id="tab-food" value="food">Geschmack</TabsTrigger>
            <TabsTrigger value="activity">Aktivität</TabsTrigger>
            <TabsTrigger value="settings">Einstellungen</TabsTrigger>
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
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                        selected
                          ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                          : "border-border bg-muted/30 hover:border-primary/30"
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                      )}
                      <span className="text-2xl">{ft.emoji}</span>
                      <span className="text-xs font-medium text-center leading-tight">{ft.label}</span>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {DIETARY_STYLES.map((ds) => {
                  const selected = profile.dietaryStyle === ds.id;
                  return (
                    <button
                      key={ds.id}
                      onClick={() => save({ dietaryStyle: ds.id } as any)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left hover:scale-[1.02] active:scale-[0.98] ${
                        selected
                          ? `border-current ${ds.bg} ${ds.color} shadow-sm`
                          : "border-border hover:border-primary/20"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${selected ? ds.bg : "bg-muted"}`}>
                        <ds.icon className={`w-4 h-4 ${selected ? ds.color : "text-muted-foreground"}`} />
                      </div>
                      <span className={`text-sm font-medium ${selected ? ds.color : "text-foreground"}`}>{ds.label}</span>
                      {selected && <Check className={`w-4 h-4 ml-auto ${ds.color}`} />}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all cursor-pointer hover:scale-105 ${
                        selected
                          ? isNone
                            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                            : "border-orange-400 bg-orange-50 dark:bg-orange-950/30"
                          : "border-border bg-muted/30 hover:border-primary/20"
                      }`}
                    >
                      <span className="text-xl">{al.emoji}</span>
                      <span className="text-xs font-medium text-center">{al.label}</span>
                      {selected && <Check className={`w-3 h-3 ${isNone ? "text-emerald-600" : "text-orange-600"}`} />}
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

          {/* ═══ TAB: EINSTELLUNGEN ══════════════════════════════════════ */}
          <TabsContent value="settings" className="space-y-5">
            <div className="bg-card border rounded-2xl p-5 md:p-6 space-y-5">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Settings className="w-4 h-4" /> Persönliche Daten
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
                    <div className="text-xs text-muted-foreground">Klicke auf das Bild um es zu ändern</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</label>
                  <EditableField
                    value={profile.name}
                    onChange={(v) => save({ name: v } as any)}
                    placeholder="Deinen Namen eingeben…"
                    icon={User}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">E-Mail</label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span>{profile.email}</span>
                    <Badge variant="secondary" className="text-[10px] ml-auto">Wird als ID genutzt</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-2xl p-5">
              <h3 className="font-bold text-base mb-4">Konto</h3>
              <button
                onClick={() => {
                  localStorage.removeItem("restosmart_email");
                  setEmail("");
                }}
                className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted/50 transition-colors text-left text-sm text-muted-foreground hover:text-foreground"
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <X className="w-4 h-4" />
                </div>
                Abmelden / E-Mail wechseln
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
