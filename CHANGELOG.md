# Changelog

## 1.0.0 — Offline Edition

First complete offline release of _Smosh: Food Battle The Game_ v1.31 (Android).

### Fixed
- Startup hang on the server health check, login and player fetch
- Player profile wiped on every scene change (missing `DontDestroyOnLoad`) —
  restored the starter Celery Sword (and with it tap-to-move), clothing, coins
  and crystals
- Saving and loading never worked (`forceOnlineConnection`)
- Story dialogue stuck on screen (analytics exception in `DialogueScreen.Start`)
- Black screen after leaving any building or shop (`CanMakePurchases`)
- Challenge Mode unplayable (server-side energy)
- Possible freezes at level start/end waiting for the ad server
- Local reminder notifications never initialised
- Errors at every level start from the missing analytics record
- Every remaining online request hanging forever (`ServiceRequest.Execute`)

### Changed
- Expansion (OBB) data merged into the APK — one file to install
- Game code ships pre-decrypted with all fixes built in; no runtime injection
- `targetSdkVersion` raised to 23 so Android 14+ can install it
- x86 libraries removed so PC emulators use ARM translation
- Ads removed

### Known limitations
- Real-money purchases, friends, accounts, promo codes and restore purchases
  require the original servers and show "Offline" / "not connected"
- 32-bit ARM only: does not run on 64-bit-only phones or Android Studio's emulator
