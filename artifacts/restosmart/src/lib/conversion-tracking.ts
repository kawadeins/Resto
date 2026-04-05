const firedThisSession = new Set<string>();

function getSessionId(): string {
  const key = "rs_conv_session";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `s_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

function getApiBase(): string {
  return (import.meta.env?.VITE_API_URL as string | undefined) ?? "";
}

export type ConversionEventType =
  | "premium_gate_viewed"
  | "trial_expired_viewed"
  | "premium_page_opened"
  | "trial_started"
  | "dashboard_accessed"
  | "analytics_locked_viewed"
  | "marketing_tools_viewed"
  | "trial_banner_viewed"
  | "trial_conversion_banner_viewed"
  | "upgrade_cta_clicked"
  | "checkout_started"
  | "payment_completed"
  | string;

export interface TrackOptions {
  ctaLabel?: string;
  messageLabel?: string;
  city?: string;
  businessType?: string;
  metadata?: Record<string, unknown>;
  dedup?: boolean;
}

export function track(event: ConversionEventType, opts: TrackOptions = {}): void {
  if (typeof window === "undefined") return;

  const dedupKey = `${event}:${opts.ctaLabel ?? ""}:${opts.messageLabel ?? ""}`;
  if (opts.dedup !== false) {
    if (firedThisSession.has(dedupKey)) return;
    firedThisSession.add(dedupKey);
  }

  const biz =
    opts.businessType ??
    localStorage.getItem("restosmart_owner_business_type") ??
    "restaurant";

  const body = {
    eventType: event,
    businessType: biz,
    restaurantId: 1,
    city: opts.city ?? "Wien",
    sessionId: getSessionId(),
    ctaLabel: opts.ctaLabel ?? null,
    messageLabel: opts.messageLabel ?? null,
    metadata: opts.metadata ?? {},
  };

  fetch(`${getApiBase()}/api/conversion/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}
