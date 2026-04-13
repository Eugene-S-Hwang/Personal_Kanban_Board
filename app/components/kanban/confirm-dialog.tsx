"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  /** Primary action label (default: Continue). */
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Continue",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#08605f]/60 backdrop-blur-sm"
        aria-label="Cancel"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/20 bg-[#0f3534] p-6 shadow-2xl shadow-black/40"
      >
        <h2 id={titleId} className="text-lg font-semibold text-[#f4f7f2]">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#f4f7f2]/85">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm font-medium text-[#f4f7f2]/80 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-[#a2ad59] px-4 py-2 text-sm font-semibold text-[#0c2524] shadow-md shadow-black/20 hover:brightness-105"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
