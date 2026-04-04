/**
 * LiveBadge — displays a live activity signal chip on restaurant cards/headers.
 * Keeps it elegant: one badge max per card, pulse animation for hot/trending.
 */
import type { LiveBadge as LiveBadgeType } from "@/lib/live-activity";

interface LiveBadgeProps {
  badge: LiveBadgeType;
  size?: "sm" | "md";
}

export function LiveBadge({ badge, size = "sm" }: LiveBadgeProps) {
  const sizeCls = size === "md"
    ? "text-xs font-bold px-3 py-1.5 gap-1.5"
    : "text-[10px] font-bold px-2.5 py-1 gap-1";

  return (
    <span
      className={`inline-flex items-center rounded-full border ${sizeCls} ${badge.cls} ${badge.pulse ? "animate-pulse" : ""}`}
      aria-label={badge.text}
    >
      <span className="leading-none">{badge.icon}</span>
      {badge.text}
    </span>
  );
}

/**
 * LivePulse — small pulsing dot for "LIVE" indicator in section headers
 */
export function LivePulse({ cls = "bg-rose-500" }: { cls?: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cls}`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${cls}`} />
    </span>
  );
}
