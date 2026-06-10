import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, Radius, Typography } from "@/constants/theme";
import { getCustomerEmail, clearCustomerEmail } from "@/lib/storage";

interface ToggleSetting {
  key: string;
  label: string;
  description?: string;
  value: boolean;
  onChange: (val: boolean) => void;
}

function SettingRow({ label, description, value, onChange }: ToggleSetting) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description ? <Text style={styles.settingDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: "rgba(139,92,246,0.4)" }}
        thumbColor={value ? Colors.violet : Colors.textSubtle}
        ios_backgroundColor={Colors.bgElevated}
      />
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ActionRow({
  icon,
  label,
  sublabel,
  onPress,
  destructive,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.actionIcon, destructive && styles.actionIconDestructive]}>
        <Ionicons
          name={icon as any}
          size={18}
          color={destructive ? "#ef4444" : Colors.violet}
        />
      </View>
      <View style={styles.actionInfo}>
        <Text style={[styles.actionLabel, destructive && { color: "#ef4444" }]}>{label}</Text>
        {sublabel ? <Text style={styles.actionSublabel}>{sublabel}</Text> : null}
      </View>
      {!destructive && <Ionicons name="chevron-forward" size={16} color={Colors.textSubtle} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const [email, setEmail] = useState<string | null>(null);

  // Notification toggles
  const [pushBooking, setPushBooking] = useState(true);
  const [pushDeals, setPushDeals] = useState(true);
  const [pushFriends, setPushFriends] = useState(true);
  const [pushReminders, setPushReminders] = useState(false);

  // Privacy toggles
  const [profilePublic, setProfilePublic] = useState(true);
  const [activityVisible, setActivityVisible] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  useEffect(() => {
    getCustomerEmail().then(setEmail);
  }, []);

  function handleDeleteAccount() {
    Alert.alert(
      "Konto löschen",
      "Bist du sicher? Alle deine Daten werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            await clearCustomerEmail();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  }

  function handleLogout() {
    Alert.alert("Abmelden", "Möchtest du dich abmelden?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Abmelden",
        style: "destructive",
        onPress: async () => {
          await clearCustomerEmail();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Einstellungen</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Account */}
        <SectionHeader title="Konto" />
        <View style={styles.section}>
          <View style={styles.accountRow}>
            <View style={styles.accountAvatar}>
              <Text style={styles.accountAvatarText}>
                {(email?.[0] ?? "?").toUpperCase()}
              </Text>
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountEmail} numberOfLines={1}>{email ?? "Lädt..."}</Text>
              <Text style={styles.accountType}>Kundenkonto</Text>
            </View>
          </View>
          <ActionRow
            icon="create-outline"
            label="Profil bearbeiten"
            sublabel="Name, Avatar, Bio"
            onPress={() => {}}
          />
          <ActionRow
            icon="lock-closed-outline"
            label="Passwort & Sicherheit"
            onPress={() => {}}
          />
        </View>

        {/* Notifications */}
        <SectionHeader title="Benachrichtigungen" />
        <View style={styles.section}>
          <SettingRow
            key="pushBooking"
            label="Buchungsbestätigungen"
            description="Wenn deine Reservierung bestätigt wird"
            value={pushBooking}
            onChange={setPushBooking}
          />
          <View style={styles.divider} />
          <SettingRow
            key="pushDeals"
            label="Angebote & Aktionen"
            description="Flash Deals und Sonderangebote"
            value={pushDeals}
            onChange={setPushDeals}
          />
          <View style={styles.divider} />
          <SettingRow
            key="pushFriends"
            label="Freundesaktivitäten"
            description="Wenn Freunde buchen oder bewerten"
            value={pushFriends}
            onChange={setPushFriends}
          />
          <View style={styles.divider} />
          <SettingRow
            key="pushReminders"
            label="Erinnerungen"
            description="30 Min. vor deiner Reservierung"
            value={pushReminders}
            onChange={setPushReminders}
          />
        </View>

        {/* Privacy */}
        <SectionHeader title="Datenschutz" />
        <View style={styles.section}>
          <SettingRow
            key="profilePublic"
            label="Öffentliches Profil"
            description="Andere können dein Profil sehen"
            value={profilePublic}
            onChange={setProfilePublic}
          />
          <View style={styles.divider} />
          <SettingRow
            key="activityVisible"
            label="Aktivitäten teilen"
            description="Buchungen im Feed deiner Freunde zeigen"
            value={activityVisible}
            onChange={setActivityVisible}
          />
          <View style={styles.divider} />
          <SettingRow
            key="locationEnabled"
            label="Standort verwenden"
            description="Für Restaurantempfehlungen in der Nähe"
            value={locationEnabled}
            onChange={setLocationEnabled}
          />
        </View>

        {/* App */}
        <SectionHeader title="App" />
        <View style={styles.section}>
          <ActionRow
            icon="language-outline"
            label="Sprache"
            sublabel="Deutsch"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <ActionRow
            icon="help-circle-outline"
            label="Hilfe & Support"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <ActionRow
            icon="document-text-outline"
            label="Datenschutzerklärung"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <ActionRow
            icon="shield-checkmark-outline"
            label="Nutzungsbedingungen"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Version</Text>
            <Text style={styles.versionValue}>1.0.0</Text>
          </View>
        </View>

        {/* Danger Zone */}
        <SectionHeader title="Konto verwalten" />
        <View style={styles.section}>
          <ActionRow
            icon="log-out-outline"
            label="Abmelden"
            onPress={handleLogout}
            destructive
          />
          <View style={styles.divider} />
          <ActionRow
            icon="trash-outline"
            label="Konto löschen"
            sublabel="Alle Daten dauerhaft entfernen"
            onPress={handleDeleteAccount}
            destructive
          />
        </View>
      </ScrollView>
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
  title: {
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: "700",
  },
  sectionTitle: {
    color: Colors.textSubtle,
    fontSize: Typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.md,
    paddingTop: 24,
    paddingBottom: 8,
  },
  section: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 52,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(139,92,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  accountAvatarText: {
    color: Colors.violet,
    fontSize: Typography.xl,
    fontWeight: "700",
  },
  accountInfo: {
    flex: 1,
    gap: 2,
  },
  accountEmail: {
    color: Colors.text,
    fontSize: Typography.base,
    fontWeight: "700",
  },
  accountType: {
    color: Colors.textSubtle,
    fontSize: Typography.sm,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  settingInfo: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    color: Colors.text,
    fontSize: Typography.base,
    fontWeight: "600",
  },
  settingDesc: {
    color: Colors.textSubtle,
    fontSize: Typography.sm,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(139,92,246,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconDestructive: {
    backgroundColor: "rgba(239,68,68,0.1)",
  },
  actionInfo: {
    flex: 1,
    gap: 2,
  },
  actionLabel: {
    color: Colors.text,
    fontSize: Typography.base,
    fontWeight: "600",
  },
  actionSublabel: {
    color: Colors.textSubtle,
    fontSize: Typography.sm,
  },
  versionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  versionLabel: {
    color: Colors.textMuted,
    fontSize: Typography.base,
  },
  versionValue: {
    color: Colors.textSubtle,
    fontSize: Typography.base,
  },
});
