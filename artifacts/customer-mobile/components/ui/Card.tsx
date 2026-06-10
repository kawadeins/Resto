import React from "react";
import { View, type ViewProps } from "react-native";
import { Colors, Radius } from "@/constants/theme";

interface CardProps extends ViewProps {
  elevated?: boolean;
}

export function Card({ elevated = false, style, children, ...props }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: elevated ? Colors.bgElevated : Colors.bgCard,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: Colors.border,
          overflow: "hidden",
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
