import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import {
  fetchSettings,
  fetchSubscription,
  getUserId,
  logSession,
  Settings,
  Subscription,
  updateSettings,
} from "../src/lib/api";
import {
  applySensitivity,
  mapSpeedToVolume,
  modeProfile,
  smooth,
} from "../src/lib/volume";

const COLORS = {
  bgStart: "#0A0A0A",
  bgEnd: "#121826",
  surface: "#1E1E1E",
  surfaceGlass: "rgba(30,30,38,0.6)",
  border: "rgba(255,255,255,0.06)",
  neon: "#00E5FF",
  neon2: "#3A86FF",
  text: "#FFFFFF",
  textSec: "rgba(255,255,255,0.8)",
  textMuted: "rgba(255,255,255,0.5)",
  inactive: "#2A2A2A",
};

const MODES: { key: "Cycling" | "Bike" | "Driving"; icon: any; label: string }[] = [
  { key: "Cycling", icon: "bicycle", label: "Cycling" },
  { key: "Bike", icon: "speedometer", label: "Bike" },
  { key: "Driving", icon: "car-sport", label: "Driving" },
];

function ProMetric({
  icon,
  label,
  value,
  unit,
}: {
  icon: any;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <View style={styles.proMetric}>
      <Ionicons name={icon} size={16} color={COLORS.neon} />
      <Text style={styles.proMetricLabel}>{label}</Text>
      <View style={styles.proMetricValueRow}>
        <Text style={styles.proMetricValue}>{value}</Text>
        <Text style={styles.proMetricUnit}>{unit}</Text>
      </View>
    </View>
  );
}

