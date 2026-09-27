"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Read out by screen readers when the sheet opens. */
  label: string;
  children: ReactNode;
}

/**
 * A bottom sheet on phones, a centred card on bigger screens. Built on <dialog>, so focus,
 * Escape and the backdrop work the native way.
 */
export function Sheet({ open, onClose, label, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="mx-auto mb-0 mt-auto w-full max-w-none rounded-t-[28px] bg-surface p-0 text-fg shadow-[0_-8px_40px_rgb(0_0_0/0.12)] backdrop:bg-fg/35 motion-safe:transition-[translate,opacity] motion-safe:duration-300 motion-safe:ease-(--ease-out) motion-safe:starting:translate-y-6 motion-safe:starting:opacity-0 sm:mb-auto sm:max-w-md sm:rounded-[28px]"
    >
      <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 sm:pt-6">
        <div aria-hidden className="mx-auto mb-5 h-1 w-10 rounded-full bg-line sm:hidden" />
        {children}
      </div>
    </dialog>
  );
}
