// Web stub for AdMob — no-ops on web/Expo Go preview so the bundle doesn't
// try to import the native module. The real implementation lives in
// `adMob.native.ts` and Metro picks the right file per platform.

type Listener = () => void;

class AdMobManagerStub {
  private closeListeners: Listener[] = [];
  isAvailable() {
    return false;
  }
  async initialize() {}
  async loadInterstitial() {}
  isReady() {
    return false;
  }
  async showInterstitial() {
    return false;
  }
  onClose(fn: Listener) {
    this.closeListeners.push(fn);
    return () => {
      this.closeListeners = this.closeListeners.filter((l) => l !== fn);
    };
  }
  async loadRewarded() {}
  isRewardedReady() {
    return false;
  }
  async showRewarded(): Promise<boolean> {
    return false;
  }
}

export const adMob = new AdMobManagerStub();
