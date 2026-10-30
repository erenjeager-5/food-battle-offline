# 🛠️ Troubleshooting

## Installing

| Problem | Cause | Fix |
|---|---|---|
| **"App not installed"** | Device can't run 32-bit apps, or an emulator instance without ARM translation | See [COMPATIBILITY.md](COMPATIBILITY.md). On emulators, create a new **Android 9** instance |
| **"App not installed" over an existing install** | An install of the original game (different signature) is already there | Uninstall the original first (this deletes its save) |
| **"Blocked by Play Protect"** | The APK isn't from the Play Store | Tap **More details → Install anyway** |
| **"Built for an older version of Android"** | Android 14+ warning for older apps | Tap **Install anyway** |
| **"There was a problem parsing the package"** | The download is incomplete or corrupted | Download the APK again |

## Launching

| Problem | Fix |
|---|---|
| **Black screen on the very first launch** | Normal — wait up to a minute. It only happens once |
| **Black screen every launch (emulator)** | Change the emulator's graphics mode — see [INSTALL-EMULATORS.md](INSTALL-EMULATORS.md#%EF%B8%8F-emulator-troubleshooting) |
| **"Food Battle has stopped"** | Restart the device and try again. If it keeps happening, open an issue with your device model and Android version |

## Playing

| Problem | Fix |
|---|---|
| **Can't find the level map** | Tap the **raccoon by the pond**, or the **Fat Guy** button (bottom right) once it appears |
| **A house won't open** | Houses unlock as the story progresses — keep playing levels |
| **Coins/Crystals tab says "Offline"** | Expected — real-money purchases need the original servers |
| **"You aren't connected to the server"** | Expected for accounts, friends and promo codes |

## Saves

| Problem | Fix |
|---|---|
| **Progress lost after uninstalling** | Uninstalling deletes the save. Always install updates **over** the old version |
| **Lost the last level's progress** | The game saves when you leave the app. A crash mid-level loses only that level |

## Reporting a bug

Please open an issue with:

1. Your **device model** and **Android version** (or emulator name and version)
2. **What you did** and **what happened**
3. A screenshot if possible
4. If you can, an error log: with the device connected to a PC,
   ```bash
   adb logcat -d -s Unity:* > foodbattle-log.txt
   ```
