// FoodBattleOffline.dll - offline features that need more than a byte patch.
//
// Crystal exchange: with Google Play billing gone, the Crystals tab in Stevie's store
// (and the crystal packs offered on the revive screen) can be bought with coins.
// Each crystal pack costs the coins of the coin pack in the same tier of the original
// store (5 crystals = 100 coins ... 1000 crystals = 30,000 coins, about 20 coins each).
//
// Text fallback: the game picks French, Italian, German or Spanish from the device
// language. Those columns were never translated, so the game shows English, except for
// labels whose English text is only registered at runtime from the prefab (the pet card,
// pet level-up and evolution labels). Their lookup returned "" in other languages, so the
// label kept its raw "[PetName] - Lv[Level]" template. Now they fall back to English too.
//
// Hooks (inserted by mod/injector):
//   StevieStoreScreen.CheckForOnline  -> CheckForOnline       (Crystals tab stays open offline)
//   UIStoreIAP.Populate   (prologue)  -> IsOfflineCrystalPack / FillOfflineCrystalPack
//   UIStoreIAP.Handle_BuyClicked      -> TryBuyWithCoins      (tap once to arm, again to buy)
//   LocManager.GetLocString (every ret) -> EnglishFallback
//
// Built against the game's own Mono 2.0 mscorlib, so only .NET 2.0/3.5 APIs are used.
using System;
using RHICommon;
using RHICommon.Tags;
using UnityEngine;

public static class FoodBattleOffline
{
    private const float ArmSeconds = 4f;

    private static UIStoreIAP s_armedItem;
    private static float s_armedAt;

    public static int CoinCost(IAPFoodPurchase pack)
    {
        switch (pack.hardCurrency)
        {
            case 5: return 100;
            case 25: return 500;
            case 60: return 1500;
            case 150: return 5000;
            case 400: return 10000;
            case 1000: return 30000;
            default: return pack.hardCurrency * 20;
        }
    }

    public static bool IsOfflineCrystalPack(object occupant)
    {
        IAPFoodPurchase pack = occupant as IAPFoodPurchase;
        return pack != null && pack.hardCurrency > 0 && pack.softCurrency == 0
            && pack.inventorySlots == 0 && (pack.items == null || pack.items.Length == 0)
            && !InAppPurchaseManager.CanMakePurchases();
    }

    // Replaces StevieStoreScreen.CheckForOnline: same as the original, except the
    // Crystals tab is always available.
    public static bool CheckForOnline(StevieStoreScreen screen, UIBuildingScreen.TabView view)
    {
        bool available = InAppPurchaseManager.CanMakePurchases() || view == screen.CrystalsView;
        if (!available)
        {
            view.uiList.ClearObjectList();
        }
        screen.OfflineView.SafeSetActive(!available);
        return available;
    }

    // Fills a store row for a crystal pack without the Google Play product info.
    public static void FillOfflineCrystalPack(UIStoreIAP item, object occupant)
    {
        IAPFoodPurchase pack = (IAPFoodPurchase)occupant;
        RagTagCollection tags = item.GetComponent<RagTagCollection>();
        Set(tags, "Icon", delegate(RagTag tag) { tag.GetComponent<UI2DSprite>().sprite2D = pack.icon; });
        SetLabel(tags, "Label_Title", PackTitle(pack));
        SetLabel(tags, "Label_Description", "Trade your coins for crystals");
        SetLabel(tags, "Label_Price", PriceText(pack));
        SetLabel(tags, "Label_Currency", LocManager.Instance.GetSubstitutedLocString("StoreIAP_Currency_Crystal",
            new string[] { "${quantity}" }, new string[] { pack.hardCurrency.ToString("N0", LocManager.Instance.currentCultureInfo) }));
        Set(tags, "Icon_Currency_Coin", delegate(RagTag tag) { tag.gameObject.SetActive(false); });
        Set(tags, "Icon_Currency_Crystal", delegate(RagTag tag) { tag.gameObject.SetActive(true); });
        Set(tags, "Collider_Buy", delegate(RagTag tag) { tag.collider.enabled = true; });
    }

    // Replaces UIStoreIAP.Handle_BuyClicked for crystal packs while offline.
    // Returns false to let the original (Google Play) purchase run.
    public static bool TryBuyWithCoins(UIStoreIAP item, IAPFoodPurchase pack)
    {
        if (pack == null || !IsOfflineCrystalPack(pack) || !Singleton<PlayerData>.Exists)
        {
            return false;
        }
        RagTagCollection tags = item.GetComponent<RagTagCollection>();
        PlayerData player = Singleton<PlayerData>.Instance;
        int cost = CoinCost(pack);

        if (s_armedItem != null && s_armedItem != item)
        {
            ResetPrice(s_armedItem);
        }
        if (player.SoftCurrency < cost)
        {
            s_armedItem = item;
            s_armedAt = 0f;
            SetLabel(tags, "Label_Price", "Need " + cost.ToString("N0") + " coins");
            return true;
        }
        if (s_armedItem != item || Time.realtimeSinceStartup - s_armedAt > ArmSeconds)
        {
            s_armedItem = item;
            s_armedAt = Time.realtimeSinceStartup;
            SetLabel(tags, "Label_Price", "Tap again to buy");
            return true;
        }

        s_armedItem = null;
        player.SoftCurrency -= cost;
        player.HardCurrency += pack.hardCurrency;
        player.Save();
        SetLabel(tags, "Label_Price", "Bought!");
        if (item.onPurchase != null)
        {
            item.onPurchase(pack);
        }
        return true;
    }

    // Runs on every value LocManager.GetLocString returns; id is the (mapped) loc ID.
    public static string EnglishFallback(LocManager loc, string id, string result)
    {
        if (loc.currentLanguageCode == LanguageCode.EN || string.IsNullOrEmpty(id))
        {
            return result;
        }
        if ((string.IsNullOrEmpty(result) || result.IndexOf(": BAD ID = ") >= 0) && loc.IsRegistered(id))
        {
            string english = loc.GetEnglishString(id);
            if (!string.IsNullOrEmpty(english))
            {
                return ConvertEscapeChars.Substitute(english);
            }
        }
        return result;
    }

    private static void ResetPrice(UIStoreIAP item)
    {
        if (item == null)
        {
            return;
        }
        IAPFoodPurchase pack = GetPack(item);
        if (pack != null)
        {
            SetLabel(item.GetComponent<RagTagCollection>(), "Label_Price", PriceText(pack));
        }
    }

    private static IAPFoodPurchase GetPack(UIStoreIAP item)
    {
        System.Reflection.FieldInfo field = typeof(UIStoreIAP).GetField("m_iapData",
            System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic);
        return field == null ? null : field.GetValue(item) as IAPFoodPurchase;
    }

    private static string PriceText(IAPFoodPurchase pack)
    {
        return CoinCost(pack).ToString("N0") + " coins";
    }

    private static string PackTitle(IAPFoodPurchase pack)
    {
        string title = pack.name;
        int dash = title.IndexOf(" - ");
        return dash >= 0 ? title.Substring(dash + 3) : title;
    }

    private static void SetLabel(RagTagCollection tags, string tagID, string text)
    {
        Set(tags, tagID, delegate(RagTag tag)
        {
            UILabel label = tag.GetComponent<UILabel>();
            if (label != null)
            {
                label.text = text;
            }
        });
    }

    private static void Set(RagTagCollection tags, string tagID, Action<RagTag> action)
    {
        if (tags != null)
        {
            tags.RunActionNow(tagID, action, RagTagCollection.RunActionFlags.DontRequireReceiver);
        }
    }
}
