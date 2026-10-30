'use strict';
// The master list of game-code fixes. build_offline.py reads the PATCH*_OFFSET /
// PATCH*_BYTES values and ANALYTICS_HELPER_NOOPS below and writes them straight
// into the decrypted Assembly-CSharp.dll (no Frida needed). The hooking code at
// the bottom is the original Frida runtime version, kept for live debugging.

var PATCH_OFFSET = 0x36448;
var PATCH_BYTES = [0x02,0x7b,0x65,0x07,0x00,0x04,0x39,0x0b,0x00,0x00,0x00,0x02,0x7b,0x65,0x07,0x00,0x04,0x6f,0x83,0x00,0x00,0x0a,0x17,0x2a];
// InitiatiateLoginProcess's original bypass just called the game's own
// debug Bypass() method (sets 2 internal flags) and returned - but Bypass()
// never fires the onLogin event, so nothing ever advanced loadingStatus past
// 0 and ProcessLoadingFlow was never called again. Live tracing confirmed
// this exact stall: ProcessLoadingFlow entered once, hit InitiatiateLoginProcess,
// returned, and nothing else ever fired.
// First fix attempt called LandingSceneController.current.Handle_OnLogin()
// directly, which threw MethodAccessException (Handle_OnLogin is not
// accessible from FoodbattleLoginFlow) AND had the wrong signature
// (Handle_OnLogin actually takes a string, confirmed via the exception
// message). Second attempt read `this.onLogin` (ldarg.0; ldfld onLogin),
// which compiled but threw NullReferenceException: the onLogin field
// (token 0x04000199) is actually declared on GameAccountManager, not
// FoodbattleLoginFlow, and Start()'s wiring sets it via
// FoodbattleOnlineManager.Instance.onLogin (FoodbattleOnlineManager extends
// GameAccountManager) - a completely different object from `this` inside
// InitiatiateLoginProcess (confirmed by the original body itself, which
// separately calls FoodbattleOnlineManager.get_Instance() to reach
// CheckServerHealth rather than using ldarg.0). Correct fix: read onLogin
// off FoodbattleOnlineManager.Instance instead of off `this`.
//   ldarg.0; call Bypass (0x06000b6b);
//   call FoodbattleOnlineManager.get_Instance (0x06000b81);
//   ldfld onLogin (0x04000199); ldnull;
//   callvirt Action<string>.Invoke (0x0a000193); ret
var PATCH2_OFFSET = 0x355f9;
var PATCH2_BYTES = [0x02,0x28,0x6b,0x0b,0x00,0x06,0x28,0x81,0x0b,0x00,0x06,0x7b,0x99,0x01,0x00,0x04,0x14,0x6f,0x93,0x01,0x00,0x0a,0x2a];
var PATCH3_OFFSET = 0xacfc;
var PATCH3_BYTES = [0x02,0x7b,0x65,0x07,0x00,0x04,0x39,0x0b,0x00,0x00,0x00,0x02,0x7b,0x65,0x07,0x00,0x04,0x6f,0x83,0x00,0x00,0x0a,0x2a];
// GameLoader.Awake tail rewrite, starting at IL_00ba. The original version of
// this patch just did `LoadComplete = true; ret` here, which cut off far more
// than the analytics tail: it also skipped ItemDatabase.Initialize,
// LevelManager.Initialize and - critically - every DontDestroyOnLoad call.
// Without DontDestroyOnLoad, PlayerData (and the other singletons) were
// destroyed on the first scene change and silently recreated empty, so the
// player had no PlayerPersistentData, no inventory (no starter Celery Sword,
// which is what tap-to-move routes through), no difficulty, no pets - the
// "everything the server gave is gone" symptom. New tail, copied verbatim
// from the original method's own IL so all tokens are correct:
//   IL_00ba..00ce  ItemDatabase.Initialize; LevelManager.Initialize (both purely Resources.Load)
//   IL_0187..020f  all 12 DontDestroyOnLoad calls + FoodBattleGameManager.m_debug = Debug
//   IL_0268..026f  LoadComplete = true; ret
//   + NotificationSystem.Initialize(new AndroidNotifications())  (original
//     IL_0178..0187): local reminder notifications need no server. Without it
//     NotificationSystem threw NullReferenceException every time the app was
//     paused, and the "Get push notifications" option did nothing.
//   + Localytics.Instance.FoodBattleAnalyticsData().ImportSavedData(): creates
//     the game's analytics record (normally done by the skipped analytics
//     AppLaunch). Gameplay code writes to savedData unguarded at the end of
//     LevelManager.StartCurrentSelectedLevel / LevelCompleted etc., which threw
//     NullReferenceException every level start.
// Still skipped: InAppPurchaseManager.Initialize, BentoSocial/Facebook,
// NotificationSystem.Initialize and the Analytics/Localytics init (all
// defunct 2014 online services).
var PATCH4_OFFSET = 0xb5036;
var PATCH4_BYTES = [0x28,0x0e,0x12,0x00,0x0a,0x6f,0x09,0x28,0x00,0x06,0x28,0x1b,0x11,0x00,0x0a,0x6f,0x7d,0x28,0x00,0x06,0x28,0x11,0x04,0x00,0x0a,0x28,0x7b,0x00,0x00,0x0a,0x28,0x89,0x27,0x00,0x06,0x28,0x7b,0x00,0x00,0x0a,0x28,0x4b,0x07,0x00,0x0a,0x28,0x7b,0x00,0x00,0x0a,0x28,0x0e,0x12,0x00,0x0a,0x28,0x7b,0x00,0x00,0x0a,0x28,0x49,0x07,0x00,0x0a,0x28,0x7b,0x00,0x00,0x0a,0x28,0x1b,0x11,0x00,0x0a,0x28,0x7b,0x00,0x00,0x0a,0x28,0x81,0x0b,0x00,0x06,0x28,0x7b,0x00,0x00,0x0a,0x28,0x55,0x07,0x00,0x0a,0x28,0x7b,0x00,0x00,0x0a,0x28,0x54,0x12,0x00,0x0a,0x28,0x7b,0x00,0x00,0x0a,0x28,0x51,0x12,0x00,0x0a,0x28,0x7b,0x00,0x00,0x0a,0x28,0x07,0x12,0x00,0x0a,0x28,0x7b,0x00,0x00,0x0a,0x28,0x5b,0x07,0x00,0x0a,0x28,0x7b,0x00,0x00,0x0a,0x28,0x89,0x27,0x00,0x06,0x02,0x7b,0x5c,0x1b,0x00,0x04,0x7d,0xc5,0x1b,0x00,0x04,0x28,0x54,0x12,0x00,0x0a,0x73,0x22,0x29,0x00,0x06,0x6f,0x39,0x29,0x00,0x06,0x28,0x61,0x02,0x00,0x06,0x28,0x7b,0x25,0x00,0x06,0x6f,0x98,0x25,0x00,0x06,0x17,0x80,0x5b,0x1b,0x00,0x04,0x2a];
var PATCH5_OFFSET = null; // RETIRED - see note above ASSEMBLY_SIZE
var PATCH5_BYTES = [0x03, 0x2a];
// Full re-analysis of ProcessLoadingFlow's switch: cases 0/1/2/3 (login,
// Initialize, GetPlayer, intro-check) each just call their one action and
// fall through to a shared epilogue - they do NOT chain into each other
// directly. Advancement instead comes from PlayerData's own completion
// events (OnLoadPersistentDataComplete -> Handle_OnLocalSaveLoaded,
// OnLoadOnlineDataComplete -> Handle_OnLoadPlayerCompleted), wired up in
// LandingSceneController.Start(). PlayerData.Instance.Initialize() itself is
// fully local/synchronous (InitPlayerData/Load/InitNewPlayer all just do
// Resources.Load + local file I/O, no network) - it was safe all along. The
// real hang is deeper: Initialize() synchronously fires
// OnLoadPersistentDataComplete, which recursively re-enters
// ProcessLoadingFlow at status=2, which calls FoodbattleLoginFlow.GetPlayer()
// - THAT is the actual unpatched network call that hangs forever against the
// dead backend. So: leave this switch case alone (case 1, Initialize) and
// patch GetPlayer directly instead (see patch13 below), letting the real
// intro-story flow run end to end.
// PlayerData.IsQuestCompleted crashes on the uninitialized PlayerPersistentData
// (NullReferenceException) when the back-button navigation refreshes quest
// dialogs, causing the black screen. Since a bypassed player has no real
// quest history anyway, just always return false - semantically correct and
// avoids needing PlayerData to ever be properly initialized.
//   ldc.i4.0; ret
var PATCH7_OFFSET = null; // RETIRED - see note above ASSEMBLY_SIZE
var PATCH7_BYTES = [0x16, 0x2a];
// Same PlayerPersistentData-is-null crash family as patch 7, hit by two more
// PlayerData accessors: IsScreenViewed(UIScreen) fires when entering a
// building screen, IsDiaogueViewed(DialogueScriptableObject) fires on the
// Back-button -> VillageBaseScreen.OnReturn -> RefreshDynamicUIElements path
// (the exact black-screen bug). Same fix: unconditionally return false.
//   ldc.i4.0; ret
var PATCH8_OFFSET = null; // RETIRED - see note above ASSEMBLY_SIZE
var PATCH8_BYTES = [0x16, 0x2a];
var PATCH9_OFFSET = null; // RETIRED - see note above ASSEMBLY_SIZE
var PATCH9_BYTES = [0x16, 0x2a];
// DialogueScriptableObject.HasDialogueRemaining crashes with NullReferenceException
// because DialogueCollections is null on this NPC's dialogue asset (an unconfigured/
// placeholder object - never got real content assigned, likely server-driven content
// we never fetch since the backend is dead). DialogueScreen.ProcessNextDialogue
// already has a graceful fallback for HasDialogueRemaining()==false: it calls
// ScreenManager.Instance.PopScreen() and cleans up. So short-circuiting this to
// always return false turns the permanent blank/dim-screen hang into a clean,
// automatic screen close.
//   ldc.i4.0; ret
var PATCH10_OFFSET = null; // RETIRED - see note above ASSEMBLY_SIZE
var PATCH10_BYTES = [0x16, 0x2a];
// PlayerData.SetDialogueViewed also throws NullReferenceException on the same
// uninitialized PlayerPersistentData - it's called unconditionally from
// DialogueScreen.ProcessNextDialogue regardless of which branch is taken
// (HasDialogueRemaining true or false both flow through this call). It's a
// void mutator, so the safe fix is a straight no-op: ret immediately.
var PATCH11_OFFSET = null; // RETIRED - see note above ASSEMBLY_SIZE
var PATCH11_BYTES = [0x2a];
// PlayerData.IsScreenViewed has a SECOND overload taking a string screen-name
// instead of a UIScreen object (patch8 only covered the UIScreen overload).
// VillageBuildingButtons.Refresh() calls this string overload to decide badge
// visibility and crashes on the same uninitialized PlayerPersistentData.
//   ldc.i4.0; ret
var PATCH12_OFFSET = null; // RETIRED - see note above ASSEMBLY_SIZE
var PATCH12_BYTES = [0x16, 0x2a];
// FoodbattleLoginFlow.GetPlayer wraps FoodbattleOnlineManager.Instance.GetPlayer(),
// which builds a ServiceRequest<T> and calls Execute() - the same
// TimeSpan.Zero-as-infinite-timeout network hang pattern as the health-check
// and login calls, just never patched before.
// First attempt called OnGetPlayerSucceeded(null), assuming
// loadPlayerDataFromOnline defaults false and takes the safe
// PlayerData.Instance.LoadClientData() branch - wrong: it was actually true,
// so it took the AttemptToLoadOnlineData(null) branch instead, which
// dereferences the null `player` argument and throws an UNHANDLED
// (fatal, process-killing) NullReferenceException, logged right after
// "Invalid Login, unable to load data properly." Fix: skip
// OnGetPlayerSucceeded entirely and call PlayerData.Instance.LoadClientData()
// directly - the exact safe, fully-local branch we actually want, with no
// player argument involved at all. LoadClientData() still fires
// OnLoadOnlineDataComplete -> Handle_OnLoadPlayerCompleted on its own,
// advancing the flow to the intro/StartLevelLoad stage for real.
//   call PlayerData.get_Instance (0x0a000749);
//   callvirt LoadClientData (0x06002aa1); ret
var PATCH13_OFFSET = 0x35844;
var PATCH13_BYTES = [0x28, 0x49, 0x07, 0x00, 0x0a, 0x6f, 0xa1, 0x2a, 0x00, 0x06, 0x2a];
// Live tracing confirmed PlayerData.Initialize() -> Load() completes cleanly
// (no hang, no exception), but Handle_OnLocalSaveLoaded never fires
// afterward, so status never advances past 1. Rather than continue chasing
// exactly why the natural OnLoadPersistentDataComplete invocation isn't
// reaching our listener, guarantee it fires directly: Load() now calls the
// real LoadPersistentData() then explicitly invokes
// this.OnLoadPersistentDataComplete, using the exact same unconditional
// invoke pattern PlayerData.LoadClientData() already uses for its own
// OnLoadOnlineDataComplete event. This sacrifices the original
// StartCoroutine(LoadDataAfterInitialLogin) online-merge path, which is
// irrelevant to our fully-local/bypassed flow anyway.
//   ldarg.0; call LoadPersistentData (0x06002a9e);
//   ldarg.0; ldfld OnLoadPersistentDataComplete (0x04001f61);
//   callvirt Action.Invoke (0x0a000083); ret
var PATCH14_OFFSET = 0xce088;
var PATCH14_BYTES = [0x02,0x28,0x9e,0x2a,0x00,0x06,0x02,0x7b,0x61,0x1f,0x00,0x04,0x6f,0x83,0x00,0x00,0x0a,0x2a];
// Catalogued all 32 call sites in the game that go through
// online.client.bootstrap.ServiceRequest<T>, the shared network-request
// class every online feature (friends, IAP, tournaments, leaderboards,
// gifting, item transactions/energy, tuning-data refresh, save-to-server,
// etc.) is built on. All 32 call the parameterless Execute() overload, which
// itself just calls Execute(TimeSpan.Zero) - the same "zero timeout treated
// as infinite" bug already fixed individually for health-check/login/
// GetPlayer, but never patched at its single shared root. Rather than
// hand-patch the remaining ~29 sites one crash at a time (many of which are
// inherently multiplayer/live-service features - real friends, real
// leaderboards - that cannot be "contained locally" no matter what), patch
// the shared entry point itself to a pure no-op. No callback (success or
// failure) fires, so nothing can ever hang the app waiting on the dead
// server again; any UI tied to one of these secondary features may show a
// permanent local spinner for that one interaction, but the game itself
// stays fully responsive.
//   ret
var PATCH15_OFFSET = 0x38299;
var PATCH15_BYTES = [0x2a];
// Confirmed via live gameplay test (act01_level01 loaded and played
// successfully - real level content, fully bundled locally, genuinely
// playable): PlayerController.CanUseCurrentWeapon() throws
// KeyNotFoundException every frame because this.PlayerWeapons[this.UsingWeapon]
// indexes a Dictionary built from the player's real equipped-item data, which
// our bypassed PlayerData never populates (empty inventory). Same
// "bypassed player has no real economy state" family as the earlier
// PlayerData null-safety patches. Since the exception fires every single
// Update() and is never caught, it also means this energy-cost gate check
// never actually completes, which may itself block attacks from registering
// properly. Fix: always allow (matches the "assume success" treatment
// already given to other bypassed-economy checks).
//   ldc.i4.1; ret
var PATCH17_OFFSET = null; // RETIRED - see note above ASSEMBLY_SIZE
var PATCH17_BYTES = [0x17, 0x2a];
// Confirmed via the real, natural WorldMap -> "Begin Quest!" -> BeginQuest
// button flow (not a hijacked test path): QuestConfirmationScreen.ConfirmButtonPress
// -> LevelManager.StartCurrentSelectedLevel() -> PlayerData.GetNumCollectedSecretsForQuest()
// crashes with NullReferenceException on the same uninitialized
// PlayerPersistentData collections family as all the other PlayerData
// null-safety patches. A fresh/bypassed player has collected 0 secrets for
// any quest, so returning 0 unconditionally is semantically correct, not
// just a crash-avoidance shortcut.
//   ldc.i4.0; ret
var PATCH18_OFFSET = null; // RETIRED - see note above ASSEMBLY_SIZE
var PATCH18_BYTES = [0x16, 0x2a];
// The raccoon's own dialogue content is confirmed empty (DialogueCollections
// on its DialogueScriptableObject is genuinely null even with PlayerData
// properly initialized - this is missing/unfinished asset data, not a bug
// patching can fix). Rather than leave that NPC a dead end, repurpose its
// (proven-reliable) tap handler to open the real WorldMap scene - the
// game's actual, fully-functional level-select screen (confirmed via the
// authentic in-game flow: star/lock progression UI, "Begin Quest!"
// confirmation dialog with star rating, BeginQuest button correctly
// launching the chosen level through LevelManager.StartCurrentSelectedLevel()).
// This is the only reliable trigger found into that screen; the original
// hub button intended for it (VillageBaseScreen.FatGuyButtonButtonPress ->
// LoadMap()) never responded to any tap location tried.
//   call FoodBattleGameManager.get_Instance (0x06002789);
//   ldstr "worldmap" (0x70014816); ldc.i4.0;
//   callvirt TransitionScene (0x060004be); ret
var PATCH16_OFFSET = 0xeb184;
var PATCH16_BYTES = [0x28,0x89,0x27,0x00,0x06,0x72,0x16,0x48,0x01,0x70,0x16,0x6f,0xbe,0x04,0x00,0x06,0x2a];
// ATTEMPTED FIX, REVERTED: forcing PlayerController.get_PlayerInputEnabled
// to always return true (ldc.i4.1; ret) reliably crashes the game with a
// native SIGSEGV a few seconds after launch, confirmed reproducible on
// live hardware (2/2 runs crashed with it enabled, 2/2 runs stable with it
// disabled). Root cause: PlayerInputEnabled is read from at least 3 call
// sites (PlayerController.Update, ProcessGameplayAction, PlaySpecialIdle),
// including the Hub itself (the Hub's walking-around character is a real
// PlayerController instance, not just dedicated levels). Forcing it true
// unconditionally likely lets ProcessGameplayAction/PlaySpecialIdle run
// weapon/animation logic against still-uninitialized native objects,
// crashing natively rather than throwing a catchable managed exception.
// Disabled (offset=null) until a narrower fix is written that targets the
// actual stall condition instead - LevelScript.Update's m_waitingForDialogue
// flag, which pauses its scripted action list (and therefore never reaches
// the specific action-list step that legitimately sets PlayerInputEnabled)
// if the level's own intro dialogue's top screen never stops being a
// DialogueScreen - the same DialogueCollections-null class of issue already
// fixed for the raccoon, but not yet patched for in-level dialogue.
var PATCH19_OFFSET = null;
var PATCH19_BYTES = [0x17, 0x2a];

