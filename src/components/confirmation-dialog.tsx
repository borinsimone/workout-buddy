"use client";
import { useEffect, useRef } from "react";

export function ConfirmationDialog({
  message,
  title = "Rimuovere il set?",
  confirmLabel = "Rimuovi set",
  cancelLabel = "Annulla",
  onConfirm,
  onCancel,
}: {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="session-exercise-dialog"
      aria-label={title}
      onCancel={onCancel}
      onClose={onCancel}
    >
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="two-buttons">
        <button
          autoFocus
          type="button"
          className="button subtle"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button type="button" className="button danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
