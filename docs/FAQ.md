# ❓ FAQ

### Is this the full game?

Yes — this is the complete v1.31 Android release: all 30 story levels across
6 acts, Challenge Mode, crafting, pets, shops and the intro/outro cinematics.
Only the features that needed the original servers are unavailable.

### Do I need a PC, root, or an internet connection to play?

No. Once installed, the game runs entirely on the device, offline.

### Does it save?

Yes. Progress saves automatically whenever you leave the app. Uninstalling or
clearing the app's storage deletes the save.

### Why doesn't this repository include the APK?

The game belongs to its rights holders. This repository only shares original
documentation and tools — the same approach ROM-hacking and preservation
communities use. See [BUILDING.md](BUILDING.md) to build it from your own copy.

### Can it run on iPhone or iPad?

No. APKs are Android-only, and the original iOS release is a 32-bit-only
v1.0 build from 2014 that cannot run on iOS 11 or later. Even on an old device
still on iOS 10, every fix would have to be redone for iOS's ahead-of-time
compiled code.

### Will it work on my new phone?

Only if your phone can run 32-bit apps. Pixel 7 and newer, and phones with the
newest flagship chips (e.g. Galaxy S24/S25), cannot. Try installing — Android
will say "App not installed" if it can't.

### Can it be made to work on 64-bit-only phones?

Not by patching. The game engine itself is 32-bit only; supporting those phones
would mean rebuilding the entire game in a modern version of Unity.

### What about consoles (PS Vita, 3DS)?

- **PS Vita:** theoretically possible via the Vita homebrew "so-loader"
  approach (the Vita is also 32-bit ARM), but it would be a large porting project.
- **3DS:** not realistic — far too little memory and an incompatible CPU and GPU.

### Why is Challenge Mode energy always full?

Energy was stored on the original servers, which no longer exist. Offline, the
game's own fallback values are used and energy is always available.

### Why are there no ads?

The ad network's servers are gone, and waiting for them could freeze the game
at the start or end of a level. The patch uses the game's own ad-free path.

### Can I move my save to another device?

Yes, with `adb` — copy `PlayerData.dat` from
`/sdcard/Android/data/com.smosh.foodbattle/files/` on one device to the same
place on the other. (On Android 6+, the game only uses that shared location if
it has storage permission.)

### How were the bugs found and fixed?

See [TECHNICAL.md](TECHNICAL.md) for the full write-up.
