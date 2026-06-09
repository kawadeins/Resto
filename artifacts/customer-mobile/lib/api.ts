import axios from "axios";
import * as SecureStore from "expo-secure-store";

// In dev, point to your local API server. In production, use your deployed URL.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Attach session token from SecureStore on every request
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync("session_token");
    if (token) config.headers["x-session-token"] = token;
  } catch {}
  return config;
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function requestCustomerOtp(email: string) {
  const res = await api.post("/auth/customer-otp-request", { email });
  return res.data as { sent: boolean; devCode?: string };
}

export async function verifyCustomerOtp(email: string, code: string) {
  const res = await api.post("/auth/customer-otp-verify", { email, code });
  return res.data as { customerEmail: string };
}

export async function getCustomerSession() {
  const res = await api.get("/auth/customer-session");
  return res.data as { authenticated: boolean; customerEmail?: string };
}

export async function logoutCustomer() {
  await api.post("/auth/customer-logout");
}

// ─── Marketplace ──────────────────────────────────────────────────────────────

export interface Restaurant {
  id: number;
  name: string;
  cuisine: string;
  cuisineEmoji: string;
  city: string;
  address: string;
  rating: string;
  reviewCount: number;
  priceRange: string;
  heroImage: string;
  description: string;
  isPartner: boolean;
  isFeatured: boolean;
  businessType: string;
  openingHours: string;
  phone: string;
  latitude: number;
  longitude: number;
}

export interface FlashDeal {
  id: number;
  restaurantId: number;
  restaurantName: string;
  discount: number;
  expiresAt: string;
  heroImage: string;
  originalPrice: number;
  dealPrice: number;
}

export async function getRestaurants(params?: {
  cuisine?: string;
  priceRange?: string;
  minRating?: number;
  search?: string;
}) {
  const res = await api.get("/marketplace/restaurants", { params });
  return res.data as Restaurant[];
}

export async function getRestaurant(id: number) {
  const res = await api.get(`/marketplace/restaurants/${id}`);
  return res.data as Restaurant;
}

export async function getFlashDeals() {
  const res = await api.get("/marketplace/flash-deals");
  return res.data as FlashDeal[];
}

export async function getPersonalizedOffers(email: string) {
  const res = await api.get("/marketplace/personalized-offers", { params: { email } });
  return res.data as Restaurant[];
}

export async function getAvailableSlots(restaurantId: number, date: string) {
  const res = await api.get("/availability/slots", { params: { restaurantId, date } });
  return res.data as { slots: string[] };
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export interface Booking {
  id: number;
  restaurantId: number;
  restaurantName: string;
  restaurantImage: string;
  date: string;
  time: string;
  partySize: number;
  status: "pending" | "confirmed" | "cancelled" | "arrived";
  notes: string | null;
  customerName: string;
  customerEmail: string;
}

export async function createBooking(data: {
  restaurantId: number;
  date: string;
  time: string;
  partySize: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: string;
}) {
  const res = await api.post("/marketplace/bookings", data);
  return res.data as Booking;
}

export async function getMyBookings(email: string) {
  const res = await api.get("/marketplace/bookings", { params: { email } });
  return res.data as Booking[];
}

export async function cancelBooking(id: number) {
  const res = await api.patch(`/marketplace/bookings/${id}/cancel`);
  return res.data;
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export interface Review {
  id: number;
  restaurantId: number;
  customerName: string;
  customerEmail: string;
  rating: number;
  comment: string;
  createdAt: string;
  ownerReply?: string;
}

export async function getReviews(restaurantId: number) {
  const res = await api.get("/reviews", { params: { restaurantId } });
  return res.data as Review[];
}

export async function createReview(data: {
  restaurantId: number;
  rating: number;
  comment: string;
  customerName: string;
  customerEmail: string;
}) {
  const res = await api.post("/reviews", data);
  return res.data as Review;
}

// ─── Loyalty ─────────────────────────────────────────────────────────────────

export interface LoyaltyProfile {
  customerEmail: string;
  points: number;
  totalEarned: number;
  tier: "Bronze" | "Silver" | "Gold" | "Elite";
  nextTier?: string;
  nextTierPoints?: number;
}

export async function getLoyalty(email: string) {
  const res = await api.get("/loyalty", { params: { email } });
  return res.data as LoyaltyProfile;
}

// ─── Customer Profile ─────────────────────────────────────────────────────────

export interface CustomerProfile {
  email: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  isPrivate: boolean;
  visitCount: number;
  reviewCount: number;
  friendCount: number;
}

export async function getCustomerProfile(email: string) {
  const res = await api.get("/customer-profile", { params: { email } });
  return res.data as CustomerProfile;
}

export async function updateCustomerProfile(email: string, data: Partial<CustomerProfile>) {
  const res = await api.patch("/customer-profile", { email, ...data });
  return res.data as CustomerProfile;
}

// ─── Social ──────────────────────────────────────────────────────────────────

export interface Friend {
  id: number;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  status: "pending" | "accepted";
  isRequester: boolean;
}

export async function getFriends(email: string) {
  const res = await api.get("/social/friends", { params: { email } });
  return res.data as Friend[];
}

export async function sendFriendRequest(fromEmail: string, toEmail: string) {
  const res = await api.post("/social/friends/request", { fromEmail, toEmail });
  return res.data;
}

export async function respondToFriendRequest(id: number, action: "accept" | "decline") {
  const res = await api.patch(`/social/friends/${id}`, { action });
  return res.data;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface Conversation {
  id: number;
  name?: string;
  isGroup: boolean;
  participants: { email: string; displayName?: string; avatarUrl?: string }[];
  lastMessage?: { content: string; senderEmail: string; createdAt: string };
  unreadCount: number;
}

export interface Message {
  id: number;
  conversationId: number;
  senderEmail: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

export async function getConversations(email: string) {
  const res = await api.get("/messages/conversations", { params: { email } });
  return res.data as Conversation[];
}

export async function getMessages(conversationId: number, email: string) {
  const res = await api.get(`/messages/conversations/${conversationId}`, { params: { email } });
  return res.data as Message[];
}

export async function sendMessage(conversationId: number, senderEmail: string, content: string) {
  const res = await api.post(`/messages/conversations/${conversationId}`, { senderEmail, content });
  return res.data as Message;
}

// ─── Meal Plans ───────────────────────────────────────────────────────────────

export interface MealPlan {
  id: number;
  name: string;
  days: {
    day: string;
    meals: { type: string; restaurantId: number; restaurantName: string; suggestion: string }[];
  }[];
}

export async function getMealPlans(email: string) {
  const res = await api.get("/meal-plan", { params: { email } });
  return res.data as MealPlan[];
}