// Challenge Mode energy, offline. The energy balance lives on the dead server
// (FoodbattleOnlineManager.itemTxClient is never created), so
// GetCurrentEnergy() always returned 0 while every challenge cost 10: every
// challenge said "not enough energy", and spending/buying energy fired a
// server request whose callback never came back, so Challenge Mode could never
// start. Offline: the balance is always full, and spending/buying succeeds
// immediately through the game's own success handler.
// itemTxClient itself is NOT null offline (the online manager constructs its
// clients), but its item cache is, so every GetItem.../GetItemTxParams... call
// inside these methods throws NullReferenceException - including the energy
// limit lookup. So none of them may touch itemTxClient: they return the game's
// own built-in offline defaults directly (limit 10; cost falls back to the
// limit, exactly as GetEnergyCost does when no server data exists).
//   GetCurrentEnergy: ldarg.0; call GetMaxRegenEnergy; ret
//   GetMaxRegenEnergy: ldc.i4.s 10; ret
//   GetEnergyCost: ldarg.0; call GetMaxRegenEnergy; ret
//   GetCurrentTimeTillMoreEnergy: ldc.i4.0; ret
//   SpendEnergy/BuyEnergy: ldarg.0; ldnull; call HandleEnergyChangeSucceeded; ret
var PATCH30_OFFSET = 0x353d0;
var PATCH30_BYTES = [0x1f, 0x0a, 0x2a];
var PATCH31_OFFSET = 0x352d0;
var PATCH31_BYTES = [0x02, 0x28, 0x65, 0x0b, 0x00, 0x06, 0x2a];
var PATCH32_OFFSET = 0x351c8;
var PATCH32_BYTES = [0x16, 0x2a];
var PATCH24_OFFSET = 0x35100;
var PATCH24_BYTES = [0x02, 0x28, 0x65, 0x0b, 0x00, 0x06, 0x2a];
var PATCH25_OFFSET = 0x35428;
var PATCH25_BYTES = [0x02, 0x14, 0x28, 0x62, 0x0b, 0x00, 0x06, 0x2a];
var PATCH26_OFFSET = 0x354c4;
var PATCH26_BYTES = [0x02, 0x14, 0x28, 0x62, 0x0b, 0x00, 0x06, 0x2a];
// No ads. Chartboost's servers are gone; level start/end screens wait for the
// ad SDK to report the interstitial dismissed (and poll IsImpressionVisible),
// which a dead ad server can leave hanging. Take the game's own ad-free path
// (what it does for players who have bought anything): report the ad as
// dismissed immediately, never request or show one.
//   ShowInterstitial: ldarg.0; ldarg.1; call didDismissInterstitial; ret
//   CacheInterstitial: ret      IsImpressionVisible: ldc.i4.0; ret
var PATCH27_OFFSET = 0xb3410;
var PATCH27_BYTES = [0x02, 0x03, 0x28, 0xe6, 0x26, 0x00, 0x06, 0x2a];
var PATCH28_OFFSET = 0xb33fd;
var PATCH28_BYTES = [0x2a];
var PATCH29_OFFSET = 0xb3469;
var PATCH29_BYTES = [0x16, 0x2a];

