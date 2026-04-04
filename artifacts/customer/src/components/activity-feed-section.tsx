/**
 * ActivityFeedSection — social feed for the homepage.
 * Shows recent activity from friends in a clean, non-spammy strip.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, ArrowRight, Sparkles } from "lucide-react";
import { getActivityFeed, activityLabel, timeAgo, nameInitials, type SocialActivity } from "@/lib/social-api";
import { Skeleton } from "@/components/ui/skeleton";

function Avatar({ name, photoUrl, size = 8 }: { name: string; photoUrl: string | null; size?: number }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`w-${size} h-${size} rounded-full object-cover shrink-0 ring-2 ring-background`}
      />
    );
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 ring-2 ring-background`}>
      <span className="text-white font-bold text-[10px]">{nameInitials(name)}</span>
    </div>
  );
}

function ActivityCard({ activity }: { activity: SocialActivity }) {
  const { icon, verb } = activityLabel(activity.activityType);
  const hasRestaurant = activity.restaurantId && activity.restaurantName;
  const content = (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/20 hover:shadow-md transition-all duration-200 min-w-[280px] max-w-[320px] shrink-0 snap-start">
      <Avatar name={activity.authorName} photoUrl={activity.authorPhoto} size={9} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="font-bold text-sm leading-tight block truncate">{activity.authorName}</span>
            <span className="text-xs text-muted-foreground leading-snug">{verb}</span>
          </div>
          <span className="text-[10px] text-muted-foreground/70 shrink-0 mt-0.5">{timeAgo(activity.createdAt)}</span>
        </div>
        {hasRestaurant && (
          <div className="mt-2 flex items-center gap-1.5 bg-muted/60 rounded-xl px-2.5 py-1.5">
            <span className="text-base leading-none">{activity.restaurantEmoji ?? "🍽️"}</span>
            <span className="text-xs font-semibold truncate">{activity.restaurantName}</span>
          </div>
        )}
        {activity.activityType === "achievement" && activity.data?.title && (
          <div className="mt-2 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
            <span className="text-base leading-none">{activity.data?.icon ?? "🏆"}</span>
            <span className="text-xs font-semibold text-amber-800 truncate">{activity.data.title}</span>
          </div>
        )}
        {activity.activityType === "streak_milestone" && activity.data?.streak && (
          <div className="mt-2 flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-xl px-2.5 py-1.5">
            <span className="text-base leading-none">🔥</span>
            <span className="text-xs font-semibold text-orange-800">{activity.data.streak}-Tage-Serie!</span>
          </div>
        )}
        <div className="mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-muted/50 text-muted-foreground">
          {icon}
        </div>
      </div>
    </div>
  );

  if (hasRestaurant) {
    return <Link href={`/restaurant/${activity.restaurantId}`}>{content}</Link>;
  }
  return content;
}

function EmptyState({ friendCount }: { friendCount: number }) {
  if (friendCount === 0) {
    return (
      <div className="flex items-center gap-4 p-5 rounded-2xl border border-dashed border-border/50 bg-muted/20">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center text-2xl shrink-0">👥</div>
        <div>
          <p className="text-sm font-bold mb-0.5">Noch keine Freunde</p>
          <p className="text-xs text-muted-foreground">Verbinde dich mit Freunden, um ihren Aktivitäten zu folgen.</p>
        </div>
        <Link href="/friends" className="shrink-0 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/15 px-3 py-2 rounded-full transition-colors">
          Freunde finden
        </Link>
      </div>
    );
  }
  return (
    <div className="text-center py-8 text-sm text-muted-foreground">
      Deine Freunde sind noch nicht aktiv. Komm später wieder!
    </div>
  );
}

interface ActivityFeedSectionProps {
  email: string;
  friendCount: number;
}

export function ActivityFeedSection({ email, friendCount }: ActivityFeedSectionProps) {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["social-feed", email],
    queryFn: () => getActivityFeed(email, 12),
    enabled: !!email,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (!email) return null;
  if (!isLoading && (!activities || activities.length === 0) && friendCount === 0) return null;

  return (
    <section className="py-8 px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/3 to-transparent pointer-events-none" />
      <div className="container mx-auto max-w-6xl relative z-10">

        <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/25">
                <Users className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl font-extrabold tracking-tight">Was Freunde machen</h2>
              {friendCount > 0 && (
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                  {friendCount} {friendCount === 1 ? "Freund" : "Freunde"}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Entdecke, was deine Freunde erleben</p>
          </div>
          <Link href="/friends" className="press-scale text-sm font-bold text-primary bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
            Freunde <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="flex gap-4 overflow-x-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="shrink-0 w-72">
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ))}
          </div>
        ) : activities && activities.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x -mx-4 px-4">
            {activities.map(a => <ActivityCard key={a.id} activity={a} />)}
          </div>
        ) : (
          <EmptyState friendCount={friendCount} />
        )}
      </div>
    </section>
  );
}
