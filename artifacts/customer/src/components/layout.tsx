import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { UtensilsCrossed, Compass, UserCircle, CalendarDays, Rss, Building2, Settings } from "lucide-react";
import { RestoLogo } from "@/components/resto-logo";
import { Link } from "wouter";
import { CustomerNotificationBell } from "@/components/notification-bell";
import { useTranslation } from "react-i18next";

// ─── Route → tab ownership ────────────────────────────────────────────────────
const ROUTE_TAB_MAP: Array<{ prefix: string; tab: string }> = [
  { prefix: "/restaurant", tab: "/explore" },
  { prefix: "/explore",    tab: "/explore" },
  { prefix: "/plan",       tab: "/meal-plan" },
  { prefix: "/meal-plan",  tab: "/meal-plan" },
  { prefix: "/my-bookings",tab: "/profile" },
  { prefix: "/friends",    tab: "/profile" },
  { prefix: "/settings",   tab: "/settings" },
  { prefix: "/feed",       tab: "/feed" },
  { prefix: "/profile",    tab: "/profile" },
  { prefix: "/",           tab: "/" },
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

function useSmartTabNav() {
  const [location, navigate] = useLocation();
  const [pressedTab, setPressedTab] = useState<string | null>(null);
  const activeTab = getActiveTab(location);

  const handleTap = (tabHref: string) => {
    setPressedTab(tabHref);
    setTimeout(() => setPressedTab(null), 180);

    if (activeTab === tabHref) {
      if (location === tabHref) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        navigate(tabHref);
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }
    } else {
      navigate(tabHref);
    }
  };

  return { activeTab, pressedTab, handleTap };
}

const SPRING = "0.18s cubic-bezier(0.34, 1.56, 0.64, 1)";
const EASE   = "0.15s ease";

export function Layout({ children }: { children: React.ReactNode }) {
  const { activeTab, pressedTab, handleTap } = useSmartTabNav();
  const { t } = useTranslation();
  const [customerEmail, setCustomerEmail] = useState(
    () => localStorage.getItem("restosmart_email") ?? ""
  );
  useEffect(() => {
    const sync = () => setCustomerEmail(localStorage.getItem("restosmart_email") ?? "");
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const NAV_ITEMS = [
    { href: "/",          label: t("nav.home", "Startseite"),   icon: UtensilsCrossed },
    { href: "/explore",   label: t("nav.explore"),    icon: Compass },
    { href: "/meal-plan", label: t("nav.meal_plan", "Essensplan"),   icon: CalendarDays },
    { href: "/feed",      label: t("nav.feed"),         icon: Rss },
    { href: "/profile",   label: t("nav.profile"),       icon: UserCircle },
    { href: "/settings",  label: t("nav.settings"),icon: Settings },
  ];

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
                  className={`px-4 py-2 rounded-full text-sm transition-all duration-150 cursor-pointer ${
                    isActive
                      ? "bg-primary/12 text-primary font-bold"
                      : "text-muted-foreground font-medium hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <CustomerNotificationBell email={customerEmail} />
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile notification bell */}
      {customerEmail && (
        <div className="md:hidden fixed top-3 right-3 z-[60]">
          <CustomerNotificationBell email={customerEmail} />
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="mx-3 mb-3 rounded-2xl bg-white/92 backdrop-blur-xl border border-border/60 shadow-xl shadow-black/10 px-2 py-2">
          <div className="flex items-center justify-around gap-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive  = activeTab === item.href;
              const isPressed = pressedTab === item.href;
              const Icon = item.icon;

              const pillScale = isPressed ? 0.80 : isActive ? 1.06 : 1;
              const btnScale  = isPressed ? 0.94 : 1;

              return (
                <button
                  key={item.href}
                  onClick={() => handleTap(item.href)}
                  style={{
                    transform: `scale(${btnScale})`,
                    transition: `transform ${EASE}`,
                  }}
                  className="flex flex-col items-center gap-0.5 flex-1 py-1 min-w-0 cursor-pointer bg-transparent border-0"
                >
                  <div
                    style={{
                      transform: `scale(${pillScale})`,
                      transition: `transform ${SPRING}`,
                    }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isActive
                        ? "bg-gradient-to-br from-primary to-accent shadow-xl shadow-primary/35"
                        : "bg-transparent"
                    }`}
                  >
                    <Icon
                      style={{
                        width:  isActive ? 20 : 17,
                        height: isActive ? 20 : 17,
                        transition: `width ${EASE}, height ${EASE}`,
                      }}
                      className={isActive ? "text-white" : "text-muted-foreground"}
                    />
                  </div>
                  <span
                    style={{
                      fontSize:   isActive ? "10px" : "9px",
                      fontWeight: isActive ? 700 : 500,
                      transition: `font-size ${EASE}, color ${EASE}`,
                    }}
                    className={`truncate w-full text-center ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
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
        <div className="bg-gradient-to-r from-primary/8 via-background to-accent/8 border-b border-border/40 py-5 px-6">
          <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                <Building2 className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground leading-tight">{t("settings.for_business_title")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.for_business_body")}</p>
              </div>
            </div>
            <Link
              href="/for-business"
              className="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
            >
              {t("nav.for_business")} <Building2 className="w-3.5 h-3.5" />
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
                <Building2 className="w-3 h-3" /> {t("nav.for_business")}
              </Link>
              <span className="text-border">{"·"}</span>
              <Link href="/explore" className="hover:underline">{t("nav.explore")}</Link>
              <span className="text-border">{"·"}</span>
              <Link href="/profile" className="hover:underline">{t("nav.profile")}</Link>
            </div>
            <p className="italic text-muted-foreground/70 mb-1">{"Gutes Essen, gute Menschen."}</p>
            <p>&copy; {new Date().getFullYear()} RestoSmart.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
