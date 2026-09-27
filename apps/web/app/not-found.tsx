import Link from "next/link";

/** Any address that doesn't exist. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="display text-[2.4rem] font-semibold">Nothing here</h1>
      <p className="text-muted">This page doesn&apos;t exist. It may have moved, or the link has a typo.</p>
      <Link href="/" className="mt-2 inline-flex h-12 items-center rounded-full bg-accent px-7 font-semibold text-on-accent">
        Go to the home page
      </Link>
    </main>
  );
}
