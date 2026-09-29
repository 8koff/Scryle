import type { Metadata } from "next";
import { BRAND } from "@retrofit/core";
import { AuthPage } from "@/components/account/auth-page";

export const metadata: Metadata = { title: `Log in · ${BRAND.name}` };

export default function LogIn() {
  return <AuthPage mode="login" />;
}
