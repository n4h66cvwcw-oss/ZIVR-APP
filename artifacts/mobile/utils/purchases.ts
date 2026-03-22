import * as InAppPurchases from "expo-in-app-purchases";
import { Platform } from "react-native";

export type VibeCoinPackage = {
  id: string;
  productId: string;
  coins: number;
  label: string;
  emoji: string;
  fallbackPrice: string;
  bonus?: number;
};

export const VIBECOIN_PACKAGES: VibeCoinPackage[] = [
  {
    id: "coins_100",
    productId: "com.vibemsg.app.coins.100",
    coins: 100,
    label: "100 VibeCoins",
    emoji: "🪙",
    fallbackPrice: "$0.99",
  },
  {
    id: "coins_500",
    productId: "com.vibemsg.app.coins.500",
    coins: 500,
    label: "500 VibeCoins",
    emoji: "💰",
    fallbackPrice: "$3.99",
    bonus: 50,
  },
  {
    id: "coins_1000",
    productId: "com.vibemsg.app.coins.1000",
    coins: 1000,
    label: "1000 VibeCoins",
    emoji: "💎",
    fallbackPrice: "$6.99",
    bonus: 200,
  },
  {
    id: "coins_2500",
    productId: "com.vibemsg.app.coins.2500",
    coins: 2500,
    label: "2500 VibeCoins",
    emoji: "🏆",
    fallbackPrice: "$14.99",
    bonus: 750,
  },
];

export type PurchaseResult =
  | { success: true; coins: number; packageId: string }
  | { success: false; reason: "cancelled" | "error"; message?: string };

let connected = false;

export async function connectIAP(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (connected) return true;
  try {
    await InAppPurchases.connectAsync();
    connected = true;
    return true;
  } catch {
    return false;
  }
}

export async function disconnectIAP(): Promise<void> {
  if (!connected) return;
  try {
    await InAppPurchases.disconnectAsync();
  } catch {}
  connected = false;
}

export async function fetchProducts(): Promise<InAppPurchases.IAPItemDetails[]> {
  if (Platform.OS === "web") return [];
  try {
    const ok = await connectIAP();
    if (!ok) return [];
    const productIds = VIBECOIN_PACKAGES.map((p) => p.productId);
    const { results } = await InAppPurchases.getProductsAsync(productIds);
    return results ?? [];
  } catch {
    return [];
  }
}

export async function purchaseVibeCoinPackage(
  pkg: VibeCoinPackage,
  onCoinsAwarded: (coins: number) => void
): Promise<PurchaseResult> {
  if (Platform.OS === "web") {
    return { success: false, reason: "error", message: "IAP not supported on web" };
  }

  try {
    const ok = await connectIAP();
    if (!ok) return { success: false, reason: "error", message: "Could not connect to store" };

    return new Promise<PurchaseResult>((resolve) => {
      InAppPurchases.setPurchaseListener(async ({ responseCode, results, errorCode }) => {
        if (responseCode === InAppPurchases.IAPResponseCode.OK && results?.length) {
          for (const purchase of results) {
            if (!purchase.acknowledged) {
              await InAppPurchases.finishTransactionAsync(purchase, false);
            }
            if (purchase.productId === pkg.productId) {
              onCoinsAwarded(pkg.coins);
              resolve({ success: true, coins: pkg.coins, packageId: pkg.id });
              return;
            }
          }
        } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
          resolve({ success: false, reason: "cancelled" });
        } else {
          resolve({
            success: false,
            reason: "error",
            message: `Store error code: ${errorCode ?? responseCode}`,
          });
        }
      });

      InAppPurchases.purchaseItemAsync(pkg.productId).catch((err: unknown) => {
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
