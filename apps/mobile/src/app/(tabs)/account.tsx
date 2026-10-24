import { planBilling } from "@retrofit/core";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { forgetInvite } from "@/components/invite-card";
import { LegalLinks } from "@/components/legal-links";
import { PlanCard } from "@/components/plan-card";
import { getApi } from "@/lib/api";
import { appleAuthorizationCode } from "@/lib/apple";
import { clearPending } from "@/lib/render";
import { account, useAccount } from "@/lib/use-account";
import { resetRenders } from "@/lib/use-renders";
import { colors, fonts, headline, radius, space } from "@/theme";

export default function Account() {
  const state = useAccount();
  const [isDeleting, setIsDeleting] = useState(false);
  if (state.status !== "signed-in") return null;

  const signOut = async () => {
    resetRenders();
    forgetInvite();
    await clearPending();
    try {
      await account.signOut();
    } catch {
      Alert.alert("Couldn't sign out", "Please try again.");
    }
  };

  /** Apple accounts confirm with Apple first, so the server can disconnect Sign in with Apple. */
  const appleCode = async (isAppleAccount: boolean): Promise<string | null | undefined> => {
    if (!isAppleAccount) return undefined;
    try {
      const code = await appleAuthorizationCode();
      if (!code) Alert.alert("Confirm with Apple", "To delete your account, confirm with Apple so we can disconnect it too.");
      return code;
    } catch {
      Alert.alert("Couldn't open Apple", "Please try again.");
      return null;
    }
  };

  // Apple requires deleting the account inside the app. Same server flow as the web.
  // The server has the last word on Apple accounts: this phone's copy can be out of date.
  const deleteAccount = async (isAppleAccount = state.hasApple): Promise<void> => {
    setIsDeleting(true);
    const code = await appleCode(isAppleAccount);
    if (code === null) return setIsDeleting(false);
    const result = await getApi<unknown>("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "delete", appleAuthorizationCode: code }),
    });
    setIsDeleting(false);
    if (result.status === "error" && result.code === "apple_confirm" && !isAppleAccount) return deleteAccount(true);
    if (result.status === "error") return Alert.alert("Couldn't delete your account", result.message);
    await signOut();
  };

  // Deleting cancels a website plan (on the server) but can't cancel an Apple one: only its owner can.
  const billing = state.plan?.willRenew ? planBilling(state.plan) : null;
  const confirmDelete = () =>
    Alert.alert(
      "Delete your account?",
      [
        "This deletes your account, your saved pictures, your share links and any pictures you have left this month. It can't be undone.",
        billing === "apple"
          ? "Your plan renews through Apple. Deleting your account doesn't cancel it. Cancel it first under Manage, or Apple keeps charging you."
          : billing === "web"
            ? "This also cancels your plan, so it won't renew."
            : "",
      ]
        .filter(Boolean)
        .join(" "),
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void deleteAccount() },
      ],
    );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Account</Text>
        <View style={styles.who}>
          <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.initial}>{initialOf(state.name ?? state.email)}</Text>
          </View>
          <View style={styles.whoText}>
            {state.name ? (
              <Text style={styles.name} numberOfLines={1}>
                {state.name}
              </Text>
            ) : null}
            <Text style={styles.email} numberOfLines={1}>
              {state.email ?? "Signed in with Apple"}
            </Text>
          </View>
        </View>
        <PlanCard />
        {/* Invites hidden until their reward is decided: free swaps no longer count with plans. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.rowText}>Sign out</Text>
        </Pressable>

        <View style={styles.footer}>
          <LegalLinks />
          {/* Required by Apple, but rare and destructive: quiet, last, and behind a confirmation. */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: isDeleting }}
            disabled={isDeleting}
            hitSlop={8}
            onPress={confirmDelete}
          >
            {isDeleting ? <ActivityIndicator color={colors.muted} /> : <Text style={styles.delete}>Delete account</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** The first letter or digit of a name or email, for the avatar. */
const initialOf = (text: string | null | undefined) => text?.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? "?";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: space.md },
  title: { ...headline(40), marginTop: space.sm, marginBottom: space.xs },
  who: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  initial: { fontFamily: fonts.semibold, fontSize: 22, color: colors.fg },
  whoText: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.semibold, fontSize: 18, color: colors.fg },
  email: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  row: { minHeight: 52, justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  rowPressed: { backgroundColor: colors.surface2 },
  rowText: { fontFamily: fonts.medium, fontSize: 16, color: colors.fg },
  footer: { alignItems: "center", gap: space.xs, marginTop: space.lg },
  delete: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, padding: space.xs },
});
