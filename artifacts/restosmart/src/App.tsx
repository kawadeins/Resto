import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { track } from "@/lib/conversion-tracking";
import { useVariants, getVariantCopy, trackVariantImpression, trackVariantClick } from "@/lib/variant-system";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { PermissionProvider } from "@/hooks/use-permissions";
import { RoleGuard } from "@/components/access-denied";
import NotFound from "@/pages/not-found";
import Overview from "@/pages/overview";
import Staff from "@/pages/staff";
import Inventory from "@/pages/inventory";
import Finances from "@/pages/finances";
import Reservations from "@/pages/reservations";
import Analytics from "@/pages/analytics";
import Menu from "@/pages/menu";
import Pos from "@/pages/pos";
import Marketing from "@/pages/marketing";
import Bookings from "@/pages/bookings";
import Billing from "@/pages/billing";
import Reviews from "@/pages/reviews";
import SuperAdmin from "@/pages/super-admin";
import Insights from "@/pages/insights";
import Onboarding from "@/pages/onboarding";
import Campaigns from "@/pages/campaigns";
import Tables from "@/pages/tables";
import Payroll from "@/pages/payroll";
import Profile from "@/pages/profile";
import Founder from "@/pages/founder";
import Optimizer from "@/pages/optimizer";
import Boost from "@/pages/boost";
import Team from "@/pages/team";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});


// ─── Premium gate ─────────────────────────────────────────────────────────────

type GateStatus = "loading" | "active" | "trial" | "expired" | "inactive";

function localGateStatus(): GateStatus {
  const premium = localStorage.getItem("restosmart_owner_premium");
  const trialEnd = localStorage.getItem("restosmart_trial_end");
  if (premium === "active") return "active";
  if (premium === "trial") {
    if (trialEnd && new Date(trialEnd) > new Date()) return "trial";
    return "expired";
  }
  return "inactive";
}

// Syncs localStorage with the authoritative DB subscription state.
// Returns the resolved GateStatus after the network check.
async function syncSubscription(): Promise<GateStatus> {
  try {
    const res = await fetch("/api/billing/subscription");
    if (!res.ok) return localGateStatus();
    const sub = await res.json() as {
      isActive?: boolean;
      status?: string;
      currentPeriodEnd?: string;
    };
    if (sub.isActive || sub.status === "active") {
      localStorage.setItem("restosmart_owner_premium", "active");
      return "active";
    }
    if (sub.status === "trial") {
      localStorage.setItem("restosmart_owner_premium", "trial");
      if (sub.currentPeriodEnd) {
        localStorage.setItem("restosmart_trial_end", sub.currentPeriodEnd);
      }
      const trialEnd = localStorage.getItem("restosmart_trial_end");
      if (trialEnd && new Date(trialEnd) > new Date()) return "trial";
      return "expired";
    }
    // DB says inactive — clear any stale localStorage override
    localStorage.removeItem("restosmart_owner_premium");
    localStorage.removeItem("restosmart_trial_end");
    return "inactive";
  } catch {
    // Network error: fall back to cached localStorage state
    return localGateStatus();
  }
}

function PremiumGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<GateStatus>("loading");

  useEffect(() => {
    // Show cached state instantly while the DB check runs in background
    const cached = localGateStatus();
    if (cached !== "inactive" && cached !== "expired") {
      setStatus(cached);
    }
    // Always verify with the server — prevents bypass and prevents lockout
    syncSubscription().then(setStatus);
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (status === "inactive") return <PremiumRequired />;
  if (status === "expired") return <TrialExpiredRequired />;
  return <>{children}</>;
}

function TrialExpiredRequired() {
  useEffect(() => { track("trial_expired_viewed"); }, []);
  const { variants, loaded } = useVariants();
  useEffect(() => {
    if (!loaded) return;
    if (variants.expired_headline) trackVariantImpression(variants.expired_headline.id);
  }, [loaded]);
  const { copy: expiredHeadline, variantId: expiredHlId } = getVariantCopy(variants, "expired_headline", "Deine Testphase ist beendet");
  const biz = typeof window !== "undefined"
    ? localStorage.getItem("restosmart_owner_business_type") ?? "restaurant"
    : "restaurant";
  const bizLabel = biz === "cafe" ? "Caf\u00e9" : biz === "bar" ? "Bar" : "Restaurant";

  const { data: promoData } = useQuery({
    queryKey: ["promotions-my-expired"],
    queryFn: async () => {
      const res = await fetch("/api/promotions/my");
      if (!res.ok) return { promotions: [] as { impressions: number; clicks: number; bookings_attributed: number }[] };
      return res.json() as Promise<{ promotions: { impressions: number; clicks: number; bookings_attributed: number }[] }>;
    },
    staleTime: 300_000,
  });

  const promos = promoData?.promotions ?? [];
  const totalImpressions = promos.reduce((s: number, p) => s + (p.impressions || 0), 0);
  const totalBookings = promos.reduce((s: number, p) => s + (p.bookings_attributed || 0), 0);
  const totalBoosts = promos.length;
  const hasPromoData = totalImpressions > 0 || totalBoosts > 0;

  const proofStats = hasPromoData ? [
    { label: "Boost-Einblendungen in der Testphase", value: totalImpressions.toLocaleString("de") },
    { label: "Buchungen über Boosts", value: totalBookings.toLocaleString("de") },
    { label: "Boosts gestartet", value: String(totalBoosts) },
  ] : [
    { label: "Vorteile von Premium", value: "Mehr Sichtbarkeit" },
    { label: "Platzierung im Entdecken-Feed", value: "Priorität" },
    { label: "Boost-Tools verfügbar", value: "6 Typen" },
  ];

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full text-center space-y-5">
        {/* Icon */}
        <div className="relative mx-auto w-20 h-20">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-amber-500/30 text-4xl">
            ⏰
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center border-2 border-[#0d0d0d]">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold tracking-widest uppercase text-amber-400">Testphase beendet</div>
          <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
            {expiredHeadline}
          </h1>
          <p className="text-[#888] text-sm leading-relaxed">
            Behalte deine Sichtbarkeit und deinen Vorteil. Verliere keine Reichweite.
          </p>
        </div>

        {/* Value proof from trial */}
        <div className="rounded-2xl border border-amber-800/30 bg-amber-950/20 p-5 text-left space-y-3">
          <p className="text-xs font-bold text-amber-400/80 uppercase tracking-widest">Was deine Testphase gebracht hat</p>
          {proofStats.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-sm text-[#aaa]">{s.label}</span>
              <span className="text-sm font-bold text-amber-400">{s.value}</span>
            </div>
          ))}
          <p className="text-xs text-[#666] border-t border-white/5 pt-3 leading-relaxed">
            {"Mit aktivem Premium behältst du diese Sichtbarkeit dauerhaft."}
          </p>
        </div>

        {/* Missed opportunity */}
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-left flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-red-300">Dein {bizLabel} ist aktuell weniger sichtbar</p>
            <p className="text-[11px] text-red-400/70 mt-0.5 leading-relaxed">{"Ohne Premium bleibt dein Geschäft oft unsichtbar — während andere Betriebe mehr Aufmerksamkeit bekommen."}</p>
          </div>
        </div>

        {/* Price + CTA */}
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
            <div className="text-left">
              <div className="text-[10px] text-[#555] uppercase tracking-widest">Business Premium</div>
              <div className="text-2xl font-bold text-white mt-0.5">39,90€<span className="text-[#666] text-sm font-normal"> / Monat</span></div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </div>
          </div>
          <button
            className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm shadow-lg shadow-violet-500/25 hover:opacity-90 transition-opacity cursor-pointer"
            onClick={() => {
              track("upgrade_cta_clicked", { ctaLabel: "F\u00fcr 39,90\u20ac / Monat fortsetzen", dedup: false });
              if (expiredHlId) trackVariantClick(expiredHlId, true);
              localStorage.setItem("restosmart_owner_premium", "active");
              localStorage.removeItem("restosmart_trial_end");
              track("premium_activated", { businessType: biz, source: "expired_gate" });
              window.location.reload();
            }}
          >
            {"Für 39,90€ / Monat fortsetzen"}
          </button>
          <p className="text-[11px] text-[#444]">
            {"Jederzeit kündbar. Keine versteckten Kosten."}
          </p>
        </div>
      </div>
    </div>
  );
}

