import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useSkin, type SkinTheme } from "@/context/SkinContext";
import {
  VIBECOIN_PACKAGES,
  fetchProducts,
  purchaseVibeCoinPackage,
  type VibeCoinPackage,
} from "@/utils/purchases";

type Tab = "store" | "my-skins" | "ai-lab";

export default function SkinStoreScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const {
    activeSkin,
    ownedIds,
    allSkins,
    aiSkins,
    coinBalance,
    applySkin,
    purchaseSkin,
    addCoins,
    generateSkin,
    isGenerating,
    generationError,
  } = useSkin();

  const [tab, setTab] = useState<Tab>("store");
  const [aiPrompt, setAiPrompt] = useState("");
  const [previewSkin, setPreviewSkin] = useState<SkinTheme | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showCoinModal, setShowCoinModal] = useState(false);
  const [storeProducts, setStoreProducts] = useState<{ productId: string; price: string }[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts().then(setStoreProducts).catch(() => {});
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleApply = async (skin: SkinTheme) => {
    await applySkin(skin.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showSuccess(`${skin.emoji} ${skin.name} applied!`);
    setPreviewSkin(null);
  };

  const handlePurchase = async (skin: SkinTheme) => {
    const result = await purchaseSkin(skin);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess(`✨ ${skin.name} unlocked!`);
    } else {
      Alert.alert("Not Enough VibeCoins", result.message, [{ text: "OK" }]);
    }
  };

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const skin = await generateSkin(aiPrompt.trim());
    if (skin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAiPrompt("");
      setPreviewSkin(skin);
    }
  };

  const handleBuyCoins = async (pkg: VibeCoinPackage) => {
    if (purchasing) return;
    setPurchasing(pkg.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await purchaseVibeCoinPackage(pkg, async (coins) => {
      await addCoins(coins);
    });
    setPurchasing(null);
    if (result.success) {
      setShowCoinModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess(`🪙 +${result.coins} VibeCoins added!`);
    } else if (result.reason !== "cancelled") {
      Alert.alert("Purchase Failed", result.message ?? "Please try again.");
    }
  };

  const getProductPrice = (productId: string) =>
    storeProducts.find((p) => p.productId === productId)?.price ?? null;

  const officialSkins = allSkins.filter((s) => s.creator === "official");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#0A84FF22", "transparent"]}
        style={styles.headerGradient}
      />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Skin Store</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            Customize your vibe
          </Text>
        </View>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); setShowCoinModal(true); }}
          style={[styles.coinBadge, { backgroundColor: colors.surfaceSecondary }]}
        >
          <Text style={styles.coinIcon}>🪙</Text>
          <Text style={[styles.coinCount, { color: colors.text }]}>
            {coinBalance.toLocaleString()}
          </Text>
          <Ionicons name="add-circle" size={16} color={colors.primary} style={{ marginLeft: 2 }} />
        </Pressable>
      </View>

      {successMsg && (
        <Animated.View style={[styles.successBanner, { backgroundColor: "#32D74B" }]}>
          <Text style={styles.successText}>{successMsg}</Text>
        </Animated.View>
      )}

      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(["store", "ai-lab", "my-skins"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tabBtn, tab === t && { borderBottomColor: colors.primary }]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: tab === t ? colors.primary : colors.textSecondary },
              ]}
            >
              {t === "store" ? "🛍️ Store" : t === "ai-lab" ? "🤖 AI Lab" : "🎨 My Skins"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {tab === "store" && (
          <StoreTab
            skins={officialSkins}
            activeSkin={activeSkin}
            ownedIds={ownedIds}
            onPreview={setPreviewSkin}
            colors={colors}
          />
        )}
        {tab === "ai-lab" && (
          <AiLabTab
            aiPrompt={aiPrompt}
            setAiPrompt={setAiPrompt}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            generationError={generationError}
            aiSkins={aiSkins}
            activeSkin={activeSkin}
            onPreview={setPreviewSkin}
            colors={colors}
          />
        )}
        {tab === "my-skins" && (
          <MySkinsTab
            skins={allSkins.filter((s) => ownedIds.has(s.id) || s.price === 0)}
            activeSkin={activeSkin}
            onApply={handleApply}
            colors={colors}
          />
        )}
      </ScrollView>

      {previewSkin && (
        <SkinPreviewModal
          skin={previewSkin}
          isOwned={ownedIds.has(previewSkin.id)}
          isActive={activeSkin.id === previewSkin.id}
          onApply={() => handleApply(previewSkin)}
          onPurchase={() => handlePurchase(previewSkin)}
          onClose={() => setPreviewSkin(null)}
          colors={colors}
        />
      )}

      <Modal
        visible={showCoinModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCoinModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowCoinModal(false)}
        />
        <View style={[styles.coinModalSheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.previewHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.coinModalTitle, { color: colors.text }]}>
            🪙 Buy VibeCoins
          </Text>
          <Text style={[styles.coinModalSub, { color: colors.textSecondary }]}>
            Use VibeCoins to unlock skins & AI Lab
          </Text>
          <Text style={[styles.coinModalBalance, { color: colors.primary }]}>
            Your balance: {coinBalance.toLocaleString()} 🪙
          </Text>
          {VIBECOIN_PACKAGES.map((pkg) => {
            const livePrice = getProductPrice(pkg.id);
            const isBuying = purchasing === pkg.id;
            return (
              <Pressable
                key={pkg.id}
                onPress={() => handleBuyCoins(pkg)}
                disabled={!!purchasing}
                style={[
                  styles.coinPkgRow,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
              >
                <Text style={styles.coinPkgEmoji}>{pkg.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.coinPkgName, { color: colors.text }]}>
                    {pkg.coins.toLocaleString()} VibeCoins
                    {pkg.bonus ? (
                      <Text style={{ color: "#32D74B" }}> +{pkg.bonus} bonus</Text>
                    ) : null}
                  </Text>
                  <Text style={[styles.coinPkgPrice, { color: colors.textSecondary }]}>
                    {livePrice ?? pkg.fallbackPrice}
                  </Text>
                </View>
                {isBuying ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <View style={[styles.buyBtn, { backgroundColor: colors.primary }]}>
                    <Text style={styles.buyBtnText}>Buy</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setShowCoinModal(false)}
            style={[styles.cancelBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function StoreTab({
  skins,
  activeSkin,
  ownedIds,
  onPreview,
  colors,
}: {
  skins: SkinTheme[];
  activeSkin: SkinTheme;
  ownedIds: Set<string>;
  onPreview: (s: SkinTheme) => void;
  colors: typeof Colors.light;
}) {
  const featured = skins.find((s) => s.id === "barry-bonds") ?? skins[0];
  const rest = skins.filter((s) => s.id !== featured?.id);

  if (!featured) {
    return (
      <View style={{ paddingBottom: 40, alignItems: "center", paddingTop: 60 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 15 }}>No skins available</Text>
      </View>
    );
  }

  return (
    <View style={{ paddingBottom: 40 }}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>⭐ Featured</Text>
        <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>Official Skin</Text>
      </View>
      <Pressable onPress={() => onPreview(featured)} style={styles.featuredCard}>
        <LinearGradient
          colors={featured.chatBackground as [string, string]}
          style={styles.featuredGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.featuredContent}>
            <Text style={styles.featuredEmoji}>{featured.emoji}</Text>
            <Text style={styles.featuredName}>{featured.name}</Text>
            <Text style={styles.featuredDesc}>{featured.description}</Text>
            <View style={styles.featuredBubbleRow}>
              <LinearGradient
                colors={featured.sentBubble}
                style={styles.sampleBubbleSent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={[styles.sampleBubbleText, { color: featured.textOnSent }]}>
                  762 HRs 🔥
                </Text>
              </LinearGradient>
              <View style={[styles.sampleBubbleReceived, { backgroundColor: featured.receivedBubble }]}>
                <Text style={[styles.sampleBubbleText, { color: featured.textOnReceived }]}>
                  GOAT ⚾
                </Text>
              </View>
            </View>
            <View style={[styles.freeBadge, { backgroundColor: "#32D74B" }]}>
              <Text style={styles.freeBadgeText}>FREE · AI Generated</Text>
            </View>
          </View>
        </LinearGradient>
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>🎨 All Skins</Text>
      </View>
      <View style={styles.skinGrid}>
        {rest.map((skin) => (
          <SkinCard
            key={skin.id}
            skin={skin}
            isActive={activeSkin.id === skin.id}
            isOwned={ownedIds.has(skin.id)}
            onPress={() => onPreview(skin)}
          />
        ))}
      </View>
    </View>
  );
}

function AiLabTab({
  aiPrompt,
  setAiPrompt,
  onGenerate,
  isGenerating,
  generationError,
  aiSkins,
  activeSkin,
  onPreview,
  colors,
}: {
  aiPrompt: string;
  setAiPrompt: (v: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  generationError: string | null;
  aiSkins: SkinTheme[];
  activeSkin: SkinTheme;
  onPreview: (s: SkinTheme) => void;
  colors: typeof Colors.light;
}) {
  const examples = [
    "Taylor Swift Eras Tour",
    "Golden State Warriors",
    "Cherry Blossom Japan",
    "Cyberpunk Night City",
    "LeBron Lakers Purple",
    "Deep Ocean Bioluminescence",
  ];

  return (
    <View style={{ paddingBottom: 40 }}>
      <LinearGradient
        colors={["#BF5AF222", "#0A84FF11"]}
        style={styles.aiLabHeader}
      >
        <Text style={styles.aiLabIcon}>🤖</Text>
        <Text style={[styles.aiLabTitle, { color: colors.text }]}>AI Skin Generator</Text>
        <Text style={[styles.aiLabDesc, { color: colors.textSecondary }]}>
          Describe any theme, athlete, place, vibe, or idea — the AI creates a custom skin just
          for you. Free to generate, free to keep.
        </Text>
      </LinearGradient>

      <View style={styles.aiInputSection}>
        <View
          style={[
            styles.aiInputBox,
            { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
          ]}
        >
          <TextInput
            style={[styles.aiInput, { color: colors.text }]}
            value={aiPrompt}
            onChangeText={setAiPrompt}
            placeholder="e.g. Barry Bonds baseball skin..."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={200}
            returnKeyType="send"
            onSubmitEditing={onGenerate}
          />
          <Pressable
            onPress={onGenerate}
            disabled={isGenerating || !aiPrompt.trim()}
            style={[
              styles.aiGenerateBtn,
              {
                backgroundColor:
                  isGenerating || !aiPrompt.trim()
                    ? colors.surfaceSecondary
                    : colors.primary,
              },
            ]}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color={isGenerating || !aiPrompt.trim() ? colors.textTertiary : "#FFF"} />
                <Text
                  style={[
                    styles.aiGenerateBtnText,
                    { color: !aiPrompt.trim() ? colors.textTertiary : "#FFF" },
                  ]}
                >
                  Generate
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {isGenerating && (
          <View style={[styles.generatingBanner, { backgroundColor: colors.surfaceSecondary }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.generatingText, { color: colors.textSecondary }]}>
              AI is crafting your skin...
            </Text>
          </View>
        )}

        {generationError && (
          <View style={[styles.errorBanner, { backgroundColor: "#FF3B3022" }]}>
            <Ionicons name="alert-circle" size={16} color="#FF3B30" />
            <Text style={[styles.errorText, { color: "#FF3B30" }]}>
              Generation failed. Check your connection and try again.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>💡 Try These</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}
      >
        {examples.map((ex) => (
          <Pressable
            key={ex}
            onPress={() => setAiPrompt(ex)}
            style={[
              styles.exampleChip,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.exampleChipText, { color: colors.text }]}>{ex}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {aiSkins.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              🎨 Your AI Creations
            </Text>
          </View>
          <View style={styles.skinGrid}>
            {aiSkins.map((skin) => (
              <SkinCard
                key={skin.id}
                skin={skin}
                isActive={activeSkin.id === skin.id}
                isOwned
                onPress={() => onPreview(skin)}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function MySkinsTab({
  skins,
  activeSkin,
  onApply,
  colors,
}: {
  skins: SkinTheme[];
  activeSkin: SkinTheme;
  onApply: (s: SkinTheme) => void;
  colors: typeof Colors.light;
}) {
  return (
    <View style={{ paddingBottom: 40 }}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Collection</Text>
        <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
          {skins.length} skins
        </Text>
      </View>
      <View style={styles.skinGrid}>
        {skins.map((skin) => (
          <Pressable
            key={skin.id}
            onPress={() => onApply(skin)}
            style={[
              styles.mySkinCard,
              activeSkin.id === skin.id && { borderColor: colors.primary, borderWidth: 2.5 },
              { backgroundColor: colors.surface },
            ]}
          >
            <LinearGradient
              colors={skin.chatBackground as [string, string]}
              style={styles.mySkinGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.mySkinEmoji}>{skin.emoji}</Text>
              {activeSkin.id === skin.id && (
                <View style={styles.activeCheck}>
                  <Ionicons name="checkmark-circle" size={18} color="#32D74B" />
                </View>
              )}
            </LinearGradient>
            <View style={styles.mySkinInfo}>
              <Text style={[styles.mySkinName, { color: colors.text }]} numberOfLines={1}>
                {skin.name}
              </Text>
              {activeSkin.id === skin.id ? (
                <Text style={[styles.mySkinStatus, { color: "#32D74B" }]}>Active</Text>
              ) : (
                <Text style={[styles.mySkinStatus, { color: colors.textSecondary }]}>
                  Tap to apply
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SkinCard({
  skin,
  isActive,
  isOwned,
  onPress,
}: {
  skin: SkinTheme;
  isActive: boolean;
  isOwned: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.skinCard, isActive && styles.skinCardActive]}>
      <LinearGradient
        colors={skin.chatBackground as [string, string]}
        style={styles.skinCardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.skinCardEmoji}>{skin.emoji}</Text>
        {skin.isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
        {isActive && (
          <View style={styles.activeBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#32D74B" />
          </View>
        )}
        <View style={styles.skinCardBubbleRow}>
          <LinearGradient
            colors={skin.sentBubble}
            style={styles.miniBubble}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <View style={[styles.miniBubble, { backgroundColor: skin.receivedBubble }]} />
        </View>
      </LinearGradient>
      <View style={styles.skinCardInfo}>
        <Text style={styles.skinCardName} numberOfLines={1}>
          {skin.name}
        </Text>
        <Text style={styles.skinCardPrice}>
          {skin.price === 0 ? "Free" : isOwned ? "Owned" : `🪙 ${Math.ceil(skin.price / 10)}`}
        </Text>
      </View>
    </Pressable>
  );
}

function SkinPreviewModal({
  skin,
  isOwned,
  isActive,
  onApply,
  onPurchase,
  onClose,
  colors,
}: {
  skin: SkinTheme;
  isOwned: boolean;
  isActive: boolean;
  onApply: () => void;
  onPurchase: () => void;
  onClose: () => void;
  colors: typeof Colors.light;
}) {
  const sampleMessages = [
    { text: "This skin goes hard 🔥", mine: true },
    { text: "Facts! Love the vibes ✨", mine: false },
    { text: skin.name, mine: true },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.previewSheet, { backgroundColor: colors.surface }]}>
        <View style={[styles.previewHandle, { backgroundColor: colors.border }]} />
        <Text style={[styles.previewTitle, { color: colors.text }]}>
          {skin.emoji} {skin.name}
        </Text>
        <Text style={[styles.previewDesc, { color: colors.textSecondary }]}>
          {skin.description}
        </Text>
        <View style={styles.previewTags}>
          {skin.tags.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.tagText, { color: colors.textSecondary }]}>#{tag}</Text>
            </View>
          ))}
        </View>

        <LinearGradient
          colors={skin.chatBackground as [string, string]}
          style={styles.chatPreview}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          {sampleMessages.map((msg, i) => (
            <View
              key={i}
              style={[styles.previewMsgRow, msg.mine ? styles.previewMsgMine : styles.previewMsgTheirs]}
            >
              {msg.mine ? (
                <LinearGradient
                  colors={skin.sentBubble}
                  style={styles.previewBubble}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={[styles.previewBubbleText, { color: skin.textOnSent }]}>
                    {msg.text}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={[styles.previewBubble, { backgroundColor: skin.receivedBubble }]}>
                  <Text style={[styles.previewBubbleText, { color: skin.textOnReceived }]}>
                    {msg.text}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </LinearGradient>

        <View style={styles.previewActions}>
          {isActive ? (
            <View style={[styles.activeBtn, { backgroundColor: "#32D74B22" }]}>
              <Ionicons name="checkmark-circle" size={18} color="#32D74B" />
              <Text style={[styles.activeBtnText, { color: "#32D74B" }]}>Currently Active</Text>
            </View>
          ) : isOwned ? (
            <Pressable
              onPress={onApply}
              style={[styles.applyBtn, { backgroundColor: skin.accentColor }]}
            >
              <Text style={styles.applyBtnText}>Apply Skin</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={onPurchase}
              style={[styles.applyBtn, { backgroundColor: skin.accentColor }]}
            >
              <Text style={styles.applyBtnText}>
                🪙 {Math.ceil(skin.price / 10)} VibeCoins — Unlock
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 200 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  coinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  coinIcon: { fontSize: 16 },
  coinCount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  successBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  successText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  featuredCard: { marginHorizontal: 16, borderRadius: 24, overflow: "hidden" },
  featuredGradient: { padding: 24 },
  featuredContent: { gap: 8 },
  featuredEmoji: { fontSize: 40 },
  featuredName: {
    color: "#FFF",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  featuredDesc: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  featuredBubbleRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  sampleBubbleSent: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  sampleBubbleReceived: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },
  sampleBubbleText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  freeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 4,
  },
  freeBadgeText: { color: "#FFF", fontSize: 12, fontFamily: "Inter_700Bold" },
  skinGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 12,
  },
  skinCard: {
    width: "45%",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#222",
    flex: 0,
    flexBasis: "45%",
  },
  skinCardActive: {
    borderWidth: 2.5,
    borderColor: "#0A84FF",
  },
  skinCardGradient: {
    height: 110,
    padding: 10,
    justifyContent: "space-between",
  },
  skinCardEmoji: { fontSize: 28 },
  newBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#FF9F0A",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  newBadgeText: { color: "#FFF", fontSize: 9, fontFamily: "Inter_700Bold" },
  activeBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 10,
  },
  skinCardBubbleRow: { flexDirection: "row", gap: 4 },
  miniBubble: { height: 16, width: 36, borderRadius: 8 },
  skinCardInfo: {
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    gap: 2,
  },
  skinCardName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  skinCardPrice: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)" },
  aiLabHeader: {
    margin: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  aiLabIcon: { fontSize: 48 },
  aiLabTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  aiLabDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  aiInputSection: { paddingHorizontal: 16, gap: 10 },
  aiInputBox: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    gap: 8,
  },
  aiInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 80,
    minHeight: 36,
    paddingTop: 6,
  },
  aiGenerateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  aiGenerateBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  generatingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  generatingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  exampleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  exampleChipText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  mySkinCard: {
    width: "45%",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "transparent",
    flex: 0,
    flexBasis: "45%",
  },
  mySkinGradient: { height: 90, justifyContent: "center", alignItems: "center" },
  mySkinEmoji: { fontSize: 32 },
  activeCheck: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 10 },
  mySkinInfo: { padding: 10, gap: 2 },
  mySkinName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  mySkinStatus: { fontSize: 11, fontFamily: "Inter_400Regular" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  previewSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    padding: 24,
    maxHeight: "85%",
  },
  previewHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  previewTitle: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 6 },
  previewDesc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 12 },
  previewTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  chatPreview: {
    borderRadius: 20,
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  previewMsgRow: { flexDirection: "row" },
  previewMsgMine: { justifyContent: "flex-end" },
  previewMsgTheirs: { justifyContent: "flex-start" },
  previewBubble: {
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  previewBubbleText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  previewActions: { gap: 10 },
  activeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 16,
  },
  activeBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  applyBtn: {
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
  },
  applyBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  coinModalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  coinModalTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  coinModalSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 4 },
  coinModalBalance: { fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center", marginBottom: 4 },
  coinPkgRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  coinPkgEmoji: { fontSize: 28 },
  coinPkgName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  coinPkgPrice: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  buyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  buyBtnText: { color: "#FFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cancelBtn: {
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  cancelBtnText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
