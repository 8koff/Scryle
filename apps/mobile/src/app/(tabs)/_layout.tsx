import { NativeTabs } from "expo-router/unstable-native-tabs";
import { colors } from "@/theme";

/** The iPhone's own tab bar: Home, My swaps, Account. */
export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.accentInk} iconColor={colors.muted} backgroundColor={colors.bg}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="swaps">
        <NativeTabs.Trigger.Label>My swaps</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "photo.on.rectangle", selected: "photo.fill.on.rectangle.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
