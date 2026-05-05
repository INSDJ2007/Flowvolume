import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { activatePro, fetchSubscription, getUserId, Subscription } from "../src/lib/api";

const COLORS = {
  bg: "#0A0A0A",
  bg2: "#121826",
  surface: "#1E1E1E",
  glass: "rgba(30,30,38,0.7)",
  border: "rgba(255,255,255,0.08)",
  neon: "#00E5FF",
  neon2: "#3A86FF",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.6)",
};

type Plan = "trial" | "monthly" | "quarterly";

const PLANS: { id: Plan; price: string; period: string; tag?: string; sub: string }[] = [
  { id: "trial", price: "Free", period: "3-Day Trial", sub: "Try Pro free, cancel anytime" },
  { id: "monthly", price: "₹29", period: "/month", sub: "Billed monthly" },
  { id: "quarterly", price: "₹79", period: "/3 months", tag: "Save 9%", sub: "Best value" },
];

const FEATURES = [
  { icon: "mic-circle", title: "AI Noise Detection", desc: "Auto-adapts to wind & traffic noise." },
  { icon: "options", title: "Custom Speed Mapping", desc: "Define your own speed → volume curves." },
  { icon: "notifications", title: "Quick Controls", desc: "Persistent notification with mode toggles." },
  { icon: "shield-checkmark", title: "No Ads", desc: "Pure, distraction-free flow." },
];

export default function PaywallScreen() {
  const router = useRouter();
  const [userId, setUid] = useState<string | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [selected, setSelected] = useState<Plan>("quarterly");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const id = await getUserId();
      setUid(id);
      setSub(await fetchSubscription(id));
    })();
  }, []);

  const handleActivate = async () => {
    if (!userId) return;
    setBusy(true);
    const updated = await activatePro(userId, selected);
    setSub(updated);
    setBusy(false);
    router.back();
  };

  const isPro = sub?.tier === "pro";

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1771616886034-ebc77c321213?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwxfHxjeWNsaXN0JTIwcmlkaW5nJTIwbmlnaHQlMjBkYXJrJTIwYmx1cnxlbnwwfHx8fDE3Nzc5NjM0OTZ8MA&ixlib=rb-4.1.0&q=85",
        }}
        resizeMode="cover"
        style={styles.heroBg}
      >
        <LinearGradient
          colors={["rgba(10,10,10,0.4)", "rgba(10,10,10,0.95)", "#0A0A0A"]}
          style={StyleSheet.absoluteFill as any}
        />
        <SafeAreaView edges={["top"]} style={styles.heroSafe}>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.closeBtn}
              testID="paywall-close-btn"
            >
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.kicker}>FLOWVOLUME PRO</Text>
            <Text style={styles.heroTitle}>Unleash{"\n"}Smart Flow.</Text>
            <Text style={styles.heroSub}>
              AI-powered audio that adapts to your speed and the world around you.
            </Text>
          </View>
        </SafeAreaView>
      </ImageBackground>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Features */}
        <View style={styles.featuresGrid}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <Ionicons name={f.icon as any} size={22} color={COLORS.neon} />
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>

        {/* Plans */}
        <Text style={styles.sectionTitle}>Choose Your Plan</Text>
        <View style={{ gap: 12 }}>
          {PLANS.map((p) => {
            const sel = selected === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                testID={`plan-${p.id}`}
                onPress={() => setSelected(p.id)}
                activeOpacity={0.9}
                style={[styles.planCard, sel && styles.planCardActive]}
              >
                <View style={styles.planLeft}>
                  <View style={[styles.radio, sel && styles.radioActive]}>
                    {sel && <View style={styles.radioDot} />}
                  </View>
                  <View>
                    <View style={styles.planRow}>
                      <Text style={styles.planPrice}>{p.price}</Text>
                      <Text style={styles.planPeriod}>{p.period}</Text>
                    </View>
                    <Text style={styles.planSub}>{p.sub}</Text>
                  </View>
                </View>
                {p.tag && (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{p.tag}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CTA */}
        <TouchableOpacity
          testID="paywall-activate-btn"
          onPress={handleActivate}
          disabled={busy || isPro}
          activeOpacity={0.9}
          style={[styles.cta, (busy || isPro) && { opacity: 0.6 }]}
        >
          <Text style={styles.ctaText}>
            {isPro
              ? "Pro Active"
              : selected === "trial"
              ? "Start 3-Day Free Trial"
              : "Activate Pro"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.privacy}>
          Microphone is used only for noise level detection. No audio is recorded or stored.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroBg: { height: 320, width: "100%" },
  heroSafe: { flex: 1, paddingHorizontal: 24 },
  topBar: { flexDirection: "row", justifyContent: "flex-end", paddingTop: 6 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroText: { flex: 1, justifyContent: "flex-end", paddingBottom: 12 },
  kicker: {
    color: COLORS.neon,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 3,
    marginBottom: 8,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 46,
  },
  heroSub: { color: COLORS.muted, fontSize: 14, marginTop: 10, lineHeight: 20 },

  body: { padding: 24, paddingBottom: 60 },

  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  featureCard: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  featureTitle: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 14,
    marginTop: 4,
  },
  featureDesc: { color: COLORS.muted, fontSize: 12, lineHeight: 16 },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  planCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.glass,
  },
  planCardActive: {
    borderColor: COLORS.neon,
    backgroundColor: "rgba(0,229,255,0.06)",
  },
  planLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: COLORS.neon },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.neon },
  planRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  planPrice: { color: COLORS.text, fontSize: 22, fontWeight: "800" },
  planPeriod: { color: COLORS.muted, fontSize: 13, fontWeight: "600" },
  planSub: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  tag: {
    backgroundColor: COLORS.neon,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  tagText: { color: "#0A0A0A", fontSize: 11, fontWeight: "800" },

  cta: {
    marginTop: 24,
    backgroundColor: COLORS.neon,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
    shadowColor: COLORS.neon,
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  ctaText: {
    color: "#0A0A0A",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 1,
  },
  privacy: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 18,
    lineHeight: 16,
  },
});
