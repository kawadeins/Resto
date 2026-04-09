/**
 * Sichtbarkeit & Boost — now powered by the unified Campaign Command Center.
 */

import { useEffect } from "react";
import { track } from "@/lib/conversion-tracking";
import { CampaignCommandCenter } from "@/components/campaign-command-center";
import { TrialConversionBanner } from "@/components/layout";

export default function Boost() {
  const isTrial = typeof window !== "undefined" && localStorage.getItem("restosmart_owner_premium") === "trial";
  useEffect(() => { track("boost_page_opened"); }, []);

  return (
    <div className="space-y-0 pb-10">
      {isTrial && <TrialConversionBanner context="marketing" />}
      <CampaignCommandCenter />
    </div>
  );
}