// RETIRED PATCHES (5, 7, 8, 9, 10, 11, 12, 17, 18): every one of these was a
// workaround for the same root cause - the old PATCH4 skipped GameLoader's
// DontDestroyOnLoad calls, so PlayerData was wiped on the first scene change
// (null PlayerPersistentData, empty inventory, no difficulty). With PATCH4
// fixed they are not needed, and several actively removed real content:
// PATCH10 skipped every story dialogue, PATCH7 made every quest permanently
// "not completed", PATCH11 stopped dialogue progress being saved, and PATCH5
// showed raw loc keys instead of English text. Verified live with all of them
// disabled: hub, world map, level load, tap-to-move, NPC dialogue (real
// English text, advances on tap) and sword combat all work with zero
// exceptions. Kept above (offset=null) for reference only.
//
// Localytics.PostEvent / Analytics.PostEvent -> ret. The analytics SDKs are
// (correctly) never initialized now, so their engine/user fields are null and
// every event call threw NullReferenceException. That mattered: e.g.
// DialogueScreen.Start() calls Localytics before wiring its tap-to-continue
// button, so dialogue got stuck on screen. Making the two shared PostEvent
// funnels no-ops silences all analytics at the source.
var PATCH20_OFFSET = 0x9cf0;
var PATCH20_BYTES = [0x2a];
var PATCH21_OFFSET = 0x4e4c;
var PATCH21_BYTES = [0x2a];

