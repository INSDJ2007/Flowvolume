// AdMob configuration with test IDs for dev and real IDs for production.
// Google's official test interstitial: ca-app-pub-3940256099942544/1033173712
// Use __DEV__ to switch automatically.

const PROD = {
  androidAppId: "ca-app-pub-2091696057854733~6814859397",
  interstitialAdUnitId: "ca-app-pub-2091696057854733/3589930257",
  rewardedAdUnitId: "ca-app-pub-2091696057854733/3677661798",
  bannerAdUnitId: "ca-app-pub-2091696057854733/2173008435",
};

const TEST = {
  androidAppId: "ca-app-pub-3940256099942544~3347511713",
  interstitialAdUnitId: "ca-app-pub-3940256099942544/1033173712",
  rewardedAdUnitId: "ca-app-pub-3940256099942544/5224354917",
  bannerAdUnitId: "ca-app-pub-3940256099942544/6300978111",
};

// In dev (Expo Go / dev build), use Google test ads to avoid policy violations.
// In production builds, switch to real ad units.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isDev = typeof __DEV__ !== "undefined" && (__DEV__ as any);

export const AD_CONFIG = isDev ? TEST : PROD;
export const AD_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
export const REWARD_GRACE_MS = 5 * 60 * 1000; // 5 minutes ad-free after rewarded
