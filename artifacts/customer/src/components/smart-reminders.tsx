import { useState, useEffect, useCallback } from "react";
import { X, Calendar, ChefHat, Users, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface Reminder {
  id: string;
  type: "booking" | "meal-plan" | "invitation" | "loyalty";
  title: string;
  body: string;
  cta?: string;
  href?: string;
  icon: typeof Calendar;
  gradient: string;
}

const SEEN_KEY = "rs_reminders_seen";

function getSeenIds(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  const seen = getSeenIds();
  seen.add(id);
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isTomorrow(dateStr: string): boolean {
  const d = new Date(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  );
}

function formatTime(timeStr: string): string {
  return timeStr?.slice(0, 5) ?? "";
}

// ── Single Reminder Card ─────────────────────────────────────────────────────
function ReminderCard({
  reminder,
  onDismiss,
}: {
  reminder: Reminder;
  onDismiss: (id: string) => void;
}) {
  const Icon = reminder.icon;
  return (
    <div className={`relative flex items-start gap-3 p-4 rounded-2xl border border-border/60 bg-card shadow-lg shadow-black/5 animate-in slide-in-from-top-3 fade-in duration-300`}>
      {/* Gradient accent bar */}
      <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b ${reminder.gradient}`} />
      <div className={`shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${reminder.gradient} flex items-center justify-center shadow-sm`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0 pr-6">
        <p className="text-sm font-semibold leading-snug">{reminder.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{reminder.body}</p>
        {reminder.cta && reminder.href && (
          <Link href={reminder.href}>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-0 text-xs font-semibold text-primary hover:text-primary/80 pl-0"
            >
              {reminder.cta} →
            </Button>
          </Link>
        )}
      </div>
      <button
        onClick={() => onDismiss(reminder.id)}
        className="absolute top-3 right-3 w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Schließen"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Smart Reminders Layer ────────────────────────────────────────────────────
export function SmartReminders({ email }: { email: string }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const dismiss = useCallback((id: string) => {
    markSeen(id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, []);

  useEffect(() => {
    if (!email) return;

    const seen = getSeenIds();
    const found: Reminder[] = [];

    // ── 1. Upcoming bookings ──────────────────────────────────────────────
    fetch(`${API_BASE}/api/customer-profile/${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((profile) => {
        const bookings: Array<{
          id: number | string;
          date: string;
          time: string;
          restaurantName: string;
          partySize: number;
          status: string;
        }> = profile?.recentBookings ?? [];

        bookings.forEach((b) => {
          if (b.status !== "confirmed" && b.status !== "pending") return;
          const rid = `booking-${b.id}`;
          if (seen.has(rid)) return;
          const today = isToday(b.date);
          const tomorrow = isTomorrow(b.date);
          if (!today && !tomorrow) return;
          found.push({
            id: rid,
            type: "booking",
            title: today
              ? `Deine Reservierung ist heute! 🍽️`
              : `Deine Reservierung ist morgen`,
            body: `${b.restaurantName} · ${b.date} um ${formatTime(b.time)} · ${b.partySize} ${b.partySize === 1 ? "Person" : "Personen"}`,
            cta: "Buchung ansehen",
            href: "/my-bookings",
            icon: Calendar,
            gradient: "from-primary to-violet-600",
          });
        });

        // ── 2. Loyalty milestone ────────────────────────────────────────
        const pts = profile?.loyalty?.points ?? 0;
        const tier = profile?.loyalty?.tier;
        const toNext = profile?.loyalty?.pointsToNext ?? 0;
        if (tier !== "Gold" && toNext > 0 && toNext <= 50) {
          const rid = "loyalty-close";
          if (!seen.has(rid)) {
            found.push({
              id: rid,
              type: "loyalty",
              title: `Noch ${toNext} Punkte bis ${profile.loyalty.nextTier}! 🏆`,
              body: `Du hast ${pts} Punkte. Buche jetzt und erreiche den nächsten Status.`,
              cta: "Restaurant entdecken",
              href: "/explore",
              icon: Bell,
              gradient: "from-amber-400 to-orange-500",
            });
          }
        }

        setReminders((prev) => {
          const prevIds = new Set(prev.map((r) => r.id));
          const fresh = found.filter((r) => !prevIds.has(r.id));
          return [...prev, ...fresh];
        });
      })
      .catch(() => {});

    // ── 3. Meal plan reminder ──────────────────────────────────────────────
    const mealRid = "meal-plan-today";
    if (!seen.has(mealRid)) {
      fetch(`${API_BASE}/api/meal-plan/${encodeURIComponent(email)}`)
        .then((r) => r.json())
        .then((data) => {
          const plans: Array<{ date: string; restaurantName?: string }> =
            data?.plans ?? data ?? [];
          const todayPlan = plans.find((p) => isToday(p.date));
          if (todayPlan) {
            const r: Reminder = {
              id: mealRid,
              type: "meal-plan",
              title: "Dein Essensplan für heute 🍱",
              body: todayPlan.restaurantName
                ? `${todayPlan.restaurantName} steht heute auf deinem Plan.`
                : "Schau dir deinen heutigen Essensplan an.",
              cta: "Jetzt ansehen",
              href: "/meal-plan",
              icon: ChefHat,
              gradient: "from-emerald-400 to-teal-500",
            };
            setReminders((prev) =>
              prev.find((x) => x.id === mealRid) ? prev : [...prev, r]
            );
          }
        })
        .catch(() => {});
    }

    // ── 4. Social cue nudge — friends active at a nearby place ────────────────
    const socialRid = "social-friends-active";
    if (!seen.has(socialRid)) {
      fetch(`${API_BASE}/api/social/group-suggestions/${encodeURIComponent(email)}`)
        .then((r) => r.json())
        .then((data) => {
          const suggestions: Array<{
            type: string;
            restaurantId?: number;
            restaurantName?: string;
            restaurantEmoji?: string;
            friendNames?: string[];
            title: string;
            cta: string;
          }> = Array.isArray(data) ? data : [];

          const friendSugg = suggestions.find(
            (s) => s.type === "friends_active" && s.restaurantName && (s.friendNames?.length ?? 0) > 0
          );
          if (friendSugg) {
            const names = (friendSugg.friendNames ?? []).slice(0, 2).join(" & ");
            const extra = (friendSugg.friendNames?.length ?? 0) > 2
              ? ` +${(friendSugg.friendNames?.length ?? 0) - 2}`
              : "";
            const isSingular = (friendSugg.friendNames?.length ?? 0) === 1;
            const rem: Reminder = {
              id: socialRid,
              type: "invitation",
              title: `${names}${extra} ${isSingular ? "ist" : "sind"} gerade aktiv 👥`,
              body: `${friendSugg.restaurantEmoji ?? "🍽️"} ${friendSugg.restaurantName} — perfekter Moment zum Treffen.`,
              cta: "Ansehen",
              href: friendSugg.restaurantId
                ? `/restaurant/${friendSugg.restaurantId}`
                : "/explore",
              icon: Users,
              gradient: "from-blue-400 to-cyan-500",
            };
            setReminders((prev) =>
              prev.find((x) => x.id === socialRid) ? prev : [...prev, rem]
            );
          }
        })
        .catch(() => {});
    }
  }, [email]);

  if (reminders.length === 0) return null;

  return (
    <div className="fixed top-4 left-0 right-0 z-[150] flex flex-col gap-2.5 px-4 sm:px-0 sm:w-[400px] sm:mx-auto pointer-events-none">
      {reminders.map((r) => (
        <div key={r.id} className="pointer-events-auto">
          <ReminderCard reminder={r} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}
