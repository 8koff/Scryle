/**
 * Public settings, baked into the app at build time. Only EXPO_PUBLIC_* values reach the app,
 * and they are public by design (the site address and Supabase's publishable key).
 */
const trimmed = (value: string | undefined) => value?.trim().replace(/\/+$/, "") || undefined;

/** The live site. Every API call goes here. */
export const API_URL = trimmed(process.env.EXPO_PUBLIC_API_URL) ?? "https://scryle.app";

/** Accepts the API form people often copy ("…supabase.co/rest/v1/") too, like the web app. */
export const SUPABASE_URL = trimmed(process.env.EXPO_PUBLIC_SUPABASE_URL)?.replace(/\/rest\/v1$/, "");

export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || undefined;

/** RevenueCat's public iOS SDK key (starts with appl_). Public by design; without it the plans show as a preview. */
export const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim() || undefined;