// FoodbattleOnlineManager.forceOnlineConnection defaults to true (static
// initializer: ldc.i4.1; stsfld). With it true, PlayerData.SavePersistentData
// and LoadPersistentData both require a real server login id, so with no
// server the game logged "Unable to save player data" and NEVER saved or
// loaded progress - every launch was a brand-new player. Every read of this
// flag in the game is the developers' own built-in offline-mode path (local
// save/load, local fallback on login failure), so flip the default to false.
//   ldc.i4.1 -> ldc.i4.0
var PATCH22_OFFSET = 0x36165;
var PATCH22_BYTES = [0x16];
// InAppPurchaseManager.CanMakePurchases() -> return false. It reads
// StoreManager.Instance.AvailableProducts, which is null because the Google
// Play store is never initialized offline, so it threw NullReferenceException.
// Returning to the hub from any building re-evaluates the story conditions
// (StoryGroup.Activate -> StoryCondition CAN_MAKE_PURCHASE -> here), so the
// exception aborted the hub refresh and left the screen black. "Purchases are
// not possible" is the true answer offline, and every caller already handles
// it (shops show their offline view; purchase-only story events are skipped).
//   ldc.i4.0; ret
var PATCH23_OFFSET = 0xd2f84;
var PATCH23_BYTES = [0x16, 0x2a];

