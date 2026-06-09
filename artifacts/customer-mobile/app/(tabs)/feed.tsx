import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, Radius, Typography } from "@/constants/theme";
import { getCustomerEmail } from "@/lib/storage";
import { api } from "@/lib/api";

interface ActivityItem {
  id: number;
  type: "booking" | "review" | "achievement" | "friend" | "checkin";
  actorEmail: string;
  actorName?: string;
  restaurantId?: number;
  restaurantName?: string;
  restaurantImage?: string;
  content?: string;
  rating?: number;
  createdAt: string;
  visibility: "public" | "friends" | "private";
}

const TYPE_CONFIG = {
  booking:     { icon: "calendar",       color: Colors.violet,  label: "hat reserviert" },
  review:      { icon: "star",           color: Colors.gold,    label: "hat bewertet" },
  achievement: { icon: "trophy",         color: Colors.warning, label: "hat erreicht" },
  friend:      { icon: "people",         color: Colors.success, label: "neue Freundschaft" },
  checkin:     { icon: "location",       color: Colors.pink,    label: "eingecheckt" },
} as const;

async function getFeed(email: string): Promise<ActivityItem[]> {
  const res = await api.get("/social/feed", { params: { email } });
  return res.data ?? [];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs} Std.`;
  const days = Math.floor(hrs / 24);
  return `vor ${days} Tag${days === 1 ? "" : "en"}`;
}

function ActivityCard({ item }: { item: ActivityItem }) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.booking;
  const name = item.actorName ?? item.actorEmail.split("@")[0];

  return (
    <View style={styles.card}>
      {/* Actor */}
      <View style={styles.cardHeader}>
        <View style={styles.actorAvatar}>
          <Text style={styles.actorAvatarText}>{name[0].toUpperCase()}</Text>
        </View>
        <View style={styles.actorInfo}>
          <Text style={styles.actorName}>{name}</Text>
          <View style={styles.actorMeta}>
            <View style={[styles.typeIcon, { backgroundColor: `${cfg.color}20` }]}>
              <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
            </View>
            <Text style={styles.typeLabel}>{cfg.label}</Text>
            {item.restaurantName && (
              <Text style={styles.restaurantRef} numberOfLines={1}> bei {item.restaurantName}</Text>
            )}
          </View>
        </View>
        <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
      </View>

      {/* Restaurant Image */}
      {item.restaurantImage && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => item.restaurantId && router.push(`/restaurant/${item.restaurantId}`)}
        >
          <Image
            source={{ uri: item.restaurantImage }}
            style={styles.restaurantImg}
            contentFit="cover"
          />
        </TouchableOpacity>
      )}

      {/* Content / Review */}
      {item.content && (
        <Text style={styles.content}>{item.content}</Text>
      )}

      {/* Star Rating */}
      {item.rating && (
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Ionicons
              key={i}
              name={i <= item.rating! ? "star" : "star-outline"}
              size={14}
              color="#f59e0b"
            />
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="heart-outline" size={18} color={Colors.textSubtle} />
          <Text style={styles.actionText}>Gefällt mir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={18} color={Colors.textSubtle} />
          <Text style={styles.actionText}>Kommentar</Text>
        </TouchableOpacity>
        {item.restaurantId && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push(`/restaurant/${item.restaurantId}`)}
          >
            <Ionicons name="arrow-forward-outline" size={18} color={Colors.violet} />
            <Text style={[styles.actionText, { color: Colors.violet }]}>Besuchen</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => { getCustomerEmail().then(setEmail); }, []);

  const { data: feed = [], isFetching, refetch } = useQuery({
    queryKey: ["feed", email],
    queryFn: () => getFeed(email!),
    enabled: !!email,
    refetchInterval: 30000,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Ionicons name="refresh-outline" size={22} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={feed}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={Colors.violet} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md }} />}
        renderItem={({ item }) => <ActivityCard item={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🌟</Text>
            <Text style={styles.emptyTitle}>Noch nichts im Feed</Text>
            <Text style={styles.emptyText}>
              Folge Freunden und buche Restaurants, um hier Aktivitäten zu sehen.
            </Text>
            <TouchableOpacity
              style={styles.exploreBtn}
              onPress={() => router.push("/(tabs)/friends")}
            >
              <Text style={styles.exploreBtnText}>Freunde finden</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
  list: {
    flexGrow: 1,
  },
  card: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  actorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(139,92,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  actorAvatarText: {
    color: Colors.violet,
    fontSize: Typography.lg,
    fontWeight: "700",
  },
  actorInfo: {
    flex: 1,
    gap: 3,
  },
  actorName: {
    color: Colors.text,
    fontSize: Typography.base,
    fontWeight: "700",
  },
  actorMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  typeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  typeLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  restaurantRef: {
    color: Colors.violet,
    fontSize: Typography.sm,
    fontWeight: "600",
    flex: 1,
  },
  time: {
    color: Colors.textSubtle,
    fontSize: Typography.xs,
    flexShrink: 0,
  },
  restaurantImg: {
    width: "100%",
    height: 200,
    borderRadius: Radius.lg,
  },
  content: {
    color: Colors.textMuted,
    fontSize: Typography.base,
    lineHeight: 22,
  },
  stars: {
    flexDirection: "row",
    gap: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 20,
    paddingTop: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionText: {
    color: Colors.textSubtle,
    fontSize: Typography.sm,
    fontWeight: "500",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: Spacing.xl,
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
    textAlign: "center",
    lineHeight: 22,
  },
  exploreBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(139,92,246,0.15)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
  },
  exploreBtnText: {
    color: Colors.violet,
    fontSize: Typography.base,
    fontWeight: "700",
  },
});
