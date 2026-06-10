import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, StyleSheet, Alert, ScrollView,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius, Typography } from "@/constants/theme";
import { requestCustomerOtp } from "@/lib/api";
import * as SecureStore from "expo-secure-store";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Ungültige E-Mail", "Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }

    setLoading(true);
    try {
      const res = await requestCustomerOtp(email.trim().toLowerCase());
      await SecureStore.setItemAsync("pending_email", email.trim().toLowerCase());
      // In dev mode, pass the code directly
      router.push({ pathname: "/(auth)/verify", params: { devCode: res.devCode ?? "" } });
    } catch (err: any) {
      Alert.alert("Fehler", err?.response?.data?.error ?? "Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={["#8b5cf6", "#ec4899"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoGradient}
          >
            <Ionicons name="restaurant" size={28} color="#fff" />
          </LinearGradient>
          <Text style={styles.logoText}>RestoSmart</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Entdecke die{"\n"}besten Restaurants</Text>
          <Text style={styles.heroSubtitle}>
            Buche Tische, sammle Punkte und erlebe kulinarische Erlebnisse in deiner Stadt.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>E-Mail-Adresse</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="deine@email.de"
            placeholderTextColor={Colors.textSubtle}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={handleContinue}
            returnKeyType="done"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#8b5cf6", "#ec4899"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              {loading ? (
                <Text style={styles.buttonText}>Wird gesendet...</Text>
              ) : (
                <>
                  <Text style={styles.buttonText}>Code senden</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Features */}
        <View style={styles.features}>
          {[
            { icon: "calendar-outline", text: "Tische reservieren" },
            { icon: "star-outline", text: "Punkte sammeln" },
            { icon: "people-outline", text: "Mit Freunden teilen" },
          ].map((f) => (
            <View key={f.text} style={styles.featureItem}>
              <Ionicons name={f.icon as any} size={20} color={Colors.violet} />
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.terms}>
          Mit der Anmeldung stimmst du unseren{" "}
          <Text style={styles.termsLink}>Nutzungsbedingungen</Text> zu.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: Spacing.lg,
    justifyContent: "center",
    gap: 32,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    alignSelf: "center",
  },
  logoGradient: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: Colors.text,
    fontSize: Typography["2xl"],
    fontWeight: "800",
  },
  hero: {
    gap: 10,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: Typography["3xl"],
    fontWeight: "800",
    lineHeight: 38,
  },
  heroSubtitle: {
    color: Colors.textMuted,
    fontSize: Typography.base,
    lineHeight: 22,
  },
  form: {
    gap: 12,
  },
  label: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  input: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: Typography.base,
  },
  button: {
    borderRadius: Radius.lg,
    overflow: "hidden",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  buttonText: {
    color: "#fff",
    fontSize: Typography.base,
    fontWeight: "700",
  },
  features: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  featureItem: {
    alignItems: "center",
    gap: 6,
  },
  featureText: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: "center",
  },
  terms: {
    color: Colors.textSubtle,
    fontSize: Typography.xs,
    textAlign: "center",
  },
  termsLink: {
    color: Colors.violet,
  },
});
