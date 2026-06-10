import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, Radius, Typography } from "@/constants/theme";
import { getCustomerEmail } from "@/lib/storage";
import { api } from "@/lib/api";

const DAYS_DE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const MEAL_TYPES = ["Frühstück", "Mittagessen", "Abendessen"];

const MEAL_ICONS: Record<string, string> = {
  "Frühstück": "☕",
  "Mittagessen": "🍜",
  "Abendessen": "🍽️",
};

interface DayPlan {
  day: string;
  meals: {
    type: string;
    restaurantId?: number;
    restaurantName?: string;
    restaurantImage?: string;
    suggestion: string;
    cuisine?: string;
  }[];
}

interface MealPlanData {
  id: number;
  name: string;
  days: DayPlan[];
  createdAt: string;
}

async function getWeeklyPlan(email: string): Promise<MealPlanData | null> {
  try {
    const res = await api.get("/meal-plan", { params: { email } });
    return res.data?.[0] ?? null;
  } catch {
    return null;
  }
}

async function generateSmartPlan(email: string): Promise<MealPlanData> {
  const res = await api.post("/smart-plan/generate", { email });
  return res.data;
}

function MealCard({
  meal,
}: {
  meal: DayPlan["meals"][0];
}) {
  return (
    <TouchableOpacity
      style={styles.mealCard}
      activeOpacity={meal.restaurantId ? 0.85 : 1}
      onPress={() => meal.restaurantId && router.push(`/restaurant/${meal.restaurantId}`)}
    >
      {meal.restaurantImage ? (
        <Image source={{ uri: meal.restaurantImage }} style={styles.mealImage} contentFit="cover" />
      ) : (
        <View style={styles.mealImagePlaceholder}>
          <Text style={{ fontSize: 28 }}>{MEAL_ICONS[meal.type] ?? "🍴"}</Text>
        </View>
      )}
      <View style={styles.mealInfo}>
        <View style={styles.mealTypeRow}>
          <Text style={styles.mealTypeEmoji}>{MEAL_ICONS[meal.type] ?? "🍴"}</Text>
          <Text style={styles.mealType}>{meal.type}</Text>
        </View>
        {meal.restaurantName ? (
          <Text style={styles.mealRestaurant} numberOfLines={1}>{meal.restaurantName}</Text>
        ) : null}
        <Text style={styles.mealSuggestion} numberOfLines={2}>{meal.suggestion}</Text>
      </View>
      {meal.restaurantId && (
        <Ionicons name="chevron-forward" size={16} color={Colors.textSubtle} />
      )}
    </TouchableOpacity>
  );
}

