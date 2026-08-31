# PawPrints on Android

## Easiest update-safe installation

Open the hosted PawPrints site in Chrome on Android and choose **Install app** or **Add to Home screen**. Android installs it as a web app, and new web releases are picked up when the app opens. Device-local profile, pet, and settings data remain under the same site origin during normal updates.

This is the best prototype workflow because visual and behavior updates do not require downloading another APK.

## Building a signed APK

PawPrints includes `twa-manifest.json` for a Trusted Web Activity package named `com.doomsday652.pawprints`. Bubblewrap is the Google Chrome Labs tool that generates the Android project and a signed APK from the hosted PWA.

One-time setup:

1. Install Node.js, Java 17, and the Android SDK.
2. Install Bubblewrap: `npm install -g @bubblewrap/cli@1.24.1`.
3. Run `bubblewrap init --manifest=https://pawtrace-lost-dog-map.doomsday652.chatgpt.site/manifest.webmanifest --directory=android-build`.
4. Keep the package ID `com.doomsday652.pawprints`.
5. Generate one signing keystore and back it up securely. Never commit it to GitHub.
6. Add the signing certificate fingerprint to the hosted `/.well-known/assetlinks.json` before a full-screen Trusted Web Activity release.
7. Run `bubblewrap build --manifest=android-build/twa-manifest.json`.

Bubblewrap outputs a signed APK and app bundle. Install the first APK normally.

## Updating without losing data

Every future APK must keep all three of these unchanged:

- package ID: `com.doomsday652.pawprints`
- the original signing keystore and key alias
- the hosted PawPrints origin

Increase the Android version code for each APK. Installing the newer signed APK over the older version performs an in-place update; do not uninstall first. Device-local app data should remain available because Android sees it as the same application and the web origin is unchanged.

Most PawPrints feature updates happen on the hosted web app and therefore appear without rebuilding the APK. A new APK is needed only for Android-wrapper changes such as package metadata, permissions, icons, or native integrations.

## Current access limitation

The hosted prototype is currently owner-only. An APK that opens it will work only for an account allowed to access that site. Before distributing PawPrints to the public, change the hosting access deliberately and replace the device-local prototype account with a production backend and public authentication system.
