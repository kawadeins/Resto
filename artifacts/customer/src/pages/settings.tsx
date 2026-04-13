import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  User, Mail, Phone, ChevronRight, Check, X, Loader2,
  Crown, Building2, Bell, Shield, Lock, Smartphone, Globe,
  AlertTriangle, ExternalLink, Star, Flame, Trophy, Target,
  FileText, HelpCircle, LogOut, Trash2, ArrowLeft, Settings,
  CheckCircle2, Zap, Store, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useHabitLoop } from "@/hooks/use-habit-loop";
import { ProfileFeedbackWidget } from "@/components/app-rating-prompt";
import { useTranslation } from "react-i18next";
import { LanguagePicker } from "@/components/language-picker";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CustomerProfile {
  email: string;
  name: string;
  photoUrl: string | null;
  favoriteCuisines: string[];
  dietaryStyle: string;
  allergies: string[];
  favoriteTags: string[];
  favoriteRestaurantIds: string[];
  loyalty: { points: number; totalEarned: number; tier: string; nextTier: string | null; pointsToNext: number; tierPct: number };
  stats: { totalBookings: number; totalReviews: number; avgRating: number | null };
  recentBookings: Array<{ id: number; date: string; time: string; partySize: number; status: string; restaurantName: string }>;
}

// ─── Inline EditableField ──────────────────────────────────────────────────────

