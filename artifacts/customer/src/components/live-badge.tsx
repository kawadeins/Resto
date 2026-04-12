/**
 * LiveBadge — displays a live activity signal chip on restaurant cards/headers.
 * Keeps it elegant: one badge max per card, with variant-specific animations.
 */
import type { LiveBadge as LiveBadgeType } from "@/lib/live-activity";

interface LiveBadgeProps {
  badge: LiveBadgeType;
  size?: "sm" | "md";
}

export function LiveBadge({ badge, size = "sm" }: LiveBadgeProps) {
  const sizeCls = size === "md"
    ? "text-[13px] font-extrabold px-3.5 py-2 gap-2"
    : "text-[12px] font-extrabold px-3 py-1.5 gap-1.5";

  const variantCls =
    badge.variant === "trending" ? "badge-shimmer" :
    badge.variant === "hot"      ? "animate-pulse" :
    "";

  const dotCls =
    badge.variant === "aktiv" ? "animate-ping inline-flex" : "inline-flex";

  return (
    <span
      className={`inline-flex items-center rounded-full border ${sizeCls} ${badge.cls} ${variantCls}`}
      aria-label={badge.text}
    >
      {badge.variant === "aktiv" ? (
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
      ) : (
        <span className="text-[15px] leading-none shrink-0">{badge.icon}</span>
      )}
      {badge.text}
    </span>
  );
}

/**
 * LivePulse — small pulsing dot for "LIVE" indicator in section headers
 */
export function LivePulse({ cls = "bg-rose-500" }: { cls?: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cls}`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cls}`} />
    </span>
  );
}
