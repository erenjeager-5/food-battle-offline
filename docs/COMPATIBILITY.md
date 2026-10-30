# ✅ Compatibility

## Summary

| Platform | Status | Notes |
|---|---|---|
| Android phones & tablets (~2015–2022) | ✅ Tested | Tested on a Samsung Galaxy Tab A (SM-T550, Android 7.1) |
| Android 5 – 13 | ✅ Should work | |
| Android 14 – 15 | ✅ Should work | Shows an "older version of Android" warning — tap **Install anyway** |
| BlueStacks 5 (Android 9) | ✅ Tested | Full play-test: story, Challenge Mode, shops, pets, revive |
| LDPlayer 9 / MEmu / Nox | 🟡 Untested | Same ARM-translation approach as BlueStacks |
| Android Studio emulator | ❌ No | See below |
| 64-bit-only phones | ❌ No | See below |
| iPhone / iPad | ❌ No | Android only |
| Android 4.x | ❓ Unknown | Not tested |

## Why some devices can't run it

### 64-bit-only phones

The game was built in 2014 with Unity 4.6, which only produced **32-bit ARM
(armeabi-v7a)** code. Some recent phones physically cannot run 32-bit code:

- **Google Pixel 7 and newer**
- Phones with a **Snapdragon 8 Gen 3** or newer, **Dimensity 9300** or newer,
  and similar 2024+ flagship chips (e.g. **Galaxy S24 / S25** series)

On these, Android refuses to install the APK with **"App not installed"**. This
can't be fixed by patching — it would require rebuilding the whole game in a
modern engine.

**Not sure about your phone?** Just try installing. Nothing is harmed if it fails.

### Android Studio's emulator

Google's emulator translates ARM apps with `libndk_translation`, which cannot run
the game's Mono JIT compiler (it crashes with `SEGV_ACCERR`). The game's
original x86 engine build runs there but only ever renders a black screen, so
x86 libraries are deliberately not included. Use BlueStacks instead.

### iPhone / iPad

APKs are Android-only. The original iOS release (v1.0, 2014) is a **32-bit-only**
build, which iOS 11 and later cannot run at all, and the fixes here do not apply
to it. See the [FAQ](FAQ.md#can-it-run-on-iphone-or-ipad).

## Technical details of the APK

| | |
|---|---|
| Package | `com.smosh.foodbattle` |
| Game version | 1.31 (version code 20) |
| Engine | Unity 4.6.1p2, Mono scripting backend |
| CPU architecture | armeabi-v7a (32-bit ARM) only |
| minSdkVersion / targetSdkVersion | 14 / 23 |
| Size | ~68 MB (expansion data included) |
| Permissions used offline | Storage (optional), wake lock |
