export type AvailabilityStatus = "available" | "limited" | "nearly_full" | "full" | "closed" | "paused";

export interface SlotInfo {
  time: string;
  status: AvailabilityStatus;
  bookedGuests: number;
  seatingCapacity: number;
  availableSeats: number;
  percentage: number;
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function slotStatus(booked: number, capacity: number): AvailabilityStatus {
  if (capacity <= 0) return "available";
  const ratio = booked / capacity;
  if (ratio >= 0.9) return "full";
  if (ratio >= 0.75) return "nearly_full";
  if (ratio >= 0.5) return "limited";
  return "available";
}

export function buildSlots(
  openTime: string,
  closeTime: string,
  slotDuration: number,
  seatingCapacity: number,
  reservations: Array<{ time: string; partySize: number; status: string }>
): SlotInfo[] {
  const openMins = timeToMins(openTime);
  const closeMins = timeToMins(closeTime) || 24 * 60; // midnight = 24:00
  const slots: SlotInfo[] = [];

  let cur = openMins;
  while (cur + 30 <= closeMins) {
    const slotEnd = cur + slotDuration;

    const bookedGuests = reservations
      .filter((r) => ["pending", "confirmed", "seated"].includes(r.status))
      .filter((r) => {
        const rs = timeToMins(r.time);
        const re = rs + slotDuration;
        return rs < slotEnd && re > cur;
      })
      .reduce((s, r) => s + r.partySize, 0);

    const hh = String(Math.floor(cur / 60)).padStart(2, "0");
    const mm = String(cur % 60).padStart(2, "0");

    slots.push({
      time: `${hh}:${mm}`,
      status: slotStatus(bookedGuests, seatingCapacity),
      bookedGuests,
      seatingCapacity,
      availableSeats: Math.max(0, seatingCapacity - bookedGuests),
      percentage: seatingCapacity > 0 ? Math.round((bookedGuests / seatingCapacity) * 100) : 0,
    });

    cur += 30;
  }

  return slots;
}

export function computeLiveAvailability(
  restaurant: {
    isOpenNow: boolean;
    seatingCapacity: number;
    slotDurationMinutes: number;
    availabilityPaused: boolean;
    availabilityPausedUntil: Date | null;
    openTime: string;
    closeTime: string;
  },
  todayReservations: Array<{ time: string; partySize: number; status: string }>
): { status: AvailabilityStatus; availableSeats: number; nextAvailableSlot: string | null } {
  if (restaurant.availabilityPaused) {
    const until = restaurant.availabilityPausedUntil;
    if (!until || until > new Date()) {
      return { status: "paused", availableSeats: 0, nextAvailableSlot: null };
    }
  }

  if (!restaurant.isOpenNow) {
    return { status: "closed", availableSeats: 0, nextAvailableSlot: null };
  }

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const dur = restaurant.slotDurationMinutes || 90;
  const capacity = restaurant.seatingCapacity || 80;

  const active = todayReservations.filter((r) =>
    ["pending", "confirmed", "seated"].includes(r.status)
  );

  const currentBooked = active
    .filter((r) => {
      const rs = timeToMins(r.time);
      const re = rs + dur;
      return rs <= nowMins && re > nowMins;
    })
    .reduce((s, r) => s + r.partySize, 0);

  const status = slotStatus(currentBooked, capacity);
  const availableSeats = Math.max(0, capacity - currentBooked);

  // Find next available slot (next 30-min boundary with availability)
  let nextAvailableSlot: string | null = null;
  if (status === "full") {
    const slots = buildSlots(restaurant.openTime, restaurant.closeTime, dur, capacity, todayReservations);
    const nextSlot = slots.find((s) => {
      const sm = timeToMins(s.time);
      return sm > nowMins && s.status !== "full";
    });
    if (nextSlot) nextAvailableSlot = nextSlot.time;
  }

  return { status, availableSeats, nextAvailableSlot };
}