// FoodBattleAnalytics (the game's own analytics wrapper) event helpers ->
// ret. Their shared static FoodBattleAnalyticsData.savedData is only filled
// in by AppLaunch (part of the skipped analytics init), so every helper threw
// NullReferenceException and aborted its caller mid-way - e.g. ItemViewed
// fired inside CraftingConfirmationScreen.Initialize when tapping a recipe.
// All are void, pure event-reporting methods, so a bare ret is exact.
var ANALYTICS_HELPER_NOOPS = [
    [0xaadb8, 'AppLaunch'], [0xaaf04, 'AppClose'], [0xab1e8, 'ServerCommunicationError'],
    [0xab220, 'CurrencyPurchased'], [0xab438, 'ItemViewed'], [0xab520, 'ItemManagement'],
    [0xabab0, 'QuestsSummary'], [0xabde8, 'ChallengeSummary'], [0xabe84, 'EnergyFlow'],
    [0xabf1c, 'DialogueScreen'], [0xabf3d, 'OptionScreenSelection(1)'], [0xabf58, 'OptionScreenSelection(2)'],
    [0xabf90, 'RedeemCode'], [0xabfc8, 'SocialNetwork']
];

var ASSEMBLY_SIZE = 2300928;
var patched = [];
var offsets = [PATCH_OFFSET,PATCH2_OFFSET,PATCH3_OFFSET,PATCH4_OFFSET,PATCH5_OFFSET,PATCH7_OFFSET,PATCH8_OFFSET,PATCH9_OFFSET,PATCH10_OFFSET,PATCH11_OFFSET,PATCH12_OFFSET,PATCH13_OFFSET,PATCH14_OFFSET,PATCH15_OFFSET,PATCH16_OFFSET,PATCH17_OFFSET,PATCH18_OFFSET,PATCH19_OFFSET,PATCH20_OFFSET,PATCH21_OFFSET,PATCH22_OFFSET,PATCH23_OFFSET,PATCH24_OFFSET,PATCH25_OFFSET,PATCH26_OFFSET,PATCH27_OFFSET,PATCH28_OFFSET,PATCH29_OFFSET,PATCH30_OFFSET,PATCH31_OFFSET,PATCH32_OFFSET];
var bytesArr = [PATCH_BYTES,PATCH2_BYTES,PATCH3_BYTES,PATCH4_BYTES,PATCH5_BYTES,PATCH7_BYTES,PATCH8_BYTES,PATCH9_BYTES,PATCH10_BYTES,PATCH11_BYTES,PATCH12_BYTES,PATCH13_BYTES,PATCH14_BYTES,PATCH15_BYTES,PATCH16_BYTES,PATCH17_BYTES,PATCH18_BYTES,PATCH19_BYTES,PATCH20_BYTES,PATCH21_BYTES,PATCH22_BYTES,PATCH23_BYTES,PATCH24_BYTES,PATCH25_BYTES,PATCH26_BYTES,PATCH27_BYTES,PATCH28_BYTES,PATCH29_BYTES,PATCH30_BYTES,PATCH31_BYTES,PATCH32_BYTES];
var names = ['health-check bypass','login-flow bypass','ServerHealthCheck network-skip','Awake analytics-tail skip','GetLocString fallback','IsQuestCompleted short-circuit','IsScreenViewed(UIScreen) short-circuit','IsDiaogueViewed short-circuit','HasDialogueRemaining short-circuit','SetDialogueViewed no-op','IsScreenViewed(string) short-circuit','GetPlayer network-skip','Load explicit OnLoadPersistentDataComplete','ServiceRequest.Execute universal no-op','raccoon-tap opens WorldMap (level select)','CanUseCurrentWeapon always-allow','GetNumCollectedSecretsForQuest short-circuit','PlayerInputEnabled always-true','Localytics.PostEvent no-op','Analytics.PostEvent no-op','offline-mode save/load enabled','CanMakePurchases always-false','energy: always full','energy: spend succeeds','energy: buy succeeds','ads: ShowInterstitial skipped','ads: CacheInterstitial skipped','ads: IsImpressionVisible false','energy: limit 10','energy: cost offline default','energy: no regen timer'];

