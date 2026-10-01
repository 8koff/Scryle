import type { InviteInfo } from "@retrofit/core";
import { useEffect, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { getApi, type Loaded } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { colors, fonts, radius, space } from "@/theme";
import { Button } from "./button";

/** The invite code never changes for an account; ask once per session. */
let kept: Promise<Exclude<Loaded<InviteInfo>, { status: "loading" }>> | null = null;
const loadInvite = () => {
  kept ??= getApi<InviteInfo>("/api/invites").then((result) => {
    if (result.status === "error") kept = null; // try again next time
    return result;
  });
  return kept;
};
/** On sign-out: the next person has their own code. */
export const forgetInvite = () => {
  kept = null;
};

/** Your invite link. You both get free swaps when the friend buys their first pack. */
export function InviteCard() {
  const [invite, setInvite] = useState<Loaded<InviteInfo>>({ status: "loading" });

  useEffect(() => {
    let isLive = true;
    void loadInvite().then((result) => {
      if (isLive) setInvite(result);
    });
    return () => {
      isLive = false;
    };
  }, []);

  if (invite.status === "error") return null;
  const reward = invite.status === "ready" ? invite.data.reward : null;
  const link = invite.status === "ready" ? `${API_URL}/?invite=${invite.data.code}` : null;

  const share = () => {
    if (!link) return;
    // The share sheet can be closed; nothing to report.
    void Share.share({ message: `Try this: see new stuff on your own photo before you buy it. ${link}` }).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Invite a friend</Text>
      <Text style={styles.body}>
        {reward
          ? `When they buy their first pack, you both get ${reward} free swaps.`
          : "When they buy their first pack, you both get free swaps."}
      </Text>
      <Button label="Share invite link" variant="quiet" onPress={share} disabled={!link} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  title: { fontFamily: fonts.semibold, fontSize: 17, color: colors.fg },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted, marginBottom: space.xs },
});
