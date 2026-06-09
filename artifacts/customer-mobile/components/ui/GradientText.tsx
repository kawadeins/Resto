import React from "react";
import { Text, type TextProps } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";

interface GradientTextProps extends TextProps {
  colors?: [string, string];
}

export function GradientText({
  colors = ["#8b5cf6", "#ec4899"],
  style,
  children,
  ...props
}: GradientTextProps) {
  return (
    <MaskedView maskElement={<Text style={style} {...props}>{children}</Text>}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text style={[style, { opacity: 0 }]} {...props}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}
