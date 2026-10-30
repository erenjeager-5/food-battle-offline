# 📱 Installing on Android (phones & tablets)

## Before you start

- An Android phone or tablet that can run **32-bit apps** — most devices from
  roughly 2015–2022. See [COMPATIBILITY.md](COMPATIBILITY.md).
- About **150 MB** of free space.
- The patched `FoodBattle_Offline.apk` (build it from your own copy of the game
  with [BUILDING.md](BUILDING.md)).

## Steps

1. **Copy the APK to your device** — over USB, Google Drive, email to yourself,
   Bluetooth, etc.
2. **Open it** from the **Files** app or your **Downloads**.
3. If Android says _"For your security, your phone is not allowed to install
   unknown apps from this source"_:
   tap **Settings** → turn on **Allow from this source** → go back.
4. Tap **Install**.
   - If **Play Protect** warns about an unknown app, tap **More details → Install anyway**.
   - On Android 14+ you may see _"This app was built for an older version of
     Android"_ — tap **Install anyway**.
5. Open **Food Battle** from your app drawer.
   - ⏳ **The very first launch can sit on a black screen for up to a minute**
     while Android prepares the app. This only happens once.

## Playing

- Tap the **raccoon by the pond** — or the **Fat Guy button** (bottom right,
  once unlocked) — to open the **level map**.
- **Tap the ground** to walk, **tap enemies** to attack, **tap characters** to talk.
- Visit the houses in the village to craft, change equipment, buy items and more
  as the story unlocks them.

## Saving

- The game **saves automatically whenever you leave it** (Home button, switching
  apps, or closing it). If it ever crashes mid-level, you only lose that level.
- ⚠️ **Uninstalling the app or using "Clear storage" deletes your save.**

### Backing up your save (optional, needs a PC)

On Android 6 and newer the save is stored in the app's private storage. If you
have `adb` set up, you can back up the shared copy (when present) with:

```bash
adb pull /sdcard/Android/data/com.smosh.foodbattle/files/PlayerData.dat
```

## Updating to a newer patched build

Install the new APK **over** the old one — it uses the same package name and
signature, so your save is kept. Do **not** uninstall first.

Having problems? → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
