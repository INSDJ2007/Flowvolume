import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { getUserId } from "../src/lib/api";

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
};

type Session = {
  id: string;
  user_id: string;
  mode: string;
  duration_seconds: number;
  avg_speed: number;
  max_speed: number;
  avg_volume: number;
  started_at: string;
  ended_at: string;
};

const API = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  if (m === 0) return `${sec}s`;
  return `${m}m ${sec}s`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MODE_ICON: Record<string, any> = {
  Cycling: "bicycle",
  Bike: "speedometer",
  Driving: "car-sport",
};

export default function HistoryScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const id = await getUserId();
    const r = await fetch(`${API}/sessions/${id}`);
    const data: Session[] = await r.json();
    setSessions(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const totalRides = sessions?.length ?? 0;
  const totalMinutes = sessions
    ? Math.round(sessions.reduce((a, s) => a + s.duration_seconds, 0) / 60)
    : 0;
  const topSpeed = sessions
    ? Math.round(sessions.reduce((a, s) => Math.max(a, s.max_speed), 0))
    : 0;

  return (
    <LinearGradient colors={[COLORS.bg, COLORS.bg2]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconBtn}
            testID="history-back-btn"
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Ride History</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.statsRow}>
          <Stat label="Rides" value={String(totalRides)} />
          <View style={styles.statDiv} />
          <Stat label="Minutes" value={String(totalMinutes)} />
          <View style={styles.statDiv} />
          <Stat label="Top km/h" value={String(topSpeed)} accent />
        </View>

        <FlatList
          contentContainerStyle={styles.list}
          data={sessions ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.neon}
            />
          }
          ListEmptyComponent={
            sessions === null ? (
              <Text style={styles.empty}>Loading…</Text>
            ) : (
              <View style={styles.emptyWrap}>
                <Ionicons name="speedometer-outline" size={40} color={COLORS.muted} />
                <Text style={styles.emptyTitle}>No rides yet</Text>
                <Text style={styles.empty}>
                  Start a session from the home screen to log your first ride.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.card} testID={`session-${item.id}`}>
              <View style={styles.cardLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons
                    name={MODE_ICON[item.mode] ?? "ellipse"}
                    size={20}
                    color={COLORS.neon}
                  />
                </View>
                <View>
                  <Text style={styles.cardTitle}>{item.mode}</Text>
                  <Text style={styles.muted}>{fmtDate(item.ended_at)}</Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.metric}>
                  {fmtDuration(item.duration_seconds)}
                </Text>
                <Text style={styles.muted}>
                  avg {Math.round(item.avg_speed)} · max {Math.round(item.max_speed)} km/h
                </Text>
                <Text style={[styles.muted, { color: COLORS.neon }]}>
                  vol avg {Math.round(item.avg_volume)}%
                </Text>
              </View>
            </View>
          )}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, accent && { color: COLORS.neon }]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statsRow: {
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 12,
    flexDirection: "row",
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingVertical: 14,
  },
  statBox: { flex: 1, alignItems: "center" },
  statValue: { color: COLORS.text, fontSize: 20, fontWeight: "800" },
  statLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
  },
  statDiv: { width: 1, backgroundColor: COLORS.border },

  list: { paddingHorizontal: 24, paddingBottom: 60, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  cardRight: { alignItems: "flex-end" },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,229,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.3)",
  },
  cardTitle: { color: COLORS.text, fontWeight: "700", fontSize: 15 },
  metric: { color: COLORS.text, fontWeight: "700", fontSize: 14 },
  muted: { color: COLORS.muted, fontSize: 12, marginTop: 2 },

  empty: { color: COLORS.muted, textAlign: "center", marginTop: 12 },
  emptyWrap: { alignItems: "center", paddingTop: 60, gap: 6 },
  emptyTitle: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 16,
    marginTop: 12,
  },
});
