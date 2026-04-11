import { UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

interface RestoLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
  textClassName?: string;
  inverted?: boolean;
}

/**
 * RestoSmart brand logo — single source of truth for the customer app.
 *
 * Icon:  fork + knife (UtensilsCrossed) inside a purple→pink gradient circle.
 * Text:  "Resto" in purple gradient · "Smart" in current foreground color.
 */
export function RestoLogo({
  size = "md",
  showText = true,
  className,
  textClassName,
  inverted = false,
}: RestoLogoProps) {
  const iconSizes = { sm: "w-6 h-6", md: "w-8 h-8", lg: "w-11 h-11", xl: "w-20 h-20" };
  const innerSizes = { sm: "w-3 h-3", md: "w-4 h-4", lg: "w-5.5 h-5.5", xl: "w-9 h-9" };
  const radiusSizes = { sm: "rounded-lg", md: "rounded-xl", lg: "rounded-2xl", xl: "rounded-3xl" };
  const textSizes = { sm: "text-base", md: "text-xl", lg: "text-2xl", xl: "text-3xl" };

  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <div
        className={cn(
          iconSizes[size],
          radiusSizes[size],
          "bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30 shrink-0",
        )}
      >
        <UtensilsCrossed className={cn(innerSizes[size], "text-white")} />
      </div>
      {showText && (
        <span className={cn("font-bold tracking-tight leading-none", textSizes[size], textClassName)}>
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Resto
          </span>
          <span className={inverted ? "text-white" : "text-foreground"}>Smart</span>
        </span>
      )}
    </div>
  );
}
