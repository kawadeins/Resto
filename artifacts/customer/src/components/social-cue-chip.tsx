/**
 * SocialCueChip — "👥 2 Freunde waren hier"
 * Shown on restaurant cards when friends have social activity at that restaurant.
 */
import { Users } from "lucide-react";
import { useSocialCues } from "@/contexts/social-context";

interface SocialCueChipProps {
  restaurantId: number;
  variant?: "card" | "detail";
}

export function SocialCueChip({ restaurantId, variant = "card" }: SocialCueChipProps) {
  const { cues } = useSocialCues();
  const cue = cues[String(restaurantId)];
  if (!cue || cue.count === 0) return null;

  const label = cue.count === 1
    ? `${cue.names[0]} war hier`
    : cue.count === 2
    ? `${cue.names[0]} & ${cue.names[1]} waren hier`
    : `${cue.count} Freunde waren hier`;

  if (variant === "detail") {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-primary/8 border border-primary/20">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/15">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-xs font-bold text-primary">Beliebt bei Freunden</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
      <Users className="w-3 h-3" />
      {label}
    </span>
  );
}
