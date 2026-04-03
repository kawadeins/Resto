import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Package, DollarSign, Calendar, BarChart3, UtensilsCrossed, ShoppingCart, BookOpen, Megaphone, CreditCard, Star, Lightbulb, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Bookings", href: "/bookings", icon: BookOpen },
  { name: "Reservations", href: "/reservations", icon: Calendar },
  { name: "Staff", href: "/staff", icon: Users },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Menu", href: "/menu", icon: UtensilsCrossed },
  { name: "POS", href: "/pos", icon: ShoppingCart },
  { name: "Finances", href: "/finances", icon: DollarSign },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Marketing", href: "/marketing", icon: Megaphone },
  { name: "Dead Hours", href: "/insights", icon: Lightbulb },
  { name: "Growth Hub", href: "/campaigns", icon: TrendingUp },
  { name: "Reviews", href: "/reviews", icon: Star },
  { name: "Billing", href: "/billing", icon: CreditCard },
];

const mobileNavigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Bookings", href: "/bookings", icon: BookOpen },
  { name: "Marketing", href: "/marketing", icon: Megaphone },
  { name: "Reviews", href: "/reviews", icon: Star },
  { name: "Billing", href: "/billing", icon: CreditCard },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen bg-background text-foreground dark overflow-hidden">
      {/* Sidebar */}
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
      </div>

      {/* Main content */}
      <main className="flex-1 md:pl-64 overflow-y-auto pb-16 md:pb-0">
        <div className="min-h-full h-full p-8 relative">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
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
      </div>
    </div>
  );
}
