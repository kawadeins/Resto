import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, FlatList,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, Radius, Typography } from "@/constants/theme";
import { getRestaurants, getFlashDeals, type Restaurant, type FlashDeal } from "@/lib/api";
import { RestaurantCard } from "@/components/RestaurantCard";
import { getCustomerEmail } from "@/lib/storage";

const CUISINES = [
  { key: "Austrian",   emoji: "🥩", label: "Österreich" },
  { key: "Italian",    emoji: "🍝", label: "Italienisch" },
  { key: "Japanese",   emoji: "🍣", label: "Japanisch" },
  { key: "Mexican",    emoji: "🌮", label: "Mexikanisch" },
  { key: "French",     emoji: "🥐", label: "Französisch" },
  { key: "Vegetarian", emoji: "🌿", label: "Vegetarisch" },
];

function getTimeOfDay(): { greeting: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 11) return { greeting: "Guten Morgen", emoji: "☕" };
  if (h < 14) return { greeting: "Guten Appetit", emoji: "🍜" };
  if (h < 18) return { greeting: "Guten Nachmittag", emoji: "🌤️" };
  return { greeting: "Guten Abend", emoji: "🌆" };
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTime("Abgelaufen"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTime(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return <Text style={{ color: Colors.warning, fontSize: Typography.sm, fontWeight: "700" }}>{time}</Text>;
}

export default function HomeScreen() {
  const [search, setSearch] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { greeting, emoji } = getTimeOfDay();

  useEffect(() => {
    getCustomerEmail().then(setUserEmail);
  }, []);

  const { data: restaurants = [], refetch, isFetching } = useQuery({
    queryKey: ["restaurants"],
    queryFn: () => getRestaurants(),
  });

  const { data: flashDeals = [] } = useQuery({
    queryKey: ["flashDeals"],
    queryFn: getFlashDeals,
  });

  const filtered = restaurants.filter((r) => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
    const matchCuisine = !selectedCuisine || r.cuisine === selectedCuisine;
    return matchSearch && matchCuisine;
  });

  const featured = filtered.filter((r) => r.isPartner || r.isFeatured).slice(0, 6);
  const popular = filtered.filter((r) => parseFloat(r.rating) >= 4.5).slice(0, 10);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={Colors.violet} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{emoji} {greeting}</Text>
            <Text style={styles.headerTitle}>RestoSmart</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile")}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color={Colors.text} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={Colors.textSubtle} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Restaurants suchen..."
            placeholderTextColor={Colors.textSubtle}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={Colors.textSubtle} />
            </TouchableOpacity>
          )}
        </View>

        {/* Flash Deals */}
        {flashDeals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionIcon}>⚡</Text>
                <Text style={styles.sectionTitle}>Flash Deals</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {flashDeals.map((deal) => (
                <TouchableOpacity
                  key={deal.id}
                  style={styles.dealCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/restaurant/${deal.restaurantId}`)}
                >
                  <Image source={{ uri: deal.heroImage }} style={styles.dealImage} contentFit="cover" />
                  <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={StyleSheet.absoluteFill} />
                  <View style={styles.dealBadge}>
                    <Text style={styles.dealBadgeText}>-{deal.discount}%</Text>
                  </View>
                  <View style={styles.dealContent}>
                    <Text style={styles.dealName}>{deal.restaurantName}</Text>
                    <View style={styles.dealPriceRow}>
                      <Text style={styles.dealOldPrice}>€{deal.originalPrice}</Text>
                      <Text style={styles.dealNewPrice}>€{deal.dealPrice}</Text>
                    </View>
                    <CountdownTimer expiresAt={deal.expiresAt} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Cuisine Filter */}
        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            <TouchableOpacity
              style={[styles.cuisineChip, !selectedCuisine && styles.cuisineChipActive]}
              onPress={() => setSelectedCuisine(null)}
            >
              <Text style={[styles.cuisineText, !selectedCuisine && styles.cuisineTextActive]}>Alle</Text>
            </TouchableOpacity>
            {CUISINES.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.cuisineChip, selectedCuisine === c.key && styles.cuisineChipActive]}
                onPress={() => setSelectedCuisine(selectedCuisine === c.key ? null : c.key)}
              >
                <Text style={styles.cuisineEmoji}>{c.emoji}</Text>
                <Text style={[styles.cuisineText, selectedCuisine === c.key && styles.cuisineTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Featured */}
        {featured.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>⭐ Featured</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/explore")}>
                <Text style={styles.seeAll}>Alle anzeigen</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {featured.map((r) => (
                <View key={r.id} style={{ width: 240 }}>
                  <RestaurantCard restaurant={r} compact />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Popular */}
        {popular.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🔥 Beliebt</Text>
            </View>
            <View style={{ gap: 12, paddingHorizontal: Spacing.md }}>
              {popular.slice(0, 5).map((r) => (
                <RestaurantCard key={r.id} restaurant={r} />
              ))}
            </View>
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
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
  greeting: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: Typography["2xl"],
    fontWeight: "800",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 10,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.base,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionIcon: { fontSize: 18 },
  sectionTitle: {
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: "700",
  },
  seeAll: {
    color: Colors.violet,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  hScroll: {
    paddingHorizontal: Spacing.md,
    gap: 12,
  },
  dealCard: {
    width: 200,
    height: 200,
    borderRadius: Radius.lg,
    overflow: "hidden",
    position: "relative",
  },
  dealImage: {
    width: "100%",
    height: "100%",
  },
  dealBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: Colors.error,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dealBadgeText: {
    color: "#fff",
    fontSize: Typography.sm,
    fontWeight: "800",
  },
  dealContent: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    gap: 3,
  },
  dealName: {
    color: "#fff",
    fontSize: Typography.sm,
    fontWeight: "700",
  },
  dealPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dealOldPrice: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    textDecorationLine: "line-through",
  },
  dealNewPrice: {
    color: "#fff",
    fontSize: Typography.base,
    fontWeight: "800",
  },
  cuisineChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cuisineChipActive: {
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderColor: Colors.violet,
  },
  cuisineEmoji: { fontSize: 16 },
  cuisineText: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  cuisineTextActive: {
    color: Colors.violet,
  },
});
