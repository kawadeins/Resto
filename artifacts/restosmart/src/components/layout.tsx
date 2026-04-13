import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Package, DollarSign, Calendar, BarChart3,
  UtensilsCrossed, ShoppingCart, BookOpen, Megaphone, CreditCard, Star,
  Lightbulb, TrendingUp, Armchair, Wallet, ArrowLeft, UserCircle, Zap,
  Clock, X, Flame, UsersRound, LogOut, AlertTriangle, RefreshCw, Globe,
} from "lucide-react";
import { OwnerNotificationBell } from "@/components/notification-bell";
import { cn } from "@/lib/utils";
import { useState, useEffect, Component, type ReactNode } from "react";
import { track } from "@/lib/conversion-tracking";
import { useVariants, getVariantCopy, trackVariantImpression, trackVariantClick } from "@/lib/variant-system";
import { usePermissions, type TeamRole } from "@/hooks/use-permissions";
import { useSession } from "@/contexts/session-context";
import { RestoLogo } from "@/components/resto-logo";
import { useTranslation } from "react-i18next";
import { LanguagePicker } from "@/components/language-picker";

// ─── Page Error Boundary ──────────────────────────────────────────────────────

interface ErrorBoundaryState { error: Error | null }

class PageErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[RestoSmart] Page render error:", error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <PageErrorFallback error={this.state.error} onReset={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

function PageErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md px-6 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white">{t("error.page_title")}</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          {error.message || t("error.page_body")}
        </p>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          {t("error.page_cta")}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const { t } = useTranslation();
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
    mainMsg = t("trial.ends_today");
    subMsg = t("trial.visibility_hint");
    ctaLabel = t("trial.cta_visible");
  } else if (daysLeft === 1) {
    mainMsg = t("trial.last_day");
    subMsg = t("trial.keep_advantage");
    ctaLabel = t("trial.cta_secure");
  } else if (isUrgent) {
    mainMsg = t("trial.ends_in_days", { count: daysLeft });
    subMsg = t("trial.lose_reach");
    ctaLabel = t("trial.cta_visible");
  } else if (isWarning) {
    mainMsg = t("trial.days_remaining", { count: daysLeft });
    subMsg = t("trial.more_customers");
    ctaLabel = t("trial.cta_visible");
  } else {
    mainMsg = t("trial.days_remaining_long", { count: daysLeft });
    subMsg = null;
    ctaLabel = t("trial.cta_visible");
  }

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
          <span className="hidden sm:inline text-xs opacity-60 font-normal">{"— "}{subMsg}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => { window.location.href = "/billing"; }}
          className={cn(
            "text-xs font-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer",
            isUrgent
              ? "bg-red-500 hover:bg-red-400 text-white"
              : isWarning
              ? "bg-amber-500 hover:bg-amber-400 text-black"
              : "bg-violet-600 hover:bg-violet-500 text-white"
          )}
        >
          {ctaLabel}
        </button>
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

