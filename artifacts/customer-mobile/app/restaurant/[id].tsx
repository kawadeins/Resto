import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, Modal, FlatList,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, Radius, Typography } from "@/constants/theme";
import {
  getRestaurant, getAvailableSlots, createBooking, getReviews,
  type Review,
} from "@/lib/api";
import { getCustomerEmail } from "@/lib/storage";

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];

function getNextDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      label: i === 0 ? "Heute" : i === 1 ? "Morgen" : d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric" }),
      value: d.toISOString().split("T")[0],
    };
  });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= rating ? "star" : i - 0.5 <= rating ? "star-half" : "star-outline"}
          size={14}
          color="#f59e0b"
        />
      ))}
    </View>
  );
}

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rid = parseInt(id ?? "0");
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [showBooking, setShowBooking] = useState(false);
  const days = getNextDays(7);
  const qc = useQueryClient();

  useEffect(() => { getCustomerEmail().then(setCustomerEmail); }, []);

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant", rid],
    queryFn: () => getRestaurant(rid),
    enabled: rid > 0,
  });

  const { data: slotsData } = useQuery({
    queryKey: ["slots", rid, selectedDate],
    queryFn: () => getAvailableSlots(rid, selectedDate),
    enabled: rid > 0,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", rid],
    queryFn: () => getReviews(rid),
    enabled: rid > 0,
  });

  const bookMutation = useMutation({
    mutationFn: () => createBooking({
      restaurantId: rid,
      date: selectedDate,
      time: selectedTime!,
      partySize,
      customerName: guestName,
      customerEmail: customerEmail!,
      customerPhone: guestPhone,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myBookings"] });
      setShowBooking(false);
      Alert.alert(
        "Buchung bestätigt! 🎉",
        `Deine Reservierung bei ${restaurant?.name} am ${selectedDate} um ${selectedTime} Uhr für ${partySize} Personen wurde aufgenommen.`,
        [{ text: "Meine Buchungen", onPress: () => router.push("/(tabs)/bookings") }, { text: "OK" }],
      );
    },
    onError: (err: any) => {
      Alert.alert("Fehler", err?.response?.data?.error ?? "Buchung fehlgeschlagen.");
    },
  });

  const slots = slotsData?.slots ?? [];

  if (isLoading || !restaurant) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: Colors.textMuted }}>Wird geladen...</Text>
      </View>
    );
  }

  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : parseFloat(restaurant.rating);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroContainer}>
          <Image source={{ uri: restaurant.heroImage }} style={styles.heroImage} contentFit="cover" />
          <LinearGradient colors={["rgba(0,0,0,0.4)", "transparent", Colors.bg]} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.heroButtons} edges={["top"]}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>
          {restaurant.isPartner && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={12} color="#f59e0b" />
              <Text style={styles.premiumText}>Premium</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Basic Info */}
          <View style={styles.infoHeader}>
            <View style={styles.infoLeft}>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{restaurant.cuisineEmoji} {restaurant.cuisine}</Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.metaText}>{restaurant.priceRange}</Text>
              </View>
            </View>
            <View style={styles.ratingBox}>
              <Text style={styles.ratingValue}>{avgRating.toFixed(1)}</Text>
              <Ionicons name="star" size={14} color="#f59e0b" />
              <Text style={styles.reviewCount}>({reviews.length})</Text>
            </View>
          </View>

          {/* Contact Row */}
          <View style={styles.contactRow}>
            <Ionicons name="location-outline" size={16} color={Colors.textSubtle} />
            <Text style={styles.contactText} numberOfLines={1}>{restaurant.address}</Text>
            {restaurant.phone && (
              <>
                <Text style={styles.dot}>·</Text>
                <Ionicons name="call-outline" size={16} color={Colors.textSubtle} />
                <Text style={styles.contactText}>{restaurant.phone}</Text>
              </>
            )}
          </View>

          {/* Description */}
          {restaurant.description && (
            <Text style={styles.description}>{restaurant.description}</Text>
          )}

          {/* Book CTA */}
          <TouchableOpacity
            style={styles.bookNowBtn}
            activeOpacity={0.85}
            onPress={() => setShowBooking(true)}
          >
            <LinearGradient
              colors={["#8b5cf6", "#ec4899"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.bookNowGradient}
            >
              <Ionicons name="calendar-outline" size={20} color="#fff" />
              <Text style={styles.bookNowText}>Tisch reservieren</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Reviews */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bewertungen</Text>
            {reviews.slice(0, 5).map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>{r.customerName[0].toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.reviewName}>{r.customerName}</Text>
                    <StarRating rating={r.rating} />
                  </View>
                  <Text style={styles.reviewDate}>
                    {new Date(r.createdAt).toLocaleDateString("de-DE")}
                  </Text>
                </View>
                <Text style={styles.reviewComment}>{r.comment}</Text>
                {r.ownerReply && (
                  <View style={styles.ownerReply}>
                    <Text style={styles.ownerReplyLabel}>Antwort des Inhabers:</Text>
                    <Text style={styles.ownerReplyText}>{r.ownerReply}</Text>
                  </View>
                )}
              </View>
            ))}
            {reviews.length === 0 && (
              <Text style={styles.noReviews}>Noch keine Bewertungen.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Booking Modal */}
      <Modal visible={showBooking} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tisch reservieren</Text>
            <TouchableOpacity onPress={() => setShowBooking(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Date Selection */}
            <Text style={styles.fieldLabel}>Datum</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {days.map((d) => (
                  <TouchableOpacity
                    key={d.value}
                    style={[styles.dateChip, selectedDate === d.value && styles.dateChipActive]}
                    onPress={() => { setSelectedDate(d.value); setSelectedTime(null); }}
                  >
                    <Text style={[styles.dateChipText, selectedDate === d.value && styles.dateChipTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Party Size */}
            <Text style={styles.fieldLabel}>Personenanzahl</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {PARTY_SIZES.map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.sizeChip, partySize === n && styles.sizeChipActive]}
                    onPress={() => setPartySize(n)}
                  >
                    <Text style={[styles.sizeChipText, partySize === n && styles.sizeChipTextActive]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Time Slots */}
            <Text style={styles.fieldLabel}>Uhrzeit</Text>
            {slots.length > 0 ? (
              <View style={styles.slotsGrid}>
                {slots.map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.slotChip, selectedTime === slot && styles.slotChipActive]}
                    onPress={() => setSelectedTime(slot)}
                  >
                    <Text style={[styles.slotText, selectedTime === slot && styles.slotTextActive]}>{slot}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.noSlots}>Keine freien Zeitfenster für diesen Tag.</Text>
            )}

            {/* Guest Details */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Deine Kontaktdaten</Text>
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={Colors.textSubtle}
              value={guestName}
              onChangeText={setGuestName}
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Telefonnummer (optional)"
              placeholderTextColor={Colors.textSubtle}
              value={guestPhone}
              onChangeText={setGuestPhone}
              keyboardType="phone-pad"
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (!selectedTime || !guestName || bookMutation.isPending) && { opacity: 0.5 },
              ]}
              onPress={() => bookMutation.mutate()}
              disabled={!selectedTime || !guestName || bookMutation.isPending}
            >
              <LinearGradient
                colors={["#8b5cf6", "#ec4899"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmGradient}
              >
                <Text style={styles.confirmText}>
                  {bookMutation.isPending ? "Wird gebucht..." : "Jetzt reservieren"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    height: 300,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroButtons: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumBadge: {
    position: "absolute",
    bottom: 60,
    left: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  premiumText: {
    color: "#f59e0b",
    fontSize: Typography.sm,
    fontWeight: "700",
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
    marginTop: -Spacing.xl,
  },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  infoLeft: { flex: 1, gap: 4 },
  restaurantName: {
    color: Colors.text,
    fontSize: Typography["2xl"],
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  dot: { color: Colors.textSubtle },
  ratingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 8,
  },
  ratingValue: {
    color: Colors.text,
    fontSize: Typography.base,
    fontWeight: "800",
  },
  reviewCount: {
    color: Colors.textSubtle,
    fontSize: Typography.xs,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  contactText: {
    color: Colors.textSubtle,
    fontSize: Typography.sm,
    flex: 1,
  },
  description: {
    color: Colors.textMuted,
    fontSize: Typography.base,
    lineHeight: 22,
  },
  bookNowBtn: {
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  bookNowGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  bookNowText: {
    color: "#fff",
    fontSize: Typography.lg,
    fontWeight: "800",
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: "700",
  },
  reviewCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(139,92,246,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: {
    color: Colors.violet,
    fontWeight: "700",
    fontSize: Typography.base,
  },
  reviewName: {
    color: Colors.text,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  reviewDate: {
    marginLeft: "auto",
    color: Colors.textSubtle,
    fontSize: Typography.xs,
  },
  reviewComment: {
    color: Colors.textMuted,
    fontSize: Typography.base,
    lineHeight: 20,
  },
  ownerReply: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.sm,
    padding: 10,
    borderLeftWidth: 2,
    borderLeftColor: Colors.violet,
    gap: 4,
  },
  ownerReplyLabel: {
    color: Colors.violet,
    fontSize: Typography.xs,
    fontWeight: "700",
  },
  ownerReplyText: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  noReviews: {
    color: Colors.textSubtle,
    fontSize: Typography.base,
    textAlign: "center",
    paddingVertical: 20,
  },
  // Modal
  modal: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: Typography.xl,
    fontWeight: "800",
  },
  modalContent: {
    padding: Spacing.md,
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontWeight: "700",
    marginBottom: 8,
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateChipActive: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderColor: Colors.violet,
  },
  dateChipText: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  dateChipTextActive: { color: Colors.violet },
  sizeChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeChipActive: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderColor: Colors.violet,
  },
  sizeChipText: {
    color: Colors.textMuted,
    fontWeight: "700",
    fontSize: Typography.base,
  },
  sizeChipTextActive: { color: Colors.violet },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  slotChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slotChipActive: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderColor: Colors.violet,
  },
  slotText: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  slotTextActive: { color: Colors.violet },
  noSlots: {
    color: Colors.textSubtle,
    fontSize: Typography.sm,
    paddingVertical: 12,
  },
  input: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: Typography.base,
  },
  modalFooter: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  confirmBtn: {
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  confirmGradient: {
    alignItems: "center",
    paddingVertical: 16,
  },
  confirmText: {
    color: "#fff",
    fontSize: Typography.lg,
    fontWeight: "800",
  },
});
