import type { SpeedVolumeStop } from "./api";

export const DEFAULT_MAP: SpeedVolumeStop[] = [
  { speed: 10, volume: 20 },
  { speed: 30, volume: 40 },
  { speed: 60, volume: 70 },
  { speed: 120, volume: 100 },
];

export function mapSpeedToVolume(
  speedKmh: number,
  stops: SpeedVolumeStop[] = DEFAULT_MAP
): number {
  if (!stops.length) return 0;
  const sorted = [...stops].sort((a, b) => a.speed - b.speed);
  if (speedKmh <= sorted[0].speed) return sorted[0].volume;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (speedKmh >= a.speed && speedKmh <= b.speed) {
      const t = (speedKmh - a.speed) / Math.max(1, b.speed - a.speed);
      return a.volume + t * (b.volume - a.volume);
    }
  }
  return sorted[sorted.length - 1].volume;
}

export type Mode = "Cycling" | "Bike" | "Driving";

export function modeProfile(mode: Mode) {
  // baseline ranges per mode used to scale the speed input
  switch (mode) {
    case "Cycling":
      return { maxSpeed: 50, label: "Cycling" };
    case "Bike":
      return { maxSpeed: 120, label: "Bike Riding" };
    case "Driving":
      return { maxSpeed: 160, label: "Driving" };
  }
}

export function applySensitivity(
  vol: number,
  sensitivity: "low" | "medium" | "high"
): number {
  const factor = sensitivity === "low" ? 0.85 : sensitivity === "high" ? 1.15 : 1.0;
  return Math.max(0, Math.min(100, vol * factor));
}

export function smooth(prev: number, next: number, smoothing: "slow" | "medium" | "fast"): number {
  const alpha = smoothing === "slow" ? 0.08 : smoothing === "fast" ? 0.45 : 0.2;
  return prev + (next - prev) * alpha;
}
