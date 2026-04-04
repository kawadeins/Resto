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

function PremiumGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "active" | "inactive">("loading");

  useEffect(() => {
    const premium = localStorage.getItem("restosmart_owner_premium");
    setStatus(premium === "active" ? "active" : "inactive");
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (status === "inactive") {
    return <PremiumRequired />;
  }

  return <>{children}</>;
}

function PremiumRequired() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Icon */}
        <div className="relative mx-auto w-24 h-24">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center shadow-2xl shadow-violet-500/30">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center border-2 border-[#0d0d0d]">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
        </div>

        {/* Text */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Restaurant Premium erforderlich
          </h1>
          <p className="text-[#888] text-sm leading-relaxed">
            Das Restaurant-Dashboard ist ausschließlich für aktive Premium-Abonnenten zugänglich.
            Aktivieren Sie Ihr Abonnement über Ihr Kundenprofil, um vollen Zugriff zu erhalten.
          </p>
        </div>

        {/* What you get */}
        <div className="rounded-2xl border border-white/8 bg-white/4 p-5 text-left space-y-2.5">
          <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Was Sie erhalten</p>
          {[
            "Vollständige Reservierungsverwaltung",
            "Personal, Schichten & Gehaltsabrechnung",
            "Kassenterminal & Speisekarte",
            "Marketing, Kampagnen & Analytics",
            "Bewertungsmanagement & Kundenbindung",
          ].map((item) => (
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
            Premium freischalten
          </a>
          <p className="text-[11px] text-[#555]">
            Sie werden zum Kundenprofil weitergeleitet — der einzigen Stelle, an der Premium verwaltet wird.
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
