import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import { connection } from "next/server";
import { BRAND } from "@retrofit/core";
import { CheckoutReturn } from "@/components/account/checkout-return";
import { InviteCapture } from "@/components/account/invite-capture";
import { SignInReturn } from "@/components/account/sign-in-return";
import "./globals.css";

/** Variable width axis: normal width for text, semi-condensed for headlines (see .display). */
const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  axes: ["wdth"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
  // Makes link-preview image addresses absolute once the site has its real address.
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  openGraph: { siteName: BRAND.name, type: "website" },
};

export const viewport: Viewport = {
  themeColor: BRAND.backgroundColor,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render each page per request, so Next.js can put this request's CSP nonce on its scripts (proxy.ts).
  await connection();
  return (
    <html lang="en" className={`${instrument.variable} h-full`}>
      {/* Browser extensions (e.g. Grammarly) add attributes to <body> before React loads. This only
          silences attribute differences on <body> itself, not on anything inside it. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <SignInReturn />
        <CheckoutReturn />
        <InviteCapture />
      </body>
    </html>
  );
}