export default function MainScreen() {
  const router = useRouter();
  const [userId, setUid] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [active, setActive] = useState(false);
  const [speed, setSpeed] = useState(0); // displayed (smoothed) km/h
  const [rawSpeed, setRawSpeed] = useState(0); // raw km/h
  const [volume, setVolume] = useState(0);
  const [noiseDb, setNoiseDb] = useState(45);
  const [simSpeed, setSimSpeed] = useState(15);
  const [usingGps, setUsingGps] = useState(false);
  const [adNotice, setAdNotice] = useState(false);
  const sessionStats = useRef({
    startedAt: "",
    samples: 0,
    sumSpeed: 0,
    maxSpeed: 0,
    sumVolume: 0,
  });
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const lastTick = useRef<number>(Date.now());

  // Animations
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    (async () => {
      const id = await getUserId();
      setUid(id);
      const [s, sb] = await Promise.all([fetchSettings(id), fetchSubscription(id)]);
      setSettings(s);
      setSub(sb);
    })();
  }, []);

  // Refetch when screen regains focus (e.g., after paywall close)
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

  // Pulse when active
  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.98, { duration: 900, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900 }),
          withTiming(0.4, { duration: 900 })
        ),
        -1,
        true
      );
    } else {
      pulse.value = withTiming(1, { duration: 250 });
      glow.value = withTiming(0, { duration: 250 });
    }
  }, [active]);

  // GPS subscription
  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      if (!active) {
        if (locationSub.current) {
          locationSub.current.remove();
          locationSub.current = null;
        }
        setUsingGps(false);
        return;
      }
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted" && Platform.OS !== "web") {
          locationSub.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 1000,
              distanceInterval: 1,
            },
            (loc) => {
              if (!mounted) return;
              const mps = loc.coords.speed ?? 0;
              const kmh = Math.max(0, mps * 3.6);
              setUsingGps(true);
              setRawSpeed(kmh);
            }
          );
        }
      } catch {}
    };
    setup();
    return () => {
      mounted = false;
      if (locationSub.current) {
        locationSub.current.remove();
        locationSub.current = null;
      }
    };
  }, [active]);

  // Simulated noise sampling for Pro AI mode
  useEffect(() => {
    if (!active || !settings?.ai_noise_detection || sub?.tier !== "pro") return;
    const t = setInterval(() => {
      // simulate ambient dB 35-85 with mode + window influence
      const base = settings.mode === "Driving" ? 55 : settings.mode === "Bike" ? 65 : 50;
      const wind = settings.mode === "Driving" ? settings.window_level * 0.25 : 10;
      const next = base + wind + Math.random() * 10 - 5;
      setNoiseDb((prev) => prev + (next - prev) * 0.3);
    }, 4000);
    return () => clearInterval(t);
  }, [active, settings?.ai_noise_detection, settings?.mode, settings?.window_level, sub?.tier]);

  // Main control loop: smooth speed, compute volume
  useEffect(() => {
    if (!active || !settings) return;
    const id = setInterval(() => {
      const target = usingGps ? rawSpeed : simSpeed;
      setSpeed((prev) => {
        const next = smooth(prev, target, settings.smoothing);
        // compute volume
        let vol = mapSpeedToVolume(next, settings.speed_volume_map);
        vol = applySensitivity(vol, settings.sensitivity);
        // noise contribution (Pro)
        if (settings.ai_noise_detection && sub?.tier === "pro") {
          const noiseBoost = Math.max(0, Math.min(20, (noiseDb - 50) * 0.6));
          vol = Math.min(100, vol + noiseBoost);
        }
        // window level boost for Driving
        if (settings.mode === "Driving") {
          vol = Math.min(100, vol + settings.window_level * 0.1);
        }
        // max volume limiter
        vol = Math.min(vol, settings.max_volume);
        setVolume((v) => smooth(v, vol, settings.smoothing));
        // session stats
        sessionStats.current.samples += 1;
        sessionStats.current.sumSpeed += next;
        sessionStats.current.maxSpeed = Math.max(sessionStats.current.maxSpeed, next);
        sessionStats.current.sumVolume += vol;
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [active, settings, sub?.tier, simSpeed, rawSpeed, usingGps, noiseDb]);

  // Ad timer for free users every 15 min (60s in demo for visibility).
  // Real AdMob interstitial when native module is available; falls back to
  // the in-app placeholder banner on web/Expo Go.
  // Skipped while inside a rewarded-ad grace period (adFreeUntil > now).
  useEffect(() => {
    if (!active || sub?.tier === "pro") return;

    // Preload an interstitial so it's ready when the timer fires.
    adMob.loadInterstitial().catch(() => {});

    const intervalMs = adMob.isAvailable() ? AD_INTERVAL_MS : 60_000;
    const t = setInterval(async () => {
      if (Date.now() < adFreeUntil) return; // user is in ad-free grace period
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
      const shown = await adMob.showInterstitial();
      if (!shown) {
        // Fallback: show the in-app placeholder banner for 4s.
        setAdNotice(true);
        setTimeout(() => setAdNotice(false), 4000);
        adMob.loadInterstitial().catch(() => {});
      }
    }, intervalMs);
    return () => clearInterval(t);
  }, [active, sub?.tier, adFreeUntil]);

  // Preload the rewarded ad whenever the user is free
  useEffect(() => {
    if (sub?.tier === "pro") return;
    adMob.loadRewarded().catch(() => {});
    const poll = setInterval(() => setRewardedReady(adMob.isRewardedReady()), 1500);
    return () => clearInterval(poll);
  }, [sub?.tier]);

  // Countdown ticker for the ad-free grace badge
  useEffect(() => {
    if (adFreeUntil <= Date.now()) {
      setAdFreeCountdown(0);
      return;
    }
    const t = setInterval(() => {
      const remaining = Math.max(0, adFreeUntil - Date.now());
      setAdFreeCountdown(remaining);
      if (remaining <= 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [adFreeUntil]);

  const handleWatchRewarded = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    // Ensure ad is loaded
    if (!adMob.isRewardedReady()) {
      await adMob.loadRewarded();
    }
    if (!adMob.isAvailable() || !adMob.isRewardedReady()) {
      // Web/Expo Go fallback: simulate the reward so the UX flow is testable.
      setAdFreeUntil(Date.now() + REWARD_GRACE_MS);
      return;
    }
    const earned = await adMob.showRewarded();
    if (earned) {
      setAdFreeUntil(Date.now() + REWARD_GRACE_MS);
    }
  };

  const handleToggle = async () => {
    if (!settings) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    if (!active) {
      sessionStats.current = {
        startedAt: new Date().toISOString(),
        samples: 0,
        sumSpeed: 0,
        maxSpeed: 0,
        sumVolume: 0,
      };
      setActive(true);
    } else {
      setActive(false);
      // log session
      const s = sessionStats.current;
      if (userId && s.samples > 0) {
        const start = new Date(s.startedAt).getTime();
        const dur = (Date.now() - start) / 1000;
        await logSession({
          user_id: userId,
          mode: settings.mode,
          duration_seconds: dur,
          avg_speed: s.sumSpeed / s.samples,
          max_speed: s.maxSpeed,
          avg_volume: s.sumVolume / s.samples,
          started_at: s.startedAt,
        });
      }
      setSpeed(0);
      setVolume(0);
      setRawSpeed(0);
    }
  };

  const setMode = async (mode: "Cycling" | "Bike" | "Driving") => {
    if (!settings || !userId) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    const next = { ...settings, mode };
    setSettings(next);
    await updateSettings(userId, { mode });
  };

  const setWindow = async (val: number) => {
    if (!settings || !userId) return;
    const next = { ...settings, window_level: val };
    setSettings(next);
  };
  const commitWindow = async (val: number) => {
    if (!userId) return;
    await updateSettings(userId, { window_level: val });
  };

  const isPro = sub?.tier === "pro";

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.15 + glow.value * 0.55,
    transform: [{ scale: 1 + glow.value * 0.1 }],
  }));

  const speedDisplay = Math.round(speed);
  const volumeDisplay = Math.round(volume);

  if (!settings || !sub) {
    return (
      <LinearGradient colors={[COLORS.bgStart, COLORS.bgEnd]} style={styles.container}>
        <Text style={styles.muted}>Loading…</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[COLORS.bgStart, COLORS.bgEnd]} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header} testID="header">
            <View style={styles.brandRow}>
              <View style={styles.brandDot} />
              <Text style={styles.brand}>FlowVolume</Text>
            </View>
            <View style={styles.headerRight}>
              <View
                style={[
                  styles.tierPill,
                  { borderColor: isPro ? COLORS.neon : COLORS.border },
                ]}
                testID="tier-pill"
              >
                <Text
                  style={[
                    styles.tierText,
                    { color: isPro ? COLORS.neon : COLORS.textSec },
                  ]}
                >
                  {isPro ? "PRO" : "FREE"}
                </Text>
              </View>
              <TouchableOpacity
                testID="open-history-btn"
                onPress={() => router.push("/history")}
                style={styles.iconBtn}
              >
                <Ionicons name="time-outline" size={22} color={COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity
                testID="open-settings-btn"
                onPress={() => router.push("/settings")}
                style={styles.iconBtn}
              >
                <Ionicons name="settings-outline" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Speed display */}
          <View style={styles.speedBlock} testID="speed-block">
            <Text style={styles.label}>Current Speed</Text>
            <View style={styles.speedRow}>
              <Text style={styles.speedNumber} testID="speed-value">
                {speedDisplay}
              </Text>
              <Text style={styles.speedUnit}>KM/H</Text>
            </View>
            <Text style={styles.subStatus}>
              {usingGps ? "GPS Locked" : "Simulated • Use slider below"}
            </Text>
          </View>

          {/* Big toggle */}
          <View style={styles.toggleWrap}>
            <Animated.View
              pointerEvents="none"
              style={[styles.glowRing, glowStyle, { opacity: active ? 0.6 : 0 }]}
            />
            <Animated.View style={buttonStyle}>
              <Pressable
                testID="main-toggle-btn"
                onPress={handleToggle}
                android_ripple={{ color: COLORS.neon, borderless: true }}
                style={({ pressed }) => [
                  styles.toggleBtn,
                  active && styles.toggleBtnActive,
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
              >
                <Ionicons
                  name={active ? "stop" : "play"}
                  size={48}
                  color={active ? COLORS.neon : COLORS.text}
                />
                <Text
                  style={[
                    styles.toggleText,
                    { color: active ? COLORS.neon : COLORS.text },
                  ]}
                >
                  {active ? "STOP" : "START"}
                </Text>
              </Pressable>
            </Animated.View>
          </View>

          {/* Status row */}
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Text style={styles.label}>Auto Volume</Text>
              <Text
                style={[
                  styles.statusValue,
                  { color: active ? COLORS.neon : COLORS.textMuted },
                ]}
                testID="auto-volume-status"
              >
                {active ? "ON" : "OFF"}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statusItem}>
              <Text style={styles.label}>Volume</Text>
              <Text style={styles.statusValue} testID="volume-value">
                {volumeDisplay}%
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statusItem}>
              <Text style={styles.label}>{isPro && settings.ai_noise_detection ? "Noise" : "Mode"}</Text>
              <Text style={styles.statusValue}>
                {isPro && settings.ai_noise_detection
                  ? `${Math.round(noiseDb)} dB`
                  : modeProfile(settings.mode).label}
              </Text>
            </View>
          </View>

          {/* Mode selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mode</Text>
            <View style={styles.modeRow}>
              {MODES.map((m) => {
                const sel = settings.mode === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    testID={`mode-${m.key.toLowerCase()}-btn`}
                    onPress={() => setMode(m.key)}
                    style={[styles.modePill, sel && styles.modePillActive]}
                  >
                    <Ionicons
                      name={m.icon}
                      size={18}
                      color={sel ? "#0A0A0A" : COLORS.text}
                    />
                    <Text style={[styles.modeText, sel && styles.modeTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Window level for Driving */}
          {settings.mode === "Driving" && (
            <View style={styles.section} testID="window-section">
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Window Level</Text>
                <Text style={styles.valueChip}>{Math.round(settings.window_level)}%</Text>
              </View>
              <Slider
                testID="window-slider"
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                value={settings.window_level}
                onValueChange={setWindow}
                onSlidingComplete={commitWindow}
                minimumTrackTintColor={COLORS.neon}
                maximumTrackTintColor={COLORS.inactive}
                thumbTintColor={COLORS.neon}
              />
              <Text style={styles.helper}>
                More wind = louder volume to compensate noise.
              </Text>
            </View>
          )}

          {/* Simulated speed slider */}
          {!usingGps && (
            <View style={styles.section} testID="sim-speed-section">
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Simulated Speed</Text>
                <Text style={styles.valueChip}>{Math.round(simSpeed)} km/h</Text>
              </View>
              <Slider
                testID="sim-speed-slider"
                style={styles.slider}
                minimumValue={0}
                maximumValue={modeProfile(settings.mode).maxSpeed}
                value={simSpeed}
                onValueChange={setSimSpeed}
                minimumTrackTintColor={COLORS.neon2}
                maximumTrackTintColor={COLORS.inactive}
                thumbTintColor={COLORS.neon}
              />
              <Text style={styles.helper}>
                Used when GPS is unavailable (preview / web).
              </Text>
            </View>
          )}

          {/* Volume bar visual */}
          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Output Volume</Text>
              <Text style={styles.valueChip}>{volumeDisplay}%</Text>
            </View>
            <View style={styles.vbarBg}>
              <LinearGradient
                colors={[COLORS.neon2, COLORS.neon]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.vbarFill, { width: `${volumeDisplay}%` }]}
              />
            </View>
          </View>

          {/* Pro live feedback panel */}
          {isPro && active && (
            <View style={styles.proPanel} testID="pro-feedback-panel">
              <View style={styles.proPanelHead}>
                <View style={styles.liveDot} />
                <Text style={styles.proPanelTitle}>LIVE FEEDBACK</Text>
              </View>
              <View style={styles.proPanelGrid}>
                <ProMetric
                  icon="speedometer"
                  label="Speed"
                  value={`${Math.round(speed)}`}
                  unit="km/h"
                />
                <ProMetric
                  icon="mic"
                  label="Noise"
                  value={
                    settings.ai_noise_detection
                      ? `${Math.round(noiseDb)}`
                      : "—"
                  }
                  unit="dB"
                />
                <ProMetric
                  icon="volume-high"
                  label="Volume"
                  value={`${Math.round(volume)}`}
                  unit="%"
                />
              </View>
            </View>
          )}

          {/* Free vs Pro CTA */}
          {!isPro ? (
            <TouchableOpacity
              testID="upgrade-cta"
              onPress={() => router.push("/paywall")}
              style={styles.proCard}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={["rgba(0,229,255,0.18)", "rgba(58,134,255,0.05)"]}
                style={StyleSheet.absoluteFill as any}
              />
              <View>
                <Text style={styles.proTitle}>Unleash FlowVolume Pro</Text>
                <Text style={styles.proSub}>
                  AI Noise Detection · Custom Mode · No Ads
                </Text>
              </View>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>From ₹29</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.proStatusCard} testID="pro-status">
              <Ionicons name="flash" size={18} color={COLORS.neon} />
              <Text style={styles.proStatusText}>
                Pro active · {sub.plan?.toUpperCase()}
              </Text>
            </View>
          )}

          {/* Free mode ad label + Rewarded CTA */}
          {!isPro && (
            <>
              {adFreeCountdown > 0 ? (
                <View style={styles.adFreeBadge} testID="ad-free-badge">
                  <Ionicons name="shield-checkmark" size={16} color={COLORS.neon} />
                  <Text style={styles.adFreeText}>
                    Ad-Free · {Math.ceil(adFreeCountdown / 1000 / 60)}m{" "}
                    {Math.floor((adFreeCountdown / 1000) % 60)
                      .toString()
                      .padStart(2, "0")}
                    s
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  testID="watch-rewarded-btn"
                  onPress={handleWatchRewarded}
                  activeOpacity={0.85}
                  style={styles.rewardedBtn}
                  disabled={!rewardedReady && adMob.isAvailable()}
                >
                  <Ionicons name="play-circle" size={18} color="#0A0A0A" />
                  <Text style={styles.rewardedBtnText}>
                    Watch Ad · Get 5 min Ad-Free
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={styles.freeNote} testID="free-note">
                Free Mode · Ad every 15 min
              </Text>
            </>
          )}

          {adNotice && !isPro && (
            <View style={styles.adBanner} testID="ad-banner">
              <Ionicons name="megaphone" size={18} color="#0A0A0A" />
              <Text style={styles.adText}>Sponsored break · Upgrade to remove ads</Text>
            </View>
          )}

          {/* Persistent banner ad for free users (hidden during ad-free grace) */}
          {!isPro && adFreeCountdown === 0 && <AdBanner />}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  muted: { color: COLORS.textMuted, alignSelf: "center", marginTop: 100 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.neon,
    shadowColor: COLORS.neon,
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  brand: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  tierPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tierText: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
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

  speedBlock: { alignItems: "center", marginTop: 18 },
  label: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  speedRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  speedNumber: {
    color: COLORS.text,
    fontSize: 96,
    fontWeight: "800",
    letterSpacing: -3,
    lineHeight: 100,
    textShadowColor: COLORS.neon,
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  speedUnit: {
    color: COLORS.neon2,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 14,
  },
  subStatus: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },

  toggleWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 16,
    height: 220,
  },
  glowRing: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: COLORS.neon,
    opacity: 0.25,
  },
  toggleBtn: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.08)",
  },
  toggleBtnActive: {
    backgroundColor: "rgba(0,229,255,0.08)",
    borderColor: COLORS.neon,
    shadowColor: COLORS.neon,
    shadowOpacity: 0.7,
    shadowRadius: 30,
  },
  toggleText: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 4,
    marginTop: 8,
  },

  statusRow: {
    flexDirection: "row",
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    marginTop: 8,
  },
  statusItem: { flex: 1, alignItems: "center", gap: 4 },
  statusValue: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  divider: { width: 1, backgroundColor: COLORS.border },

  section: { marginTop: 22 },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  valueChip: {
    color: COLORS.neon,
    fontSize: 13,
    fontWeight: "700",
  },
  helper: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  slider: { width: "100%", height: 36 },

  modeRow: { flexDirection: "row", gap: 10 },
  modePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "transparent",
  },
  modePillActive: {
    backgroundColor: COLORS.neon,
    borderColor: COLORS.neon,
  },
  modeText: { color: COLORS.text, fontSize: 13, fontWeight: "600" },
  modeTextActive: { color: "#0A0A0A", fontWeight: "800" },

  vbarBg: {
    width: "100%",
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.inactive,
    overflow: "hidden",
  },
  vbarFill: { height: "100%", borderRadius: 7 },

  proCard: {
    marginTop: 22,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.35)",
    overflow: "hidden",
  },
  proTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  proSub: { color: COLORS.textSec, fontSize: 12, marginTop: 4 },
  proBadge: {
    backgroundColor: COLORS.neon,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  proBadgeText: { color: "#0A0A0A", fontSize: 12, fontWeight: "800" },

  proStatusCard: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.35)",
    backgroundColor: "rgba(0,229,255,0.08)",
  },
  proStatusText: { color: COLORS.neon, fontWeight: "700", letterSpacing: 1 },

  freeNote: {
    marginTop: 14,
    alignSelf: "center",
    color: COLORS.textMuted,
    fontSize: 12,
  },

  adBanner: {
    marginTop: 16,
    backgroundColor: COLORS.neon,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  adText: { color: "#0A0A0A", fontWeight: "700" },

  proPanel: {
    marginTop: 22,
    backgroundColor: "rgba(0,229,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.3)",
    borderRadius: 18,
    padding: 16,
  },
  proPanelHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.neon,
    shadowColor: COLORS.neon,
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  proPanelTitle: {
    color: COLORS.neon,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
  proPanelGrid: { flexDirection: "row", gap: 10 },
  proMetric: {
    flex: 1,
    backgroundColor: "rgba(10,10,10,0.5)",
    borderRadius: 12,
    padding: 12,
    alignItems: "flex-start",
    gap: 6,
  },
  proMetricLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  proMetricValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  proMetricValue: { color: COLORS.text, fontSize: 22, fontWeight: "800" },
  proMetricUnit: {
    color: COLORS.neon2,
    fontSize: 11,
    fontWeight: "700",
  },

  rewardedBtn: {
    marginTop: 16,
    backgroundColor: COLORS.neon,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: COLORS.neon,
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  rewardedBtnText: { color: "#0A0A0A", fontWeight: "800", fontSize: 14, letterSpacing: 0.3 },

  adFreeBadge: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "rgba(0,229,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.4)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  adFreeText: { color: COLORS.neon, fontWeight: "800", fontSize: 13, letterSpacing: 1 },
});
