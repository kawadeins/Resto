import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, Radius, Typography } from "@/constants/theme";
import { getCustomerEmail } from "@/lib/storage";
import { api } from "@/lib/api";

interface PublicProfile {
  email: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  totalBookings: number;
  totalReviews: number;
  loyaltyPoints: number;
  friendCount: number;
  isFriend: boolean;
  isPending: boolean;
  recentActivity: {
    id: number;
    type: string;
    restaurantName?: string;
    restaurantImage?: string;
    content?: string;
    rating?: number;
    createdAt: string;
  }[];
}

async function getPublicProfile(email: string, viewerEmail: string): Promise<PublicProfile> {
  const res = await api.get("/social/profile", {
    params: { email, viewerEmail },
  });
  return res.data;
}

async function sendFriendRequest(fromEmail: string, toEmail: string): Promise<void> {
  await api.post("/social/friends/request", { fromEmail, toEmail });
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

const ACTIVITY_LABELS: Record<string, string> = {
  booking: "hat reserviert",
  review: "hat bewertet",
  checkin: "eingecheckt bei",
  achievement: "hat erreicht",
};

export default function PublicProfileScreen() {
  const { email: rawEmail } = useLocalSearchParams<{ email: string }>();
  const profileEmail = decodeURIComponent(rawEmail ?? "");
  const [myEmail, setMyEmail] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    getCustomerEmail().then(setMyEmail);
  }, []);

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["publicProfile", profileEmail, myEmail],
    queryFn: () => getPublicProfile(profileEmail, myEmail!),
    enabled: !!myEmail && !!profileEmail,
  });

  const friendMutation = useMutation({
    mutationFn: () => sendFriendRequest(myEmail!, profileEmail),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publicProfile", profileEmail] });
    },
  });

  const isOwnProfile = myEmail === profileEmail;
  const displayName = profile?.displayName ?? profileEmail.split("@")[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.violet} />
        </View>
      ) : error || !profile ? (
        <View style={styles.errorState}>
          <Text style={styles.errorIcon}>🔍</Text>
          <Text style={styles.errorTitle}>Profil nicht gefunden</Text>
          <Text style={styles.errorText}>Dieses Profil ist privat oder existiert nicht.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Avatar + Name */}
          <View style={styles.profileTop}>
            {profile.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{displayName[0].toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.profileEmail}>{profileEmail}</Text>
            {profile.bio ? (
              <Text style={styles.bio}>{profile.bio}</Text>
            ) : null}

            {/* Action Button */}
            {!isOwnProfile && (
              profile.isFriend ? (
                <View style={styles.friendBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.friendBadgeText}>Befreundet</Text>
                </View>
              ) : profile.isPending ? (
                <View style={[styles.actionBtn, styles.actionBtnPending]}>
                  <Ionicons name="time-outline" size={16} color={Colors.textSubtle} />
                  <Text style={styles.actionBtnPendingText}>Anfrage gesendet</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => friendMutation.mutate()}
                  disabled={friendMutation.isPending}
                  activeOpacity={0.85}
                >
                  {friendMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="person-add" size={16} color="#fff" />
                  )}
                  <Text style={styles.actionBtnText}>Freundschaft anfragen</Text>
                </TouchableOpacity>
              )
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.totalBookings}</Text>
              <Text style={styles.statLabel}>Buchungen</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.totalReviews}</Text>
              <Text style={styles.statLabel}>Bewertungen</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.friendCount}</Text>
              <Text style={styles.statLabel}>Freunde</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.loyaltyPoints}</Text>
              <Text style={styles.statLabel}>Punkte</Text>
            </View>
          </View>

          {/* Recent Activity */}
          {profile.recentActivity.length > 0 && (
            <View style={styles.activitySection}>
              <Text style={styles.sectionTitle}>Letzte Aktivitäten</Text>
              {profile.recentActivity.map((act) => (
                <View key={act.id} style={styles.activityCard}>
                  {act.restaurantImage ? (
                    <Image
                      source={{ uri: act.restaurantImage }}
                      style={styles.activityImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.activityImagePlaceholder}>
                      <Ionicons name="restaurant" size={20} color={Colors.textSubtle} />
                    </View>
                  )}
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityText} numberOfLines={2}>
                      {ACTIVITY_LABELS[act.type] ?? act.type}
                      {act.restaurantName ? ` ${act.restaurantName}` : ""}
                    </Text>
                    {act.content ? (
                      <Text style={styles.activityContent} numberOfLines={2}>
                        "{act.content}"
                      </Text>
                    ) : null}
                    {act.rating ? (
                      <View style={styles.stars}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Ionicons
                            key={i}
                            name={i <= act.rating! ? "star" : "star-outline"}
                            size={12}
                            color="#f59e0b"
                          />
                        ))}
                      </View>
                    ) : null}
                    <Text style={styles.activityTime}>{timeAgo(act.createdAt)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: Colors.text,
    fontSize: Typography.base,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: 12,
  },
  errorIcon: { fontSize: 48 },
  errorTitle: {
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: "700",
  },
  errorText: {
    color: Colors.textMuted,
    fontSize: Typography.base,
    textAlign: "center",
  },
  profileTop: {
    alignItems: "center",
    padding: Spacing.xl,
    gap: 8,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 4,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(139,92,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    color: Colors.violet,
    fontSize: 36,
    fontWeight: "700",
  },
  displayName: {
    color: Colors.text,
    fontSize: Typography["2xl"],
    fontWeight: "800",
  },
  profileEmail: {
    color: Colors.textSubtle,
    fontSize: Typography.sm,
  },
  bio: {
    color: Colors.textMuted,
    fontSize: Typography.base,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 4,
  },
  friendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  friendBadgeText: {
    color: Colors.success,
    fontSize: Typography.sm,
    fontWeight: "700",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.violet,
    borderRadius: Radius.lg,
    paddingHorizontal: 20,
    paddingVertical: 11,
    marginTop: 8,
  },
  actionBtnPending: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: Typography.base,
    fontWeight: "700",
  },
  actionBtnPendingText: {
    color: Colors.textSubtle,
    fontSize: Typography.base,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  statValue: {
    color: Colors.text,
    fontSize: Typography.xl,
    fontWeight: "800",
  },
  statLabel: {
    color: Colors.textSubtle,
    fontSize: Typography.xs,
    fontWeight: "600",
  },
  activitySection: {
    marginTop: 24,
    paddingHorizontal: Spacing.md,
    gap: 12,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: "700",
    marginBottom: 4,
  },
  activityCard: {
    flexDirection: "row",
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    gap: 12,
  },
  activityImage: {
    width: 70,
    height: 70,
  },
  activityImagePlaceholder: {
    width: 70,
    height: 70,
    backgroundColor: Colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  activityInfo: {
    flex: 1,
    padding: 10,
    gap: 4,
  },
  activityText: {
    color: Colors.text,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  activityContent: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontStyle: "italic",
  },
  stars: {
    flexDirection: "row",
    gap: 2,
  },
  activityTime: {
    color: Colors.textSubtle,
    fontSize: Typography.xs,
  },
});