export function TrialConversionBanner({ context }: { context: "overview" | "analytics" | "marketing" | "insights" | "billing" }) {
  const { t } = useTranslation();
  const isTrial = typeof window !== "undefined" && localStorage.getItem("restosmart_owner_premium") === "trial";
  useEffect(() => {
    if (isTrial) track("trial_conversion_banner_viewed", { messageLabel: context });
  }, []);
  const { variants, loaded } = useVariants();
  useEffect(() => {
    if (!loaded || !isTrial) return;
    if (variants.banner_headline) trackVariantImpression(variants.banner_headline.id);
    if (variants.trial_cta) trackVariantImpression(variants.trial_cta.id);
  }, [loaded]);

  if (typeof window === "undefined") return null;
  const premium = localStorage.getItem("restosmart_owner_premium");
  const trialEndStr = localStorage.getItem("restosmart_trial_end");
  if (premium !== "trial" || !trialEndStr) return null;
  const end = new Date(trialEndStr);
  const now = new Date();
  if (end <= now) return null;
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
  const biz = localStorage.getItem("restosmart_owner_business_type") ?? "restaurant";
  const bizLabel = biz === "cafe" ? "Café" : biz === "bar" ? "Bar" : "Restaurant";
  const dayLabel = daysLeft === 1 ? t("trial.day_singular") : t("trial.day_plural");

  const contextual: Record<string, { headline: string; body: string; cta: string }> = {
    overview: {
      headline: t("trial.banner_overview_headline"),
      body: t("trial.banner_overview_body", { biz: bizLabel, count: daysLeft, dayLabel }),
      cta: t("trial.cta_visible"),
    },
    analytics: {
      headline: t("trial.banner_analytics_headline"),
      body: t("trial.banner_analytics_body"),
      cta: t("trial.cta_continue"),
    },
    marketing: {
      headline: t("trial.banner_marketing_headline"),
      body: t("trial.banner_marketing_body", { biz: bizLabel, count: daysLeft, dayLabel }),
      cta: t("trial.cta_activate"),
    },
    insights: {
      headline: t("trial.banner_insights_headline"),
      body: t("trial.banner_insights_body"),
      cta: t("trial.cta_visible"),
    },
    billing: {
      headline: t("trial.banner_billing_headline"),
      body: t("trial.banner_billing_body"),
      cta: t("trial.cta_continue"),
    },
  };

  const { headline: fallbackHeadline, body, cta: fallbackCta } = contextual[context] ?? contextual.overview;
  const { copy: headline } = getVariantCopy(variants, "banner_headline", fallbackHeadline);
  const { copy: cta, variantId: trialCtaId } = getVariantCopy(variants, "trial_cta", fallbackCta);
  const isUrgent = daysLeft <= 3;

  return (
    <div className={cn(
      "rounded-xl border p-4 flex items-center gap-4",
      isUrgent
        ? "border-red-700/40 bg-gradient-to-r from-red-950/50 to-pink-950/30"
        : "border-violet-700/30 bg-gradient-to-r from-violet-950/60 to-pink-950/30"
    )}>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold", isUrgent ? "text-red-200" : "text-violet-200")}>{headline}</p>
        <p className={cn("text-xs mt-0.5 leading-relaxed", isUrgent ? "text-red-300/60" : "text-violet-300/60")}>{body}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {!isUrgent && (
          <div className="hidden sm:block text-right">
            <div className="text-[10px] text-violet-400/50 uppercase tracking-widest">{t("trial.testphase_label")}</div>
            <div className="text-sm font-bold text-violet-300">{daysLeft} {t("trial.day_plural")}</div>
          </div>
        )}
        <button
          onClick={() => {
            if (trialCtaId) trackVariantClick(trialCtaId, true);
            window.location.href = "/billing";
          }}
          className={cn(
            "text-xs font-bold px-3 py-2 rounded-xl text-white hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer",
            isUrgent
              ? "bg-gradient-to-r from-red-600 to-pink-600"
              : "bg-gradient-to-r from-violet-600 to-pink-600"
          )}
        >
          {cta}
        </button>
      </div>
    </div>
  );
}

type NavItem = { key: string; href: string; icon: typeof LayoutDashboard; roles?: TeamRole[] };

function getNavigation(t: (k: string) => string): NavItem[] {
  return [
    { key: "nav.overview",      href: "/",            icon: LayoutDashboard },
    { key: "nav.profile",       href: "/profile",     icon: UserCircle },
    { key: "nav.bookings",      href: "/bookings",    icon: BookOpen },
    { key: "nav.reservations",  href: "/reservations",icon: Calendar },
    { key: "nav.tables",        href: "/tables",      icon: Armchair },
    { key: "nav.staff",         href: "/staff",       icon: Users,        roles: ["owner", "manager"] },
    { key: "nav.payroll",       href: "/payroll",     icon: Wallet,       roles: ["owner"] },
    { key: "nav.team",          href: "/team",        icon: UsersRound,   roles: ["owner"] },
    { key: "nav.inventory",     href: "/inventory",   icon: Package,      roles: ["owner", "manager"] },
    { key: "nav.menu",          href: "/menu",        icon: UtensilsCrossed, roles: ["owner", "manager"] },
    { key: "nav.pos",           href: "/pos",         icon: ShoppingCart },
    { key: "nav.finances",      href: "/finances",    icon: DollarSign,   roles: ["owner"] },
    { key: "nav.analytics",     href: "/analytics",   icon: BarChart3,    roles: ["owner", "manager"] },
    { key: "nav.boost",         href: "/boost",       icon: Flame,        roles: ["owner", "manager"] },
    { key: "nav.marketing",     href: "/marketing",   icon: Megaphone,    roles: ["owner", "manager"] },
    { key: "nav.deadhours",     href: "/insights",    icon: Lightbulb,    roles: ["owner", "manager"] },
    { key: "nav.growth",        href: "/campaigns",   icon: TrendingUp,   roles: ["owner", "manager"] },
    { key: "nav.optimizer",     href: "/optimizer",   icon: Zap,          roles: ["owner", "manager"] },
    { key: "nav.reviews",       href: "/reviews",     icon: Star },
    { key: "nav.billing",       href: "/billing",     icon: CreditCard,   roles: ["owner"] },
  ];
}