function EditableField({
  value,
  onChange,
  placeholder,
  icon: Icon,
  readOnly,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ElementType;
  readOnly?: boolean;
  type?: string;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  if (readOnly) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-muted/40 border border-border/50 text-sm text-muted-foreground">
        {Icon && <Icon className="w-4 h-4 shrink-0" />}
        <span className="flex-1">{value || placeholder}</span>
        <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {t("settings.verified")}
        </Badge>
      </div>
    );
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full flex items-center gap-2 h-10 px-3 rounded-xl bg-muted/40 border border-border/50 hover:border-primary/40 transition-colors text-sm text-left"
      >
        {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
        <span className={`flex-1 ${value ? "text-foreground" : "text-muted-foreground"}`}>{value || placeholder}</span>
        <span className="text-[11px] text-primary font-medium">{t("settings.edit_field")}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />}
        <Input
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className={`h-10 rounded-xl ${Icon ? "pl-9" : ""} pr-3`}
          autoFocus
        />
      </div>
      <button
        onClick={() => { onChange(draft); setEditing(false); }}
        className="w-9 h-9 rounded-xl bg-primary/10 hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors"
      >
        <Check className="w-4 h-4 text-primary" />
      </button>
      <button
        onClick={() => { setDraft(value); setEditing(false); }}
        className="w-9 h-9 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center shrink-0 transition-colors"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
  className = "",
}: {
  icon?: React.ElementType;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-card border rounded-2xl p-5 space-y-4 ${className}`}>
      <h2 className="font-bold text-sm flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-primary shrink-0" />}
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const habit = useHabitLoop();

  // ── Email / auth ─────────────────────────────────────────────────────────
  const [email, setEmail] = useState(() => localStorage.getItem("restosmart_email") ?? "");
  useEffect(() => {
    const sync = () => setEmail(localStorage.getItem("restosmart_email") ?? "");
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (email === "" && typeof window !== "undefined") {
      const stored = localStorage.getItem("restosmart_email");
      if (!stored) navigate("/profile");
    }
  }, [email, navigate]);

  // ── Profile data ─────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!email) return;
    setLoading(true);
    fetch(`${API_BASE}/api/customer-profile/${encodeURIComponent(email)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setProfile(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [email]);

  const save = useCallback(async (patch: Partial<CustomerProfile>) => {
    if (!email) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/customer-profile/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error();
      await r.json();
      setProfile(prev => prev ? { ...prev, ...patch } : prev);
      toast({ title: t("settings.saved"), description: t("settings.save_success") });
    } catch {
      toast({ title: t("common.error"), description: t("settings.save_error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [email, toast, t]);

  // ── Notification toggles ─────────────────────────────────────────────────
  const [notifBookings, setNotifBookings] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);
  const [notifReviews, setNotifReviews] = useState(true);

  // ── Owner premium ────────────────────────────────────────────────────────
  const [ownerPremium, setOwnerPremium] = useState(false);
  useEffect(() => {
    setOwnerPremium(localStorage.getItem("restosmart_owner_premium") === "true");
  }, []);

  const bizType = localStorage.getItem("restosmart_owner_business_type") ?? "restaurant";
  const bizLabel = bizType === "cafe" ? "Café" : bizType === "bar" ? "Bar" : "Restaurant";
  const bizEmoji = bizType === "cafe" ? "☕" : bizType === "bar" ? "🍸" : "🍽️";

  // ── Delete account ───────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("restosmart_email");
    localStorage.removeItem("restosmart_owner_premium");
    localStorage.removeItem("restosmart_owner_business_type");
    window.dispatchEvent(new Event("storage"));
    navigate("/");
  };

  const handleDelete = async () => {
    toast({ title: t("settings.delete_account"), description: t("settings.delete_success") });
    handleLogout();
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (!email) return null;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const name = profile?.name ?? "";

  return (
    <div className="min-h-screen bg-background pb-28">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 max-w-2xl h-14 flex items-center gap-3">
          <Link href="/profile" className="w-9 h-9 rounded-xl bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-base leading-none">{t("settings.title")}</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">{email}</p>
          </div>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-2xl py-5 space-y-4">

        {/* ── 1. Konto-Details — nur für Business/Premium-Nutzer ──────── */}
        {ownerPremium && (
          <Section icon={User} title={t("settings.account")}>
            {/* Avatar row */}
            <div className="flex items-center gap-4 pb-2">
              <div className="relative w-16 h-16 shrink-0">
                {profile?.photoUrl ? (
                  <img
                    src={profile.photoUrl}
                    alt={name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-primary/20"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xl font-bold border-2 border-primary/20">
                    {name ? name[0].toUpperCase() : email[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{name || t("settings.no_name")}</p>
                <p className="text-xs text-muted-foreground truncate">{email}</p>
                <Badge variant="secondary" className="mt-1 text-[10px] flex items-center gap-1 w-fit">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {t("settings.email_verified")}
                </Badge>
              </div>
            </div>

            {/* Name field */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{t("settings.display_name")}</label>
              <EditableField
                value={name}
                onChange={(v) => save({ name: v } as any)}
                placeholder={t("settings.name_placeholder")}
                icon={User}
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{t("settings.login_email")}</label>
              <EditableField
                value={email}
                onChange={() => {}}
                placeholder={t("settings.email")}
                icon={Mail}
                readOnly
              />
            </div>
          </Section>
        )}

        {/* ── 2. Business-Dashboard ──────────────────────────────────── */}
        <Section icon={Crown} title={t("settings.business")}>
          {ownerPremium ? (
            <button
              onClick={() => { window.location.href = window.location.origin + "/restosmart/"; }}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-sm shadow-primary/20 text-lg">
                {bizEmoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{t("settings.my_dashboard", { biz: bizLabel })}</div>
                <div className="text-xs text-muted-foreground">{t("settings.premium_active")}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ) : (
            <Link href="/for-business" className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 border border-border/50 transition-colors text-left">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{t("settings.business_unlock")}</div>
                <div className="text-xs text-muted-foreground">{t("settings.business_unlock_desc")}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          )}
        </Section>

        {/* ── 3. Benachrichtigungen ───────────────────────────────────── */}
        <Section icon={Bell} title={t("settings.notifications")}>
          <div className="space-y-1">
            {[
              { label: t("settings.notif_bookings"), detail: t("settings.notif_bookings_detail"), value: notifBookings, onChange: setNotifBookings },
              { label: t("settings.notif_reviews"), detail: t("settings.notif_reviews_detail"), value: notifReviews, onChange: setNotifReviews },
              { label: t("settings.notif_marketing"), detail: t("settings.notif_marketing_detail"), value: notifMarketing, onChange: setNotifMarketing },
            ].map((item, i, arr) => (
              <div key={item.label} className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? "border-b" : ""}`}>
                <div className="flex-1 mr-4">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.detail}</div>
                </div>
                <Switch checked={item.value} onCheckedChange={item.onChange} />
              </div>
            ))}
          </div>
        </Section>

        {/* ── 3b. Sprache ─────────────────────────────────────────────── */}
        <Section icon={Globe} title={t("settings.language")}>
          <LanguagePicker variant="inline" />
        </Section>

        {/* ── 4. Datenschutz ─────────────────────────────────────────── */}
        <Section icon={Shield} title={t("settings.privacy")}>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
            <Lock className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">{t("settings.data_protected")}</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5 leading-relaxed">
                {t("settings.data_protected_desc")}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            {[
              { label: t("settings.privacy_profile"), detail: t("settings.privacy_profile_detail") },
              { label: t("settings.privacy_bookings"), detail: t("settings.privacy_bookings_detail") },
              { label: t("settings.privacy_taste"), detail: t("settings.privacy_taste_detail") },
              { label: t("settings.privacy_loyalty"), detail: t("settings.privacy_loyalty_detail") },
            ].map((item, i, arr) => (
              <div key={item.label} className={`flex items-center justify-between py-2.5 ${i < arr.length - 1 ? "border-b" : ""}`}>
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.detail}</div>
                </div>
                <Badge variant="secondary" className="text-[10px]">{t("settings.data_status")}</Badge>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            className="w-full rounded-xl h-10 text-sm"
            onClick={() => toast({ title: t("settings.export_requested"), description: t("settings.export_desc") })}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t("settings.export_data")}
          </Button>
        </Section>

        {/* ── 5. Habit-Fortschritt ────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20 rounded-2xl p-5 space-y-4">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500 shrink-0" />
            {t("settings.habit_title")}
          </h2>

          {/* Streak + points overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-background/60 rounded-xl p-3 text-center">
              <div className="text-2xl font-serif font-black text-orange-500">{habit.data.currentStreak}</div>
              <div className="text-[11px] text-muted-foreground">{t("settings.streak_daily")}</div>
            </div>
            <div className="bg-background/60 rounded-xl p-3 text-center">
              <div className="text-2xl font-serif font-bold">{habit.data.longestStreak}</div>
              <div className="text-[11px] text-muted-foreground">{t("settings.streak_best")}</div>
            </div>
            <div className="bg-background/60 rounded-xl p-3 text-center">
              <div className="text-2xl font-serif font-bold">{habit.data.totalPoints}</div>
              <div className="text-[11px] text-muted-foreground">{t("settings.habit_points")}</div>
            </div>
          </div>

          {/* Next milestone */}
          {habit.nextMilestone && (
            <div className="text-xs text-muted-foreground text-center">
              {t("settings.next_milestone", { target: habit.nextMilestone.target, reward: habit.nextMilestone.reward })}
            </div>
          )}

          {/* Daily missions summary */}
          {habit.dailyMissions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Target className="w-3 h-3" /> {t("settings.daily_missions")}
              </p>
              {habit.dailyMissions.slice(0, 3).map((m) => (
                <div key={m.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {Math.min(m.progress, m.target)}/{m.target}
                      {m.completed && <span className="ml-1 text-green-600 font-bold">{"✓"}</span>}
                    </span>
                  </div>
                  <Progress value={Math.min((m.progress / m.target) * 100, 100)} className="h-1.5" />
                </div>
              ))}
            </div>
          )}

          {/* Achievements count */}
          {habit.unlockedAchievements.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="flex-1">
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {t("settings.achievements_unlocked", { count: habit.unlockedAchievements.length })}
                </span>
              </div>
              <div className="flex gap-1">
                {habit.unlockedAchievements.slice(0, 3).map((a) => (
                  <span key={a.id} className="text-lg">{a.icon}</span>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
            <Smartphone className="w-3 h-3 shrink-0 mt-0.5" />
            {t("settings.habit_local")}
          </p>
        </div>

        {/* ── 6. Sitzungen ────────────────────────────────────────────── */}
        <Section icon={Smartphone} title={t("settings.sessions")}>
          <div className="p-3 rounded-xl bg-muted/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <div className="text-sm font-medium">{t("settings.this_device")}</div>
                <div className="text-xs text-muted-foreground">{t("settings.last_active")}</div>
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30">{t("settings.current_session")}</Badge>
          </div>
          <Button
            variant="outline"
            className="w-full rounded-xl h-10 text-sm"
            onClick={handleLogout}
          >
            {t("settings.end_all_sessions")}
          </Button>
        </Section>

        {/* ── 7. Feedback ─────────────────────────────────────────────── */}
        <Section icon={Star} title={t("settings.feedback_section")}>
          <ProfileFeedbackWidget email={email} />
        </Section>

        {/* ── 8. Rechtliches & Hilfe ──────────────────────────────────── */}
        <Section icon={FileText} title={t("settings.legal_section")}>
          <div className="space-y-1">
            {[
              { labelKey: "settings.privacy_policy", href: "#" },
              { labelKey: "settings.terms", href: "#" },
              { labelKey: "settings.imprint", href: "#" },
              { labelKey: "settings.contact_support", href: "#" },
            ].map((item, i, arr) => (
              <button
                key={item.labelKey}
                onClick={() => toast({ title: t(item.labelKey), description: t("settings.coming_soon") })}
                className={`w-full flex items-center justify-between py-3 text-sm hover:text-primary transition-colors ${i < arr.length - 1 ? "border-b" : ""}`}
              >
                <span>{t(item.labelKey)}</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
          <div className="text-center text-[10px] text-muted-foreground/50 pt-1">
            {t("settings.version")}
          </div>
        </Section>

        {/* ── 9. Abmelden ─────────────────────────────────────────────── */}
        <div className="bg-card border rounded-2xl p-5">
          <h2 className="font-bold text-sm text-muted-foreground mb-3">{t("settings.session_label")}</h2>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-sm font-medium">{t("settings.logout")}</div>
              <div className="text-xs text-muted-foreground">{t("settings.logout_hint")}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
          </button>
        </div>

        {/* ── 10. Gefahrenzone ────────────────────────────────────────── */}
        <div className="bg-card border border-red-200 dark:border-red-900/50 rounded-2xl p-5 space-y-3">
          <h2 className="font-bold text-sm flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            {t("settings.danger_zone")}
          </h2>
          {showDeleteConfirm ? (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 space-y-3">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                {t("settings.delete_warning")}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-xl flex-1" onClick={() => setShowDeleteConfirm(false)}>
                  {t("settings.cancel")}
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
                  onClick={handleDelete}
                >
                  {t("settings.delete_cta")}
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-red-600">{t("settings.delete_account")}</div>
                <div className="text-xs text-muted-foreground">{t("settings.delete_all_data")}</div>
              </div>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
