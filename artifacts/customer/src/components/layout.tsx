import { useLocation } from "wouter";
import { UtensilsCrossed, Compass, CalendarCheck, UserCircle, CalendarDays, Users, Building2 } from "lucide-react";
import { RestoLogo } from "@/components/resto-logo";
import { Link } from "wouter";

// ─── Route → tab ownership ────────────────────────────────────────────────────
// Order matters: more specific prefixes must come first.
const ROUTE_TAB_MAP: Array<{ prefix: string; exact?: boolean; tab: string }> = [
  { prefix: "/restaurant", tab: "/explore" },  // /restaurant/:id belongs to Entdecken
  { prefix: "/explore",    tab: "/explore" },
  { prefix: "/meal-plan",  tab: "/meal-plan" },
  { prefix: "/my-bookings",tab: "/my-bookings" },
  { prefix: "/friends",    tab: "/friends" },
  { prefix: "/profile",    tab: "/profile" },
  { prefix: "/",           tab: "/" },          // catch-all: home
];

function getActiveTab(location: string): string {
  for (const { prefix, tab } of ROUTE_TAB_MAP) {
    if (
      location === prefix ||
      location.startsWith(prefix + "/") ||
      location.startsWith(prefix + "?")
    ) {
      return tab;
    }
  }
  return "/";
}

// ─── Smart tab hook ───────────────────────────────────────────────────────────

function useSmartTabNav() {
  const [location, navigate] = useLocation();
  const activeTab = getActiveTab(location);

  const handleTap = (tabHref: string) => {
    if (activeTab === tabHref) {
      if (location === tabHref) {
        // Already on section root → smooth scroll to top
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Inside nested view → navigate to root, then scroll top
        navigate(tabHref);
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }
    } else {
      // Different section → normal navigate
      navigate(tabHref);
    }
  };

  return { activeTab, handleTap };
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/",            label: "Startseite", icon: UtensilsCrossed },
  { href: "/explore",     label: "Entdecken",  icon: Compass },
  { href: "/meal-plan",   label: "Essensplan", icon: CalendarDays },
  { href: "/my-bookings", label: "Buchungen",  icon: CalendarCheck },
  { href: "/friends",     label: "Freunde",    icon: Users },
  { href: "/profile",     label: "Profil",     icon: UserCircle },
];

// ─── Layout ───────────────────────────────────────────────────────────────────

export function Layout({ children }: { children: React.ReactNode }) {
  const { activeTab, handleTap } = useSmartTabNav();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">

      {/* Desktop header */}
      <header className="hidden md:flex sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <RestoLogo size="md" />
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.href;
              return (
                <button
                  key={item.href}
                  onClick={() => handleTap(item.href)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav — glassy pill design */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="mx-3 mb-3 rounded-2xl bg-white/90 backdrop-blur-xl border border-border/60 shadow-xl shadow-black/10 px-2 py-2">
          <div className="flex items-center justify-around gap-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.href;
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => handleTap(item.href)}
                  className="press-scale flex flex-col items-center gap-0.5 flex-1 py-1 min-w-0 cursor-pointer bg-transparent border-0"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30"
                      : "bg-transparent"
                  }`}>
                    <Icon
                      className={`transition-colors ${isActive ? "text-white" : "text-muted-foreground"}`}
                      style={{ width: 18, height: 18 }}
                    />
                  </div>
                  <span className={`text-[9px] font-semibold transition-colors truncate w-full text-center ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Desktop footer */}
      <footer className="hidden md:block border-t mt-auto">
        {/* For Business banner */}
        <div className="bg-gradient-to-r from-primary/8 via-background to-accent/8 border-b border-border/40 py-5 px-6">
          <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                <Building2 className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground leading-tight">Restaurant, {"Café"} oder Bar?</p>
                <p className="text-xs text-muted-foreground">Mehr {"Gäste"} mit RestoSmart {"—"} kostenlos starten</p>
              </div>
            </div>
            <Link href="/for-business" className="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity">
              {"Für Betriebe"} <Building2 className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
        <div className="py-8 px-6">
          <div className="container mx-auto text-center text-muted-foreground text-sm">
            <div className="flex items-center justify-center mb-3">
              <RestoLogo size="sm" />
            </div>
            <div className="flex items-center justify-center gap-4 mb-2 flex-wrap text-xs">
              <Link href="/for-business" className="text-primary font-semibold hover:underline flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {"Für Betriebe"}
              </Link>
              <span className="text-border">·</span>
              <Link href="/explore" className="hover:underline">Entdecken</Link>
              <span className="text-border">·</span>
              <Link href="/profile" className="hover:underline">Profil</Link>
            </div>
            <p className="italic text-muted-foreground/70 mb-1">Gutes Essen, gute Menschen.</p>
            <p>&copy; {new Date().getFullYear()} RestoSmart. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
