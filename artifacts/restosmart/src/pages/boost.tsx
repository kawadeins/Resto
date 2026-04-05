/**
 * Boost & Sichtbarkeit — dedicated page for promotion tools and visibility management.
 * Premium-only. Shows PromotionTools (launch/pause/budget) + PromotionPerformance (ROI).
 */

import { useEffect } from "react";
import { track } from "@/lib/conversion-tracking";
import { PromotionTools } from "@/components/promotion-tools";
import { PromotionPerformance } from "@/components/promotion-performance";
import { TrialConversionBanner } from "@/components/layout";
import { getBizType, BIZ_LABEL } from "@/lib/biz-copy";
import { Zap } from "lucide-react";

export default function Boost() {
  const biz = getBizType();
  const isTrial = typeof window !== "undefined" && localStorage.getItem("restosmart_owner_premium") === "trial";

  useEffect(() => { track("boost_page_opened"); }, []);

  const subline: Record<string, string> = {
    restaurant: "Sichtbarkeit zur Mittags- und Abendzeit maximieren — mehr Gäste, mehr Buchungen.",
    cafe: "Mehr Gäste am Morgen und zur Kaffeepause — präzise Sichtbarkeit für Ihr Café.",
    bar: "Abend- und Happy-Hour-Sichtbarkeit maximieren — werden Sie die erste Wahl der Nacht.",
  };

  return (
    <div className="space-y-8 pb-10">
      {isTrial && <TrialConversionBanner context="marketing" />}

      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Zap className="w-7 h-7 text-amber-500" />
          Sichtbarkeit & Boost
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {subline[biz] ?? subline.restaurant}
        </p>
      </div>

      <PromotionTools />
      <PromotionPerformance />
    </div>
  );
}
