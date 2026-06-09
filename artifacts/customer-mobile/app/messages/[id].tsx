import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, Radius, Typography } from "@/constants/theme";
import { getMessages, sendMessage, getConversations, type Message } from "@/lib/api";
import { getCustomerEmail } from "@/lib/storage";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const convId = parseInt(id ?? "0");
  const [email, setEmail] = useState<string | null>(null);
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);
  const qc = useQueryClient();

  useEffect(() => { getCustomerEmail().then(setEmail); }, []);

  const { data: messages = [], refetch } = useQuery({
    queryKey: ["messages", convId],
    queryFn: () => getMessages(convId, email!),
    enabled: !!email && convId > 0,
    refetchInterval: 3000,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations", email],
    queryFn: () => getConversations(email!),
    enabled: !!email,
  });

  const conv = conversations.find((c) => c.id === convId);
  const others = conv?.participants.filter((p) => p.email !== email) ?? [];
  const title = conv?.isGroup ? conv.name : (others[0]?.displayName ?? others[0]?.email.split("@")[0] ?? "Chat");

  const sendMutation = useMutation({
    mutationFn: () => sendMessage(convId, email!, text.trim()),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", convId] });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    },
  });

  function handleSend() {
    if (!text.trim() || sendMutation.isPending) return;
    sendMutation.mutate();
  }

  function isMyMsg(msg: Message) {
    return msg.senderEmail === email;
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{(title ?? "?")[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item, index }) => {
          const mine = isMyMsg(item);
          const prev = messages[index - 1];
          const showAvatar = !mine && (!prev || prev.senderEmail !== item.senderEmail);
          return (
            <View style={[styles.msgRow, mine && styles.msgRowMine]}>
              {!mine && (
                <View style={[styles.msgAvatar, !showAvatar && { opacity: 0 }]}>
                  <Text style={styles.msgAvatarText}>
                    {item.senderEmail[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                  {item.content}
                </Text>
                <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                  {formatTime(item.createdAt)}
                  {mine && (
                    <Text> {item.isRead ? "✓✓" : "✓"}</Text>
                  )}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Noch keine Nachrichten. Sag Hallo! 👋</Text>
          </View>
        }
      />

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Nachricht schreiben..."
            placeholderTextColor={Colors.textSubtle}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sendMutation.isPending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(139,92,246,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: {
    color: Colors.violet,
    fontWeight: "700",
    fontSize: Typography.base,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: Typography.base,
    fontWeight: "700",
    flex: 1,
  },
  list: {
    padding: Spacing.md,
    gap: 6,
    flexGrow: 1,
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 4,
  },
  msgRowMine: {
    justifyContent: "flex-end",
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(139,92,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  msgAvatarText: {
    color: Colors.violet,
    fontSize: 12,
    fontWeight: "700",
  },
  bubble: {
    maxWidth: "72%",
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  bubbleMine: {
    backgroundColor: Colors.violet,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: Colors.text,
    fontSize: Typography.base,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: "#fff",
  },
  bubbleTime: {
    color: Colors.textSubtle,
    fontSize: 11,
    alignSelf: "flex-end",
  },
  bubbleTimeMine: {
    color: "rgba(255,255,255,0.65)",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: Colors.textSubtle,
    fontSize: Typography.base,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: Typography.base,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
