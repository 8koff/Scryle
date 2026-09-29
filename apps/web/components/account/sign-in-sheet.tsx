"use client";

import { useState } from "react";
import { useAccount } from "@/lib/account/use-account";
import { Sheet } from "@/components/ui/sheet";
import { AuthScreen } from "./auth-screen";

interface SignInSheetProps {
  open: boolean;
  onClose: () => void;
  /** Called once this tab is signed in with the emailed code (Google leaves the page instead). */
  onSignedIn: () => void;
  /** Where Google sends the person back to. Defaults to this page. */
  returnTo?: string;
}

/** The sign-up screen in a pop-up, for actions on the landing page that need an account (like Buy). */
export function SignInSheet({ open, onClose, onSignedIn, returnTo }: SignInSheetProps) {
  const me = useAccount();
  const [handled, setHandled] = useState(false);
  if (open && me.status === "signed-in" && !handled) {
    setHandled(true);
    onSignedIn();
  }
  if (!open && handled) setHandled(false);

  return (
    <Sheet open={open} onClose={onClose} label="Sign in">
      {open && <AuthScreen initialMode="signup" variant="sheet" returnTo={returnTo ?? window.location.pathname} />}
    </Sheet>
  );
}
