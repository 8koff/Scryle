import * as WebBrowser from "expo-web-browser";
import { StyleSheet, Text, View } from "react-native";
import { API_URL } from "@/lib/config";
import { colors, fonts, space } from "@/theme";

/** Terms and Privacy, opened from the website (Apple wants both reachable in the app). */
export function LegalLinks() {
  const open = (path: string) => void WebBrowser.openBrowserAsync(`${API_URL}${path}`);
  return (
    <View style={styles.row}>
      <Text accessibilityRole="link" style={styles.link} onPress={() => open("/terms")}>
        Terms
      </Text>
      <Text accessibilityRole="link" style={styles.link} onPress={() => open("/privacy")}>
        Privacy
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.lg, justifyContent: "center", paddingVertical: space.sm },
  link: { fontFamily: fonts.medium, fontSize: 14, color: colors.accentInk, padding: space.xs },
});
