"use client";
import { useEffect, useRef } from "react";

export function ConfirmationDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
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
      aria-label="Conferma rimozione set"
      onCancel={onCancel}
      onClose={onCancel}
    >
      <h2>Rimuovere il set?</h2>
      <p>{message}</p>
      <div className="two-buttons">
        <button
          autoFocus
          type="button"
          className="button subtle"
          onClick={onCancel}
        >
          Annulla
        </button>
        <button type="button" className="button danger" onClick={onConfirm}>
          Rimuovi set
        </button>
      </div>
    </dialog>
  );
}
