/**
 * Social API client helpers — friends, activities, radar, group suggestions
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const SOCIAL = `${API_BASE}/api/social`;

// ─── Privacy ──────────────────────────────────────────────────────────────────

const PRIVACY_KEY = "restosmart_social_privacy";
export type Visibility = "public" | "friends" | "private";

export function getSocialPrivacy(): Visibility {
  return (localStorage.getItem(PRIVACY_KEY) as Visibility) ?? "friends";
}
export function setSocialPrivacy(v: Visibility) {
  localStorage.setItem(PRIVACY_KEY, v);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FriendProfile {
  email: string;
  name: string;
  photoUrl: string | null;
}

export interface FriendRequest {
  id: number;
  requesterEmail: string;
  recipientEmail: string;
  status: string;
  createdAt: string;
  requesterName?: string;
  requesterPhoto?: string | null;
  recipientName?: string;
  recipientPhoto?: string | null;
}

export interface FriendRequests {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

export interface SocialActivity {
  id: number;
  userEmail: string;
  activityType: string;
  restaurantId: number | null;
  restaurantName: string | null;
  restaurantEmoji: string | null;
  data: Record<string, any>;
  visibility: Visibility;
  createdAt: string;
  authorName: string;
  authorPhoto: string | null;
}

export interface SocialCue {
  count: number;
  names: string[];
}

// ─── Friend Radar ─────────────────────────────────────────────────────────────

export interface RadarZone {
  restaurantId: number;
  restaurantName: string;
  restaurantEmoji: string;
  friendCount: number;
  friendNames: string[];
  activityTypes: string[];
  lastSeen: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
}

// ─── Group Suggestions ────────────────────────────────────────────────────────

export interface GroupSuggestion {
  type: "friends_active" | "group_plan" | "time_context";
  restaurantId?: number;
  restaurantName?: string;
  restaurantEmoji?: string;
  friendNames?: string[];
  title: string;
  cta: string;
  ctaButton: string;
  urgency: "high" | "medium" | "low";
  icon?: string;
  link?: string;
}

// ─── Friends ──────────────────────────────────────────────────────────────────

export async function getFriends(email: string): Promise<FriendProfile[]> {
  const r = await fetch(`${SOCIAL}/friends/${encodeURIComponent(email)}`);
  if (!r.ok) return [];
  return r.json();
}

export async function getFriendRequests(email: string): Promise<FriendRequests> {
  const r = await fetch(`${SOCIAL}/requests/${encodeURIComponent(email)}`);
  if (!r.ok) return { incoming: [], outgoing: [] };
  return r.json();
}

export async function sendFriendRequest(requesterEmail: string, recipientEmail: string) {
  const r = await fetch(`${SOCIAL}/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requesterEmail, recipientEmail }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function respondToRequest(id: number, status: "accepted" | "rejected") {
  const r = await fetch(`${SOCIAL}/request/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function removeFriend(userEmail: string, friendEmail: string) {
  const r = await fetch(`${SOCIAL}/friend-by-email`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userEmail, friendEmail }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ─── Activity feed ────────────────────────────────────────────────────────────

export async function getActivityFeed(email: string, limit = 20): Promise<SocialActivity[]> {
  const r = await fetch(`${SOCIAL}/feed/${encodeURIComponent(email)}?limit=${limit}`);
  if (!r.ok) return [];
  return r.json();
}

export async function postActivity(payload: {
  userEmail: string;
  activityType: string;
  restaurantId?: number;
  restaurantName?: string;
  restaurantEmoji?: string;
  data?: Record<string, any>;
  visibility?: Visibility;
}) {
  const visibility = payload.visibility ?? getSocialPrivacy();
  if (visibility === "private") return null; // respect privacy setting
  const r = await fetch(`${SOCIAL}/activity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, visibility }),
  });
  if (!r.ok) return null;
  return r.json();
}

// ─── Social cues ──────────────────────────────────────────────────────────────

export async function getSocialCues(email: string): Promise<Record<string, SocialCue>> {
  const r = await fetch(`${SOCIAL}/cues/${encodeURIComponent(email)}`);
  if (!r.ok) return {};
  return r.json();
}

// ─── Friend Radar ─────────────────────────────────────────────────────────────

export async function getFriendRadar(email: string): Promise<RadarZone[]> {
  const r = await fetch(`${SOCIAL}/radar/${encodeURIComponent(email)}`);
  if (!r.ok) return [];
  return r.json();
}

// ─── Group Suggestions ────────────────────────────────────────────────────────

export async function getGroupSuggestions(email: string): Promise<GroupSuggestion[]> {
  const r = await fetch(`${SOCIAL}/group-suggestions/${encodeURIComponent(email)}`);
  if (!r.ok) return [];
  return r.json();
}

// ─── Activity label helpers ───────────────────────────────────────────────────

export function activityLabel(type: string): { icon: string; verb: string } {
  const map: Record<string, { icon: string; verb: string }> = {
    booking:          { icon: "📅", verb: "hat reserviert bei" },
    review:           { icon: "⭐", verb: "hat bewertet:" },
    favorite:         { icon: "❤️", verb: "hat als Favorit gespeichert:" },
    check_in:         { icon: "📍", verb: "war bei" },
    achievement:      { icon: "🏆", verb: "hat freigeschaltet:" },
    streak_milestone: { icon: "🔥", verb: "hat erreicht:" },
    meal_plan:        { icon: "📋", verb: "hat einen Speiseplan erstellt" },
    explore:          { icon: "🧭", verb: "hat entdeckt:" },
    group_plan:       { icon: "👥", verb: "plant einen Ausflug zu" },
  };
  return map[type] ?? { icon: "✨", verb: "war aktiv" };
}

export function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  return new Date(isoDate).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

export function nameInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
