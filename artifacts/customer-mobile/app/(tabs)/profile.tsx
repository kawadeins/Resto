import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, Radius, Typography } from "@/constants/theme";
import { getLoyalty, getCustomerProfile } from "@/lib/api";
import { getCustomerEmail } from "@/lib/storage";
import { clearCustomerEmail } from "@/lib/storage";

const TIER_COLORS = {
  Bronze: { from: "#b45309", to: "#92400e", text: "#fbbf24" },
  Silver: { from: "#64748b", to: "#475569", text: "#e2e8f0" },
  Gold:   { from: "#b45309", to: "#78350f", text: "#fde68a" },
  Elite:  { from: "#7c3aed", to: "#4c1d95", text: "#c4b5fd" },
};

export default function ProfileScreen() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => { getCustomerEmail().then(setEmail); }, []);

  const { data: profile } = useQuery({
    queryKey: ["customerProfile", email],
    queryFn: () => getCustomerProfile(email!),
    enabled: !!email,
  });

  const { data: loyalty } = useQuery({
    queryKey: ["loyalty", email],
    queryFn: () => getLoyalty(email!),
    enabled: !!email,
  });

  async function handleLogout() {
    Alert.alert(
      "Abmelden",
      "Möchtest du dich wirklich abmelden?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Abmelden", style: "destructive",
          onPress: async () => {
            await clearCustomerEmail();
            router.replace("/(auth)/login");
          },
        },
      ],
    );
  }

  const tierConfig = loyalty ? TIER_COLORS[loyalty.tier] : TIER_COLORS.Bronze;
  const name = profile?.displayName ?? email?.split("@")[0] ?? "Gast";
  const pointsToNext = loyalty?.nextTierPoints ? loyalty.nextTierPoints - loyalty.points : 0;
  const progressPct = loyalty && loyalty.nextTierPoints
    ? Math.min(100, (loyalty.points / loyalty.nextTierPoints) * 100)
    : 100;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Mein Profil</Text>
          <TouchableOpacity style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Avatar + Name */}
        <View style={styles.avatarSection}>
          <LinearGradient
            colors={["#8b5cf6", "#ec4899"]}
            style={styles.avatarGradient}
          >
            <Text style={styles.avatarLetter}>{name[0].toUpperCase()}</Text>
          </LinearGradient>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.emailText}>{email}</Text>
        </View>

        {/* Loyalty Card */}
        {loyalty && (
          <LinearGradient
            colors={[tierConfig.from, tierConfig.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.loyaltyCard}
          >
            <View style={styles.loyaltyTop}>
              <View>
                <Text style={[styles.loyaltyTier, { color: tierConfig.text }]}>{loyalty.tier}</Text>
                <Text style={styles.loyaltyLabel}>Mitglied</Text>
              </View>
              <View style={styles.pointsBadge}>
                <Text style={styles.pointsValue}>{loyalty.points}</Text>
                <Text style={styles.pointsLabel}>Punkte</Text>
              </View>
            </View>

            {loyalty.nextTier && (
              <View style={styles.progressSection}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  Noch {pointsToNext} Punkte bis {loyalty.nextTier}
                </Text>
              </View>
            )}
          </LinearGradient>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { icon: "calendar", label: "Buchungen", value: profile?.visitCount ?? 0 },
            { icon: "star", label: "Bewertungen", value: profile?.reviewCount ?? 0 },
            { icon: "people", label: "Freunde", value: profile?.friendCount ?? 0 },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Ionicons name={stat.icon as any} size={22} color={Colors.violet} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Menu Items */}
        <View style={styles.menu}>
          {[
            { icon: "bookmark-outline", label: "Meine Buchungen", onPress: () => router.push("/(tabs)/bookings") },
            { icon: "people-outline", label: "Freunde", onPress: () => router.push("/(tabs)/friends") },
            { icon: "chatbubbles-outline", label: "Nachrichten", onPress: () => router.push("/messages/") },
            { icon: "notifications-outline", label: "Benachrichtigungen", onPress: () => {} },
            { icon: "shield-outline", label: "Datenschutz", onPress: () => {} },
            { icon: "help-circle-outline", label: "Hilfe & Support", onPress: () => {} },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon as any} size={20} color={Colors.violet} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSubtle} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Abmelden</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
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
  title: {
    color: Colors.text,
    fontSize: Typography["2xl"],
    fontWeight: "800",
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    gap: 8,
  },
  avatarGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: "#fff",
    fontSize: Typography["3xl"],
    fontWeight: "800",
  },
  name: {
    color: Colors.text,
    fontSize: Typography.xl,
    fontWeight: "700",
  },
  emailText: {
    color: Colors.textSubtle,
    fontSize: Typography.sm,
  },
  loyaltyCard: {
    marginHorizontal: Spacing.md,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: 16,
  },
  loyaltyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  loyaltyTier: {
    fontSize: Typography["2xl"],
    fontWeight: "800",
  },
  loyaltyLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: Typography.sm,
  },
  pointsBadge: {
    alignItems: "flex-end",
  },
  pointsValue: {
    color: "#fff",
    fontSize: Typography["3xl"],
    fontWeight: "800",
  },
  pointsLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: Typography.sm,
  },
  progressSection: {
    gap: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 3,
  },
  progressText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: Typography.xs,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    gap: 10,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    padding: 14,
    gap: 4,
  },
  statValue: {
    color: Colors.text,
    fontSize: Typography.xl,
    fontWeight: "800",
  },
  statLabel: {
    color: Colors.textSubtle,
    fontSize: Typography.xs,
    textAlign: "center",
  },
  menu: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.base,
    fontWeight: "500",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: Spacing.md,
    paddingVertical: 16,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  logoutText: {
    color: Colors.error,
    fontSize: Typography.base,
    fontWeight: "700",
  },
});
