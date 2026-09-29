"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { account, useAccount } from "@/lib/account/use-account";
import { Avatar } from "./avatar";

const item = "flex h-10 w-full items-center rounded-lg px-3 text-left text-[14px] font-medium transition-colors hover:bg-surface-2";

/** The avatar at the top of the app. Opens a small menu: who you are, your account, sign out. */
export function AccountMenu() {
  const me = useAccount();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [isOpen]);

  if (me.status !== "signed-in") return <span className="size-9" />;

  const signOut = async () => {
    setIsOpen(false);
    await account.signOut();
    router.push("/");
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label="Your account"
        className="flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-bg transition-shadow hover:ring-2 hover:ring-line"
      >
        <Avatar name={me.name} email={me.email} avatarUrl={me.avatarUrl} size={32} />
      </button>
      {isOpen && (
        <div
          id={menuId}
          className="absolute right-0 top-11 z-40 w-64 origin-top-right rounded-2xl border border-line bg-surface p-1.5 shadow-[0_16px_40px_rgb(0_0_0/0.45)] motion-safe:animate-[menu-in_140ms_var(--ease-out)]"
        >
          <div className="flex items-center gap-3 px-3 pb-3 pt-2.5">
            <Avatar name={me.name} email={me.email} avatarUrl={me.avatarUrl} size={36} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold">{me.name ?? "Your account"}</p>
              <p className="truncate text-[13px] text-muted">{me.email}</p>
            </div>
          </div>
          <div className="border-t border-line pt-1.5">
            <Link href="/app/account" onClick={() => setIsOpen(false)} className={item}>
              Account
            </Link>
            <Link href="/app/renders" onClick={() => setIsOpen(false)} className={item}>
              My pictures
            </Link>
            <button type="button" onClick={signOut} className={`${item} text-muted hover:text-fg`}>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
