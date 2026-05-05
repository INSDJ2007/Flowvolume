import AsyncStorage from "@react-native-async-storage/async-storage";

const API = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

const USER_ID_KEY = "flowvolume_user_id";

function uuid(): string {
  // RFC4122-ish v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getUserId(): Promise<string> {
  let id = await AsyncStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = uuid();
    await AsyncStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

export type SpeedVolumeStop = { speed: number; volume: number };

export type Settings = {
  user_id: string;
  mode: "Cycling" | "Bike" | "Driving";
  auto_volume: boolean;
  sensitivity: "low" | "medium" | "high";
  smoothing: "slow" | "medium" | "fast";
  max_volume: number;
  window_level: number;
  ai_noise_detection: boolean;
  custom_mode: boolean;
  speed_volume_map: SpeedVolumeStop[];
  updated_at: string;
};

export type Subscription = {
  user_id: string;
  tier: "free" | "pro";
  plan: "monthly" | "quarterly" | "trial" | null;
  started_at: string | null;
  expires_at: string | null;
};

export async function fetchSettings(userId: string): Promise<Settings> {
  const r = await fetch(`${API}/settings/${userId}`);
  return r.json();
}

export async function updateSettings(
  userId: string,
  patch: Partial<Settings>
): Promise<Settings> {
  const r = await fetch(`${API}/settings/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return r.json();
}

export async function fetchSubscription(userId: string): Promise<Subscription> {
  const r = await fetch(`${API}/subscription/${userId}`);
  return r.json();
}

export async function activatePro(
  userId: string,
  plan: "monthly" | "quarterly" | "trial"
): Promise<Subscription> {
  const r = await fetch(`${API}/subscription/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, plan }),
  });
  return r.json();
}

export async function cancelPro(userId: string): Promise<Subscription> {
  const r = await fetch(`${API}/subscription/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, plan: "monthly" }),
  });
  return r.json();
}

export async function logSession(payload: {
  user_id: string;
  mode: string;
  duration_seconds: number;
  avg_speed: number;
  max_speed: number;
  avg_volume: number;
  started_at: string;
}) {
  await fetch(`${API}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
