# 🔬 Technical write-up

How _Smosh: Food Battle The Game_ v1.31 (Android) was brought back to a fully
playable state after its servers shut down.

## Contents

- [The game](#the-game)
- [Approach](#approach)
- [Problems and fixes](#problems-and-fixes)
  - [1. Startup hangs](#1-startup-hangs)
  - [2. Progress wiped on every scene change](#2-progress-wiped-on-every-scene-change)
  - [3. Saving never worked](#3-saving-never-worked)
  - [4. Every online service hung or crashed](#4-every-online-service-hung-or-crashed)
  - [5. Black screen after leaving a building](#5-black-screen-after-leaving-a-building)
  - [6. Challenge Mode impossible](#6-challenge-mode-impossible)
  - [7. Ad freezes](#7-ad-freezes)
  - [8. Analytics crashes](#8-analytics-crashes)
  - [9. Notifications](#9-notifications)
  - [10. Packaging: OBB, Android 14+, emulators](#10-packaging-obb-android-14-emulators)
  - [11. Pet text placeholders in other languages](#11-pet-text-placeholders-in-other-languages)
  - [12. Crystals for coins](#12-crystals-for-coins)
- [The companion library](#the-companion-library)
- [Retired workarounds](#retired-workarounds)
- [Lessons learned](#lessons-learned)
- [Patch reference](#patch-reference)

---

## The game

| | |
|---|---|
| Developer | Roadhouse Interactive, for Defy Media / Smosh (2014) |
| Engine | Unity 4.6.1p2, Mono scripting backend (JIT) |
| Game code | `Assembly-CSharp.dll` (2.3 MB, encrypted on disk) |
| Native libs | `libunity.so`, `libmono.so`, `libmain.so`, `libfff_.so` (decryptor) |
| Data | APK + a 58 MB Google Play expansion file (`main.20.com.smosh.foodbattle.obb`) |
| Backend | `foodbattle2.roadhouseinteractive.com` (gone) |

The game code ships **encrypted**. A small native library, `libfff_.so`, is
loaded from Java in `onCreate`, hooks Mono's image loader and decrypts the
assemblies as Mono reads them. The cipher differs per file, so the decrypted
images were captured from memory at the point Mono receives them
(`mono_image_open_from_data_with_name`).

## Approach

1. **Capture** the decrypted assemblies with a Frida hook on
   `mono_image_open_from_data_with_name`.
2. **Decompile** them with ILSpy to read the game's C#.
3. **Reproduce** each problem on a real device while recording `logcat`.
4. **Patch** the smallest possible piece of IL — usually a method's first few
   bytes — preferring the game's own offline code paths.
5. Early on, patches were applied **at runtime** by Frida. The final build
   writes them **directly into the decrypted DLL** and ships it unencrypted,
   with the decryptor removed — no runtime injection at all.
6. Features that need new code rather than a few changed bytes live in a small
   C# library that is wired into the game at build time with Mono.Cecil
   (see [The companion library](#the-companion-library)).

Every patch is a small, documented IL byte sequence at a fixed file offset in
the v1.31 `Assembly-CSharp.dll` — see [`patches/fixes.js`](../patches/fixes.js).

---

## Problems and fixes

### 1. Startup hangs

The landing scene runs a chain: **server health check → login → load local
save → fetch the player from the server → load the village**. Every network
step used `ServiceRequest.Execute()`, which calls `Execute(TimeSpan.Zero)`, and
this old client code treats a zero timeout as **wait forever**. With the server
gone, the game sat on the loading screen indefinitely.

| Patch | Method | Fix |
|---|---|---|
| `PATCH` | health-check flow | treat the check as passed |
| `PATCH3` | `ServerHealthCheck` | skip the network call |
| `PATCH2` | `FoodbattleLoginFlow.InitiatiateLoginProcess` | call the game's own `Bypass()`, then raise `onLogin` on `FoodbattleOnlineManager.Instance` so the flow advances |
| `PATCH13` | `FoodbattleLoginFlow.GetPlayer` | call `PlayerData.LoadClientData()` directly — the game's local-data branch |
| `PATCH14` | `PlayerData.Load` | load local data and raise `OnLoadPersistentDataComplete` synchronously |
| `PATCH15` | `ServiceRequest.Execute` | no-op: no request is ever sent, so nothing can wait on one |

### 2. Progress wiped on every scene change

The most important bug. An early workaround skipped the analytics/ad SDK setup
at the end of `GameLoader.Awake` by returning early — but it returned too early
and also skipped `ItemDatabase.Initialize`, `LevelManager.Initialize` and
**every `DontDestroyOnLoad` call**.

Without `DontDestroyOnLoad`, the `PlayerData` singleton was **destroyed on the
first scene change** and silently recreated empty. The symptoms looked like
"everything the server provided is missing":

- no starter **Celery Sword**, so **tap-to-move didn't work** (movement is
  routed through the equipped weapon object)
- 0 coins, no clothing, no difficulty, no pets
- `NullReferenceException` everywhere `PlayerPersistentData` was read

**Fix (`PATCH4`):** rewrite the tail of `GameLoader.Awake` from IL_00BA using
the method's *own* original IL: `ItemDatabase.Initialize`,
`LevelManager.Initialize`, all 12 `DontDestroyOnLoad` calls, the debug-settings
assignment, the notification setup and the analytics record (see 8 and 9), then
`LoadComplete = true`. Still skipped: in-app purchasing, Facebook/BentoSocial
and the analytics SDKs.

### 3. Saving never worked

`FoodbattleOnlineManager.forceOnlineConnection` is a static field initialised to
`true`. With it set, `PlayerData.SavePersistentData` and `LoadPersistentData`
both require a valid server login ID, so the game logged _"Unable to save
player data"_ and **never saved or loaded** — every launch was a new player.

Every read of this flag in the game is the developers' own **offline mode**
(local save/load, local fallback on login failure).

**Fix (`PATCH22`):** flip the static initializer from `ldc.i4.1` to `ldc.i4.0`.
Saves are written to `PlayerData.dat` through Unity's persistent data path.

### 4. Every online service hung or crashed

| Patch | Method | Fix |
|---|---|---|
| `PATCH15` | `ServiceRequest.Execute` | universal no-op for all 32 call sites (friends, IAP, gifting, tuning refresh, save-to-server…) |
| `PATCH16` | raccoon's tap handler | opens the world map (the only reliable way into it on a fresh profile) |

### 5. Black screen after leaving a building

Returning to the village from any building re-evaluates the story conditions:
`StoryGroup.Activate → StoryCondition (CAN_MAKE_PURCHASE) →
InAppPurchaseManager.CanMakePurchases()`. That reads
`StoreManager.Instance.AvailableProducts`, which is `null` because Google Play
billing is never initialised offline. The exception aborted the hub refresh and
left the screen black.

**Fix (`PATCH23`):** `CanMakePurchases()` returns `false` — the true answer
offline. Every caller already handles it: shops show their **Offline** view and
purchase-only story events are skipped.

### 6. Challenge Mode impossible

Energy ("pizza slices") lived on the server's item-transaction service:

- `GetCurrentEnergy()` returned 0 while every challenge cost 10 → always _"not
  enough energy"_
- buying/spending energy sent a request whose callback never returned
- `itemTxClient` itself exists offline but its cache is `null`, so the limit and
  cost lookups threw — crashing the difficulty buttons

**Fix (`PATCH24`–`PATCH26`, `PATCH30`–`PATCH32`):** none of the energy methods
touch `itemTxClient`. They return the game's own built-in defaults (limit 10;
cost falls back to the limit), the balance is always full, and spending or
buying succeeds immediately through the game's own success handler.

### 7. Ad freezes

Level start (`QuestConfirmationScreen`) and level end (`LevelResultsScreen`,
`ChallengeResultsScreen`, `ChallengePetXPScreen`) randomly request a Chartboost
interstitial and wait for the SDK to report it dismissed. With Chartboost's
servers gone, whether that ever happens depends on the old SDK.

**Fix (`PATCH27`–`PATCH29`):** `ShowInterstitial` reports the ad dismissed
immediately (the game's own path for players who have made a purchase),
`CacheInterstitial` does nothing, and `IsImpressionVisible` returns `false`.

### 8. Analytics crashes

| Patch | Method | Fix |
|---|---|---|
| `PATCH20` | `Localytics.PostEvent` | no-op — the SDK is never initialised, so every event threw (this blocked `DialogueScreen.Start` from wiring its tap-to-continue button) |
| `PATCH21` | `Analytics.PostEvent` | no-op |
| 14 × helpers | `FoodBattleAnalytics.*` (`AppLaunch`, `ItemViewed`, `QuestsSummary`…) | no-op — they read analytics data only created by the skipped SDK setup |
| `PATCH4` (part) | `GameLoader.Awake` | calls the game's own `FoodBattleAnalyticsData.ImportSavedData()` so the analytics record exists; gameplay code writes to it unguarded at level start/end |

### 9. Notifications

`NotificationSystem.Initialize(new AndroidNotifications())` was part of the
skipped `GameLoader.Awake` tail, so every app pause threw and the _"Get push
notifications"_ option did nothing. These are **local** reminders and need no
server. **Fix:** restored as part of `PATCH4`.

### 10. Packaging: OBB, Android 14+, emulators

| Change | Why |
|---|---|
| Expansion (OBB) contents merged into the APK, Unity `useObb` = `False` | No separate 58 MB file to copy; the two videos are stored uncompressed for Android's media player |
| OBB download check coroutine (`<OBBDownloader>c__Iterator25.MoveNext`) → finished | Otherwise it tries to fetch the missing OBB from Google Play forever |
| Decrypted assemblies shipped; `libfff_.so` and its `loadLibrary` removed | No runtime decryption or injection needed |
| `targetSdkVersion` 21 → 23 | Android 14+ refuses to install apps targeting below 23 |
| x86 engine libraries removed | On x86 emulators the original x86 Unity player renders only a black screen; without it they use their ARM translator, which works on BlueStacks |

### 11. Pet text placeholders in other languages

The game picks its language from the device on first launch (`LocManager.Initialize`):
English, French, Italian, German or Spanish. Only English was ever translated; the
other columns of `localization.csv` hold `FR:`-style placeholders, and with
`locErrorsEnabled = false` (set in `GameLoader.Awake`) `GetLocString` falls back to
the English CSV text for them. So the game looks fully English on those devices.

Some labels never appear in the CSV at all. `LocaliseLabel` registers their English
text from the prefab at runtime (`LocManager.RegisterEnglish`), e.g.
`Inventory_PetName` = `[PetName] - Lv[Level]`. That registration only goes into the
English table. In any other language `GetLocString` found nothing, returned `""` (no
error text, because errors are disabled), and `LocaliseLabel.DoLocaliseLabel` skips
empty results, so the label kept its raw template. Affected: the pet card, the pet
XP / level-up screen and the pet evolution screen.

Reproduced on a real device with a test build forced to Spanish, then verified fixed.

**Fix (companion library):** every value `LocManager.GetLocString` returns passes
through `FoodBattleOffline.EnglishFallback`. In a non-English language, an empty or
`BAD ID` result for an ID that has registered English text returns that English
text instead. English devices are unaffected.

### 12. Crystals for coins

Crystals (the premium currency) were sold for real money in Stevie's store
(`StevieStoreScreen`, Crystals tab) and on the in-level revive screen
(`ResurrectStoreScreen`). Both list the game's own `IAPFoodPurchase` packs, but
the titles, descriptions and prices came from Google Play, so offline the tab only
showed the **Offline** view. That left Challenge Mode rewards as the only source of
crystals.

**Feature (companion library):**

| Hook | Behaviour |
|---|---|
| `StevieStoreScreen.CheckForOnline` | same as the original, except the Crystals tab is always available |
| `UIStoreIAP.Populate` (prologue) | a crystal-only pack is filled in locally: title from the pack name, price in coins |
| `UIStoreIAP.Handle_BuyClicked` (prologue) | first tap arms the pack ("Tap again to buy"), a second tap within 4 s spends the coins, adds the crystals and saves; not enough coins shows "Need N coins" |

Prices follow the original store tiers: each crystal pack costs the coins of the
coin pack in the same tier, about 20 coins per crystal.

| Pack | Crystals | Coins |
|---|---|---|
| Starter | 5 | 100 |
| Small | 25 | 500 |
| Medium | 60 | 1,500 |
| Large | 150 | 5,000 |
| Massive | 400 | 10,000 |
| Epic | 1,000 | 30,000 |

The Coins tab stays offline: there is nothing sensible to pay for coins with.

---

## The companion library

[`mod/helper/FoodBattleOffline.cs`](../mod/helper/FoodBattleOffline.cs) is compiled
with the .NET SDK's C# compiler against the game's **own** Mono 2.0 `mscorlib`,
`System`, `System.Core` and `UnityEngine` (`-nostdlib`, C# 3), so it only uses APIs
the game's runtime has. It ships as `Managed/FoodBattleOffline.dll`; Mono loads it
from there like any other game assembly.

[`mod/injector`](../mod/injector/Program.cs) (Mono.Cecil) then edits the
byte-patched `Assembly-CSharp.dll`:

- inserts the hooks listed in [11](#11-pet-text-placeholders-in-other-languages)
  and [12](#12-crystals-for-coins), which call into the library
- trims the dead IL that some byte patches leave behind an early `ret` (the
  analytics no-ops and `PlayerData.Load`); Cecil cannot re-encode those bytes,
  and they are unreachable, so behaviour is unchanged

The C# compile is deterministic, so a build from the same inputs is byte-identical.

---

## Retired workarounds

Several early patches only papered over the wiped-`PlayerData` bug
([2](#2-progress-wiped-on-every-scene-change)) and were removed once it was fixed — some
had been removing real content:

| Retired | Side effect it had |
|---|---|
| `HasDialogueRemaining` → false | skipped **every** story dialogue |
| `IsQuestCompleted` → false | quests could never count as complete |
| `SetDialogueViewed` → no-op | dialogue progress never saved |
| `GetLocString` → return key | showed raw text keys instead of English |
| `IsScreenViewed`, `IsDialogueViewed`, `CanUseCurrentWeapon`, `GetNumCollectedSecretsForQuest` | masked null `PlayerPersistentData` |

## Lessons learned

- **Find the root cause.** Nine "fixes" turned out to be symptoms of one early
  return that skipped `DontDestroyOnLoad`.
- **Don't write into freed memory.** The early Frida script re-applied patches
  every 300 ms into Unity's assembly buffer — but Mono copies that buffer
  (`need_copy=1`) and Unity then frees it, so the loop was corrupting the heap.
  That caused "random" `SIGSEGV`/`SIGILL` crashes that were wrongly blamed on
  individual patches.
- **Don't hook `dlopen` on Android 7+.** The linker uses the caller's return
  address to choose a library namespace; an `Interceptor` on `dlopen` made vendor
  GPU drivers fail to load.
- **Frida doesn't survive ARM translation.** Under emulator ARM translators the
  Frida gadget stalls during start-up — one reason the final build bakes the
  patches in instead of injecting them.
- **Prefer the game's own fallbacks.** Almost every fix routes into code the
  original developers wrote for offline or ad-free play.
- **Test in other languages.** The game silently changes behaviour with the
  device language; a forced-language test build is a cheap way to check.

## Patch reference

All patches target **file offsets in the decrypted v1.31
`Assembly-CSharp.dll`** (size 2,300,928 bytes). Each entry in
[`patches/fixes.js`](../patches/fixes.js) has a comment explaining the problem,
the evidence, and the exact IL written. In total the build applies **36**
patches: 21 numbered fixes, 14 analytics helper no-ops and the OBB-check skip.
The companion library's hooks are listed in [11](#11-pet-text-placeholders-in-other-languages)
and [12](#12-crystals-for-coins).
