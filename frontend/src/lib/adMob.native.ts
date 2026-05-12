// Lightweight wrapper around react-native-google-mobile-ads.
// Gracefully no-ops if the native module is unavailable (Expo Go web preview),
// so the rest of the app keeps working.

import { Platform } from "react-native";
import { AD_CONFIG } from "./adsConfig";

type Listener = () => void;

class AdMobManager {
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private interstitial: any = null;
  private loaded = false;
  private loading = false;
  private rewarded: any = null;
  private rewardedLoaded = false;
  private rewardedLoading = false;
  private closeListeners: Listener[] = [];
  private available = true;
  private nativeModule: any = null;

  constructor() {
    // On web there's no native module; mark unavailable up front.
    if (Platform.OS === "web") {
      this.available = false;
      return;
    }
    try {
      // Lazy import so the JS bundle doesn't blow up in Expo Go.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.nativeModule = require("react-native-google-mobile-ads");
    } catch {
      this.available = false;
    }
  }

  isAvailable() {
    return this.available;
  }

  async initialize() {
    if (!this.available) return;
    if (this.initialized) return;
    if (this.initializing) return this.initializing;
    this.initializing = (async () => {
      try {
        await this.nativeModule.default().initialize();
        this.initialized = true;
      } catch (e) {
        console.warn("AdMob initialize failed:", e);
        this.available = false;
      } finally {
        this.initializing = null;
      }
    })();
    return this.initializing;
  }

  async loadInterstitial() {
    if (!this.available || this.loaded || this.loading) return;
    this.loading = true;
    try {
      const { InterstitialAd, AdEventType } = this.nativeModule;
      const ad = InterstitialAd.createForAdRequest(AD_CONFIG.interstitialAdUnitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      ad.addAdEventListener(AdEventType.LOADED, () => {
        this.loaded = true;
        this.loading = false;
      });
      ad.addAdEventListener(AdEventType.ERROR, (e: any) => {
        console.warn("Interstitial error:", e);
        this.loaded = false;
        this.loading = false;
        this.interstitial = null;
      });
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        this.loaded = false;
        this.interstitial = null;
        this.closeListeners.forEach((l) => l());
        // preload next
        this.loadInterstitial().catch(() => {});
      });

      this.interstitial = ad;
      ad.load();
    } catch (e) {
      console.warn("loadInterstitial failed:", e);
      this.loading = false;
    }
  }

  isReady() {
    return this.available && this.loaded && !!this.interstitial;
  }

  async showInterstitial() {
    if (!this.isReady()) return false;
    try {
      await this.interstitial.show();
      return true;
    } catch (e) {
      console.warn("showInterstitial failed:", e);
      return false;
    }
  }

  onClose(fn: Listener) {
    this.closeListeners.push(fn);
    return () => {
      this.closeListeners = this.closeListeners.filter((l) => l !== fn);
    };
  }

  async loadRewarded() {
    if (!this.available || this.rewardedLoaded || this.rewardedLoading) return;
    this.rewardedLoading = true;
    try {
      const { RewardedAd, RewardedAdEventType, AdEventType } = this.nativeModule;
      const ad = RewardedAd.createForAdRequest(AD_CONFIG.rewardedAdUnitId, {
        requestNonPersonalizedAdsOnly: false,
      });
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        this.rewardedLoaded = true;
        this.rewardedLoading = false;
      });
      ad.addAdEventListener(AdEventType.ERROR, (e: any) => {
        console.warn("Rewarded error:", e);
        this.rewardedLoaded = false;
        this.rewardedLoading = false;
        this.rewarded = null;
      });
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        this.rewardedLoaded = false;
        this.rewarded = null;
        // preload next
        this.loadRewarded().catch(() => {});
      });
      this.rewarded = ad;
      ad.load();
    } catch (e) {
      console.warn("loadRewarded failed:", e);
      this.rewardedLoading = false;
    }
  }

  isRewardedReady() {
    return this.available && this.rewardedLoaded && !!this.rewarded;
  }

  /**
   * Shows a rewarded ad. Resolves to true if the user fully watched and earned
   * the reward; false otherwise (skipped, error, or native module unavailable).
   */
  async showRewarded(): Promise<boolean> {
    if (!this.isRewardedReady()) return false;
    return new Promise<boolean>((resolve) => {
      let earned = false;
      try {
        const { RewardedAdEventType, AdEventType } = this.nativeModule;
        const unsubEarn = this.rewarded.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD,
          () => {
            earned = true;
          }
        );
        const unsubClose = this.rewarded.addAdEventListener(
          AdEventType.CLOSED,
          () => {
            unsubEarn?.();
            unsubClose?.();
            resolve(earned);
          }
        );
        this.rewarded.show();
      } catch (e) {
        console.warn("showRewarded failed:", e);
        resolve(false);
      }
    });
  }
}

export const adMob = new AdMobManager();