ANALYTICS_HELPER_NOOPS.forEach(function (e) {
    offsets.push(e[0]); bytesArr.push([0x2a]); names.push('FoodBattleAnalytics.' + e[1] + ' no-op');
});

var savedImageBase = null;
function applyPatches(dataPtr, len) {
    if (len !== ASSEMBLY_SIZE) return;
    savedImageBase = dataPtr;
    for (var i = 0; i < offsets.length; i++) {
        if (patched[i] || offsets[i] === null) continue;
        patched[i] = true;
        Memory.protect(dataPtr.add(offsets[i]), bytesArr[i].length, 'rwx');
        Memory.writeByteArray(dataPtr.add(offsets[i]), bytesArr[i]);
        console.log('[patch] ' + names[i] + ' applied');
    }
}

var hooked = false;
function tryHook() {
    if (hooked) return;
    var mod = Process.findModuleByName('libmono.so');
    if (!mod) return;
    var addr = Module.findExportByName('libmono.so', 'mono_image_open_from_data_with_name');
    if (!addr) return;
    hooked = true;
    Interceptor.attach(addr, { onEnter: function (args) { applyPatches(args[0], args[1].toInt32()); } });
    console.log('[+] mono hook installed');
}
// Install immediately if libmono.so is already loaded: the standalone APK
// loads it from Java right before the gadget, so this always succeeds there.
// (Do NOT hook dlopen/android_dlopen_ext instead: on Android 7+ the linker
// uses the caller's return address to pick the library namespace, so an
// Interceptor on dlopen breaks vendor driver loading - verified: "libgsl.so
// not found" followed by a SIGSEGV in the linker on the RenderThread.)
tryHook();
var pollCount = 0;
var pollIv = setInterval(function () {
    pollCount++;
    tryHook();
    if (hooked || pollCount > 600) clearInterval(pollIv);
}, 100);

// No re-assertion loop: Unity calls mono_image_open_from_data_with_name with
// need_copy=1 (verified live), so Mono copies the buffer - patches included -
// inside that call, and the original buffer is then freed. The old loop kept
// writing into that freed heap memory every 300ms, corrupting whatever got
// allocated there next; that was the source of the "flaky" SIGSEGV/SIGILL
// crashes (and why the large GameLoader.Awake patch crashed instantly).

console.log('[+] final patch-only script ready');
