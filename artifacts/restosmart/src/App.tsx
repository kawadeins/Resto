import { useEffect, useState } from "react";
import { track } from "@/lib/conversion-tracking";
import { useVariants, getVariantCopy, trackVariantImpression, trackVariantClick } from "@/lib/variant-system";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const CUSTOMER_PROFILE_URL = window.location.origin + "/customer/profile";

// ─── Premium gate ─────────────────────────────────────────────────────────────

type GateStatus = "loading" | "active" | "trial" | "expired" | "inactive";

function getPremiumStatus(): GateStatus {
  const premium = localStorage.getItem("restosmart_owner_premium");
  const trialEnd = localStorage.getItem("restosmart_trial_end");
  if (premium === "active") return "active";
  if (premium === "trial") {
    if (trialEnd && new Date(trialEnd) > new Date()) return "trial";
    return "expired";
  }
  return "inactive";
}

function PremiumGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<GateStatus>("loading");

  useEffect(() => {
    setStatus(getPremiumStatus());
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
  const { copy: expiredHeadline, variantId: expiredHlId } = getVariantCopy(variants, "expired_headline", "Aktiviere Premium, um sichtbar zu bleiben");
  const biz = typeof window !== "undefined"
    ? localStorage.getItem("restosmart_owner_business_type") ?? "restaurant"
    : "restaurant";
  const bizLabel = biz === "cafe" ? "Café" : biz === "bar" ? "Bar" : "Restaurant";

  const proofStats = [
    { label: "Dein Profil wurde angesehen", value: "124×" },
    { label: "Neue Buchungsanfragen", value: "8" },
    { label: "Sichtbarkeits-Boost während Testphase", value: "+340%" },
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
          <div className="text-[10px] font-bold tracking-widest uppercase text-amber-400">Deine Testphase ist beendet</div>
          <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
            {expiredHeadline}
          </h1>
          <p className="text-[#888] text-sm leading-relaxed">
            Premium-Betriebe werden häufiger angezeigt. Du verpasst gerade potenzielle Kunden in deiner Nähe.
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
            Mit aktivem Premium behältst du diese Sichtbarkeit dauerhaft.
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
            <p className="text-[11px] text-red-400/70 mt-0.5 leading-relaxed">Erhöhe deine Sichtbarkeit jetzt und bleib präsent für Kunden in deiner Nähe.</p>
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
          <a
            href={CUSTOMER_PROFILE_URL}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm shadow-lg shadow-violet-500/25 hover:opacity-90 transition-opacity"
            onClick={() => {
              track("upgrade_cta_clicked", { ctaLabel: "Jetzt für 39,90€ / Monat fortsetzen", dedup: false });
              if (expiredHlId) trackVariantClick(expiredHlId, false);
            }}
          >
            Jetzt für 39,90€ / Monat fortsetzen
          </a>
          <p className="text-[11px] text-[#444]">
            Jederzeit kündbar. Keine langfristige Verpflichtung.
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
  const { copy: gateHeadline } = getVariantCopy(variants, "gate_headline", "Mehr Sichtbarkeit. Mehr Gäste. Mehr Umsatz.");
  const { copy: gateCta, variantId: gateCtaId } = getVariantCopy(variants, "gate_cta", "Jetzt 14 Tage kostenlos starten");
  const biz = typeof window !== "undefined"
    ? localStorage.getItem("restosmart_owner_business_type") ?? "restaurant"
    : "restaurant";

  const bizLabel = biz === "cafe" ? "Café" : biz === "bar" ? "Bar" : "Restaurant";
  const bizEmoji = biz === "cafe" ? "\u2615" : biz === "bar" ? "\uD83C\uDF78" : "\uD83C\uDF7D\uFE0F";

  const bizTimeMsg = biz === "cafe"
    ? "Mehr Kunden am Morgen und während der Kaffeezeiten"
    : biz === "bar"
    ? "Mehr Aufmerksamkeit am Abend und im Nachtleben"
    : "Mehr Sichtbarkeit zur Mittags- und Abendzeit";

  const smartMsg = biz === "cafe"
    ? "Jetzt ist eine gute Zeit für mehr Sichtbarkeit am Morgen"
    : biz === "bar"
    ? "Hohe Nachfrage am Abend in deiner Umgebung"
    : "Mehr Reichweite zur Mittagszeit möglich";

  const benefits = [
    "Mehr Sichtbarkeit in der Suche und auf der Startseite",
    "Höhere Platzierung bei 'In deiner Nähe'",
    "Verifizierter Business-Status — mehr Vertrauen",
    "Zugriff auf Promotion- und Boost-Tools",
    "Mehr Reichweite bei lokalen Kunden",
    "Bessere Präsenz auf der Karte",
  ];

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full text-center space-y-5">

        {/* STEP 1: PROBLEM — Loss avoidance at the very top */}
        <div className="rounded-xl border border-red-900/50 bg-red-950/25 p-4 text-left flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-red-500/25 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-red-300">
              Ohne Premium bleibt dein {bizLabel} weniger sichtbar
            </p>
            <p className="text-[11px] text-red-400/70 mt-0.5">
              Andere Betriebe werden häufiger entdeckt. Du verpasst potenzielle Reichweite in deiner Umgebung.
            </p>
          </div>
        </div>

        {/* STEP 2: OPPORTUNITY — Icon + headline */}
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
            <p className="text-[#666] text-sm leading-relaxed mt-2">
              {bizTimeMsg} — {"werde in deiner Nähe häufiger entdeckt und stärke die Präsenz deines "}{bizLabel}{"s."}
            </p>
          </div>
        </div>

        {/* STEP 3: SMART HOOK — contextual opportunity signal */}
        <div className="rounded-xl border border-violet-800/40 bg-violet-950/30 p-3 flex items-center gap-3 text-left">
          <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
          </div>
          <span className="text-xs text-violet-300 font-medium">{smartMsg}</span>
        </div>

        {/* STEP 4: VALUE — Benefits */}
        <div className="rounded-2xl border border-white/8 bg-white/4 p-5 text-left space-y-2.5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#555] uppercase tracking-widest">Was du bekommst</p>
            <span className="text-[10px] text-violet-400 font-semibold bg-violet-950/60 px-2 py-0.5 rounded-full">{bizTimeMsg.split(" ").slice(0, 4).join(" ")}…</span>
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

        {/* STEP 5: ROI FRAMING */}
        <div className="rounded-xl border border-amber-900/30 bg-amber-950/15 px-4 py-3 text-left flex items-center gap-3">
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-300/80 leading-relaxed">
            {"Schon ein zusätzlicher Gast kann den Monatsbetrag rechtfertigen. 39,90€ im Monat für mehr lokale Sichtbarkeit."}
          </p>
        </div>

        {/* STEP 6: PRICE + CTA */}
        <div className="space-y-3">
          <div className="text-center">
            <span className="text-xs text-[#555]">14 Tage kostenlos testen, danach</span>
            <div className="text-2xl font-bold text-white mt-0.5">39,90€ <span className="text-[#555] text-base font-normal">/ Monat</span></div>
          </div>
          <a
            href={CUSTOMER_PROFILE_URL}
            className="flex items-center justify-center gap-2 w-full h-13 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm shadow-lg shadow-violet-500/25 hover:opacity-90 transition-opacity"
            onClick={() => {
              track("upgrade_cta_clicked", { ctaLabel: gateCta, dedup: false });
              if (gateCtaId) trackVariantClick(gateCtaId, false);
            }}
          >
            {gateCta}
          </a>
          <p className="text-[11px] text-[#444] leading-relaxed">
            Jederzeit kündbar. Keine langfristige Verpflichtung.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
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
                <Layout>
                  <Switch>
                    <Route path="/login">
                      <Redirect to="/" />
                    </Route>
                    <Route path="/" component={Overview} />
                    <Route path="/staff" component={Staff} />
                    <Route path="/inventory" component={Inventory} />
                    <Route path="/finances" component={Finances} />
                    <Route path="/reservations" component={Reservations} />
                    <Route path="/analytics" component={Analytics} />
                    <Route path="/menu" component={Menu} />
                    <Route path="/pos" component={Pos} />
                    <Route path="/marketing" component={Marketing} />
                    <Route path="/bookings" component={Bookings} />
                    <Route path="/billing" component={Billing} />
                    <Route path="/reviews" component={Reviews} />
                    <Route path="/super-admin" component={SuperAdmin} />
                    <Route path="/insights" component={Insights} />
                    <Route path="/onboarding" component={Onboarding} />
                    <Route path="/campaigns" component={Campaigns} />
                    <Route path="/tables" component={Tables} />
                    <Route path="/payroll" component={Payroll} />
                    <Route path="/profile" component={Profile} />
                    <Route path="/optimizer" component={Optimizer} />
                    <Route component={NotFound} />
                  </Switch>
                </Layout>
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
