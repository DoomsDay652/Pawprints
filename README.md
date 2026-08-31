# PawPrints

PawPrints is a mobile-first community map for coordinating missing-pet searches. Helpers can report time-stamped sightings, record the direction an animal was moving, follow an arrowed trail, contact the owner or local public services, and discuss a selected search in a localized chat.

## Current prototype

- Real OpenStreetMap-based map centered on Salem, Ohio
- Private foreground-only geolocation and a 200-meter sighting radius
- Salem test mode with click-to-move testing
- Directional trails and clickable sighting details
- Community confidence voting
- Owner contact, local search chat, and public-service contacts
- Device-local accounts, pet profiles, photos, settings, and account deletion
- Light, dark, and system themes
- Installable Progressive Web App support for Android

The current prototype stores user-created data on the device. A shared production release will need a real backend for cross-device accounts, uploads, chat, and moderation.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Android

The preferred testing path is to install the hosted Progressive Web App from Chrome on Android. It behaves like an app, receives web updates automatically, and preserves device-local profile data.

The repository also includes a Bubblewrap Trusted Web Activity configuration for producing a signed APK. See [docs/ANDROID.md](docs/ANDROID.md) before creating the first signing key.

## Privacy note

Live user location remains on the device and is requested only while the app is being used. Submitted sightings intentionally include the chosen sighting location and automatic timestamp.
