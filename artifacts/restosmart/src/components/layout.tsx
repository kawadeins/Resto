import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Package, DollarSign, Calendar, BarChart3,
  UtensilsCrossed, ShoppingCart, BookOpen, Megaphone, CreditCard, Star,
  Lightbulb, TrendingUp, Armchair, Wallet, ArrowLeft, UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const name = email ? email.split("@")[0].replace(/[._]/g, " ") : "Restaurantbesitzer";
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
      <main className="flex-1 md:pl-64 overflow-y-auto pb-16 md:pb-0">
        <div className="min-h-full h-full p-8 relative">
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
