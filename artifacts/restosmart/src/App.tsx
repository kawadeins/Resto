import { useEffect, useState } from "react";
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
  const biz = typeof window !== "undefined"
    ? localStorage.getItem("restosmart_owner_business_type") ?? "restaurant"
    : "restaurant";
  const bizLabel = biz === "cafe" ? "Café" : biz === "bar" ? "Bar" : "Restaurant";

  const stats = [
    { label: "Aufrufe Ihres Profils", value: "124" },
    { label: "Neue Buchungsanfragen", value: "8" },
    { label: "Sichtbarkeits-Boost", value: "+340%" },
  ];

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
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

        <div className="space-y-2">
          <div className="text-[10px] font-bold tracking-widest uppercase text-amber-400 mb-1">Testphase abgelaufen</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Ihre 14-Tage-Testphase ist beendet
          </h1>
          <p className="text-[#888] text-sm leading-relaxed">
            Schalten Sie {bizLabel} Premium frei, um weiterhin alle Funktionen zu nutzen.
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/4 p-5 text-left space-y-3">
          <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Ihre Testphase in Zahlen</p>
          {stats.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-sm text-[#aaa]">{s.label}</span>
              <span className="text-sm font-bold text-amber-400">{s.value}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
            <div className="text-left">
              <div className="text-xs text-[#666] uppercase tracking-widest">RestoSmart Business Premium</div>
              <div className="text-2xl font-bold text-white mt-0.5">€39,90<span className="text-[#666] text-sm font-normal">/Monat</span></div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </div>
          </div>
          <a
            href={CUSTOMER_PROFILE_URL}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/25 hover:opacity-90 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Jetzt Premium freischalten · €39,90/Monat
          </a>
          <p className="text-[11px] text-[#555]">
            Keine automatische Abbuchung — Sie best\u00e4tigen die Zahlung im n\u00e4chsten Schritt.
          </p>
        </div>
      </div>
    </div>
  );
}

function PremiumRequired() {
  const biz = typeof window !== "undefined"
    ? localStorage.getItem("restosmart_owner_business_type") ?? "restaurant"
    : "restaurant";

  const bizLabel = biz === "cafe" ? "Café" : biz === "bar" ? "Bar" : "Restaurant";
  const bizEmoji = biz === "cafe" ? "☕" : biz === "bar" ? "🍸" : "🍽️";

  const features = [
    "Prioritätsplatzierung im Entdecken-Feed",
    "Premium-Vertrauens-Badge",
    "Vollständiges Analytics-Dashboard",
    "Buchungs- & Gästemanagement",
    "Personal, Schichten & Gehaltsabrechnung",
    "Marketing, Kampagnen & Smart Offers",
    "Kassenterminal (POS) & Menü-Editor",
    "Revenue Optimizer & Boost-Sichtbarkeit",
  ];

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="relative mx-auto w-20 h-20">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center shadow-2xl shadow-violet-500/30 text-4xl">
            {bizEmoji}
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center border-2 border-[#0d0d0d]">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold tracking-widest uppercase text-violet-400 mb-1">RestoSmart Business Premium</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {bizLabel}-Dashboard freischalten
          </h1>
          <p className="text-[#888] text-sm leading-relaxed">
            Das vollständige Wachstumspaket für {bizLabel}s — Sichtbarkeit, Buchungen, Analytics und mehr.
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-2xl font-bold text-white">14 Tage kostenlos</span>
            <span className="text-[#666] text-sm">danach €39,90/Monat</span>
          </div>
        </div>

        {/* What you get */}
        <div className="rounded-2xl border border-white/8 bg-white/4 p-5 text-left space-y-2">
          <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Im Paket enthalten</p>
          {features.map((item) => (
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

        {/* CTA */}
        <div className="space-y-3">
          <a
            href={CUSTOMER_PROFILE_URL}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/25 hover:opacity-90 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            14 Tage kostenlos testen
          </a>
          <p className="text-[11px] text-[#555]">
            Keine Zahlung heute · nach der Testphase €39,90/Monat · Aktivierung im Kundenprofil.
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
