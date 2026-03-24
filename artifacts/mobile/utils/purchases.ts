import Constants from "expo-constants";
import { Platform } from "react-native";

export type ZivCoinPackage = {
  id: string;
  productId: string;
  coins: number;
  label: string;
  emoji: string;
  fallbackPrice: string;
  bonus?: number;
};

export const VIBECOIN_PACKAGES: ZivCoinPackage[] = [
  {
    id: "coins_100",
    productId: "com.zivr.app.coins.100",
    coins: 100,
    label: "100 ZivCoins",
    emoji: "🪙",
    fallbackPrice: "$0.99",
  },
  {
    id: "coins_500",
    productId: "com.zivr.app.coins.500",
    coins: 500,
    label: "500 ZivCoins",
    emoji: "💰",
    fallbackPrice: "$3.99",
    bonus: 50,
  },
  {
    id: "coins_1000",
    productId: "com.zivr.app.coins.1000",
    coins: 1000,
    label: "1000 ZivCoins",
    emoji: "💎",
    fallbackPrice: "$6.99",
    bonus: 200,
  },
  {
    id: "coins_2500",
    productId: "com.zivr.app.coins.2500",
    coins: 2500,
    label: "2500 ZivCoins",
    emoji: "🏆",
    fallbackPrice: "$14.99",
    bonus: 750,
  },
];

export type PurchaseResult =
  | { success: true; coins: number; packageId: string }
  | { success: false; reason: "cancelled" | "error"; message?: string };

type IAPModule = typeof import("expo-in-app-purchases");

let _iap: IAPModule | null = null;
let connected = false;

function isIAPSupported(): boolean {
  if (Platform.OS === "web") return false;
  const ownership = Constants.appOwnership;
  if (ownership === "expo") return false;
  return true;
}

async function getIAP(): Promise<IAPModule | null> {
  if (!isIAPSupported()) return null;
  if (_iap) return _iap;
  try {
    _iap = await import("expo-in-app-purchases");
    return _iap;
  } catch {
    return null;
  }
}

export async function connectIAP(): Promise<boolean> {
  const IAP = await getIAP();
  if (!IAP) return false;
  if (connected) return true;
  try {
    await IAP.connectAsync();
    connected = true;
    return true;
  } catch {
    return false;
  }
}

export async function disconnectIAP(): Promise<void> {
  const IAP = await getIAP();
  if (!IAP || !connected) return;
  try {
    await IAP.disconnectAsync();
  } catch {}
  connected = false;
}

export async function fetchProducts(): Promise<{ productId: string; price: string }[]> {
  const IAP = await getIAP();
  if (!IAP) return [];
  try {
    const ok = await connectIAP();
    if (!ok) return [];
    const productIds = VIBECOIN_PACKAGES.map((p) => p.productId);
    const { results } = await IAP.getProductsAsync(productIds);
    return (results ?? []).map((r) => ({ productId: r.productId, price: r.price }));
  } catch {
    return [];
  }
}

export async function purchaseZivCoinPackage(
  pkg: ZivCoinPackage,
  onCoinsAwarded: (coins: number) => void
): Promise<PurchaseResult> {
  const IAP = await getIAP();
  if (!IAP) {
    return {
      success: false,
      reason: "error",
      message: "In-app purchases require the full app build (not Expo Go)",
    };
  }

  try {
    const ok = await connectIAP();
    if (!ok) return { success: false, reason: "error", message: "Could not connect to store" };

    return new Promise<PurchaseResult>((resolve) => {
      IAP.setPurchaseListener(async ({ responseCode, results, errorCode }) => {
        if (responseCode === IAP.IAPResponseCode.OK && results?.length) {
          for (const purchase of results) {
            if (!purchase.acknowledged) {
              await IAP.finishTransactionAsync(purchase, false);
            }
            if (purchase.productId === pkg.productId) {
              onCoinsAwarded(pkg.coins);
              resolve({ success: true, coins: pkg.coins, packageId: pkg.id });
              return;
            }
          }
        } else if (responseCode === IAP.IAPResponseCode.USER_CANCELED) {
          resolve({ success: false, reason: "cancelled" });
        } else {
          resolve({
            success: false,
            reason: "error",
            message: `Store error code: ${errorCode ?? responseCode}`,
          });
        }
      });

      IAP.purchaseItemAsync(pkg.productId).catch((err: unknown) => {
        resolve({
          success: false,
          reason: "error",
          message: err instanceof Error ? err.message : "Purchase failed",
        });
      });
    });
  } catch (err: unknown) {
    return {
      success: false,
      reason: "error",
      message: err instanceof Error ? err.message : "Unexpected error",
    };
  }
}
