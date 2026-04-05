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

const BIZ_CONFIG: Record<BizType, {
  label: string;
  emoji: string;
  icon: typeof UtensilsCrossed;
  color: string;
  gradient: string;
  heroTitle: string;
  heroSub: string;
  peakTime: string;
  peakDesc: string;
  values: { icon: typeof Eye; title: string; desc: string }[];
  missedItems: string[];
  boostExample: string;
  tipLabel: string;
}> = {
  restaurant: {
    label:    "Restaurant",
    emoji:    "🍽️",
    icon:     UtensilsCrossed,
    color:    "text-violet-600",
    gradient: "from-violet-500 to-purple-600",
    heroTitle: "Mehr Gäste. Mehr Tische. Mehr Umsatz.",
    heroSub:   "RestoSmart bringt Restaurants neue Gäste aus der Umgebung — mit smarter Sichtbarkeit, Live-Verfügbarkeit und gezieltem Marketing.",
    peakTime:  "Mittag & Abend",
    peakDesc:  "Nutzer suchen aktiv nach Tischreservierungen in Ihrer Umgebung",
    values: [
      { icon: MapPin,     title: "Karten-Sichtbarkeit",  desc: "Erscheinen Sie prominent auf der Entdeckungs-Karte" },
      { icon: Eye,        title: "Höhere Reichweite",    desc: "Erreichen Sie mehr Menschen in Ihrer Umgebung" },
      { icon: BarChart3,  title: "Buchungsanalysen",     desc: "Verstehen Sie wann und warum Gäste reservieren" },
      { icon: Zap,        title: "Mittags-Boost",        desc: "Promoted Platzierung in Stoßzeiten 11–14 Uhr" },
      { icon: Star,       title: "Premium-Badge",        desc: "Trust-Badge für höhere Klickrate" },
      { icon: TrendingUp, title: "Umsatz-Optimizer",     desc: "KI-gestützte Empfehlungen für Wachstum" },
    ],
    missedItems: [
      "Nutzer in Ihrer Umgebung reservieren bei Konkurrenten",
      "Ihr Lokal erscheint nicht auf der Entdeckungs-Karte",
      "Mittags- und Abend-Peaks nutzen Sie nicht für Sichtbarkeit",
      "Gäste finden Sie nicht, obwohl sie gerade suchen",
      "Kein Premium-Badge — Vertrauen bleibt auf der Strecke",
    ],
    boostExample: "Mittagstisch-Boost — €0.01/Einblendung, sichtbar für alle Umgebungsnutzer 11–14 Uhr",
    tipLabel: "Mittags-Boost",
  },
  cafe: {
    label:    "Café",
    emoji:    "☕",
    icon:     Coffee,
    color:    "text-amber-600",
    gradient: "from-amber-500 to-orange-500",
    heroTitle: "Mehr Stammgäste. Mehr Kaffee. Mehr Morgen.",
    heroSub:   "RestoSmart bringt Cafés lokale Gäste am Morgen, in der Mittagspause und am Nachmittag — mit echter Nähesuche und smarten Angeboten.",
    peakTime:  "Morgen & Mittagspause",
    peakDesc:  "Kaffee-Nachfrage in Wien ist morgens und mittags am stärksten",
    values: [
      { icon: MapPin,     title: "Nahbereichs-Entdeckung", desc: "Nutzer in 500m Umkreis finden Sie zuerst" },
      { icon: Eye,        title: "Frühstücks-Sichtbarkeit", desc: "Prominente Platzierung in der Morgenroutine" },
      { icon: BarChart3,  title: "Besucheranalysen",        desc: "Wann kommen Ihre besten Gäste?" },
      { icon: Zap,        title: "Frühstücks-Boost",        desc: "Promoted Platzierung 6–11 Uhr" },
      { icon: Star,       title: "Vertrauens-Badge",        desc: "Premium-Badge erhöht Klickrate spürbar" },
      { icon: Globe,      title: "Work-from-Café Signal",   desc: "Laptop-Friendly Badge für Work-Gäste" },
    ],
    missedItems: [
      "Morgenbesucher wählen Cafés, die zuerst angezeigt werden",
      "Sie fehlen auf der Karte, wenn Gäste ihren Tag starten",
      "Mittagspausen-Suchende finden Sie nicht in der Nähe",
      "Kein Boost — Sie erscheinen nach der Konkurrenz",
      "Nachmittags-Potential bleibt ungenutzt",
    ],
    boostExample: "Frühstücks-Boost — €0.01/Einblendung, maximale Café-Sichtbarkeit 6–11 Uhr",
    tipLabel: "Frühstücks-Boost",
  },
  bar: {
    label:    "Bar / Lounge",
    emoji:    "🍸",
    icon:     Wine,
    color:    "text-rose-600",
    gradient: "from-rose-500 to-pink-600",
    heroTitle: "Mehr Gäste. Mehr Happy Hour. Mehr Nächte.",
    heroSub:   "RestoSmart bringt Bars Nachtleben-Gäste in der richtigen Stunde — mit Happy-Hour-Boosts, Wochenend-Sichtbarkeit und lokaler Entdeckung.",
    peakTime:  "Abend & Wochenende",
    peakDesc:  "Nachtleben-Suchen in Wien explodieren ab 19 Uhr freitags und samstags",
    values: [
      { icon: MapPin,     title: "Nachtleben-Entdeckung",  desc: "Sichtbar wenn Gäste ausgehen wollen" },
      { icon: Flame,      title: "Happy-Hour-Boosts",      desc: "Promoted Platzierung 17–20 Uhr" },
      { icon: BarChart3,  title: "Nacht-Analysen",         desc: "Verstehen Sie Ihre besten Abendmuster" },
      { icon: Star,       title: "Wochenend-Premium",      desc: "Erhöhte Sichtbarkeit Fr/Sa/So" },
      { icon: Users,      title: "Gruppen-Empfehlungen",   desc: "Erscheinen bei Gruppen-Planungs-Features" },
      { icon: Zap,        title: "Nightlife-Boost",        desc: "Top-Platzierung 19–24 Uhr" },
    ],
    missedItems: [
      "Gruppen suchen freitagabends nach Bars — und finden Ihre nicht",
      "Happy-Hour Potential bleibt ohne Boost ungenutzt",
      "Wochenend-Suchende sehen zuerst die Premium-Bars",
      "Nachtleben-Suchen treffen Sie nicht, weil Sie nicht gelistet sind",
      "Kein Gruppen-Empfehlungs-Feature ohne Premium",
    ],
    boostExample: "Nightlife-Boost — €0.01/Einblendung, maximale Bar-Sichtbarkeit 19–24 Uhr Fr/Sa",
    tipLabel: "Nightlife-Boost",
  },
};

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
  useSeo({ title: "Für Betriebe | RestoSmart — Mehr Gäste, mehr Umsatz", description: "RestoSmart für Restaurants, Cafés und Bars in Wien: Sichtbarkeit, Buchungen, Boost & mehr." });

  const [activeBiz, setActiveBiz] = useState<BizType>("restaurant");
  const [formStep, setFormStep]   = useState<"idle" | "open" | "success">("idle");
  const [formData, setFormData]   = useState({
    businessName: "", businessType: "restaurant" as BizType,
    ownerName: "", email: "", phone: "", city: "Wien", message: "",
  });

  const cfg = BIZ_CONFIG[activeBiz];

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
        }),
      });
      if (!r.ok) throw new Error("Fehler beim Absenden");
      return r.json();
    },
    onSuccess: () => setFormStep("success"),
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
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-3.5 py-1.5 text-xs font-bold">
              <Building2 className="w-3 h-3" />
              Für Betriebe — Restaurants, Cafés & Bars
            </div>
          </div>

          {/* Business type tabs */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-muted/60 rounded-2xl p-1 border border-border/50">
              {(["restaurant", "cafe", "bar"] as BizType[]).map((type) => {
                const c = BIZ_CONFIG[type];
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
              <div className="text-5xl mb-5">{cfg.emoji}</div>
              <h1 className="text-3xl md:text-5xl font-extrabold text-foreground tracking-tight mb-4 leading-tight">
                {cfg.heroTitle}
              </h1>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
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
                  className={`h-13 px-8 rounded-2xl bg-gradient-to-r ${cfg.gradient} text-white border-0 shadow-lg font-bold text-base`}
                  onClick={() => { setFormStep("open"); setTimeout(() => document.getElementById("claim-form")?.scrollIntoView({ behavior: "smooth" }), 50); }}
                >
                  14 Tage kostenlos testen
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-13 px-6 rounded-2xl font-semibold"
                  onClick={() => document.getElementById("value-section")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Mehr erfahren
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
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
                value={platform.totalVenues > 0 ? `${platform.totalVenues}+` : "Wächst"}
                label="Betriebe auf der Plattform"
                icon={Building2} color="text-primary"
              />
              <StatCard
                value={platform.totalBookings > 0 ? `${platform.totalBookings.toLocaleString("de")}+` : "Aktiv"}
                label="Buchungen gesamt"
                icon={CalCheck} color="text-emerald-600"
              />
              <StatCard
                value={platform.activePromotions > 0 ? `${platform.activePromotions}` : "Täglich"}
                label="Aktive Boosts gerade"
                icon={Zap} color="text-amber-500"
              />
              <StatCard
                value={platform.avgRating > 0 ? `${platform.avgRating}` : "4.7"}
                label="Ø Bewertung der Betriebe"
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
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Was Sie bekommen</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              Ihr {cfg.label} — voll sichtbar, voll gebucht
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
              RestoSmart ist kein Bewertungsportal. Es ist eine aktive Entdeckungsplattform, die lokale Betriebe direkt zu neuen Gästen bringt.
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
            <p className="text-xs font-bold uppercase tracking-widest text-rose-500 mb-2">Was Sie gerade verpassen</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              Während Sie warten, buchen andere
            </h2>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto text-sm">
              Lokale Nutzer suchen gerade nach {cfg.label === "Bar / Lounge" ? "Bars" : cfg.label + "s"} in Wien. Ohne Eintrag finden sie Sie nicht.
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
              Jetzt Profil aktivieren
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── 5. HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">So einfach geht's</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">In 3 Schritten live</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                icon: Building2,
                title: "Profil aktivieren",
                desc: "Tragen Sie Ihren Betrieb ein. Wählen Sie Ihren Typ — Restaurant, Café oder Bar. Kostenlos und in 2 Minuten erledigt.",
              },
              {
                step: "02",
                icon: Eye,
                title: "Sichtbar werden",
                desc: "Ihr Betrieb erscheint in der Nähesuche, auf der Karte und in personalisierten Empfehlungen lokaler Nutzer.",
              },
              {
                step: "03",
                icon: TrendingUp,
                title: "Wachsen & optimieren",
                desc: "Mit Premium-Tools und Boosts steigern Sie Ihre Sichtbarkeit gezielt — mit echten Daten und smartem Budget.",
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

      {/* ── 6. PREMIUM + BOOST ───────────────────────────────────────────────── */}
      <section className="py-14 px-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Premium & Boost</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              Sichtbarkeit, die sich auszahlt
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto text-sm">
              Gratis-Listing gibt Ihnen die Basis. Premium gibt Ihnen den Vorsprung.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Free tier */}
            <div className="rounded-2xl border border-border/60 bg-card p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Kostenlos</p>
              <div className="space-y-2.5">
                {[
                  "Basis-Listing auf der Plattform",
                  "Karten-Eintrag",
                  "Grundlegendes Profil",
                  "Buchungsannahme",
                ].map(f => (
                  <div key={f} className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-sm text-foreground/80">{f}</span>
                  </div>
                ))}
                {[
                  "Höhere Platzierung in der Nähesuche",
                  "Premium-Vertrauens-Badge",
                  "Boost-Sichtbarkeit",
                  "Analytics-Dashboard",
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
                EMPFOHLEN
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Business Premium</p>
              <p className="text-2xl font-extrabold text-foreground mb-1">
                €39,90 <span className="text-sm font-normal text-muted-foreground">/ Monat</span>
              </p>
              <p className="text-xs text-primary font-semibold mb-4">RestoSmart Business Premium</p>
              <div className="space-y-2.5">
                {[
                  "Alles aus Kostenlos",
                  "Höhere Platzierung — prominent sichtbar",
                  "Premium-Vertrauens-Badge",
                  "Vollständiges Analytics-Dashboard",
                  "Revenue Optimizer mit KI-Empfehlungen",
                  "Zugang zu Boost-Sichtbarkeit",
                  "Gruppen-Empfehlungs-Feature",
                  "Smart-Angebote & Flash-Deals",
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
                  <h3 className="font-bold text-sm text-amber-900">Boost-Sichtbarkeit</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">Premium-Feature</span>
                </div>
                <p className="text-sm text-amber-800 mb-2">{cfg.boostExample}</p>
                <p className="text-xs text-amber-700">
                  Boosts erscheinen als <strong>„Gesponsert"</strong> — transparent für Nutzer, sichtbar vor der Konkurrenz. Budget selbst festlegen, jederzeit pausierbar.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. CLAIM FORM ────────────────────────────────────────────────────── */}
      <section id="claim-form" className="py-16 px-4">
        <div className="container mx-auto max-w-xl">
          <div className="text-center mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">14 Tage kostenlos testen</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              Ihr Betrieb auf RestoSmart
            </h2>
            <p className="text-muted-foreground mt-2 text-sm max-w-md mx-auto">
              Tragen Sie Ihre Daten ein. Wir melden uns innerhalb von 24 Stunden und führen Sie durch das Onboarding.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {formStep === "success" ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-10 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-extrabold text-foreground mb-2">Anfrage eingegangen!</h3>
                <p className="text-muted-foreground mb-1">Wir melden uns innerhalb von <strong>24 Stunden</strong>.</p>
                <p className="text-sm text-muted-foreground">Schauen Sie auch in Ihren Spam-Ordner.</p>
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
                    <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">Art des Betriebs *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["restaurant", "cafe", "bar"] as BizType[]).map(type => {
                        const c = BIZ_CONFIG[type];
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
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Name des Betriebs *</label>
                    <Input
                      placeholder="z.B. Café Schwarzenberg"
                      value={formData.businessName}
                      onChange={e => setFormData(f => ({ ...f, businessName: e.target.value }))}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Ihr Name *</label>
                      <Input
                        placeholder="Vorname & Nachname"
                        value={formData.ownerName}
                        onChange={e => setFormData(f => ({ ...f, ownerName: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Stadt</label>
                      <Input
                        placeholder="Wien"
                        value={formData.city}
                        onChange={e => setFormData(f => ({ ...f, city: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">E-Mail *</label>
                    <Input
                      type="email"
                      placeholder="ihre@email.at"
                      value={formData.email}
                      onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                      className="rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Telefon (optional)</label>
                    <Input
                      type="tel"
                      placeholder="+43 ..."
                      value={formData.phone}
                      onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                      className="rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Nachricht (optional)</label>
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
                      Fehler beim Absenden — bitte versuchen Sie es erneut.
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
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Wird gesendet…</>
                    ) : (
                      <>14 Tage kostenlos testen <ArrowRight className="w-4 h-4 ml-2" /></>
                    )}
                  </Button>

                  <p className="text-[11px] text-muted-foreground text-center">
                    Kostenlos starten — kein Kreditkarte erforderlich. Premium optional.
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
                title: "Transparent & fair",
                desc: 'Kein versteckter Algorithmus. Boosts werden klar als \u201eGesponsert\u201c markiert \u2014 Vertrauen bei Nutzern und Betrieben.',
              },
              {
                icon: MapPin, color: "text-primary", bg: "bg-primary/5 border-primary/15",
                title: "Wien-fokussiert",
                desc: "Wir konzentrieren uns auf Wien — mit echter Lokalkenntniss und regionalem Verständnis für alle Stadtbezirke.",
              },
              {
                icon: Award, color: "text-amber-600", bg: "bg-amber-50 border-amber-100",
                title: "Betriebe wachsen zuerst",
                desc: "Unser Geschäftsmodell funktioniert nur, wenn Restaurants, Cafés und Bars wirklich wachsen. Ihr Erfolg ist unser Erfolg.",
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
            <p className="text-sm text-muted-foreground mb-3">Fragen? Wir helfen gerne direkt.</p>
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
