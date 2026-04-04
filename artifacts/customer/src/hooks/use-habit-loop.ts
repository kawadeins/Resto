/**
 * useHabitLoop — React hook wrapping the habit engine.
 *
 * Initialises on mount (records app_open + updates streak),
 * exposes state + recordEvent function for child components.
 */
import { useState, useCallback, useEffect } from "react";
import {
  readHabitData,
  recordHabitEvent,
  processAppOpen,
  getActiveDailyMissions,
  getActiveWeeklyMissions,
  getUnlockedAchievements,
  getNextStreakMilestone,
  type HabitData,
  type HabitEventType,
  type ActiveMission,
  type Achievement,
} from "@/lib/habit-engine";

const INTERACTIONS_KEY = "restosmart_lifestyle_interactions";

function readInteractions() {
  try {
    const raw = localStorage.getItem(INTERACTIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { cafe: 0, restaurant: 0, bar: 0 };
}

export interface HabitLoopReturn {
  data: HabitData;
  dailyMissions: ActiveMission[];
  weeklyMissions: ActiveMission[];
  unlockedAchievements: Achievement[];
  allAchievements: HabitData["achievements"];
  nextMilestone: { target: number; reward: string };
  record: (event: HabitEventType) => void;
  totalCompleted: number;
}

export function useHabitLoop(): HabitLoopReturn {
  const [data, setData] = useState<HabitData>(() => readHabitData());

  // On mount: process app open (streak + reset missions)
  useEffect(() => {
    const interactions = readInteractions();
    const updated = processAppOpen(interactions);
    setData(updated);
  }, []);

  const record = useCallback((event: HabitEventType) => {
    const updated = recordHabitEvent(event);
    setData(updated);
  }, []);

  const dailyMissions = getActiveDailyMissions(data);
  const weeklyMissions = getActiveWeeklyMissions(data);
  const unlockedAchievements = getUnlockedAchievements(data);
  const nextMilestone = getNextStreakMilestone(data.streak.currentStreak);
  const totalCompleted = Object.values(data.missionStates).filter(s => s.completed).length;

  return {
    data,
    dailyMissions,
    weeklyMissions,
    unlockedAchievements,
    allAchievements: data.achievements,
    nextMilestone,
    record,
    totalCompleted,
  };
}
