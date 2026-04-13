import { motion } from "framer-motion";
import { Link } from "wouter";
import { LayoutDashboard, BookOpen, BarChart3, Star, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();

  const QUICK_LINKS = [
    { label: t("nav.overview"), href: "/", icon: LayoutDashboard },
    { label: t("nav.bookings"), href: "/bookings", icon: BookOpen },
    { label: t("nav.analytics"), href: "/analytics", icon: BarChart3 },
    { label: t("nav.reviews"), href: "/reviews", icon: Star },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-lg text-center space-y-8"
      >
        <div className="space-y-3">
          <div
            className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-500/20"
            style={{ background: "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))" }}
          >
            <LayoutDashboard className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t("overview.welcome_title")}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
            {t("overview.welcome_subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {QUICK_LINKS.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href}>
              <div className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">{label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          ))}
        </div>

        <Link href="/">
          <button
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg shadow-violet-500/25 hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))" }}
          >
            {t("nav.overview")}
            <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </motion.div>
    </div>
  );
}
