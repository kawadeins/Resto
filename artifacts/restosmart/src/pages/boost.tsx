/**
 * Boost & Sichtbarkeit — dedicated page for promotion tools and visibility management.
 * Premium-only. Shows PromotionTools (launch/pause/budget) + PromotionPerformance (ROI).
 */

import { useEffect } from "react";
import { track } from "@/lib/conversion-tracking";
import { PromotionTools } from "@/components/promotion-tools";
import { PromotionPerformance } from "@/components/promotion-performance";
import { BoostROIPanel } from "@/components/boost-roi-panel";
import { SmartBoostRecommendations } from "@/components/smart-boost-recommendations";
import { TrialConversionBanner } from "@/components/layout";
import { getBizType } from "@/lib/biz-copy";
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

      {/* ── Page header ── */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-500/20 shrink-0 mt-0.5">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Sichtbarkeit & Boost
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            {subline[biz] ?? subline.restaurant}
          </p>
        </div>
      </div>

      <SmartBoostRecommendations />
      <PromotionTools />
      <PromotionPerformance />
      <BoostROIPanel />
    </div>
  );
}
