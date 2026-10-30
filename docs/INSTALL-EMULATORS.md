# 💻 Playing on PC (Android emulators)

## Requirements

- **Windows 10 or 11**
- **4 GB RAM** minimum (8 GB recommended)
- **Virtualization enabled** (Intel VT-x / AMD-V). Most PCs have it on already;
  if the emulator says it's off, enable it in your BIOS/UEFI settings.
- An **Android 7 or Android 9** emulator instance with **ARM translation**
  (the default on all emulators below)

| Emulator | Status |
|---|---|
| **BlueStacks 5** | ✅ Tested — works |
| **LDPlayer 9** | 🟡 Should work — not yet tested |
| **MEmu** | 🟡 Should work — not yet tested |
| **Nox** | 🟡 Should work — not yet tested |
| Android Studio emulator | ❌ Does not work |

> **Why "should work"?** LDPlayer, MEmu and Nox run Android on your PC's
> Intel/AMD processor and translate ARM apps — the same approach as BlueStacks,
> where the game is tested and working. The APK only contains ARM code, so these
> emulators use their translator for it.

---

## 🟢 BlueStacks 5 (recommended)

1. Download and install **BlueStacks 5** from <https://www.bluestacks.com>.
2. Open it. The default **Android 9 (Pie 64-bit)** instance is the right one.
3. **Drag the APK** onto the BlueStacks window — or click **Install APK** on the
   right-hand side bar and choose the file.
4. Open **Food Battle** from the BlueStacks home screen.

## 🟡 LDPlayer 9

1. Download and install **LDPlayer 9** from <https://www.ldplayer.net>
   (LDPlayer 9 runs Android 9).
2. **Drag the APK** onto the window — or click the **APK** button on the right toolbar.
3. Open **Food Battle**.

## 🟡 MEmu

1. Download and install **MEmu** from <https://www.memuplay.com>.
2. **Drag the APK** onto the window — or click the **APK** button on the right toolbar.
3. Open **Food Battle**.
4. If you get **"App not installed"**, open **Multi-MEmu**, create a new
   **Android 9** instance and install it there.

## 🟡 Nox

1. Download and install **NoxPlayer** from <https://www.bignox.com>.
2. **Drag the APK** onto the window — or click the **APK** button on the right toolbar.
3. Open **Food Battle**.
4. If you get **"App not installed"**, open **Multi-Drive**, add a new
   **Android 9** instance and install it there.

---

## 🛠️ Emulator troubleshooting

| Problem | Fix |
|---|---|
| Black screen on first launch | Wait up to a minute — the first start is slow |
| Black screen that never goes away | Change the graphics mode (below), then restart the emulator |
| "App not installed" | That instance has no ARM translation — create a new **Android 9** instance |
| Game is slow / choppy | Give the emulator more CPU cores and RAM in its settings |

**Changing the graphics mode** — try **OpenGL** first, then **DirectX** or **Vulkan**:

| Emulator | Setting |
|---|---|
| BlueStacks | Settings → Graphics → Graphics renderer |
| LDPlayer | Settings → Advanced → Graphics rendering mode |
| MEmu | Settings → Engine → Render mode |
| Nox | Settings → Performance → Graphics rendering mode |

## Controls

- **Click the ground** to walk, **click enemies** to attack, **click characters** to talk.

## Saves

Saves live inside that emulator instance. Deleting the instance or uninstalling
the game deletes the save.

More help → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
