import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { useFocusEffect, useRouter } from "expo-router";
import {
  cancelPro,
  fetchSettings,
  fetchSubscription,
  getUserId,
  Settings,
  Subscription,
  updateSettings,
  SpeedVolumeStop,
} from "../src/lib/api";

const COLORS = {
  bg: "#0A0A0A",
  bg2: "#121826",
  surface: "#1E1E1E",
  glass: "rgba(30,30,38,0.65)",
  border: "rgba(255,255,255,0.08)",
  neon: "#00E5FF",
  neon2: "#3A86FF",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.6)",
  inactive: "#2A2A2A",
};

const SENS = ["low", "medium", "high"] as const;
const SMOOTH = ["slow", "medium", "fast"] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const [userId, setUid] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);

  useEffect(() => {
    (async () => {
      const id = await getUserId();
      setUid(id);
      const [s, sb] = await Promise.all([fetchSettings(id), fetchSubscription(id)]);
      setSettings(s);
      setSub(sb);
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      (async () => {
        const [s, sb] = await Promise.all([
          fetchSettings(userId),
          fetchSubscription(userId),
        ]);
        if (!cancelled) {
          setSettings(s);
          setSub(sb);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [userId])
  );

  const isPro = sub?.tier === "pro";

  const persist = async (patch: Partial<Settings>) => {
    if (!userId || !settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await updateSettings(userId, patch);
  };

  const updateMapStop = (idx: number, key: "speed" | "volume", val: number) => {
    if (!settings) return;
    const map = settings.speed_volume_map.map((s, i) =>
      i === idx ? { ...s, [key]: val } : s
    );
    persist({ speed_volume_map: map });
  };

  const handleCancel = async () => {
    if (!userId) return;
    Alert.alert("Cancel Pro?", "You'll be moved back to Free.", [
      { text: "Keep Pro", style: "cancel" },
      {
        text: "Cancel",
        style: "destructive",
        onPress: async () => {
          const updated = await cancelPro(userId);
          setSub(updated);
        },
      },
    ]);
  };

  if (!settings || !sub) {
    return (
      <LinearGradient colors={[COLORS.bg, COLORS.bg2]} style={{ flex: 1 }}>
        <SafeAreaView />
        <Text style={styles.muted}>Loading…</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[COLORS.bg, COLORS.bg2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconBtn}
            testID="settings-back-btn"
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Subscription card */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.kicker}>Subscription</Text>
                <Text style={styles.cardTitle}>
                  {isPro ? `Pro · ${sub.plan?.toUpperCase()}` : "Free Plan"}
                </Text>
                {isPro && sub.expires_at && (
                  <Text style={styles.muted}>
                    Renews {new Date(sub.expires_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
              {isPro ? (
                <TouchableOpacity onPress={handleCancel} testID="cancel-pro-btn">
                  <Text style={styles.dangerLink}>Cancel</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => router.push("/paywall")}
                  style={styles.upgradeBtn}
                  testID="settings-upgrade-btn"
                >
                  <Text style={styles.upgradeBtnText}>Upgrade</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Sensitivity */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sensitivity</Text>
            <Text style={styles.muted}>How aggressively volume reacts to speed.</Text>
            <View style={styles.segmented}>
              {SENS.map((opt) => {
                const sel = settings.sensitivity === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    testID={`sensitivity-${opt}-btn`}
                    onPress={() => persist({ sensitivity: opt })}
                    style={[styles.segBtn, sel && styles.segBtnActive]}
                  >
                    <Text style={[styles.segText, sel && styles.segTextActive]}>
                      {opt.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Smoothing */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Volume Smoothing</Text>
            <Text style={styles.muted}>Speed of volume transitions.</Text>
            <View style={styles.segmented}>
              {SMOOTH.map((opt) => {
                const sel = settings.smoothing === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    testID={`smoothing-${opt}-btn`}
                    onPress={() => persist({ smoothing: opt })}
                    style={[styles.segBtn, sel && styles.segBtnActive]}
                  >
                    <Text style={[styles.segText, sel && styles.segTextActive]}>
                      {opt.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Max volume limiter */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Max Volume Limiter</Text>
              <Text style={styles.chip}>{Math.round(settings.max_volume)}%</Text>
            </View>
            <Text style={styles.muted}>For your safety. Caps the auto-volume.</Text>
            <Slider
              testID="max-volume-slider"
              style={{ width: "100%", height: 40 }}
              minimumValue={20}
              maximumValue={100}
              step={1}
              value={settings.max_volume}
              onSlidingComplete={(v) => persist({ max_volume: v })}
              minimumTrackTintColor={COLORS.neon}
              maximumTrackTintColor={COLORS.inactive}
              thumbTintColor={COLORS.neon}
            />
          </View>

          {/* AI Noise (Pro) */}
          <View style={[styles.card, !isPro && styles.cardLocked]}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowInline}>
                  <Text style={styles.cardTitle}>AI Noise Detection</Text>
                  {!isPro && <View style={styles.proLock}><Text style={styles.proLockText}>PRO</Text></View>}
                </View>
                <Text style={styles.muted}>
                  Samples ambient noise every 30–60s for smarter adjustment.
                </Text>
              </View>
              <Switch
                testID="ai-noise-switch"
                disabled={!isPro}
                value={settings.ai_noise_detection}
                onValueChange={(v) => persist({ ai_noise_detection: v })}
                trackColor={{ false: COLORS.inactive, true: COLORS.neon }}
                thumbColor={"#FFF"}
              />
            </View>
          </View>

          {/* Custom Mode (Pro) */}
          <View style={[styles.card, !isPro && styles.cardLocked]}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowInline}>
                  <Text style={styles.cardTitle}>Custom Speed → Volume</Text>
                  {!isPro && <View style={styles.proLock}><Text style={styles.proLockText}>PRO</Text></View>}
                </View>
                <Text style={styles.muted}>
                  Define your own mapping curve.
                </Text>
              </View>
              <Switch
                testID="custom-mode-switch"
                disabled={!isPro}
                value={settings.custom_mode}
                onValueChange={(v) => persist({ custom_mode: v })}
                trackColor={{ false: COLORS.inactive, true: COLORS.neon }}
                thumbColor={"#FFF"}
              />
            </View>

            {isPro && settings.custom_mode && (
              <View style={{ marginTop: 14, gap: 10 }}>
                {settings.speed_volume_map.map((stop, idx) => (
                  <MapStopRow
                    key={idx}
                    stop={stop}
                    onChange={(k, v) => updateMapStop(idx, k, v)}
                    idx={idx}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Privacy */}
          <View style={styles.card}>
            <View style={styles.rowInline}>
              <Ionicons name="shield-checkmark" size={18} color={COLORS.neon} />
              <Text style={styles.cardTitle}> Privacy</Text>
            </View>
            <Text style={styles.muted}>
              Microphone is used only for noise level detection. No audio is ever recorded or stored.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function MapStopRow({
  stop,
  onChange,
  idx,
}: {
  stop: SpeedVolumeStop;
  onChange: (k: "speed" | "volume", v: number) => void;
  idx: number;
}) {
  const [speed, setSpeed] = useState(String(stop.speed));
  const [volume, setVolume] = useState(String(stop.volume));
  return (
    <View style={styles.mapRow}>
      <Text style={styles.muted}>Stop {idx + 1}</Text>
      <View style={styles.mapInputs}>
        <TextInput
          testID={`map-speed-${idx}`}
          value={speed}
          onChangeText={setSpeed}
          onBlur={() => onChange("speed", Math.max(0, Number(speed) || 0))}
          keyboardType="numeric"
          style={styles.input}
          placeholder="km/h"
          placeholderTextColor={COLORS.muted}
        />
        <Text style={styles.arrow}>→</Text>
        <TextInput
          testID={`map-volume-${idx}`}
          value={volume}
          onChangeText={setVolume}
          onBlur={() => onChange("volume", Math.min(100, Math.max(0, Number(volume) || 0)))}
          keyboardType="numeric"
          style={styles.input}
          placeholder="%"
          placeholderTextColor={COLORS.muted}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { color: COLORS.text, fontSize: 20, fontWeight: "800", letterSpacing: 0.5 },
  scroll: { paddingHorizontal: 24, paddingBottom: 40, gap: 14 },
  muted: { color: COLORS.muted, fontSize: 12, marginTop: 4 },

  card: {
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
  },
  cardLocked: { opacity: 0.85 },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  kicker: {
    color: COLORS.neon,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowInline: { flexDirection: "row", alignItems: "center", gap: 4 },

  upgradeBtn: {
    backgroundColor: COLORS.neon,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  upgradeBtnText: { color: "#0A0A0A", fontWeight: "800", fontSize: 12 },
  dangerLink: { color: "#FF6B6B", fontWeight: "700" },

  segmented: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  segBtnActive: { backgroundColor: COLORS.neon, borderColor: COLORS.neon },
  segText: { color: COLORS.text, fontWeight: "700", fontSize: 12, letterSpacing: 1 },
  segTextActive: { color: "#0A0A0A", fontWeight: "800" },

  chip: {
    color: COLORS.neon,
    fontWeight: "700",
    fontSize: 13,
  },

  proLock: {
    backgroundColor: "rgba(0,229,255,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 8,
  },
  proLockText: { color: COLORS.neon, fontSize: 10, fontWeight: "800", letterSpacing: 1 },

  mapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  mapInputs: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 80,
    textAlign: "center",
    fontWeight: "700",
  },
  arrow: { color: COLORS.muted, fontSize: 16 },
});
