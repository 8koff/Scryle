import * as AppleAuthentication from "expo-apple-authentication";
import { useState } from "react";
import { KeyboardAvoidingView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { MAX_CODE_LENGTH } from "@/lib/account";
import { account, useAccount } from "@/lib/use-account";
import { colors, display, fonts, radius, space } from "@/theme";

/** Sign in with Apple, or with a code sent by email. New emails get a new account. */
export default function SignIn() {
  const state = useAccount();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const run = async (action: () => Promise<string | null>, onDone?: () => void) => {
    setIsBusy(true);
    setError(null);
    try {
      const message = await action();
      if (message) setError(message);
      else onDone?.();
    } catch {
      // A Keychain error, not a sign-in answer: the person can just try again.
      setError("Something went wrong. Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  if (state.status === "unavailable") {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.title}>Sign-in isn&apos;t ready</Text>
        <Text style={styles.body}>This build has no sign-in keys. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <View style={styles.fill}>
          <Text style={styles.title}>Scryle</Text>
          <Text style={styles.body}>See real products on your car, your room, or you, before you buy.</Text>
        </View>

        {step === "email" ? (
          <View style={styles.form}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={radius.md}
              style={[styles.apple, isBusy && styles.off]}
              onPress={() => {
                if (!isBusy) void run(() => account.signInWithApple());
              }}
            />
            <Text style={styles.or}>or use your email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              style={styles.input}
              accessibilityLabel="Email"
            />
            <Button label="Email me a code" isBusy={isBusy} onPress={() => void run(() => account.sendCode(email), () => setStep("code"))} />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.body}>We sent a code to {email.trim()}. Type it here.</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Code"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={MAX_CODE_LENGTH}
              style={styles.input}
              accessibilityLabel="Code from the email"
            />
            <Button label="Sign in" isBusy={isBusy} onPress={() => void run(() => account.verifyCode(email, code))} />
            <Button
              label="Use another email"
              variant="quiet"
              onPress={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
            />
          </View>
        )}
        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg },
  fill: { flex: 1 },
  title: { ...display, fontSize: 44, marginTop: space.xl },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted, marginTop: space.sm },
  form: { gap: space.md, paddingBottom: space.md },
  apple: { height: 52 },
  off: { opacity: 0.5 },
  or: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, textAlign: "center" },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.fg,
  },
  error: { fontFamily: fonts.medium, fontSize: 15, color: colors.fg, textAlign: "center", paddingBottom: space.sm },
});
