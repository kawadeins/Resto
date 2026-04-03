import { haversineKm } from "@/hooks/use-geolocation";
import type { MarketplaceRestaurant, MarketplaceFlashDeal } from "@workspace/api-client-react";

export interface ScoredRestaurant {
  restaurant: MarketplaceRestaurant;
  distance: number;
  score: number;
  isWeakHour: boolean;
  minutesUntilClose: number | null;
  flashMinutesLeft: number | null;
  flashDeal: MarketplaceFlashDeal | null;
}

function parseTimeMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function nowMins(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

export function checkWeakHour(openTime: string, closeTime: string): boolean {
  const now = nowMins();
  const open = parseTimeMins(openTime);
  const close = parseTimeMins(closeTime);
  if (now < open || now > close) return false;
  const minsOpen = now - open;
  const minsUntilClose = close - now;
  return minsOpen < 120 || minsUntilClose < 120;
}

export function computeHyperLocalScore(
  restaurant: MarketplaceRestaurant,
  userLat: number,
  userLng: number,
  flashDeal: MarketplaceFlashDeal | null = null
): ScoredRestaurant {
  const distance = haversineKm(
    userLat,
    userLng,
    restaurant.lat ?? 51.5074,
    restaurant.lng ?? -0.1278
  );

  const distScore = (1 / (distance + 0.1)) * 4;
  const openScore = restaurant.isOpenNow ? 3 : 0;
  const dealScore = restaurant.hasActiveFlash ? 2 : 0;
  const ratingScore = ((restaurant.rating ?? 0) / 5) * 1.5;

  const isWeakHour =
    restaurant.isOpenNow && restaurant.openTime && restaurant.closeTime
      ? checkWeakHour(restaurant.openTime, restaurant.closeTime)
      : false;
  const weakHourScore = isWeakHour ? 1.5 : 0;

  const score = distScore + openScore + dealScore + ratingScore + weakHourScore;

  const flashMinutesLeft =
    flashDeal?.flashExpiresAt
      ? Math.max(0, Math.round((new Date(flashDeal.flashExpiresAt).getTime() - Date.now()) / 60000))
      : null;

  let minutesUntilClose: number | null = null;
  if (restaurant.isOpenNow && restaurant.closeTime) {
    const close = parseTimeMins(restaurant.closeTime);
    minutesUntilClose = close - nowMins();
  }

  return {
    restaurant,
    distance,
    score,
    isWeakHour,
    minutesUntilClose,
    flashMinutesLeft,
    flashDeal,
  };
}

export function rankHyperLocal(
  restaurants: MarketplaceRestaurant[],
  userLat: number,
  userLng: number,
  flashDeals: MarketplaceFlashDeal[] = [],
  radiusKm = 10
): ScoredRestaurant[] {
  const flashByRestaurantId = new Map<number, MarketplaceFlashDeal>();
  for (const deal of flashDeals) {
    if (deal.restaurant?.id != null) {
      flashByRestaurantId.set(deal.restaurant.id, deal);
    }
  }

  return restaurants
    .map((r) =>
      computeHyperLocalScore(r, userLat, userLng, flashByRestaurantId.get(r.id) ?? null)
    )
    .filter((sr) => sr.distance <= radiusKm)
    .sort((a, b) => b.score - a.score);
}

export function urgencyLabel(
  flashMinutesLeft: number | null,
  isWeakHour: boolean,
  minutesUntilClose: number | null
): { text: string; level: "critical" | "high" | "medium" | "low" } | null {
  if (flashMinutesLeft !== null) {
    if (flashMinutesLeft <= 30) {
      return { text: `Ends in ${flashMinutesLeft}m`, level: "critical" };
    }
    if (flashMinutesLeft <= 120) {
      return { text: `${Math.floor(flashMinutesLeft / 60)}h ${flashMinutesLeft % 60}m left`, level: "high" };
    }
    return { text: "Flash Deal Active", level: "medium" };
  }
  if (isWeakHour && minutesUntilClose !== null && minutesUntilClose <= 120) {
    return { text: `Closes in ${minutesUntilClose}m · Great tables now`, level: "low" };
  }
  if (isWeakHour) {
    return { text: "Great tables available now", level: "low" };
  }
  return null;
}
