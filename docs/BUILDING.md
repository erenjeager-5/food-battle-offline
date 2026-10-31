# 🏗️ Building the patched APK

This builds `FoodBattle_Offline.apk` from **your own copy** of _Smosh: Food Battle
The Game_ **v1.31** (Android, version code 20). Nothing from the game is included
in this repository.

> The build has been verified to reproduce the tested APK file-for-file from the
> v1.31 inputs listed under [Expected inputs](#expected-inputs).

## Requirements

| Tool | Notes |
|---|---|
| [Python 3.8+](https://www.python.org) | Runs the build script |
| [.NET 8 SDK](https://dotnet.microsoft.com/download) | Compiles the companion library and runs the Mono.Cecil injector (`mod/`) |
| [Java 11+](https://adoptium.net) | Runs apktool and keytool |
| [apktool 2.9+](https://apktool.org) | Decodes and rebuilds the APK |
| Android SDK **build-tools** and **platform-tools** | `zipalign`, `apksigner`, `adb` — e.g. via Android Studio's SDK Manager |
| [Frida](https://frida.re) (`pip install frida-tools`) | One-time capture of the decrypted game code |
| An Android device | To run the original game once for the capture |

## 1. Get the original files from your device

With the original game installed on your Android device and USB debugging on:

```bash
adb shell pm path com.smosh.foodbattle
```

```bash
adb pull /data/app/<path from above>/base.apk base.apk
```

```bash
adb pull /sdcard/Android/obb/com.smosh.foodbattle/main.20.com.smosh.foodbattle.obb
```

## 2. Decode the APK

```bash
java -jar apktool.jar d base.apk -o decoded
```

## 3. Capture the decrypted game code (one time)

The game's assemblies are encrypted in the APK and decrypted in memory at
launch. [`tools/dump_assemblies.js`](../tools/dump_assemblies.js) saves them as
Mono receives them. Pick **one** way to run Frida:

### Option A — rooted device

Run [`frida-server`](https://frida.re/docs/android/) on the device, then:

```bash
frida -U -f com.smosh.foodbattle -l tools/dump_assemblies.js
```

### Option B — no root (Frida Gadget)

Inject the Frida Gadget into a **copy** of the APK with
[objection](https://github.com/sensepost/objection):

```bash
objection patchapk --source base.apk
```

Uninstall the original game, install `base.objection.apk` (keep the OBB in
place), start it — it will wait on a black screen — then:

```bash
frida -U -n Gadget -l tools/dump_assemblies.js
```

Type `%resume` in the Frida console if the game doesn't continue by itself.

### Collect the files

Once the game reaches its loading screen, pull the three files:

```bash
adb pull /sdcard/Android/data/com.smosh.foodbattle/files/dec_Assembly-CSharp.dll assemblies/Assembly-CSharp.dll
```

```bash
adb pull /sdcard/Android/data/com.smosh.foodbattle/files/dec_Assembly-CSharp-firstpass.dll assemblies/Assembly-CSharp-firstpass.dll
```

```bash
adb pull /sdcard/Android/data/com.smosh.foodbattle/files/dec_Assembly-UnityScript.dll assemblies/Assembly-UnityScript.dll
```

## 4. Create a signing key (one time)

```bash
keytool -genkeypair -keystore my.keystore -alias foodbattle -keyalg RSA -keysize 2048 -validity 10000
```

Keep this keystore: future builds signed with the **same** key install over
earlier ones **without losing saves**.

## 5. Build

```bash
python tools/build_offline.py --decoded decoded --obb main.20.com.smosh.foodbattle.obb --assemblies assemblies --keystore my.keystore --ks-pass pass:YOUR_PASSWORD --apktool apktool.jar --build-tools "PATH/TO/Android/Sdk/build-tools/36.0.0"
```

The script checks every input against the known v1.31 checksums, applies all
36 patches, compiles and injects the companion library (`mod/`), merges the OBB
and produces `FoodBattle_Offline.apk` (~68 MB). The first run downloads Mono.Cecil
from NuGet.

## 6. Install

Uninstall the original (or Gadget) build first — it has a different signature —
then install the new APK:

```bash
adb install FoodBattle_Offline.apk
```

## Expected inputs

| File | SHA-256 |
|---|---|
| `Assembly-CSharp.dll` (decrypted, 2,300,928 bytes) | `f52b38288986a0189eec8eba28bd14e69054f9268c7fe1f09a073f9d0c0c5f01` |
| `Assembly-CSharp-firstpass.dll` (decrypted) | `2adda1c79b6ab8b0915adb8998e8e243b6069ce698c44d8ceb01f49fc4491c23` |
| `Assembly-UnityScript.dll` (decrypted) | `0f47c209e28a89bf82e97b060111b3d1acc8eccb3d633f833bf053a702eb24fb` |
| `main.20.com.smosh.foodbattle.obb` | `6129bae2f02fc44176ee592722fbbab5f4adfee5c63ee8a8e4ac60d5d3444150` |

Patch offsets are specific to v1.31. Other versions will be rejected unless
`--force` is used (and would need new offsets — see
[`tools/find_method.py`](../tools/find_method.py)).

## Developing new patches

1. Decompile the decrypted `Assembly-CSharp.dll` with
   [ILSpy](https://github.com/icsharpcode/ILSpy) (`ilspycmd -p -o src Assembly-CSharp.dll`).
2. Find a method's IL file offset:
   ```bash
   python tools/find_method.py assemblies/Assembly-CSharp.dll PlayerData.Load
   ```
3. Add a `PATCHnn_OFFSET` / `PATCHnn_BYTES` pair to
   [`patches/fixes.js`](../patches/fixes.js) with a comment explaining the
   problem and the IL, and add it to the `offsets`, `bytesArr` and `names` lists.
4. Check the result with `ilspycmd -il`, then rebuild and test with
   `adb logcat -s Unity:*` running.

`patches/fixes.js` is also a working Frida script (it applies the same patches
at runtime), which is handy for trying a patch without rebuilding.
