import React, { useState, useMemo } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, Radius, Typography } from "@/constants/theme";
import { getRestaurants } from "@/lib/api";
import { RestaurantCard } from "@/components/RestaurantCard";

const PRICE_RANGES = ["€", "€€", "€€€"];
const MIN_RATINGS = [3, 3.5, 4, 4.5];
const CUISINES = ["Austrian", "French", "Italian", "Japanese", "Vegetarian", "Mexican", "American", "Indian"];

export default function ExploreScreen() {
  const [search, setSearch] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<string | null>(null);
  const [minRating, setMinRating] = useState<number | null>(null);

  const { data: restaurants = [], isFetching, refetch } = useQuery({
    queryKey: ["restaurants"],
    queryFn: () => getRestaurants(),
  });

  const filtered = useMemo(() => {
    return restaurants.filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase()) &&
          !r.cuisine.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedCuisine && r.cuisine !== selectedCuisine) return false;
      if (selectedPrice && r.priceRange !== selectedPrice) return false;
      if (minRating && parseFloat(r.rating) < minRating) return false;
      return true;
    });
  }, [restaurants, search, selectedCuisine, selectedPrice, minRating]);

  const activeFilters = [selectedCuisine, selectedPrice, minRating].filter(Boolean).length;

  function clearFilters() {
    setSelectedCuisine(null);
    setSelectedPrice(null);
    setMinRating(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      {/* Search Bar */}
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={Colors.textSubtle} />
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

        {/* Filter Chips Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {activeFilters > 0 && (
            <TouchableOpacity style={styles.clearChip} onPress={clearFilters}>
              <Ionicons name="close" size={14} color={Colors.error} />
              <Text style={styles.clearChipText}>Filter löschen</Text>
            </TouchableOpacity>
          )}
          {CUISINES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, selectedCuisine === c && styles.chipActive]}
              onPress={() => setSelectedCuisine(selectedCuisine === c ? null : c)}
            >
              <Text style={[styles.chipText, selectedCuisine === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Price + Rating */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {PRICE_RANGES.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, selectedPrice === p && styles.chipActive]}
              onPress={() => setSelectedPrice(selectedPrice === p ? null : p)}
            >
              <Text style={[styles.chipText, selectedPrice === p && styles.chipTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
          {MIN_RATINGS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, minRating === r && styles.chipActive]}
              onPress={() => setMinRating(minRating === r ? null : r)}
            >
              <Ionicons name="star" size={12} color={minRating === r ? Colors.violet : Colors.textSubtle} />
              <Text style={[styles.chipText, minRating === r && styles.chipTextActive]}>{r}+</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results count */}
      <View style={styles.resultsMeta}>
        <Text style={styles.resultsText}>{filtered.length} Restaurants gefunden</Text>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        onRefresh={refetch}
        refreshing={isFetching}
        renderItem={({ item }) => <RestaurantCard restaurant={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyTitle}>Keine Restaurants gefunden</Text>
            <Text style={styles.emptyText}>Versuche andere Filter.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.base,
  },
  filterRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderColor: Colors.violet,
  },
  chipText: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  chipTextActive: {
    color: Colors.violet,
  },
  clearChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  clearChipText: {
    color: Colors.error,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  resultsMeta: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  resultsText: {
    color: Colors.textSubtle,
    fontSize: Typography.sm,
  },
  list: {
    padding: Spacing.md,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: "700",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Typography.base,
  },
});
