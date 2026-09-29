import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { InviteCard } from "@/components/invite-card";
import { SwapsLeft } from "@/components/swaps-left";
import { getApi } from "@/lib/api";
import { account, useAccount } from "@/lib/use-account";
import { resetRenders } from "@/lib/use-renders";
import { colors, display, fonts, radius, space } from "@/theme";

export default function Account() {
  const state = useAccount();
  const [isDeleting, setIsDeleting] = useState(false);
  if (state.status !== "signed-in") return null;

  const signOut = async () => {
    resetRenders();
    await account.signOut();
  };

  // Apple requires deleting the account inside the app. Same server flow as the web.
  const deleteAccount = async () => {
    setIsDeleting(true);
    const result = await getApi<unknown>("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "delete" }),
    });
    setIsDeleting(false);
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
