/**
 * Instant Plans API client
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const BASE = `${API_BASE}/api/instant-plans`;

export interface InstantPlan {
  id: number;
  creatorEmail: string;
  restaurantId: number | null;
  restaurantName: string | null;
  restaurantEmoji: string | null;
  restaurantAddress: string | null;
  mode: string;
  suggestedTime: string | null;
  status: string;
  invitedEmails: string[];
  joinedEmails: string[];
  declinedEmails: string[];
  data: Record<string, any>;
  createdAt: string;
  expiresAt: string | null;
  restaurant?: any;
  isCreator?: boolean;
  hasJoined?: boolean;
  hasDeclined?: boolean;
}

export async function createInstantPlan(payload: {
  creatorEmail: string;
  restaurantId?: number;
  restaurantName?: string;
  restaurantEmoji?: string;
  restaurantAddress?: string;
  mode: string;
  suggestedTime?: string;
  invitedEmails?: string[];
  data?: Record<string, any>;
}): Promise<InstantPlan> {
  const r = await fetch(`${BASE}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getActivePlans(email: string): Promise<InstantPlan[]> {
  const r = await fetch(`${BASE}/active/${encodeURIComponent(email)}`);
  if (!r.ok) return [];
  return r.json();
}

export async function getIncomingPlans(email: string): Promise<InstantPlan[]> {
  const r = await fetch(`${BASE}/incoming/${encodeURIComponent(email)}`);
  if (!r.ok) return [];
  return r.json();
}

export async function getPlan(id: number): Promise<InstantPlan | null> {
  const r = await fetch(`${BASE}/${id}`);
  if (!r.ok) return null;
  return r.json();
}

export async function respondToPlan(id: number, email: string, response: "join" | "decline"): Promise<InstantPlan> {
  const r = await fetch(`${BASE}/${id}/respond`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, response }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function cancelPlan(id: number, email: string): Promise<void> {
  await fetch(`${BASE}/${id}/cancel`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

// ─── Plan mode labels ─────────────────────────────────────────────────────────

const MODE_LABELS: Record<string, { label: string; emoji: string; gradient: string }> = {
  quick_coffee: { label: "Schneller Kaffee",           emoji: "☕", gradient: "from-amber-500 to-orange-500" },
  lunch_plan:   { label: "Mittagessen",                emoji: "🍽️", gradient: "from-orange-500 to-rose-500"  },
  group_dinner: { label: "Gemeinsames Abendessen",     emoji: "🥂", gradient: "from-violet-500 to-purple-600" },
  night_out:    { label: "Abend ausgehen",             emoji: "🌙", gradient: "from-indigo-500 to-violet-600" },
  trending_spot:{ label: "Trendiger Spot",             emoji: "🔥", gradient: "from-rose-500 to-pink-600"    },
};

export function getModeLabel(mode: string) {
  return MODE_LABELS[mode] ?? { label: mode, emoji: "✨", gradient: "from-primary to-accent" };
}

export function countdownLabel(expiresAt: string | null): string {
  if (!expiresAt) return "";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Abgelaufen";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} Min.`;
}
