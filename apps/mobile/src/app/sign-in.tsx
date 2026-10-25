import * as AppleAuthentication from "expo-apple-authentication";
import { useState } from "react";
import { KeyboardAvoidingView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { SeamMark } from "@/components/seam-mark";
import { MAX_CODE_LENGTH } from "@/lib/account";
import { account, useAccount } from "@/lib/use-account";
import { colors, display, fonts, headline, radius, space } from "@/theme";

/**
 * Sign in with Apple, or with a code sent by email. New emails get a new account.
 * "Use a password" is for the App Review demo account: Apple's reviewers can't get email codes.
 */
export default function SignIn() {
  const state = useAccount();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "code" | "password">("email");
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

  const goTo = (next: typeof step) => {
    setStep(next);
    setCode("");
    setPassword("");
    setError(null);
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
          <View style={styles.brand} accessibilityRole="header" accessibilityLabel="Scryle">
            <SeamMark size={28} />
            <Text style={styles.wordmark}>Scryle</Text>
          </View>
          <Text style={styles.headline}>See it before you buy it.</Text>
          <Text style={styles.tagline}>{"Tap a part.\nSee the swap on your own photo."}</Text>
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
            <Button label="Use a password" variant="quiet" onPress={() => goTo("password")} />
          </View>
        ) : step === "password" ? (
          <View style={styles.form}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              style={styles.input}
              accessibilityLabel="Email"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              style={styles.input}
              accessibilityLabel="Password"
            />
            <Button label="Sign in" isBusy={isBusy} onPress={() => void run(() => account.signInWithPassword(email, password))} />
            <Button label="Use an email code instead" variant="quiet" onPress={() => goTo("email")} />
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
            <Button label="Use another email" variant="quiet" onPress={() => goTo("email")} />
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
  brand: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: space.md },
  wordmark: { ...display, fontSize: 24, letterSpacing: -0.5 },
  headline: { ...headline(52), marginTop: 56 },
  tagline: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 25, color: colors.muted, marginTop: space.md },
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
