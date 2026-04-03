import { Link, useLocation } from "wouter";
import { UtensilsCrossed, Compass, CalendarCheck } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Startseite", icon: <UtensilsCrossed className="w-5 h-5" /> },
    { href: "/explore", label: "Entdecken", icon: <Compass className="w-5 h-5" /> },
    { href: "/my-bookings", label: "Buchungen", icon: <CalendarCheck className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Desktop-Kopfzeile */}
      <header className="hidden md:flex sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary font-serif text-2xl font-bold tracking-tight">
            RestoSmart
          </Link>
          <nav className="flex items-center gap-8 text-sm font-medium">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`transition-colors hover:text-primary ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Hauptinhalt */}
      <main className="flex-1 w-full pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile-Navigation unten */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-[0_-4px_20px_rgba(0,0,0,0.05)] safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-4">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center w-16 gap-1 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      
      {/* Fußzeile (Desktop) */}
      <footer className="hidden md:block py-12 bg-muted/30 border-t mt-auto">
        <div className="container mx-auto px-6 text-center text-muted-foreground text-sm">
          <p className="font-serif italic text-lg text-foreground mb-4">Gutes Essen, gute Menschen.</p>
          &copy; {new Date().getFullYear()} RestoSmart. Alle Rechte vorbehalten.
        </div>
      </footer>
    </div>
  );
}
