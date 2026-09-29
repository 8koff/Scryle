"use client";

import { useState } from "react";

interface AvatarProps {
  name: string | null;
  email: string | undefined;
  avatarUrl: string | null;
  size: number;
}

/** The Google photo, or the first letter of the name (or email) on a denim disc. */
export function Avatar({ name, email, avatarUrl, size }: AvatarProps) {
  const [isBroken, setIsBroken] = useState(false);
  const letter = (name ?? email ?? "?").trim().charAt(0).toUpperCase() || "?";
  const box = { width: size, height: size };

  if (avatarUrl && !isBroken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Google account photo, any size
      <img
        src={avatarUrl}
        alt=""
        style={box}
        referrerPolicy="no-referrer"
        onError={() => setIsBroken(true)}
        className="shrink-0 rounded-full bg-surface-2 object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ ...box, fontSize: Math.round(size * 0.44) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold leading-none text-on-accent"
    >
      {letter}
    </span>
  );
}
