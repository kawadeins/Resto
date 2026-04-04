/**
 * Habit Engine — localStorage-only, no DB changes
 *
 * Handles: streak tracking, daily missions, weekly challenges,
 * achievements, and habit-point accounting.
 *
 * All state is stored under restosmart_habit_data in localStorage.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type HabitEventType =
  | "app_open"
  | "explore_visit"
  | "offer_interact"
  | "meal_plan_visit"
  | "restaurant_view"
  | "booking_complete"
  | "review_submit"
  | "cuisine_filter"
  | "cafe_visit"
  | "bar_visit";

export type MissionFrequency = "daily" | "weekly";

export interface MissionDef {
  id: string;
  frequency: MissionFrequency;
  title: string;
  description: string;
  icon: string;
  eventType: HabitEventType;
  target: number;
  points: number;
  tags: string[];                // "cafe" | "nightlife" | "restaurant" | "food" | "social"
}

export interface MissionState {
  id: string;
  progress: number;
  target: number;
  completed: boolean;
  completedAt: string | null;
  claimedPoints: boolean;
  windowStart: string;           // ISO date string of window start
}

export interface Achievement {
  id: string;
  title: string;
  icon: string;
  description: string;
  unlockedAt: string | null;
}

export interface StreakData {
  currentStreak: number;
  bestStreak: number;
  lastActiveDateISO: string;
  totalDaysActive: number;
}

export interface HabitData {
  streak: StreakData;
  dailyMissionIds: string[];     // which 3 missions are active today
  weeklyMissionIds: string[];    // which 2 missions are active this week
  missionStates: Record<string, MissionState>;
  achievements: Achievement[];
  totalHabitPoints: number;
  lastMissionReset: { daily: string; weekly: string };
}

// ─── Storage key ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "restosmart_habit_data";

// ─── All mission definitions ──────────────────────────────────────────────────

export const ALL_MISSIONS: MissionDef[] = [
  // Daily
  {
    id: "open_app",
    frequency: "daily",
    title: "Heute aktiv",
    description: "Öffne die App heute",
    icon: "☀️",
    eventType: "app_open",
    target: 1,
    points: 5,
    tags: ["food"],
  },
  {
    id: "explore_today",
    frequency: "daily",
    title: "Entdecke ein Lokal",
    description: "Stöbere in der Entdecken-Seite",
    icon: "🧭",
    eventType: "explore_visit",
    target: 1,
    points: 10,
    tags: ["food", "restaurant", "cafe"],
  },
  {
    id: "view_smart_offer",
    frequency: "daily",
    title: "Smart-Angebot ansehen",
    description: "Interagiere mit einem personalisierten Angebot",
    icon: "✨",
    eventType: "offer_interact",
    target: 1,
    points: 10,
    tags: ["food", "restaurant"],
  },
  {
    id: "check_meal_plan",
    frequency: "daily",
    title: "Speiseplan prüfen",
    description: "Wirf einen Blick auf deinen Tagesplan",
    icon: "📋",
    eventType: "meal_plan_visit",
    target: 1,
    points: 10,
    tags: ["food"],
  },
  {
    id: "view_restaurant",
    frequency: "daily",
    title: "Restaurant entdecken",
    description: "Öffne eine Restaurant-Detailseite",
    icon: "🍽️",
    eventType: "restaurant_view",
    target: 1,
    points: 8,
    tags: ["restaurant", "food"],
  },
  {
    id: "visit_cafe",
    frequency: "daily",
    title: "Café erkunden",
    description: "Besuche ein Café in der App",
    icon: "☕",
    eventType: "cafe_visit",
    target: 1,
    points: 10,
    tags: ["cafe"],
  },
  {
    id: "visit_bar",
    frequency: "daily",
    title: "Bar entdecken",
    description: "Entdecke eine Bar oder ein Lokal",
    icon: "🍸",
    eventType: "bar_visit",
    target: 1,
    points: 10,
    tags: ["nightlife"],
  },

  // Weekly
  {
    id: "book_this_week",
    frequency: "weekly",
    title: "Buche diese Woche",
    description: "Schließe eine Tischreservierung ab",
    icon: "📅",
    eventType: "booking_complete",
    target: 1,
    points: 50,
    tags: ["restaurant", "social", "food"],
  },
  {
    id: "review_this_week",
    frequency: "weekly",
    title: "Bewertungen schreiben",
    description: "Bewerte 2 Lokale diese Woche",
    icon: "⭐",
    eventType: "review_submit",
    target: 2,
    points: 40,
    tags: ["food", "social"],
  },
  {
    id: "active_4_days",
    frequency: "weekly",
    title: "4 Tage aktiv",
    description: "Öffne die App an 4 verschiedenen Tagen",
    icon: "🔥",
    eventType: "app_open",
    target: 4,
    points: 30,
    tags: ["food"],
  },
  {
    id: "explore_2_cuisines",
    frequency: "weekly",
    title: "2 Küchen erkunden",
    description: "Filtere nach 2 verschiedenen Küchenstilen",
    icon: "🌍",
    eventType: "cuisine_filter",
    target: 2,
    points: 35,
    tags: ["food", "restaurant"],
  },
  {
    id: "cafe_week",
    frequency: "weekly",
    title: "Café-Woche",
    description: "Besuche 3 verschiedene Cafés",
    icon: "☕",
    eventType: "cafe_visit",
    target: 3,
    points: 40,
    tags: ["cafe"],
  },
  {
    id: "nightlife_week",
    frequency: "weekly",
    title: "Nachtleben entdecken",
    description: "Erkunde 2 Bars oder Nachtlokale",
    icon: "🌙",
    eventType: "bar_visit",
    target: 2,
    points: 40,
    tags: ["nightlife"],
  },
];

// ─── Achievement definitions ──────────────────────────────────────────────────

export const ALL_ACHIEVEMENTS: Omit<Achievement, "unlockedAt">[] = [
  { id: "streak_3",      icon: "🔥", title: "3-Tage-Serie",     description: "3 Tage in Folge aktiv" },
  { id: "streak_7",      icon: "🌟", title: "Wochenkrieger",    description: "7 Tage in Folge aktiv" },
  { id: "streak_14",     icon: "💫", title: "Zwei Wochen",      description: "14 Tage am Stück dabei" },
  { id: "streak_30",     icon: "🏆", title: "Monatsheld",       description: "30 Tage ohne Unterbrechung" },
  { id: "first_mission", icon: "✅", title: "Erste Mission",    description: "Erste Mission abgeschlossen" },
  { id: "five_missions", icon: "🎯", title: "Missionskämpfer",  description: "5 Missionen erfolgreich abgeschlossen" },
  { id: "first_booking", icon: "📅", title: "Erste Buchung",    description: "Erste Reservierung abgeschlossen" },
  { id: "reviewer",      icon: "⭐", title: "Kritiker",         description: "3 Bewertungen hinterlassen" },
  { id: "explorer_10",   icon: "🧭", title: "Entdecker",        description: "10 verschiedene Lokale besucht" },
  { id: "cafe_lover",    icon: "☕", title: "Kaffeeliebhaber",  description: "5 Cafés erkundet" },
  { id: "night_owl",     icon: "🌙", title: "Nachtschwärmer",   description: "Eine Bar in der App besucht" },
  { id: "foodie",        icon: "🍽️", title: "Genießer",         description: "5 verschiedene Küchen entdeckt" },
  { id: "points_100",    icon: "💎", title: "100 Hab.-Punkte",  description: "100 Habit-Punkte gesammelt" },
  { id: "points_500",    icon: "👑", title: "500 Hab.-Punkte",  description: "500 Habit-Punkte gesammelt" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function thisWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = now.getDate() - ((day + 6) % 7); // Monday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function defaultStreak(): StreakData {
  return { currentStreak: 0, bestStreak: 0, lastActiveDateISO: "", totalDaysActive: 0 };
}

function selectMissions(
  frequency: MissionFrequency,
  count: number,
  interactions: { cafe: number; restaurant: number; bar: number },
  seed: string
): string[] {
  const pool = ALL_MISSIONS.filter(m => m.frequency === frequency);

  // Score each mission by relevance to user's interaction preferences
  const total = interactions.cafe + interactions.restaurant + interactions.bar + 1;
  const cafeShare = interactions.cafe / total;
  const barShare = interactions.bar / total;

  const scored = pool.map(m => {
    let score = 0;
    if (cafeShare > 0.3 && m.tags.includes("cafe")) score += 2;
    if (barShare > 0.3 && m.tags.includes("nightlife")) score += 2;
    if (m.tags.includes("food")) score += 1;
    // Simple deterministic shuffle using seed
    const seedHash = [...(m.id + seed)].reduce((a, c) => a + c.charCodeAt(0), 0);
    score += (seedHash % 10) * 0.1;
    return { id: m.id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.id);
}

// ─── Read / write state ───────────────────────────────────────────────────────

export function readHabitData(): HabitData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return buildDefaultData();
}

function buildDefaultData(): HabitData {
  return {
    streak: defaultStreak(),
    dailyMissionIds: [],
    weeklyMissionIds: [],
    missionStates: {},
    achievements: ALL_ACHIEVEMENTS.map(a => ({ ...a, unlockedAt: null })),
    totalHabitPoints: 0,
    lastMissionReset: { daily: "", weekly: "" },
  };
}

function writeHabitData(data: HabitData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

// ─── Streak update ─────────────────────────────────────────────────────────────

export function updateStreak(data: HabitData): HabitData {
  const today = todayISO();
  const streak = { ...data.streak };
  const last = streak.lastActiveDateISO;

  if (last === today) return data; // already counted today

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (last === yesterday) {
    streak.currentStreak += 1;
  } else if (last === "") {
    streak.currentStreak = 1;
  } else {
    streak.currentStreak = 1; // reset
  }

  streak.bestStreak = Math.max(streak.bestStreak, streak.currentStreak);
  streak.lastActiveDateISO = today;
  streak.totalDaysActive += 1;

  return { ...data, streak };
}

// ─── Mission window reset ──────────────────────────────────────────────────────

export function resetMissionsIfNeeded(
  data: HabitData,
  interactions: { cafe: number; restaurant: number; bar: number }
): HabitData {
  const today = todayISO();
  const weekStart = thisWeekStart();
  let changed = false;

  let { dailyMissionIds, weeklyMissionIds, missionStates, lastMissionReset } = data;

  // Reset daily
  if (lastMissionReset.daily !== today) {
    const newDailyIds = selectMissions("daily", 3, interactions, today);
    dailyMissionIds = newDailyIds;
    lastMissionReset = { ...lastMissionReset, daily: today };
    // Create states for new missions
    const newStates = { ...missionStates };
    for (const id of newDailyIds) {
      const def = ALL_MISSIONS.find(m => m.id === id)!;
      if (!newStates[`daily-${today}-${id}`]) {
        newStates[`daily-${today}-${id}`] = {
          id,
          progress: 0,
          target: def.target,
          completed: false,
          completedAt: null,
          claimedPoints: false,
          windowStart: today,
        };
      }
    }
    missionStates = newStates;
    changed = true;
  }

  // Reset weekly
  if (lastMissionReset.weekly !== weekStart) {
    const newWeeklyIds = selectMissions("weekly", 2, interactions, weekStart);
    weeklyMissionIds = newWeeklyIds;
    lastMissionReset = { ...lastMissionReset, weekly: weekStart };
    const newStates = { ...missionStates };
    for (const id of newWeeklyIds) {
      const def = ALL_MISSIONS.find(m => m.id === id)!;
      if (!newStates[`weekly-${weekStart}-${id}`]) {
        newStates[`weekly-${weekStart}-${id}`] = {
          id,
          progress: 0,
          target: def.target,
          completed: false,
          completedAt: null,
          claimedPoints: false,
          windowStart: weekStart,
        };
      }
    }
    missionStates = newStates;
    changed = true;
  }

  if (!changed) return data;
  return { ...data, dailyMissionIds, weeklyMissionIds, missionStates, lastMissionReset };
}

// ─── Event recording ───────────────────────────────────────────────────────────

export function recordEvent(
  data: HabitData,
  eventType: HabitEventType
): HabitData {
  const today = todayISO();
  const weekStart = thisWeekStart();
  const missionStates = { ...data.missionStates };
  let totalHabitPoints = data.totalHabitPoints;
  let newlyCompleted = 0;

  // Update matching daily missions
  for (const id of data.dailyMissionIds) {
    const def = ALL_MISSIONS.find(m => m.id === id);
    if (!def || def.eventType !== eventType) continue;
    const key = `daily-${today}-${id}`;
    const state = missionStates[key];
    if (!state || state.completed) continue;
    const newProgress = Math.min(state.progress + 1, state.target);
    const completed = newProgress >= state.target;
    missionStates[key] = {
      ...state,
      progress: newProgress,
      completed,
      completedAt: completed ? new Date().toISOString() : null,
      claimedPoints: completed ? true : false,
    };
    if (completed && !state.claimedPoints) {
      totalHabitPoints += def.points;
      newlyCompleted++;
    }
  }

  // Update matching weekly missions
  for (const id of data.weeklyMissionIds) {
    const def = ALL_MISSIONS.find(m => m.id === id);
    if (!def || def.eventType !== eventType) continue;
    const key = `weekly-${weekStart}-${id}`;
    const state = missionStates[key];
    if (!state || state.completed) continue;
    const newProgress = Math.min(state.progress + 1, state.target);
    const completed = newProgress >= state.target;
    missionStates[key] = {
      ...state,
      progress: newProgress,
      completed,
      completedAt: completed ? new Date().toISOString() : null,
      claimedPoints: completed ? true : false,
    };
    if (completed && !state.claimedPoints) {
      totalHabitPoints += def.points;
      newlyCompleted++;
    }
  }

  return { ...data, missionStates, totalHabitPoints };
}

// ─── Achievement checking ─────────────────────────────────────────────────────

export function checkAchievements(data: HabitData): HabitData {
  const achievements = data.achievements.map(a => ({ ...a }));
  const now = new Date().toISOString();

  const unlock = (id: string) => {
    const a = achievements.find(a => a.id === id);
    if (a && !a.unlockedAt) { a.unlockedAt = now; }
  };

  const { currentStreak, bestStreak } = data.streak;
  if (Math.max(currentStreak, bestStreak) >= 3)  unlock("streak_3");
  if (Math.max(currentStreak, bestStreak) >= 7)  unlock("streak_7");
  if (Math.max(currentStreak, bestStreak) >= 14) unlock("streak_14");
  if (Math.max(currentStreak, bestStreak) >= 30) unlock("streak_30");

  const completedMissions = Object.values(data.missionStates).filter(s => s.completed).length;
  if (completedMissions >= 1) unlock("first_mission");
  if (completedMissions >= 5) unlock("five_missions");

  if (data.totalHabitPoints >= 100) unlock("points_100");
  if (data.totalHabitPoints >= 500) unlock("points_500");

  return { ...data, achievements };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function processAppOpen(
  interactions: { cafe: number; restaurant: number; bar: number }
): HabitData {
  let data = readHabitData();
  data = updateStreak(data);
  data = resetMissionsIfNeeded(data, interactions);
  data = recordEvent(data, "app_open");
  data = checkAchievements(data);
  writeHabitData(data);
  return data;
}

export function recordHabitEvent(eventType: HabitEventType): HabitData {
  let data = readHabitData();
  data = recordEvent(data, eventType);
  data = checkAchievements(data);
  writeHabitData(data);
  return data;
}

export function unlockAchievementById(id: string): HabitData {
  let data = readHabitData();
  const achievements = data.achievements.map(a =>
    a.id === id && !a.unlockedAt ? { ...a, unlockedAt: new Date().toISOString() } : a
  );
  data = { ...data, achievements };
  writeHabitData(data);
  return data;
}

// ─── View helpers ──────────────────────────────────────────────────────────────

export interface ActiveMission {
  def: MissionDef;
  state: MissionState;
  key: string;
}

export function getActiveDailyMissions(data: HabitData): ActiveMission[] {
  const today = todayISO();
  return data.dailyMissionIds.map(id => {
    const def = ALL_MISSIONS.find(m => m.id === id)!;
    const key = `daily-${today}-${id}`;
    const state = data.missionStates[key] ?? {
      id, progress: 0, target: def.target, completed: false,
      completedAt: null, claimedPoints: false, windowStart: today,
    };
    return { def, state, key };
  }).filter(m => m.def);
}

export function getActiveWeeklyMissions(data: HabitData): ActiveMission[] {
  const weekStart = thisWeekStart();
  return data.weeklyMissionIds.map(id => {
    const def = ALL_MISSIONS.find(m => m.id === id)!;
    const key = `weekly-${weekStart}-${id}`;
    const state = data.missionStates[key] ?? {
      id, progress: 0, target: def.target, completed: false,
      completedAt: null, claimedPoints: false, windowStart: weekStart,
    };
    return { def, state, key };
  }).filter(m => m.def);
}

export function getUnlockedAchievements(data: HabitData): Achievement[] {
  return data.achievements.filter(a => a.unlockedAt !== null)
    .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime());
}

export function getNextStreakMilestone(streak: number): { target: number; reward: string } {
  const milestones = [
    { target: 3,  reward: "🏅 Serie-Abzeichen + 20 Pkt." },
    { target: 7,  reward: "🌟 Wochenkrieger-Abzeichen + 50 Pkt." },
    { target: 14, reward: "💫 Zwei-Wochen-Abzeichen + 80 Pkt." },
    { target: 30, reward: "🏆 Monatsheld-Abzeichen + 200 Pkt." },
  ];
  return milestones.find(m => m.target > streak) ?? { target: 30, reward: "🏆 Maximales Abzeichen" };
}
