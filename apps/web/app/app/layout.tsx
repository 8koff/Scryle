import type { Metadata } from "next";
import { BRAND } from "@retrofit/core";
import { RequireAccount } from "@/components/account/require-account";
import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = { title: { default: `App · ${BRAND.name}`, template: `%s · ${BRAND.name}` }, robots: { index: false } };

/** Everything under /app is the product itself: signed-in only, in the app's own frame. */
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <AppShell>
      <RequireAccount>{children}</RequireAccount>
    </AppShell>
  );
}
