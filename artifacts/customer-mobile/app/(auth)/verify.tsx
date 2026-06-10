import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { Colors, Spacing, Radius, Typography } from "@/constants/theme";
import { verifyCustomerOtp, requestCustomerOtp } from "@/lib/api";
import { saveCustomerEmail } from "@/lib/storage";

export default function VerifyScreen() {
  const { devCode } = useLocalSearchParams<{ devCode?: string }>();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const inputs = useRef<TextInput[]>([]);

  useEffect(() => {
    SecureStore.getItemAsync("pending_email").then((e) => {
      if (e) setEmail(e);
    });
    // Dev mode: auto-fill code
    if (devCode && devCode.length === 6) {
      const chars = devCode.split("");
      setCode(chars);
    }
  }, [devCode]);

  function handleChange(val: string, index: number) {
    const newCode = [...code];
    newCode[index] = val.replace(/[^0-9]/g, "").slice(-1);
    setCode(newCode);
    if (val && index < 5) inputs.current[index + 1]?.focus();
    if (!val && index > 0) inputs.current[index - 1]?.focus();
    // Auto-submit when complete
    const full = newCode.join("");
    if (full.length === 6) handleVerify(full);
  }

  async function handleVerify(fullCode?: string) {
    const codeStr = fullCode ?? code.join("");
    if (codeStr.length !== 6) {
      Alert.alert("Ungültiger Code", "Bitte gib den 6-stelligen Code ein.");
      return;
    }
    setLoading(true);
    try {
      await verifyCustomerOtp(email, codeStr);
      await saveCustomerEmail(email);
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Falscher Code", "Der Code ist ungültig oder abgelaufen.");
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      await requestCustomerOtp(email);
      Alert.alert("Code gesendet", "Ein neuer Code wurde an deine E-Mail gesendet.");
    } catch {
      Alert.alert("Fehler", "Code konnte nicht gesendet werden.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Code eingeben</Text>
          <Text style={styles.subtitle}>
            Wir haben einen 6-stelligen Code an{"\n"}
            <Text style={styles.emailText}>{email}</Text> gesendet.
          </Text>
        </View>

        {/* OTP Inputs */}
        <View style={styles.otpRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { if (ref) inputs.current[i] = ref; }}
              style={[styles.otpInput, digit && styles.otpInputFilled]}
              value={digit}
              onChangeText={(val) => handleChange(val, i)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        {devCode && (
          <View style={styles.devBanner}>
            <Ionicons name="information-circle" size={16} color={Colors.warning} />
            <Text style={styles.devText}>DEV: Code ist {devCode}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.6 }]}
          onPress={() => handleVerify()}
          disabled={loading || code.join("").length < 6}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#8b5cf6", "#ec4899"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>
              {loading ? "Wird überprüft..." : "Bestätigen"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resend} onPress={handleResend}>
          <Text style={styles.resendText}>
            Keinen Code erhalten?{" "}
            <Text style={styles.resendLink}>Erneut senden</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    gap: 28,
  },
  back: {
    marginTop: Spacing.xl,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    gap: 10,
  },
  title: {
    color: Colors.text,
    fontSize: Typography["2xl"],
    fontWeight: "800",
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: Typography.base,
    lineHeight: 22,
  },
  emailText: {
    color: Colors.violet,
    fontWeight: "600",
  },
  otpRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  otpInput: {
    width: 48,
    height: 58,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    color: Colors.text,
    fontSize: Typography.xl,
    fontWeight: "700",
  },
  otpInputFilled: {
    borderColor: Colors.violet,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
  },
  devBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  devText: {
    color: Colors.warning,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  button: {
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  buttonGradient: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  buttonText: {
    color: "#fff",
    fontSize: Typography.base,
    fontWeight: "700",
  },
  resend: {
    alignItems: "center",
  },
  resendText: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  resendLink: {
    color: Colors.violet,
    fontWeight: "600",
  },
});
