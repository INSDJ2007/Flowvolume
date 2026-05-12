# FlowVolume — PRD

## Overview
FlowVolume is a smart adaptive audio control mobile app (React Native Expo, Android-first) that auto-adjusts media volume based on real-time GPS speed, the active activity mode (Cycling / Bike / Driving), and (Pro) ambient noise sampled from the microphone.

## Core User Flow
1. User opens the app — sees animated speedometer, large START button, current mode and volume.
2. User picks a mode (Cycling / Bike / Driving). Driving mode reveals a "Window Level" slider.
3. User taps START — app subscribes to GPS (or simulated speed slider on web/preview).
4. App computes target volume from a piecewise speed→volume mapping, applies sensitivity & smoothing, and (if Pro + AI Noise on) layers a noise-based boost.
5. STOP ends the session and logs avg/max stats to the backend.

## Screens
- `app/index.tsx` — Main control screen (speed, START/STOP, mode pills, window-level slider, sim-speed slider, output volume bar, free/Pro CTA, ad banner).
- `app/paywall.tsx` — Premium paywall with hero image, feature grid, plan cards (Trial / ₹29 monthly / ₹79 quarterly), activate CTA.
- `app/settings.tsx` — Subscription mgmt, sensitivity, smoothing, max volume limiter, AI Noise toggle (Pro), Custom Mode toggle (Pro) with editable speed→volume stops, privacy note.

## Backend (FastAPI + MongoDB, prefixed `/api`)
- `GET  /api/settings/{user_id}` — get-or-create user settings.
- `PUT  /api/settings/{user_id}` — patch settings (mode, sensitivity, smoothing, max_volume, window_level, ai_noise_detection, custom_mode, speed_volume_map).
- `GET  /api/subscription/{user_id}` — get-or-create subscription (default tier=free).
- `POST /api/subscription/activate` — body `{user_id, plan: trial|monthly|quarterly}`; sets tier=pro with expires_at.
- `POST /api/subscription/cancel` — body `{user_id}`; reverts to tier=free.
- `POST /api/sessions` — log a ride session (mode, duration, avg/max speed, avg volume).
- `GET  /api/sessions/{user_id}` — last 100 sessions.

## Pricing & Monetization
- Free: speed-based volume only, ad banner every 15 min while active (sped up to 60s in demo).
- Pro: ₹29/month, ₹79/3 months, optional 3-day free trial. No ads, AI noise detection, custom mapping, advanced settings. Currently MOCKED — paywall flips subscription record server-side without a real payment processor.

## Permissions (declared in app.json)
- iOS: NSLocationWhenInUseUsageDescription, NSMicrophoneUsageDescription
- Android: ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, RECORD_AUDIO, FOREGROUND_SERVICE

## Known Limitations / MOCKED behaviour
- **Volume control is visual-only**: Expo Go cannot programmatically set device media volume; the app shows a live "Output Volume" bar reflecting the computed value. A native dev build would integrate `react-native-volume-manager` to actually drive system media volume.
- **AI Noise Detection is SIMULATED**: in this MVP, dB values are synthesized from mode + window level + jitter to demonstrate the smart-volume math. A native build would use `expo-av` Recording metering to sample real ambient noise every 30–60s.
- **Paywall is MOCKED**: tapping Activate flips the user's `subscription.tier` to `pro` with no real billing. Stripe/Razorpay can be integrated later via `integration_playbook_expert_v2`.
- **Persistent notification with quick controls is NOT implemented** in this MVP (would require a dev build with `expo-notifications` and a foreground service module).

## AdMob (Google Mobile Ads)
- **Package**: `react-native-google-mobile-ads@16.3.3`, configured via `app.json` plugin.
- **Android App ID**: `ca-app-pub-2091696057854733~6814859397`
- **Interstitial Ad Unit ID (production)**: `ca-app-pub-2091696057854733/3589930257`
- **Rewarded Ad Unit ID (production)**: `ca-app-pub-2091696057854733/3677661798`
- **Test IDs** (auto-used when `__DEV__===true`): interstitial `ca-app-pub-3940256099942544/1033173712`, rewarded `ca-app-pub-3940256099942544/5224354917`
- **Interstitial behavior**: Free-tier users get an interstitial every 15 minutes while a session is active. Pro users see no ads.
- **Rewarded behavior**: A "Watch Ad · Get 5 min Ad-Free" CTA is shown to free users. When the user watches the rewarded ad to completion, the next interstitial is suppressed for 5 minutes (i.e. the 15-min interstitial effectively becomes 20 min for that cycle). An "Ad-Free · Xm Ys" countdown badge replaces the CTA during the grace period.
- **Platform stub**: `src/lib/adMob.web.ts` is a no-op for web preview; `src/lib/adMob.native.ts` is the real implementation. Metro picks the right file per platform.
- **Web/Expo Go fallback**: Tapping "Watch Ad" on web simulates the reward (5-min grace period) so the UX flow is testable without a native build.
- **Real ads only render in a standalone/dev APK** (Emergent publish or `eas build`).
