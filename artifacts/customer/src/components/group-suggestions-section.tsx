/**
 * GroupSuggestionsSection — "Join your friends for coffee", "Plan together" etc.
 * Shown on home page when user has friends with recent activity.
 * Social, premium feel. Privacy-safe: aggregated data only.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, Sparkles, ArrowRight, Calendar, Zap } from "lucide-react";
import { getGroupSuggestions, type GroupSuggestion } from "@/lib/social-api";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Urgency config ───────────────────────────────────────────────────────────

const URGENCY_STYLE = {
  high:   { border: "border-rose-200",    bg: "bg-rose-50/80",    pulse: true,  dot: "bg-rose-500"    },
  medium: { border: "border-amber-200",   bg: "bg-amber-50/80",   pulse: false, dot: "bg-amber-500"   },
  low:    { border: "border-border/50",   bg: "bg-card",          pulse: false, dot: "bg-primary/50"  },
};

// ─── Single suggestion card ───────────────────────────────────────────────────

function SuggestionCard({ sg }: { sg: GroupSuggestion }) {
  const style = URGENCY_STYLE[sg.urgency];
  const href = sg.link ?? (sg.restaurantId ? `/restaurant/${sg.restaurantId}` : "/explore");

  const friendLabel = sg.friendNames?.length === 1 ? sg.friendNames[0]
    : sg.friendNames?.length === 2 ? `${sg.friendNames[0]} & ${sg.friendNames[1]}`
    : sg.friendNames && sg.friendNames.length > 2 ? `${sg.friendNames.length} Freunde`
    : null;

  return (
    <div className={`relative overflow-hidden rounded-3xl border ${style.border} ${style.bg} p-5 shrink-0 w-72 snap-start flex flex-col gap-3`}>

      {/* Live dot */}
      {style.pulse && (
        <div className="absolute top-4 right-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${style.dot}`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${style.dot}`} />
          </span>
        </div>
      )}

      {/* Icon + restaurant */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-border/30 flex items-center justify-center text-2xl shrink-0">
          {sg.restaurantEmoji ?? sg.icon ?? "✨"}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
            {sg.type === "friends_active" ? "Freunde-Tipp" : sg.type === "time_context" ? "Jetzt passend" : "Gruppenplan"}
          </p>
          <h3 className="font-bold text-sm leading-tight line-clamp-1">{sg.restaurantName ?? sg.title}</h3>
        </div>
      </div>

      {/* Friend avatars row */}
      {friendLabel && (
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {(sg.friendNames ?? []).slice(0, 3).map((name, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center border-2 border-background shadow-sm"
              >
                <span className="text-white font-bold text-[9px]">{name.slice(0, 2).toUpperCase()}</span>
              </div>
            ))}
          </div>
          <span className="text-xs font-semibold text-foreground/80">{friendLabel}</span>
        </div>
      )}

      {/* Suggestion text */}
      <p className="text-sm text-muted-foreground leading-snug">{sg.cta}</p>

      {/* CTA button */}
      <Link href={href} className="mt-auto">
        <button className="w-full flex items-center justify-center gap-2 text-sm font-bold py-2.5 px-4 rounded-2xl bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/25 hover:shadow-lg transition-all press-scale">
          {sg.ctaButton}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </Link>
    </div>
  );
}

// ─── Plan together CTA card ───────────────────────────────────────────────────

function PlanTogetherCard({ friendCount }: { friendCount: number }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/8 to-accent/8 p-5 shrink-0 w-64 snap-start flex flex-col gap-3 items-center justify-center text-center">
      <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl shadow-lg shadow-primary/30">
        👥
      </div>
      <div>
        <p className="font-bold text-sm mb-1">Zusammen planen</p>
        <p className="text-xs text-muted-foreground">
          {friendCount > 0
            ? `Du hast ${friendCount} ${friendCount === 1 ? "Freund" : "Freunde"} – plant gemeinsam`
            : "Freunde einladen & gemeinsam entdecken"}
        </p>
      </div>
      <Link href="/friends">
        <button className="text-xs font-bold px-4 py-2 rounded-2xl bg-primary text-white shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors">
          Freunde verwalten
        </button>
      </Link>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface GroupSuggestionsSectionProps {
  email: string;
  friendCount: number;
}

export function GroupSuggestionsSection({ email, friendCount }: GroupSuggestionsSectionProps) {
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["group-suggestions", email],
    queryFn: () => getGroupSuggestions(email),
    enabled: !!email,
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (!email) return null;
  if (!isLoading && suggestions.length === 0 && friendCount === 0) return null;

  return (
    <section className="py-8 px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-r from-accent/5 via-primary/3 to-transparent pointer-events-none" />
      <div className="container mx-auto max-w-6xl relative z-10">

        {/* Header */}
        <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              {/* Live pulse */}
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-accent" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-accent to-rose-500 flex items-center justify-center shadow-md shadow-accent/25">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl font-extrabold tracking-tight">Vorschläge für dich</h2>
            </div>
            <p className="text-xs text-muted-foreground">Basierend auf Freunden & Aktivitäten in deiner Nähe</p>
          </div>
          <Link href="/friends" className="text-xs font-bold text-primary bg-primary/8 hover:bg-primary/15 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
            Alle Freunde <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="flex gap-4 overflow-x-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="shrink-0 w-72 h-48 rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x -mx-4 px-4">
            {suggestions.map((sg, i) => (
              <SuggestionCard key={i} sg={sg} />
            ))}
            <PlanTogetherCard friendCount={friendCount} />
          </div>
        )}
      </div>
    </section>
  );
}
