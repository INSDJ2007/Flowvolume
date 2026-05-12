// Web stub: render a small placeholder strip so the layout looks right in preview.
import React from "react";
import { View, Text, StyleSheet } from "react-native";

const COLORS = {
  surface: "#1E1E1E",
  border: "rgba(255,255,255,0.08)",
  muted: "rgba(255,255,255,0.5)",
};

export default function AdBanner() {
  return (
    <View style={styles.wrap} testID="ad-banner-placeholder">
      <Text style={styles.label}>Ad placeholder (real banner shows in APK)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: 50,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  label: { color: COLORS.muted, fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
});
