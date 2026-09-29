"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { MAX_NAME_LENGTH } from "@/lib/account/account-store";
import { account, useAccount } from "@/lib/account/use-account";
import { Avatar } from "./avatar";
import { BuySheet } from "./buy-sheet";
import { DeleteAccount } from "./delete-account";
import { InvitePanel } from "./invite-panel";

const button = "h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold transition-[transform,opacity] active:scale-[0.97] disabled:opacity-50";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-line py-5 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-6">
      <p className="pt-2 text-[14px] font-medium text-muted">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** The name shown at the top of the app. Saved to the account, so it follows you to other devices. */
function NameForm({ current }: { current: string | null }) {
  const [name, setName] = useState(current ?? "");
  const [phase, setPhase] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const isChanged = name.trim() !== (current ?? "");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setPhase("saving");
    setError(null);
    const problem = await account.updateName(name);
    setPhase(problem ? "idle" : "saved");
    setError(problem);
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label htmlFor="account-name" className="sr-only">
          Name
        </label>
        <input
          id="account-name"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="name"
          placeholder="Your name"
          onChange={(e) => {
            setName(e.target.value);
            setPhase("idle");
          }}
          className="h-10 min-w-0 flex-1 rounded-full border border-line bg-bg px-4 text-[15px] outline-none focus:border-accent"
        />
        <button type="submit" disabled={!isChanged || phase === "saving"} className={`${button} bg-fg text-bg`}>
          {phase === "saving" ? "Saving…" : "Save"}
        </button>
      </div>
      <p aria-live="polite" className={`text-[13px] ${error ? "font-medium text-accent-ink" : "text-muted"}`}>
        {error ?? (phase === "saved" ? "Saved." : "Shown at the top of the app.")}
      </p>
    </form>
  );
}

/** Your details, your renders, and the way out. */
export function AccountPage() {
  const me = useAccount();
  const router = useRouter();
  const [isBuying, setIsBuying] = useState(false);
  if (me.status !== "signed-in") return null;

  const signOut = async () => {
    await account.signOut();
    router.push("/");
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <div className="flex items-center gap-4 pb-6">
        <Avatar name={me.name} email={me.email} avatarUrl={me.avatarUrl} size={56} />
        <div className="min-w-0">
          <h1 className="truncate text-[1.5rem] font-semibold tracking-tight">{me.name ?? "Your account"}</h1>
          <p className="truncate text-[14px] text-muted">{me.email}</p>
        </div>
      </div>

      <Row label="Name">
        <NameForm key={me.name ?? ""} current={me.name} />
      </Row>

      <Row label="Email">
        <p className="pt-2 text-[15px]">{me.email}</p>
        <p className="mt-1 text-[13px] text-muted">This is the address you sign in with. It can&apos;t be changed here.</p>
      </Row>

      <Row label="Pictures">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="pt-1 text-[15px]">
            <span className="text-[1.4rem] font-semibold tabular-nums">{me.credits ?? "…"}</span> left
          </p>
          <button type="button" onClick={() => setIsBuying(true)} className={`${button} bg-accent text-on-accent`}>
            Get more
          </button>
        </div>
        <InvitePanel />
      </Row>

      <Row label="Session">
        <button type="button" onClick={signOut} className={`${button} border border-line hover:border-fg`}>
          Sign out
        </button>
      </Row>

      <Row label="Delete">
        <p className="pt-2 text-[14px] text-muted">Close your account and delete everything in it.</p>
        <DeleteAccount />
      </Row>

      <BuySheet open={isBuying} onClose={() => setIsBuying(false)} returnTo="/app/account" />
    </div>
  );
}