function getMobileNavigation(t: (k: string) => string): NavItem[] {
  return [
    { key: "nav.overview",   href: "/",          icon: LayoutDashboard },
    { key: "nav.bookings",   href: "/bookings",  icon: BookOpen },
    { key: "nav.marketing",  href: "/marketing", icon: Megaphone,  roles: ["owner", "manager"] },
    { key: "nav.reviews",    href: "/reviews",   icon: Star },
    { key: "nav.staff",      href: "/staff",     icon: Users,      roles: ["owner", "manager"] },
  ];
}

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

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t } = useTranslation();
  const { email, name, initials } = getOwnerInfo();
  const { role } = usePermissions();
  const { logout } = useSession();

  async function handleLogout() {
    await logout();
  }

  const navigation = getNavigation(t);
  const mobileNavigation = getMobileNavigation(t);

  const filteredNavigation = navigation.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(role);
  });

  const filteredMobileNav = mobileNavigation.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(role);
  });

  return (
    <div className="flex h-screen bg-background text-foreground dark overflow-hidden">
      {/* Seitenleiste */}
      <div className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50 border-r border-border bg-sidebar">
        <div className="flex h-16 shrink-0 items-center px-6 border-b border-sidebar-border bg-sidebar-primary/5 justify-between">
          <RestoLogo size="md" />
          <OwnerNotificationBell />
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
          <nav className="flex-1 space-y-1">
            {filteredNavigation.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              const label = t(item.key);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    isActive
                      ? "bg-sidebar-primary/15 text-sidebar-primary border border-sidebar-primary/20"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground border border-transparent",
                    "group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150"
                  )}
                >
                  <item.icon
                    className={cn(
                      isActive ? "text-sidebar-primary" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70",
                      "mr-3 h-4 w-4 flex-shrink-0 transition-colors"
                    )}
                    aria-hidden="true"
                  />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Language picker in sidebar */}
          <div className="mt-4 pt-4 border-t border-sidebar-border">
            <LanguagePicker compact />
          </div>
        </div>

        {/* Owner section */}
        <div className="shrink-0 px-4 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary text-xs font-bold shrink-0 ring-1 ring-sidebar-primary/30">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate capitalize">{name}</p>
              {email && (
                <p className="text-[10px] text-sidebar-foreground/40 truncate">{email}</p>
              )}
            </div>
            <button
              onClick={handleLogout}
              title={t("common.logout")}
              className="shrink-0 p-1.5 rounded-lg text-sidebar-foreground/40 hover:text-red-400 hover:bg-red-500/8 transition-all duration-150 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 md:pl-64 overflow-y-auto pb-16 md:pb-0 flex flex-col">
        <TrialBanner />
        <PageErrorBoundary key={location}>
          <div className="flex-1 p-8 relative">
            {children}
          </div>
        </PageErrorBoundary>
      </main>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-sidebar border-t border-border flex justify-around items-center h-16 px-2">
        {filteredMobileNav.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          const label = t(item.key);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
        {/* Mobile notifications */}
        <div className="flex flex-col items-center justify-center w-full h-full space-y-1">
          <OwnerNotificationBell />
          <span className="text-[10px] font-medium text-muted-foreground">Alerts</span>
        </div>
        {/* Mobile profile */}
        <Link
          href="/profile"
          className="flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-[10px] font-medium">{t("nav.profile")}</span>
        </Link>
      </div>
    </div>
  );
}
