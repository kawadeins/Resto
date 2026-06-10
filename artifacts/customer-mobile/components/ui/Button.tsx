import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Spacing, Radius } from "@/constants/theme";

type Variant = "gradient" | "outline" | "ghost" | "secondary";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends TouchableOpacityProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  label: string;
  fullWidth?: boolean;
}

const sizeStyles: Record<Size, { container: ViewStyle; text: TextStyle }> = {
  sm: { container: { paddingVertical: 8, paddingHorizontal: 14 }, text: { fontSize: 13 } },
  md: { container: { paddingVertical: 12, paddingHorizontal: 20 }, text: { fontSize: 15 } },
  lg: { container: { paddingVertical: 16, paddingHorizontal: 28 }, text: { fontSize: 17 } },
};

export function Button({
  variant = "gradient",
  size = "md",
  loading = false,
  label,
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  if (variant === "gradient") {
    return (
      <TouchableOpacity
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[{ borderRadius: Radius.lg, overflow: "hidden", width: fullWidth ? "100%" : undefined }, style as ViewStyle]}
        {...props}
      >
        <LinearGradient
          colors={isDisabled ? ["#4a4a4a", "#5a5a5a"] : ["#8b5cf6", "#ec4899"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[s.container, { alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }]}
        >
          {loading && <ActivityIndicator size="small" color="#fff" />}
          <Text style={[s.text, { color: "#fff", fontWeight: "700" }]}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const containerStyle: ViewStyle = {
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    width: fullWidth ? "100%" : undefined,
    ...(variant === "outline" ? {
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: "transparent",
    } : {}),
    ...(variant === "secondary" ? { backgroundColor: Colors.bgElevated } : {}),
    ...(variant === "ghost" ? { backgroundColor: "transparent" } : {}),
  };

  const textColor = variant === "outline" || variant === "ghost" ? Colors.text : Colors.text;

  return (
    <TouchableOpacity
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[containerStyle, s.container, { opacity: isDisabled ? 0.5 : 1 }, style as ViewStyle]}
      {...props}
    >
      {loading && <ActivityIndicator size="small" color={Colors.text} />}
      <Text style={[s.text, { color: textColor, fontWeight: "600" }]}>{label}</Text>
    </TouchableOpacity>
  );
}
