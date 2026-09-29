import type { Metadata } from "next";
import { BRAND } from "@retrofit/core";
import { AuthPage } from "@/components/account/auth-page";

export const metadata: Metadata = { title: `Create your account · ${BRAND.name}` };

export default function SignUp() {
  return <AuthPage mode="signup" />;
}
