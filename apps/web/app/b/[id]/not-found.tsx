import Link from "next/link";

/** A deleted or mistyped share link. */
export default function ShareNotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="display text-[2.4rem] font-semibold">This link isn&apos;t here</h1>
      <p className="text-muted">The person who made it may have deleted it. You can still try it with your own photo.</p>
      <Link href="/" className="mt-2 inline-flex h-12 items-center rounded-full bg-accent px-7 font-semibold text-on-accent">
        Start with my photo
      </Link>
    </main>
  );
}