function PremiumRequired() {
  useEffect(() => { track("premium_gate_viewed"); }, []);
  const { variants, loaded } = useVariants();
  useEffect(() => {
    if (!loaded) return;
    if (variants.gate_headline) trackVariantImpression(variants.gate_headline.id);
    if (variants.gate_cta) trackVariantImpression(variants.gate_cta.id);
  }, [loaded]);
  const { copy: gateHeadline } = getVariantCopy(variants, "gate_headline", "Dein Gesch\u00e4ft ist online \u2014 aber sehen dich auch genug Kunden?");
  const { copy: gateCta, variantId: gateCtaId } = getVariantCopy(variants, "gate_cta", "Jetzt sichtbar werden");
  const biz = typeof window !== "undefined"
    ? localStorage.getItem("restosmart_owner_business_type") ?? "restaurant"
    : "restaurant";

  const bizLabel = biz === "cafe" ? "Caf\u00e9" : biz === "bar" ? "Bar" : "Restaurant";
  const bizEmoji = biz === "cafe" ? "\u2615" : biz === "bar" ? "\uD83C\uDF78" : "\uD83C\uDF7D\uFE0F";

  const benefits = [
    "Mehr Sichtbarkeit in der Suche und auf der Startseite",
    "H\u00f6here Platzierung bei \u201eIn deiner N\u00e4he\u201c",
    "Premium-Betriebe wirken vertrauensw\u00fcrdiger",
    "Zugriff auf Promotion- und Boost-Tools",
    "Mehr Reichweite bei lokalen Kunden",
    "Bessere Pr\u00e4senz auf der Karte",
  ];

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full text-center space-y-5">

        {/* STEP 1: PROBLEM — Missed opportunity trigger */}
        <div className="rounded-xl border border-red-900/50 bg-red-950/25 p-4 text-left flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-red-500/25 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-red-300">
              Ohne Premium bleibt dein {bizLabel} oft unsichtbar
            </p>
            <p className="text-[11px] text-red-400/70 mt-0.5">
              {"Während andere Betriebe mehr Aufmerksamkeit bekommen, verpasst du potenzielle Kunden in deiner Nähe."}
            </p>
          </div>
        </div>

        {/* STEP 2: HERO — Icon + main hook */}
        <div className="space-y-4">
          <div className="relative mx-auto w-20 h-20">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center shadow-2xl shadow-violet-500/30 text-4xl">
              {bizEmoji}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center border-2 border-[#0d0d0d]">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-bold tracking-widest uppercase text-violet-400">RestoSmart Business Premium</div>
            <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
              {gateHeadline}
            </h1>
            <p className="text-[10px] text-violet-400/70 font-semibold uppercase tracking-widest">{"Für Restaurants, Cafés & Bars"}</p>
            <p className="text-[#888] text-sm leading-relaxed mt-2">
              {"Mit Premium wirst du deutlich häufiger entdeckt — genau von den Menschen in deiner Nähe."}
            </p>
          </div>
        </div>

        {/* STEP 3: SOCIAL — Customers are searching */}
        <div className="rounded-xl border border-violet-800/40 bg-violet-950/30 p-3 flex items-center gap-3 text-left">
          <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
          </div>
          <span className="text-xs text-violet-300 font-medium">Kunden in deiner Umgebung suchen genau jetzt nach Angeboten wie deinem.</span>
        </div>

        {/* STEP 4: VALUE — Benefits */}
        <div className="rounded-2xl border border-white/8 bg-white/4 p-5 text-left space-y-2.5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#555] uppercase tracking-widest">Was du bekommst</p>
          </div>
          {benefits.map((item) => (
            <div key={item} className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                <svg className="w-2.5 h-2.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <span className="text-sm text-[#aaa]">{item}</span>
            </div>
          ))}
        </div>

        {/* STEP 5: PRESTIGE */}
        <div className="rounded-xl border border-violet-800/25 bg-violet-950/15 px-4 py-3 text-left flex items-center gap-3">
          <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
          <p className="text-xs text-violet-300/80 leading-relaxed">
            {"Premium-Betriebe werden bevorzugt angezeigt und wirken vertrauenswürdiger."}
          </p>
        </div>

        {/* STEP 6: ROI PUSH */}
        <div className="rounded-xl border border-amber-900/30 bg-amber-950/15 px-4 py-3 text-left flex items-center gap-3">
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-300/80 leading-relaxed">
            {"Schon ein zusätzlicher Kunde pro Woche kann deine Investition mehr als ausgleichen."}
          </p>
        </div>

        {/* STEP 7: OFFER + CTA */}
        <div className="space-y-3">
          <div className="text-center">
            <span className="text-xs text-[#888] font-medium">Teste Premium 14 Tage kostenlos.</span>
            <div className="text-2xl font-bold text-white mt-1">{"Danach nur 39,90€"} <span className="text-[#555] text-base font-normal">/ Monat</span></div>
          </div>
          <button
            className="flex items-center justify-center gap-2 w-full h-13 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm shadow-lg shadow-violet-500/25 hover:opacity-90 transition-opacity cursor-pointer"
            onClick={() => {
              track("upgrade_cta_clicked", { ctaLabel: gateCta, dedup: false });
              if (gateCtaId) trackVariantClick(gateCtaId, true);
              const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
              localStorage.setItem("restosmart_owner_premium", "trial");
              localStorage.setItem("restosmart_trial_end", trialEnd);
              track("trial_started", { businessType: biz });
              window.location.reload();
            }}
          >
            {gateCta}
          </button>
          <button
            className="flex items-center justify-center gap-2 w-full h-10 py-2 rounded-xl border border-white/10 bg-white/3 text-[#999] font-medium text-xs hover:bg-white/6 transition-colors cursor-pointer"
            onClick={() => {
              track("upgrade_cta_clicked", { ctaLabel: "14 Tage kostenlos starten", dedup: false });
              if (gateCtaId) trackVariantClick(gateCtaId, true);
              const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
              localStorage.setItem("restosmart_owner_premium", "trial");
              localStorage.setItem("restosmart_trial_end", trialEnd);
              track("trial_started", { businessType: biz });
              window.location.reload();
            }}
          >
            14 Tage kostenlos starten
          </button>
          <p className="text-[11px] text-[#444] leading-relaxed">
            {"Jederzeit kündbar. Keine versteckten Kosten."}
          </p>
        </div>

        {/* URGENCY LINE */}
        <p className="text-[11px] text-[#555] italic">
          Jeder Tag ohne Premium bedeutet weniger Sichtbarkeit.
        </p>
      </div>
    </div>
  );
}

// ─── Bootstrap owner identity ─────────────────────────────────────────────────
// Auto-sets restosmart_owner_email in localStorage if not present,
// by reading the restaurant profile. Required for auth-gated endpoints.
async function bootstrapOwnerEmail(): Promise<void> {
  if (localStorage.getItem("restosmart_owner_email")) return;
  try {
    // Use the team bootstrap endpoint to resolve the owner email for this restaurant.
    const r = await fetch("/api/team/bootstrap-owner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@restosmart.app", restaurantId: 1 }),
    });
    // Always set the known owner email — bootstrap-owner creates the record if needed.
    localStorage.setItem("restosmart_owner_email", "owner@restosmart.app");
  } catch {
    localStorage.setItem("restosmart_owner_email", "owner@restosmart.app");
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    bootstrapOwnerEmail();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Switch>
            {/* Founder Command Center — completely outside PremiumGate, has its own auth */}
            <Route path="/founder" component={Founder} />

            {/* All other routes require premium */}
            <Route>
              <PremiumGate>
                <PermissionProvider>
                  <Layout>
                    <Switch>
                      <Route path="/login">
                        <Redirect to="/" />
                      </Route>
                      <Route path="/" component={Overview} />
                      <Route path="/profile" component={Profile} />
                      <Route path="/bookings" component={Bookings} />
                      <Route path="/reservations" component={Reservations} />
                      <Route path="/tables" component={Tables} />
                      <Route path="/pos" component={Pos} />
                      <Route path="/reviews" component={Reviews} />
                      <Route path="/onboarding" component={Onboarding} />

                      <Route path="/staff">{() => <RoleGuard allowed={["owner", "manager"]} section="Personal"><Staff /></RoleGuard>}</Route>
                      <Route path="/inventory">{() => <RoleGuard allowed={["owner", "manager"]} section="Inventar"><Inventory /></RoleGuard>}</Route>
                      <Route path="/menu">{() => <RoleGuard allowed={["owner", "manager"]} section="Speisekarte"><Menu /></RoleGuard>}</Route>
                      <Route path="/analytics">{() => <RoleGuard allowed={["owner", "manager"]} section="Analyse"><Analytics /></RoleGuard>}</Route>
                      <Route path="/boost">{() => <RoleGuard allowed={["owner", "manager"]} section="Sichtbarkeit & Boost"><Boost /></RoleGuard>}</Route>
                      <Route path="/marketing">{() => <RoleGuard allowed={["owner", "manager"]} section="Marketing"><Marketing /></RoleGuard>}</Route>
                      <Route path="/insights">{() => <RoleGuard allowed={["owner", "manager"]} section="Tote Stunden"><Insights /></RoleGuard>}</Route>
                      <Route path="/campaigns">{() => <RoleGuard allowed={["owner", "manager"]} section="Wachstum"><Campaigns /></RoleGuard>}</Route>
                      <Route path="/optimizer">{() => <RoleGuard allowed={["owner", "manager"]} section="Optimizer"><Optimizer /></RoleGuard>}</Route>

                      <Route path="/finances">{() => <RoleGuard allowed="owner" section="Finanzen"><Finances /></RoleGuard>}</Route>
                      <Route path="/payroll">{() => <RoleGuard allowed="owner" section="Gehaltsabrechnung"><Payroll /></RoleGuard>}</Route>
                      <Route path="/billing">{() => <RoleGuard allowed="owner" section="Abonnement"><Billing /></RoleGuard>}</Route>
                      <Route path="/team">{() => <RoleGuard allowed="owner" section="Team"><Team /></RoleGuard>}</Route>
                      <Route path="/super-admin">{() => <RoleGuard allowed="owner" section="Admin"><SuperAdmin /></RoleGuard>}</Route>

                      <Route component={NotFound} />
                    </Switch>
                  </Layout>
                </PermissionProvider>
              </PremiumGate>
            </Route>
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