export default function MealPlanScreen() {
  const [email, setEmail] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { getCustomerEmail().then(setEmail); }, []);

  const { data: plan, refetch, isLoading } = useQuery({
    queryKey: ["mealPlan", email],
    queryFn: () => getWeeklyPlan(email!),
    enabled: !!email,
  });

  async function handleGenerate() {
    if (!email) return;
    setGenerating(true);
    try {
      await generateSmartPlan(email);
      refetch();
    } finally {
      setGenerating(false);
    }
  }

  const todayIndex = (new Date().getDay() + 6) % 7; // Mon=0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mahlzeitenplan</Text>
          <Text style={styles.subtitle}>Deine Woche, smart geplant</Text>
        </View>
        <TouchableOpacity
          style={[styles.genBtn, generating && { opacity: 0.6 }]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="sparkles" size={16} color="#fff" />
          }
          <Text style={styles.genBtnText}>{generating ? "Wird geplant..." : "KI-Plan"}</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.violet} />
          <Text style={styles.loadingText}>Wird geladen...</Text>
        </View>
      ) : !plan ? (
        /* Empty State */
        <View style={styles.emptyState}>
          <LinearGradient
            colors={["rgba(139,92,246,0.1)", "rgba(236,72,153,0.1)"]}
            style={styles.emptyCard}
          >
            <Text style={styles.emptyIcon}>🤖</Text>
            <Text style={styles.emptyTitle}>Noch kein Plan</Text>
            <Text style={styles.emptyText}>
              Lass die KI einen personalisierten Wochenplan erstellen — basierend auf deinen Vorlieben und den besten Restaurants in deiner Nähe.
            </Text>
            <TouchableOpacity
              style={styles.createBtn}
              onPress={handleGenerate}
              disabled={generating}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#8b5cf6", "#ec4899"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.createBtnGradient}
              >
                {generating
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="sparkles" size={18} color="#fff" />
                }
                <Text style={styles.createBtnText}>
                  {generating ? "Wird erstellt..." : "KI-Plan erstellen"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>

          {/* Cuisine Inspiration */}
          <Text style={styles.inspTitle}>Inspiration nach Küche</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inspRow}>
            {[
              { emoji: "🍝", label: "Italienisch", color: "#ef4444" },
              { emoji: "🍣", label: "Japanisch",   color: "#3b82f6" },
              { emoji: "🥐", label: "Französisch", color: "#8b5cf6" },
              { emoji: "🌿", label: "Vegetarisch", color: "#22c55e" },
              { emoji: "🥩", label: "Österreich",  color: "#f59e0b" },
            ].map((c) => (
              <TouchableOpacity
                key={c.label}
                style={styles.inspChip}
                onPress={() => router.push({ pathname: "/(tabs)/explore", params: { cuisine: c.label } })}
              >
                <Text style={{ fontSize: 24 }}>{c.emoji}</Text>
                <Text style={styles.inspLabel}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        /* Plan View */
        <>
          <View style={styles.planHeader}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planDate}>
              Erstellt {new Date(plan.createdAt).toLocaleDateString("de-DE")}
            </Text>
          </View>

          {/* Day Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayScroll}
          >
            {DAYS_DE.map((day, i) => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayChip,
                  activeDay === i && styles.dayChipActive,
                  i === todayIndex && activeDay !== i && styles.dayChipToday,
                ]}
                onPress={() => setActiveDay(i)}
              >
                <Text style={[styles.dayChipText, activeDay === i && styles.dayChipTextActive]}>
                  {day.slice(0, 2)}
                </Text>
                {i === todayIndex && (
                  <View style={[styles.todayDot, activeDay === i && styles.todayDotActive]} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Meals for selected day */}
          <ScrollView contentContainerStyle={styles.mealsContainer} showsVerticalScrollIndicator={false}>
            {(() => {
              const dayPlan = plan.days.find((d) => d.day === DAYS_DE[activeDay]) ?? plan.days[activeDay];
              if (!dayPlan) {
                return (
                  <View style={styles.noMeals}>
                    <Text style={styles.noMealsText}>Keine Mahlzeiten für diesen Tag geplant.</Text>
                  </View>
                );
              }
              return dayPlan.meals.map((meal, i) => (
                <MealCard key={i} meal={meal} />
              ));
            })()}

            <View style={{ height: 40 }} />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: Typography["2xl"],
    fontWeight: "800",
  },
  subtitle: {
    color: Colors.textSubtle,
    fontSize: Typography.sm,
    marginTop: 2,
  },
  genBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.violet,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  genBtnText: {
    color: "#fff",
    fontSize: Typography.sm,
    fontWeight: "700",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: Typography.base,
  },
  emptyState: {
    flex: 1,
    padding: Spacing.md,
    gap: 24,
  },
  emptyCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
    padding: Spacing.xl,
    alignItems: "center",
    gap: 14,
  },
  emptyIcon: { fontSize: 56 },
  emptyTitle: {
    color: Colors.text,
    fontSize: Typography.xl,
    fontWeight: "800",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Typography.base,
    textAlign: "center",
    lineHeight: 22,
  },
  createBtn: {
    width: "100%",
    borderRadius: Radius.lg,
    overflow: "hidden",
    marginTop: 4,
  },
  createBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  createBtnText: {
    color: "#fff",
    fontSize: Typography.base,
    fontWeight: "700",
  },
  inspTitle: {
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: "700",
  },
  inspRow: {
    gap: 12,
    paddingVertical: 4,
  },
  inspChip: {
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inspLabel: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    fontWeight: "600",
  },
  planHeader: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  planName: {
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: "700",
  },
  planDate: {
    color: Colors.textSubtle,
    fontSize: Typography.xs,
    marginTop: 2,
  },
  dayScroll: {
    paddingHorizontal: Spacing.md,
    gap: 8,
    paddingBottom: Spacing.sm,
  },
  dayChip: {
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 3,
  },
  dayChipActive: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderColor: Colors.violet,
  },
  dayChipToday: {
    borderColor: Colors.pink,
  },
  dayChipText: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontWeight: "700",
  },
  dayChipTextActive: {
    color: Colors.violet,
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.pink,
  },
  todayDotActive: {
    backgroundColor: Colors.violet,
  },
  mealsContainer: {
    padding: Spacing.md,
    gap: 12,
  },
  mealCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    gap: 12,
    paddingRight: 12,
  },
  mealImage: {
    width: 80,
    height: 80,
  },
  mealImagePlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: Colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  mealInfo: {
    flex: 1,
    gap: 3,
  },
  mealTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  mealTypeEmoji: { fontSize: 14 },
  mealType: {
    color: Colors.textSubtle,
    fontSize: Typography.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mealRestaurant: {
    color: Colors.text,
    fontSize: Typography.base,
    fontWeight: "700",
  },
  mealSuggestion: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    lineHeight: 18,
  },
  noMeals: {
    alignItems: "center",
    paddingVertical: 40,
  },
  noMealsText: {
    color: Colors.textSubtle,
    fontSize: Typography.base,
  },
});
