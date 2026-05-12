// Native AdMob banner. Renders a real BannerAd on Android/iOS.
import React from "react";
import { View, StyleSheet } from "react-native";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { BannerAd, BannerAdSize } = require("react-native-google-mobile-ads");
import { AD_CONFIG } from "../lib/adsConfig";

export default function AdBanner() {
  return (
    <View style={styles.wrap} testID="ad-banner-native">
      <BannerAd
        unitId={AD_CONFIG.bannerAdUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
});
