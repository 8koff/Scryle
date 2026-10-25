import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/button";
import { colors, fonts, space } from "@/theme";

/** A link to a page this app doesn't have (for example from an old version). */
export default function NotFound() {
  return (
    <View style={styles.screen}>
      <Text style={styles.body}>This page doesn&apos;t exist in the app.</Text>
      <Button label="Go home" onPress={() => router.replace("/")} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.md, justifyContent: "center" },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted },
});
