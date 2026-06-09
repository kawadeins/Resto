import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, Radius, Typography } from "@/constants/theme";
import { getConversations, type Conversation } from "@/lib/api";
import { getCustomerEmail } from "@/lib/storage";

function ConvCard({ conv, currentEmail }: { conv: Conversation; currentEmail: string }) {
  const others = conv.participants.filter((p) => p.email !== currentEmail);
  const name = conv.isGroup ? conv.name : (others[0]?.displayName ?? others[0]?.email.split("@")[0]);
  const initial = (name ?? "?")[0].toUpperCase();

  return (
    <TouchableOpacity
      style={styles.convCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/messages/${conv.id}`)}
    >
      <View style={styles.convAvatar}>
        <Text style={styles.convAvatarText}>{initial}</Text>
        {conv.isGroup && (
          <View style={styles.groupBadge}>
            <Ionicons name="people" size={8} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.convInfo}>
        <View style={styles.convHeader}>
          <Text style={styles.convName} numberOfLines={1}>{name ?? "Unbekannt"}</Text>
          {conv.lastMessage && (
            <Text style={styles.convTime}>
              {new Date(conv.lastMessage.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
            </Text>
          )}
        </View>
        <View style={styles.convPreview}>
          <Text style={styles.convLastMsg} numberOfLines={1}>
            {conv.lastMessage?.content ?? "Keine Nachrichten"}
          </Text>
          {conv.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{conv.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MessagesScreen() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => { getCustomerEmail().then(setEmail); }, []);

  const { data: conversations = [], isFetching, refetch } = useQuery({
    queryKey: ["conversations", email],
    queryFn: () => getConversations(email!),
    enabled: !!email,
    refetchInterval: 5000,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Nachrichten</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(c) => String(c.id)}
        onRefresh={refetch}
        refreshing={isFetching}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => <ConvCard conv={item} currentEmail={email ?? ""} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Keine Nachrichten</Text>
            <Text style={styles.emptyText}>Verbinde dich mit Freunden und chatte!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.xl,
    fontWeight: "800",
  },
  list: {
    flexGrow: 1,
  },
  convCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  convAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(139,92,246,0.2)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  convAvatarText: {
    color: Colors.violet,
    fontSize: Typography.xl,
    fontWeight: "700",
  },
  groupBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.violet,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.bg,
  },
  convInfo: {
    flex: 1,
    gap: 3,
  },
  convHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  convName: {
    color: Colors.text,
    fontSize: Typography.base,
    fontWeight: "700",
    flex: 1,
  },
  convTime: {
    color: Colors.textSubtle,
    fontSize: Typography.xs,
  },
  convPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  convLastMsg: {
    flex: 1,
    color: Colors.textSubtle,
    fontSize: Typography.sm,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.violet,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md + 50 + 12,
  },
  empty: {
    flex: 1,
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
  },
});
