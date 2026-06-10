import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, Radius, Typography } from "@/constants/theme";
import { getMyBookings, cancelBooking, type Booking } from "@/lib/api";
import { getCustomerEmail } from "@/lib/storage";

const STATUS_CONFIG = {
  pending:   { label: "Ausstehend",  color: Colors.warning,  icon: "time-outline" },
  confirmed: { label: "Bestätigt",   color: Colors.success,  icon: "checkmark-circle-outline" },
  cancelled: { label: "Storniert",   color: Colors.error,    icon: "close-circle-outline" },
  arrived:   { label: "Angekommen",  color: Colors.violet,   icon: "star-outline" },
} as const;

function BookingCard({ booking, onCancel }: { booking: Booking; onCancel: (id: number) => void }) {
  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/restaurant/${booking.restaurantId}`)}
    >
      <Image source={{ uri: booking.restaurantImage }} style={styles.cardImage} contentFit="cover" />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.restaurantName} numberOfLines={1}>{booking.restaurantName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${cfg.color}20`, borderColor: `${cfg.color}40` }]}>
            <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textSubtle} />
            <Text style={styles.detailText}>{booking.date}</Text>
            <Ionicons name="time-outline" size={14} color={Colors.textSubtle} />
            <Text style={styles.detailText}>{booking.time} Uhr</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={14} color={Colors.textSubtle} />
            <Text style={styles.detailText}>{booking.partySize} Personen</Text>
          </View>
        </View>

        {booking.status === "pending" || booking.status === "confirmed" ? (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={(e) => { e.stopPropagation?.(); onCancel(booking.id); }}
          >
            <Text style={styles.cancelText}>Stornieren</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function BookingsScreen() {
  const [email, setEmail] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => { getCustomerEmail().then(setEmail); }, []);

  const { data: bookings = [], isFetching, refetch } = useQuery({
    queryKey: ["myBookings", email],
    queryFn: () => getMyBookings(email!),
    enabled: !!email,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["myBookings"] }),
    onError: () => Alert.alert("Fehler", "Buchung konnte nicht storniert werden."),
  });

  function handleCancel(id: number) {
    Alert.alert(
      "Buchung stornieren",
      "Möchtest du diese Buchung wirklich stornieren?",
      [
        { text: "Abbrechen", style: "cancel" },
        { text: "Stornieren", style: "destructive", onPress: () => cancelMutation.mutate(id) },
      ],
    );
  }

  const upcoming = bookings.filter((b) => b.status === "pending" || b.status === "confirmed");
  const past = bookings.filter((b) => b.status === "arrived" || b.status === "cancelled");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meine Buchungen</Text>
        <Text style={styles.headerSubtitle}>{bookings.length} Buchungen insgesamt</Text>
      </View>

      <FlatList
        data={[...upcoming, ...past]}
        keyExtractor={(b) => String(b.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={isFetching}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={
          upcoming.length > 0 && past.length > 0 ? (
            <View style={{ gap: 4, marginBottom: 16 }}>
              <Text style={styles.sectionLabel}>Bevorstehend</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <>
            {index === upcoming.length && past.length > 0 && (
              <Text style={[styles.sectionLabel, { marginBottom: 12, marginTop: 4 }]}>Vergangene</Text>
            )}
            <BookingCard booking={item} onCancel={handleCancel} />
          </>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🗓️</Text>
            <Text style={styles.emptyTitle}>Keine Buchungen</Text>
            <Text style={styles.emptyText}>Entdecke Restaurants und mache deine erste Reservierung!</Text>
            <TouchableOpacity
              style={styles.discoverBtn}
              onPress={() => router.push("/(tabs)/explore")}
            >
              <Text style={styles.discoverBtnText}>Restaurants entdecken</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: Typography["2xl"],
    fontWeight: "800",
  },
  headerSubtitle: {
    color: Colors.textSubtle,
    fontSize: Typography.sm,
    marginTop: 2,
  },
  list: {
    padding: Spacing.md,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    flexDirection: "row",
  },
  cardImage: {
    width: 90,
    height: 100,
  },
  cardContent: {
    flex: 1,
    padding: 12,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  restaurantName: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.base,
    fontWeight: "700",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  details: {
    gap: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  detailText: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
  },
  cancelBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.4)",
  },
  cancelText: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: "600",
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
    textAlign: "center",
    lineHeight: 22,
  },
  discoverBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  discoverBtnText: {
    color: Colors.violet,
    fontSize: Typography.base,
    fontWeight: "700",
  },
});
