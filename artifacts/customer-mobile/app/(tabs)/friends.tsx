import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, Radius, Typography } from "@/constants/theme";
import { getFriends, sendFriendRequest, respondToFriendRequest, type Friend } from "@/lib/api";
import { getCustomerEmail } from "@/lib/storage";

function FriendItem({
  friend,
  currentEmail,
  onRespond,
}: { friend: Friend; currentEmail: string; onRespond: (id: number, action: "accept" | "decline") => void }) {
  const isPending = friend.status === "pending";
  const isIncoming = isPending && !friend.isRequester;

  return (
    <View style={styles.friendCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(friend.displayName ?? friend.email)[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{friend.displayName ?? friend.email.split("@")[0]}</Text>
        <Text style={styles.friendEmail} numberOfLines={1}>{friend.email}</Text>
      </View>
      {isIncoming ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn]}
            onPress={() => onRespond(friend.id, "accept")}
          >
            <Ionicons name="checkmark" size={16} color={Colors.success} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.declineBtn]}
            onPress={() => onRespond(friend.id, "decline")}
          >
            <Ionicons name="close" size={16} color={Colors.error} />
          </TouchableOpacity>
        </View>
      ) : isPending ? (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>Ausstehend</Text>
        </View>
      ) : (
        <View style={styles.friendBadge}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
        </View>
      )}
    </View>
  );
}

export default function FriendsScreen() {
  const [email, setEmail] = useState<string | null>(null);
  const [newFriendEmail, setNewFriendEmail] = useState("");
  const qc = useQueryClient();

  useEffect(() => { getCustomerEmail().then(setEmail); }, []);

  const { data: friends = [], isFetching, refetch } = useQuery({
    queryKey: ["friends", email],
    queryFn: () => getFriends(email!),
    enabled: !!email,
    refetchInterval: 15000,
  });

  const sendMutation = useMutation({
    mutationFn: () => sendFriendRequest(email!, newFriendEmail.trim().toLowerCase()),
    onSuccess: () => {
      setNewFriendEmail("");
      qc.invalidateQueries({ queryKey: ["friends"] });
      Alert.alert("Anfrage gesendet", "Freundschaftsanfrage wurde gesendet!");
    },
    onError: (err: any) => {
      Alert.alert("Fehler", err?.response?.data?.error ?? "Anfrage konnte nicht gesendet werden.");
    },
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "accept" | "decline" }) =>
      respondToFriendRequest(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] }),
  });

  const accepted = friends.filter((f) => f.status === "accepted");
  const pending = friends.filter((f) => f.status === "pending");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Freunde</Text>
        <Text style={styles.subtitle}>{accepted.length} Freunde · {pending.length} ausstehend</Text>
      </View>

      {/* Add Friend */}
      <View style={styles.addFriendRow}>
        <TextInput
          style={styles.input}
          placeholder="E-Mail eines Freundes..."
          placeholderTextColor={Colors.textSubtle}
          value={newFriendEmail}
          onChangeText={setNewFriendEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!newFriendEmail || sendMutation.isPending) && { opacity: 0.5 }]}
          onPress={() => sendMutation.mutate()}
          disabled={!newFriendEmail || sendMutation.isPending}
        >
          {sendMutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="person-add" size={18} color="#fff" />
          }
        </TouchableOpacity>
      </View>

      <FlatList
        data={[...pending, ...accepted]}
        keyExtractor={(f) => String(f.id)}
        onRefresh={refetch}
        refreshing={isFetching}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={
          pending.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Eingehende Anfragen</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <>
            {index === pending.length && accepted.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Meine Freunde</Text>
              </View>
            )}
            <FriendItem
              friend={item}
              currentEmail={email ?? ""}
              onRespond={(id, action) => respondMutation.mutate({ id, action })}
            />
          </>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>Noch keine Freunde</Text>
            <Text style={styles.emptyText}>Lade Freunde ein und entdeckt gemeinsam Restaurants!</Text>
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
  addFriendRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: Typography.base,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  sectionHeader: {
    marginBottom: 8,
    marginTop: 4,
  },
  sectionLabel: {
    color: Colors.textSubtle,
    fontSize: Typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: Colors.violet,
    fontSize: Typography.lg,
    fontWeight: "700",
  },
  friendInfo: {
    flex: 1,
    gap: 2,
  },
  friendName: {
    color: Colors.text,
    fontSize: Typography.base,
    fontWeight: "600",
  },
  friendEmail: {
    color: Colors.textSubtle,
    fontSize: Typography.xs,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  acceptBtn: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderColor: "rgba(34, 197, 94, 0.4)",
  },
  declineBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  pendingText: {
    color: Colors.warning,
    fontSize: 11,
    fontWeight: "600",
  },
  friendBadge: {},
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
});
