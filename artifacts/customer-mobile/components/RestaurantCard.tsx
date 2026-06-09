import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Radius, Typography } from "@/constants/theme";
import type { Restaurant } from "@/lib/api";

interface Props {
  restaurant: Restaurant;
  compact?: boolean;
}

export function RestaurantCard({ restaurant, compact = false }: Props) {
  const rating = parseFloat(restaurant.rating);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[styles.card, compact && styles.cardCompact]}
      onPress={() => router.push(`/restaurant/${restaurant.id}`)}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: restaurant.heroImage }}
          style={[styles.image, compact && styles.imageCompact]}
          contentFit="cover"
          transition={200}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.7)"]}
          style={StyleSheet.absoluteFill}
        />
        {restaurant.isPartner && (
          <View style={styles.partnerBadge}>
            <Ionicons name="star" size={10} color="#f59e0b" />
            <Text style={styles.partnerText}>Premium</Text>
          </View>
        )}
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={12} color="#f59e0b" />
          <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{restaurant.name}</Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            {restaurant.cuisineEmoji} {restaurant.cuisine}
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.metaText}>{restaurant.priceRange}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.metaText}>{restaurant.reviewCount} Bewertungen</Text>
        </View>
        <View style={styles.location}>
          <Ionicons name="location-outline" size={12} color={Colors.textSubtle} />
          <Text style={styles.locationText} numberOfLines={1}>{restaurant.address}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  cardCompact: {
    width: 220,
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: 180,
  },
  imageCompact: {
    height: 140,
  },
  partnerBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  partnerText: {
    color: "#f59e0b",
    fontSize: 11,
    fontWeight: "600",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratingText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  info: {
    padding: 12,
    gap: 4,
  },
  name: {
    color: Colors.text,
    fontSize: Typography.base,
    fontWeight: "700",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
  },
  dot: {
    color: Colors.textSubtle,
    fontSize: Typography.xs,
  },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  locationText: {
    color: Colors.textSubtle,
    fontSize: Typography.xs,
    flex: 1,
  },
});
