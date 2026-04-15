/**
 * for-business.tsx
 * Business Growth Engine — landing page for restaurant, café & bar owners
 *
 * Sections:
 *  1. Hero with live growth signal + business type selector
 *  2. Platform stats (real data)
 *  3. Value by business type
 *  4. What you are missing (missed opportunity)
 *  5. How it works (3 steps)
 *  6. Premium + Boost overview
 *  7. Claim / activation form
 *  8. Trust signals
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  UtensilsCrossed, Coffee, Wine, MapPin, TrendingUp, Eye, Star,
  Zap, BarChart3, Users, CheckCircle, ArrowRight, Sparkles, Clock,
  Shield, Award, Globe, ChevronDown, Loader2, Phone, Mail,
  Target, Flame, Activity, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSeo } from "@/hooks/use-seo";
import { useTranslation } from "react-i18next";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

type BizType = "restaurant" | "cafe" | "bar";

interface GrowthSignals {
  platform: {
    totalVenues: number;
    restaurants: number;
    cafes: number;
    bars: number;
    avgRating: number;
    totalBookings: number;
    bookings7d: number;
    bookings30d: number;
    activePromotions: number;
    totalImpressions: number;
    newPromos7d: number;
  };
  timeSignals: {
    restaurant: { active: boolean; label: string; sub: string };
    cafe:       { active: boolean; label: string; sub: string };
    bar:        { active: boolean; label: string; sub: string };
  };
  currentHour: number;
  isWeekend: boolean;
}

// ─── Business-type config ─────────────────────────────────────────────────────

function getBizConfig(t: (key: string) => string) {
  return {
    restaurant: {
      label:    t("for_business.biz_restaurant_label"),
      emoji:    "🍽️",
      icon:     UtensilsCrossed,
      color:    "text-violet-600",
      gradient: "from-violet-500 to-purple-600",
      heroTitle: t("for_business.biz_restaurant_hero"),
      heroSub:   t("for_business.biz_restaurant_sub"),
      peakTime:  t("for_business.biz_restaurant_peak_time"),
      peakDesc:  t("for_business.biz_restaurant_peak_desc"),
      values: [
        { icon: MapPin,     title: t("for_business.biz_restaurant_v0_title"), desc: t("for_business.biz_restaurant_v0_desc") },
        { icon: Eye,        title: t("for_business.biz_restaurant_v1_title"), desc: t("for_business.biz_restaurant_v1_desc") },
        { icon: BarChart3,  title: t("for_business.biz_restaurant_v2_title"), desc: t("for_business.biz_restaurant_v2_desc") },
        { icon: Zap,        title: t("for_business.biz_restaurant_v3_title"), desc: t("for_business.biz_restaurant_v3_desc") },
        { icon: Star,       title: t("for_business.biz_restaurant_v4_title"), desc: t("for_business.biz_restaurant_v4_desc") },
        { icon: TrendingUp, title: t("for_business.biz_restaurant_v5_title"), desc: t("for_business.biz_restaurant_v5_desc") },
      ],
      missedItems: [
        t("for_business.biz_restaurant_m0"),
        t("for_business.biz_restaurant_m1"),
        t("for_business.biz_restaurant_m2"),
        t("for_business.biz_restaurant_m3"),
        t("for_business.biz_restaurant_m4"),
      ],
      boostExample: t("for_business.biz_restaurant_boost"),
      tipLabel: t("for_business.biz_restaurant_tip"),
    },
    cafe: {
      label:    t("for_business.biz_cafe_label"),
      emoji:    "☕",
      icon:     Coffee,
      color:    "text-amber-600",
      gradient: "from-amber-500 to-orange-500",
      heroTitle: t("for_business.biz_cafe_hero"),
      heroSub:   t("for_business.biz_cafe_sub"),
      peakTime:  t("for_business.biz_cafe_peak_time"),
      peakDesc:  t("for_business.biz_cafe_peak_desc"),
      values: [
        { icon: MapPin,     title: t("for_business.biz_cafe_v0_title"), desc: t("for_business.biz_cafe_v0_desc") },
        { icon: Eye,        title: t("for_business.biz_cafe_v1_title"), desc: t("for_business.biz_cafe_v1_desc") },
        { icon: BarChart3,  title: t("for_business.biz_cafe_v2_title"), desc: t("for_business.biz_cafe_v2_desc") },
        { icon: Zap,        title: t("for_business.biz_cafe_v3_title"), desc: t("for_business.biz_cafe_v3_desc") },
        { icon: Star,       title: t("for_business.biz_cafe_v4_title"), desc: t("for_business.biz_cafe_v4_desc") },
        { icon: Globe,      title: t("for_business.biz_cafe_v5_title"), desc: t("for_business.biz_cafe_v5_desc") },
      ],
      missedItems: [
        t("for_business.biz_cafe_m0"),
        t("for_business.biz_cafe_m1"),
        t("for_business.biz_cafe_m2"),
        t("for_business.biz_cafe_m3"),
        t("for_business.biz_cafe_m4"),
      ],
      boostExample: t("for_business.biz_cafe_boost"),
      tipLabel: t("for_business.biz_cafe_tip"),
    },
    bar: {
      label:    t("for_business.biz_bar_label"),
      emoji:    "🍸",
      icon:     Wine,
      color:    "text-rose-600",
      gradient: "from-rose-500 to-pink-600",
      heroTitle: t("for_business.biz_bar_hero"),
      heroSub:   t("for_business.biz_bar_sub"),
      peakTime:  t("for_business.biz_bar_peak_time"),
      peakDesc:  t("for_business.biz_bar_peak_desc"),
      values: [
        { icon: MapPin,     title: t("for_business.biz_bar_v0_title"), desc: t("for_business.biz_bar_v0_desc") },
        { icon: Flame,      title: t("for_business.biz_bar_v1_title"), desc: t("for_business.biz_bar_v1_desc") },
        { icon: BarChart3,  title: t("for_business.biz_bar_v2_title"), desc: t("for_business.biz_bar_v2_desc") },
        { icon: Star,       title: t("for_business.biz_bar_v3_title"), desc: t("for_business.biz_bar_v3_desc") },
        { icon: Users,      title: t("for_business.biz_bar_v4_title"), desc: t("for_business.biz_bar_v4_desc") },
        { icon: Zap,        title: t("for_business.biz_bar_v5_title"), desc: t("for_business.biz_bar_v5_desc") },
      ],
      missedItems: [
        t("for_business.biz_bar_m0"),
        t("for_business.biz_bar_m1"),
        t("for_business.biz_bar_m2"),
        t("for_business.biz_bar_m3"),
        t("for_business.biz_bar_m4"),
      ],
      boostExample: t("for_business.biz_bar_boost"),
      tipLabel: t("for_business.biz_bar_tip"),
    },
  };
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ value, label, icon: Icon, color }: {
  value: string | number; label: string; icon: typeof Eye; color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-4">
      <Icon className={`w-5 h-5 ${color}`} />
      <p className="text-2xl font-extrabold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground text-center leading-tight">{label}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ForBusiness() {
  const { t } = useTranslation();
  useSeo({ title: t("for_business.title"), description: t("for_business.hero_subtitle") });

  const [activeBiz, setActiveBiz] = useState<BizType>("restaurant");
  const [formStep, setFormStep]   = useState<"idle" | "open" | "success">("idle");
  const [formData, setFormData]   = useState({
    businessName: "", businessType: "restaurant" as BizType,
    ownerName: "", email: "", phone: "", city: "Wien", message: "",
  });

  const bizConfig = getBizConfig(t);
  const cfg = bizConfig[activeBiz];

  const signalsQuery = useQuery<GrowthSignals>({
    queryKey: ["growth-signals"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/business-claims/growth-signals`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 120_000,
    refetchInterval: 300_000,
  });

  const claimMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const r = await fetch(`${API_BASE}/api/business-claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: data.businessName,
          businessType: data.businessType,
          ownerName:    data.ownerName,
          email:        data.email,
          phone:        data.phone,
          city:         data.city,
          message:      data.message,
          source:       "self_serve",
        }),
      });
      if (!r.ok) throw new Error("Fehler beim Absenden");
      return r.json();
    },
    onSuccess: (_, variables) => {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      localStorage.setItem("restosmart_owner_email", variables.email);
      localStorage.setItem("restosmart_owner_premium", "trial");
      localStorage.setItem("restosmart_owner_business_type", variables.businessType);
      localStorage.setItem("restosmart_trial_end", trialEnd.toISOString());
      localStorage.setItem("restosmart_trial_started", new Date().toISOString());
      fetch(`${API_BASE}/api/conversion/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "self_serve_signup",
          businessType: variables.businessType,
          source: "for_business_form",
        }),
      }).catch(() => {});
      setFormStep("success");
    },
  });

  const signals = signalsQuery.data;
  const timeSignal = signals?.timeSignals?.[activeBiz];
  const platform = signals?.platform;

  useEffect(() => {
    setFormData(f => ({ ...f, businessType: activeBiz }));
  }, [activeBiz]);

  return (
    <div className="bg-background min-h-screen">

      {/* ── 1. HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-accent/6 pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative container mx-auto px-4 pt-12 pb-10">
          {/* Label */}
          <div className="flex justify-center mb-7">
            <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-3.5 py-1.5 text-xs font-bold">
              <Building2 className="w-3 h-3" />
              {t("for_business.hero_badge")}
            </div>
          </div>

          {/* Master headline */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5 text-foreground">
              <span className="gradient-text">{t("for_business.master_headline1")}</span>
              <br />{t("for_business.master_headline2")}
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
              {t("for_business.master_sub")}
            </p>
          </div>

          {/* Business type tabs */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-muted/60 rounded-2xl p-1 border border-border/50">
              {(["restaurant", "cafe", "bar"] as BizType[]).map((type) => {
                const c = bizConfig[type];
                const Icon = c.icon;
                const isActive = activeBiz === type;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveBiz(type)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? "bg-white shadow-md shadow-black/8 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? c.color : ""}`} />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hero content — animated per type */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeBiz}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="text-center max-w-2xl mx-auto"
            >
              <div className="text-5xl mb-4">{cfg.emoji}</div>
              <h2 className="text-2xl md:text-4xl font-extrabold text-foreground tracking-tight mb-4 leading-tight">
                {cfg.heroTitle}
              </h2>
              <p className="text-muted-foreground text-base md:text-lg mb-7 leading-relaxed max-w-lg mx-auto">
                {cfg.heroSub}
              </p>

              {/* Live growth signal */}
              {timeSignal && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`inline-flex items-center gap-2.5 rounded-2xl px-4 py-2.5 border mb-8 ${
                    timeSignal.active
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-primary/5 border-primary/20 text-primary"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${timeSignal.active ? "bg-emerald-500 animate-pulse" : "bg-primary/60"}`} />
                  <div className="text-left">
                    <p className="text-xs font-bold leading-tight">{timeSignal.label}</p>
                    <p className="text-[11px] opacity-75 leading-tight">{timeSignal.sub}</p>
                  </div>
                </motion.div>
              )}

              {/* CTA buttons */}
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  size="lg"
                  className="h-13 px-8 rounded-2xl bg-gradient-to-r from-primary to-accent text-white border-0 shadow-lg shadow-primary/25 font-bold text-base hover:opacity-90 transition-opacity"
                  onClick={() => { setFormStep("open"); setTimeout(() => document.getElementById("claim-form")?.scrollIntoView({ behavior: "smooth" }), 50); }}
                >
                  {t("for_business.pricing_trial")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-13 px-6 rounded-2xl font-semibold border-border hover:border-primary/40 hover:bg-primary/5"
                  onClick={() => document.getElementById("value-section")?.scrollIntoView({ behavior: "smooth" })}
                >
                  {t("for_business.cta_learn")}
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </div>

              {/* Trust pills */}
              <div className="flex items-center justify-center gap-5 mt-4 flex-wrap">
                {[t("for_business.pricing_trial"), t("for_business.trust_no_cc"), t("for_business.trust_go_live")].map(pill => (
                  <span key={pill} className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {pill}
                  </span>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── 2. PLATFORM STATS ────────────────────────────────────────────────── */}
      {platform && (
        <section className="py-8 border-y border-border/50 bg-muted/20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-w-3xl mx-auto">
              <StatCard
                value={platform.totalVenues > 0 ? `${platform.totalVenues}+` : t("for_business.stat_growing")}
                label={t("for_business.stat_venues")}
                icon={Building2} color="text-primary"
              />
              <StatCard
                value={platform.totalBookings > 0 ? `${platform.totalBookings.toLocaleString("de")}+` : t("for_business.stat_active")}
                label={t("for_business.stat_bookings")}
                icon={CalCheck} color="text-emerald-600"
              />
              <StatCard
                value={platform.activePromotions > 0 ? `${platform.activePromotions}` : t("for_business.stat_daily")}
                label={t("for_business.stat_boosts")}
                icon={Zap} color="text-amber-500"
              />
              <StatCard
                value={platform.avgRating > 0 ? `${platform.avgRating}` : "4.7"}
                label={t("for_business.stat_rating")}
                icon={Star} color="text-yellow-500"
              />
            </div>
          </div>
        </section>
      )}

      {/* ── 3. VALUE SECTION ─────────────────────────────────────────────────── */}
      <section id="value-section" className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">{t("for_business.what_you_get")}</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              {t("for_business.visible_booked", { type: cfg.label })}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
              {t("for_business.platform_desc")}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeBiz}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 md:grid-cols-3 gap-4"
            >
              {cfg.values.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/30 transition-colors">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center mb-3 shadow-md`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground mb-1">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── 4. MISSED OPPORTUNITY ────────────────────────────────────────────── */}
      <section className="py-14 px-4 bg-gradient-to-br from-rose-50 to-orange-50 border-y border-rose-100">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-rose-500 mb-2">{t("for_business.what_you_miss")}</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              {t("for_business.while_you_wait")}
            </h2>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto text-sm">
              {t("for_business.locals_searching", { type: cfg.label === "Bar / Lounge" ? "Bar" : cfg.label })}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeBiz}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {cfg.missedItems.map((item, i) => (
                <div key={i} className="flex items-start gap-3 bg-white/80 rounded-2xl border border-rose-100 px-4 py-3.5 shadow-sm">
                  <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-rose-500 text-[11px] font-bold">{i + 1}</span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-snug">{item}</p>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>

          {timeSignal?.active && (
            <div className="mt-6 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3.5 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <p className="text-sm text-amber-800 font-medium">
                <strong>Jetzt gerade:</strong> {timeSignal.label} — Nutzer suchen aktiv.
              </p>
            </div>
          )}

          <div className="mt-8 text-center">
            <Button
              size="lg"
              className={`h-12 px-8 rounded-2xl bg-gradient-to-r ${cfg.gradient} text-white border-0 shadow-lg font-bold`}
              onClick={() => { setFormStep("open"); setTimeout(() => document.getElementById("claim-form")?.scrollIntoView({ behavior: "smooth" }), 50); }}
            >
              {t("for_business.cta_start")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── 5. HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">{t("for_business.how_it_works_label")}</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">{t("for_business.steps_title")}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                icon: Building2,
                title: t("for_business.step1_title"),
                desc: t("for_business.step1_desc"),
              },
              {
                step: "02",
                icon: Eye,
                title: t("for_business.step2_title"),
                desc: t("for_business.step2_desc"),
              },
              {
                step: "03",
                icon: TrendingUp,
                title: t("for_business.step3_title"),
                desc: t("for_business.step3_desc"),
              },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="relative rounded-2xl border border-border/60 bg-card p-6">
                <div className="absolute -top-3 left-5 bg-primary text-white text-[10px] font-black px-2.5 py-1 rounded-full">{step}</div>
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 mt-2">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-bold text-base text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURE PREVIEW ──────────────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-muted/20 border-y border-border/50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">{t("for_business.dashboard_label")}</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              {t("for_business.all_in_one")}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto text-sm">
              {t("for_business.dashboard_desc")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: Star,
                gradient: "from-primary to-accent",
                shadow: "shadow-primary/20",
                title: t("for_business.feature1_title"),
                desc: t("for_business.feature1_desc"),
                tag: t("for_business.feature1_tag"),
              },
              {
                icon: Zap,
                gradient: "from-amber-400 to-orange-500",
                shadow: "shadow-amber-400/20",
                title: t("for_business.feature2_title"),
                desc: t("for_business.feature2_desc"),
                tag: t("for_business.feature2_tag"),
              },
              {
                icon: BarChart3,
                gradient: "from-emerald-500 to-teal-500",
                shadow: "shadow-emerald-500/20",
                title: t("for_business.feature3_title"),
                desc: t("for_business.feature3_desc"),
                tag: t("for_business.feature3_tag"),
              },
              {
                icon: Shield,
                gradient: "from-primary to-accent",
                shadow: "shadow-primary/20",
                title: t("for_business.feature4_title"),
                desc: t("for_business.feature4_desc"),
                tag: t("for_business.feature4_tag"),
              },
            ].map(({ icon: Icon, gradient, shadow, title, desc, tag }) => (
              <div key={title} className="rounded-2xl border border-border/60 bg-card p-6 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-200">
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-lg ${shadow}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="font-bold text-sm text-foreground">{title}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/15 shrink-0">{tag}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <button
              onClick={() => { setFormStep("open"); setTimeout(() => document.getElementById("claim-form")?.scrollIntoView({ behavior: "smooth" }), 50); }}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-bold text-sm shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity"
            >
              {t("for_business.dashboard_cta")} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── 6. PREMIUM + BOOST ───────────────────────────────────────────────── */}
      <section className="py-14 px-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">{t("for_business.premium_label")}</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              {t("for_business.free_tier_headline")}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto text-sm">
              {t("for_business.free_tier_sub")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Free tier */}
            <div className="rounded-2xl border border-border/60 bg-card p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">{t("for_business.free_label")}</p>
              <div className="space-y-2.5">
                {[
                  t("for_business.free_feature1"),
                  t("for_business.free_feature2"),
                  t("for_business.free_feature3"),
                  t("for_business.free_feature4"),
                ].map(f => (
                  <div key={f} className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-sm text-foreground/80">{f}</span>
                  </div>
                ))}
                {[
                  t("for_business.free_locked_feature1"),
                  t("for_business.free_locked_feature2"),
                  t("for_business.free_locked_feature3"),
                  t("for_business.free_locked_feature4"),
                ].map(f => (
                  <div key={f} className="flex items-center gap-2.5 opacity-40">
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                    <span className="text-sm text-muted-foreground line-through">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Premium tier */}
            <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-accent/5 p-6 relative overflow-hidden">
              <div className="absolute top-3 right-3 bg-gradient-to-r from-primary to-accent text-white text-[10px] font-black px-2.5 py-1 rounded-full">
                {t("for_business.recommended")}
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">{t("for_business.business_premium_name")}</p>
              <p className="text-2xl font-extrabold text-foreground mb-1">
                €39,90 <span className="text-sm font-normal text-muted-foreground">{t("for_business.pricing_month_suffix")}</span>
              </p>
              <p className="text-xs text-primary font-semibold mb-4">{t("for_business.premium_subtitle")}</p>
              <div className="space-y-2.5">
                {[
                  t("for_business.premium_feature1"),
                  t("for_business.premium_feature2"),
                  t("for_business.premium_feature3"),
                  t("for_business.premium_feature4"),
                  t("for_business.premium_feature5"),
                  t("for_business.premium_feature6"),
                  t("for_business.premium_feature7"),
                  t("for_business.premium_feature8"),
                ].map(f => (
                  <div key={f} className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Boost highlight */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-md">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm text-amber-900">{t("for_business.boost_label")}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">{t("for_business.premium_feature_badge")}</span>
                </div>
                <p className="text-sm text-amber-800 mb-2">{cfg.boostExample}</p>
                <p className="text-xs text-amber-700">
                  {t("for_business.boost_transparency")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ──────────────────────────────────────────────────────── */}
      <div className="border-y border-border/50 bg-card py-5 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {[
              { icon: CheckCircle, text: t("for_business.trust1"), sub: t("for_business.trust1_sub") },
              { icon: Shield,      text: t("for_business.trust2"), sub: t("for_business.trust2_sub") },
              { icon: Clock,       text: t("for_business.trust3"), sub: t("for_business.trust3_sub") },
              { icon: Award,       text: t("for_business.trust4"), sub: t("for_business.trust4_sub") },
            ].map(({ icon: Icon, text, sub }) => (
              <div key={text} className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground leading-tight">{text}</p>
                  <p className="text-[11px] text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FINAL CTA BANNER ─────────────────────────────────────────────────── */}
      <div className="px-4 py-10">
        <div className="container mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-accent py-12 px-6 text-center shadow-2xl shadow-primary/25">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(236,72,153,0.3),transparent_60%)] pointer-events-none" />
            <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3">{t("for_business.final_cta_label")}</p>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
              {t("for_business.final_headline")}
            </h2>
            <p className="text-white/80 text-sm md:text-base max-w-md mx-auto mb-7 leading-relaxed">
              {t("for_business.final_sub")}
            </p>
            <button
              onClick={() => { setFormStep("open"); setTimeout(() => document.getElementById("claim-form")?.scrollIntoView({ behavior: "smooth" }), 50); }}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-primary font-extrabold text-sm shadow-xl hover:shadow-2xl hover:opacity-95 transition-all"
            >
              {t("for_business.final_btn")} <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-white/50 text-xs mt-4">{t("for_business.final_disclaimer")}</p>
          </div>
        </div>
      </div>

      {/* ── 7. CLAIM FORM ────────────────────────────────────────────────────── */}
      <section id="claim-form" className="py-10 px-4">
        <div className="container mx-auto max-w-xl">
          <div className="text-center mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">{t("for_business.register_label")}</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              {t("for_business.register_title")}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm max-w-md mx-auto">
              {t("for_business.register_sub")}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {formStep === "success" ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-8 text-center"
              >
                <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${cfg.gradient} flex items-center justify-center mx-auto mb-5 shadow-xl`}>
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t("for_business.success_live_badge")}
                </div>
                <h3 className="text-2xl font-extrabold text-foreground mb-2">{t("for_business.success_title")}</h3>
                <p className="text-muted-foreground text-sm mb-5">
                  {t("for_business.success_desc")}
                </p>
                <div className="bg-white/80 border border-border/60 rounded-2xl p-4 mb-6 text-left space-y-2.5">
                  {[
                    t("for_business.success_item1"),
                    t("for_business.success_item2"),
                    t("for_business.success_item3"),
                    t("for_business.success_item4"),
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-sm text-foreground/80">{item}</span>
                    </div>
                  ))}
                </div>
                <button
                  className={`w-full h-13 rounded-2xl bg-gradient-to-r ${cfg.gradient} text-white font-bold text-base shadow-lg px-6 py-3.5 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity`}
                  onClick={() => { window.location.href = window.location.origin + "/restosmart/"; }}
                >
                  {t("for_business.success_btn")}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-xs text-muted-foreground mt-3">
                  {t("for_business.success_redirect")}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="rounded-3xl border border-border/60 bg-card shadow-xl shadow-primary/5 p-6 md:p-8 space-y-4">

                  {/* Business type selector in form */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">{t("for_business.form_business_type")}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["restaurant", "cafe", "bar"] as BizType[]).map(type => {
                        const c = bizConfig[type];
                        const Icon = c.icon;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => { setActiveBiz(type); setFormData(f => ({ ...f, businessType: type })); }}
                            className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 px-2 text-xs font-semibold transition-all ${
                              formData.businessType === type
                                ? "border-primary bg-primary/8 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            <Icon className="w-4.5 h-4.5" />
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Form fields */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("for_business.form_business_name")}</label>
                    <Input
                      placeholder="z.B. Café Schwarzenberg"
                      value={formData.businessName}
                      onChange={e => setFormData(f => ({ ...f, businessName: e.target.value }))}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("for_business.form_owner_name")}</label>
                      <Input
                        placeholder="Vorname & Nachname"
                        value={formData.ownerName}
                        onChange={e => setFormData(f => ({ ...f, ownerName: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("for_business.form_city")}</label>
                      <Input
                        placeholder="Wien"
                        value={formData.city}
                        onChange={e => setFormData(f => ({ ...f, city: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("for_business.form_email")}</label>
                    <Input
                      type="email"
                      placeholder="ihre@email.at"
                      value={formData.email}
                      onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                      className="rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("for_business.form_phone")}</label>
                    <Input
                      type="tel"
                      placeholder="+43 ..."
                      value={formData.phone}
                      onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                      className="rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("for_business.form_message")}</label>
                    <textarea
                      placeholder="Was interessiert Sie besonders? Haben Sie Fragen?"
                      value={formData.message}
                      onChange={e => setFormData(f => ({ ...f, message: e.target.value }))}
                      rows={3}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                    />
                  </div>

                  {claimMutation.isError && (
                    <p className="text-sm text-red-500 rounded-xl bg-red-50 border border-red-200 px-3 py-2">
                      {t("for_business.form_error")}
                    </p>
                  )}

                  <Button
                    className={`w-full h-12 rounded-2xl bg-gradient-to-r ${cfg.gradient} text-white border-0 shadow-lg font-bold text-base`}
                    onClick={() => {
                      if (!formData.businessName || !formData.ownerName || !formData.email) return;
                      claimMutation.mutate(formData);
                    }}
                    disabled={claimMutation.isPending || !formData.businessName || !formData.ownerName || !formData.email}
                  >
                    {claimMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("for_business.form_submitting")}</>
                    ) : (
                      <>{t("for_business.pricing_trial")} <ArrowRight className="w-4 h-4 ml-2" /></>
                    )}
                  </Button>

                  <p className="text-[11px] text-muted-foreground text-center">
                    {t("for_business.form_legal")}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ── 8. TRUST SIGNALS ─────────────────────────────────────────────────── */}
      <section className="py-14 px-4 border-t border-border/50 bg-muted/20">
        <div className="container mx-auto max-w-4xl">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            {[
              {
                icon: Shield, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100",
                title: t("for_business.why0_title"),
                desc: t("for_business.why0_desc"),
              },
              {
                icon: MapPin, color: "text-primary", bg: "bg-primary/5 border-primary/15",
                title: t("for_business.why1_title"),
                desc: t("for_business.why1_desc"),
              },
              {
                icon: Award, color: "text-amber-600", bg: "bg-amber-50 border-amber-100",
                title: t("for_business.why2_title"),
                desc: t("for_business.why2_desc"),
              },
            ].map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className={`rounded-2xl border ${bg} p-6`}>
                <div className={`w-10 h-10 rounded-xl ${bg} border flex items-center justify-center mx-auto mb-3`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <h3 className="font-bold text-sm text-foreground mb-2">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Contact line */}
          <div className="mt-10 text-center">
            <p className="text-sm text-muted-foreground mb-3">{t("for_business.contact_hint")}</p>
            <div className="flex items-center justify-center gap-6 flex-wrap">
              <a href="mailto:hello@restosmart.at" className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                <Mail className="w-4 h-4" /> hello@restosmart.at
              </a>
              <span className="text-border">|</span>
              <a href="tel:+4315551234" className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                <Phone className="w-4 h-4" /> +43 1 555 1234
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Small helper — CalCheck icon (alias for CalendarCheck)
function CalCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}
