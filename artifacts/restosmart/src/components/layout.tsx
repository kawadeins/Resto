import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Package, DollarSign, Calendar, BarChart3,
  UtensilsCrossed, ShoppingCart, BookOpen, Megaphone, CreditCard, Star,
  Lightbulb, TrendingUp, Armchair, Wallet, ArrowLeft, UserCircle, Zap,
  Clock, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

function getTrialState() {
  const premium = localStorage.getItem("restosmart_owner_premium");
  const trialEnd = localStorage.getItem("restosmart_trial_end");
  if (premium !== "trial" || !trialEnd) return null;
  const end = new Date(trialEnd);
  const now = new Date();
  if (end <= now) return null;
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
  return { daysLeft, end };
}

function TrialBanner() {
  const [dismissed, setDismissed] = useState(false);
  const trial = getTrialState();
  if (!trial || dismissed) return null;

  const { daysLeft } = trial;
  const isUrgent = daysLeft <= 3;
  const isWarning = daysLeft <= 7 && daysLeft > 3;

  let mainMsg: string;
  let subMsg: string | null = null;
  let ctaLabel: string;

  if (daysLeft <= 0) {
    mainMsg = "Deine Testphase läuft heute ab";
    subMsg = "Aktiviere Premium, um sichtbar zu bleiben";
    ctaLabel = "Premium aktivieren";
  } else if (daysLeft === 1) {
    mainMsg = "Letzter Tag deiner Testphase";
    subMsg = "Danach verlierst du deine Sichtbarkeit";
    ctaLabel = "Jetzt für 39,90€ sichern";
  } else if (isUrgent) {
    mainMsg = `Testphase endet in ${daysLeft} Tagen`;
    subMsg = "Premium jetzt aktivieren — Sichtbarkeit behalten";
    ctaLabel = "Premium aktivieren";
  } else if (isWarning) {
    mainMsg = `Noch ${daysLeft} Tage Testzugang`;
    subMsg = "Deine Testphase endet bald — Sichtbarkeit sichern";
    ctaLabel = "Sichtbarkeit sichern";
  } else {
    mainMsg = `Noch ${daysLeft} Tage kostenloser Testzugang`;
    subMsg = null;
    ctaLabel = "Jetzt upgraden";
  }

  const customerProfileUrl = window.location.origin + "/customer/profile";

  return (
    <div className={cn(
      "flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium",
      isUrgent
        ? "bg-red-950/60 border-b border-red-800/50 text-red-200"
        : isWarning
        ? "bg-amber-950/50 border-b border-amber-800/40 text-amber-200"
        : "bg-violet-950/60 border-b border-violet-800/40 text-violet-200"
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <Clock className="w-4 h-4 shrink-0" />
        <span className="truncate font-semibold">{mainMsg}</span>
        {subMsg && (
          <span className="hidden sm:inline text-xs opacity-60 font-normal">— {subMsg}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={customerProfileUrl}
          className={cn(
            "text-xs font-bold px-3 py-1.5 rounded-full transition-colors",
            isUrgent
              ? "bg-red-500 hover:bg-red-400 text-white"
              : isWarning
              ? "bg-amber-500 hover:bg-amber-400 text-black"
              : "bg-violet-600 hover:bg-violet-500 text-white"
          )}
        >
          {ctaLabel}
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="opacity-40 hover:opacity-80 transition-opacity"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

const navigation = [
  { name: "Übersicht", href: "/", icon: LayoutDashboard },
  { name: "Mein Profil", href: "/profile", icon: UserCircle },
  { name: "Buchungen", href: "/bookings", icon: BookOpen },
  { name: "Reservierungen", href: "/reservations", icon: Calendar },
  { name: "Tische", href: "/tables", icon: Armchair },
  { name: "Personal", href: "/staff", icon: Users },
  { name: "Gehaltsabrechnung", href: "/payroll", icon: Wallet },
  { name: "Inventar", href: "/inventory", icon: Package },
  { name: "Speisekarte", href: "/menu", icon: UtensilsCrossed },
  { name: "Kassenterminal", href: "/pos", icon: ShoppingCart },
  { name: "Finanzen", href: "/finances", icon: DollarSign },
  { name: "Analyse", href: "/analytics", icon: BarChart3 },
  { name: "Marketing", href: "/marketing", icon: Megaphone },
  { name: "Tote Stunden", href: "/insights", icon: Lightbulb },
  { name: "Wachstum", href: "/campaigns", icon: TrendingUp },
  { name: "Optimizer", href: "/optimizer", icon: Zap },
  { name: "Bewertungen", href: "/reviews", icon: Star },
  { name: "Abonnement", href: "/billing", icon: CreditCard },
];

const mobileNavigation = [
  { name: "Übersicht", href: "/", icon: LayoutDashboard },
  { name: "Buchungen", href: "/bookings", icon: BookOpen },
  { name: "Marketing", href: "/marketing", icon: Megaphone },
  { name: "Bewertungen", href: "/reviews", icon: Star },
  { name: "Personal", href: "/staff", icon: Users },
];

function getOwnerInfo() {
  const email = localStorage.getItem("restosmart_owner_email") ?? "";
  const biz = localStorage.getItem("restosmart_owner_business_type") ?? "restaurant";
  const bizLabel = biz === "cafe" ? "Café-Betreiber" : biz === "bar" ? "Bar-Betreiber" : "Restaurantbesitzer";
  const name = email ? email.split("@")[0].replace(/[._]/g, " ") : bizLabel;
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return { email, name, initials };
}

function exitToProfile() {
  window.location.href = window.location.origin + "/customer/profile";
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { email, name, initials } = getOwnerInfo();

  return (
    <div className="flex h-screen bg-background text-foreground dark overflow-hidden">
      {/* Seitenleiste */}
      <div className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50 border-r border-border bg-sidebar">
        <div className="flex h-16 shrink-0 items-center px-6 border-b border-sidebar-border bg-sidebar-primary/5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg shadow-primary/20">
              R
            </div>
            <span className="text-xl font-bold tracking-tight text-sidebar-foreground">
              RestoSmart
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
          <nav className="flex-1 space-y-1">
            {navigation.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    "group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
                  )}
                >
                  <item.icon
                    className={cn(
                      isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70",
                      "mr-3 h-5 w-5 flex-shrink-0 transition-colors"
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Owner section — exit back to customer profile */}
        <div className="shrink-0 px-4 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate capitalize">{name}</p>
              {email && (
                <p className="text-[10px] text-sidebar-foreground/40 truncate">{email}</p>
              )}
            </div>
            <button
              onClick={exitToProfile}
              title="Zurück zum Profil"
              className="shrink-0 p-1.5 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={exitToProfile}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-sidebar-border/60 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors text-xs font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Zurück zum Benutzerprofil
          </button>
        </div>
      </div>

      {/* Hauptinhalt */}
      <main className="flex-1 md:pl-64 overflow-y-auto pb-16 md:pb-0 flex flex-col">
        <TrialBanner />
        <div className="flex-1 p-8 relative">
          {children}
        </div>
      </main>

      {/* Mobile-Navigation unten */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-sidebar border-t border-border flex justify-around items-center h-16 px-2">
        {mobileNavigation.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
        {/* Mobile exit button */}
        <button
          onClick={exitToProfile}
          className="flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-[10px] font-medium">Profil</span>
        </button>
      </div>
    </div>
  );
}
