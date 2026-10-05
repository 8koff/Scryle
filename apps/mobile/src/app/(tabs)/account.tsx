import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { forgetInvite, InviteCard } from "@/components/invite-card";
import { LegalLinks } from "@/components/legal-links";
import { SwapsLeft } from "@/components/swaps-left";
import { getApi } from "@/lib/api";
import { appleAuthorizationCode } from "@/lib/apple";
import { clearPending } from "@/lib/render";
import { account, useAccount } from "@/lib/use-account";
import { resetRenders } from "@/lib/use-renders";
import { colors, display, fonts, radius, space } from "@/theme";

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

  const confirmDelete = () =>
    Alert.alert(
      "Delete your account?",
      "This deletes your account, your saved swaps, your share links and any swaps you have left. It can't be undone.",
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
          {state.name ? <Text style={styles.name}>{state.name}</Text> : null}
          <Text style={styles.email}>{state.email ?? "Signed in with Apple"}</Text>
        </View>
        <SwapsLeft />
        <InviteCard />
        <Button label="Sign out" variant="quiet" onPress={() => void signOut()} />
        <Button label="Delete account" variant="quiet" isBusy={isDeleting} onPress={confirmDelete} style={styles.delete} />
        <LegalLinks />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.md, gap: space.md },
  title: { ...display, fontSize: 32, lineHeight: 35 },
  who: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.xs },
  name: { fontFamily: fonts.semibold, fontSize: 18, color: colors.fg },
  email: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  delete: { borderColor: "transparent", marginTop: space.lg },
});
