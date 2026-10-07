"use client";
import { useEffect, useRef, useState } from "react";
import { clock } from "@/lib/workout";
export function RestTimer({
  seconds,
  finished,
  paused,
  onExtend,
  onPause,
  onClose,
}: {
  seconds: number;
  finished: boolean;
  paused: boolean;
  onExtend: () => void;
  onPause: () => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const widget = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const clamp = (x: number, y: number) => ({
    x: Math.max(8, Math.min(x, window.innerWidth - 228)),
    y: Math.max(
      12,
      Math.min(y, window.innerHeight - (window.innerWidth <= 640 ? 280 : 210))
    ),
  });
  useEffect(() => {
    const resize = () => setPosition((p) => (p ? clamp(p.x, p.y) : null));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (expanded) dialog.current?.showModal();
    else dialog.current?.close();
  }, [expanded]);
  const label = finished
    ? "Recupero terminato"
    : paused
    ? "Recupero in pausa"
    : "Recupero";
  return (
    <>
      <div
        ref={widget}
        className={`floating-rest ${finished ? "finished" : ""}`}
        style={
          position
            ? {
                left: position.x,
                top: position.y,
                right: "auto",
                bottom: "auto",
              }
            : undefined
        }
      >
        <button
          className="rest-drag"
          aria-label="Sposta timer recupero"
          title="Trascina per spostare, o usa le frecce"
          onPointerDown={(e) => {
            const rect = widget.current!.getBoundingClientRect();
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              left: rect.left,
              top: rect.top,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current)
              setPosition(
                clamp(
                  drag.current.left + e.clientX - drag.current.x,
                  drag.current.top + e.clientY - drag.current.y
                )
              );
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={(e) => {
            const offset: { [key: string]: [number, number] } = {
              ArrowLeft: [-20, 0],
              ArrowRight: [20, 0],
              ArrowUp: [0, -20],
              ArrowDown: [0, 20],
            };
            if (offset[e.key]) {
              e.preventDefault();
              const rect = widget.current!.getBoundingClientRect();
              const [x, y] = offset[e.key];
              setPosition(clamp(rect.left + x, rect.top + y));
            }
          }}
        >
          ⠿
        </button>
        <button
          className="rest-open"
          aria-label="Apri recupero a schermo intero"
          onClick={() => setExpanded(true)}
        >
          <span>{label}</span>
          <strong>{finished ? "Pronto!" : clock(seconds)}</strong>
          <small>Tocca per ingrandire</small>
        </button>
        <button
          className="rest-dismiss"
          aria-label="Chiudi recupero"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <dialog
        ref={dialog}
        className="rest-fullscreen"
        onCancel={() => setExpanded(false)}
        onClose={() => setExpanded(false)}
        aria-labelledby="rest-heading"
      >
        <button className="button subtle" onClick={() => setExpanded(false)}>
          Riduci timer
        </button>
        <div className="rest-fullscreen-center">
          <p className="eyebrow" id="rest-heading">
            {label}
          </p>
          <strong>{finished ? "Pronto!" : clock(seconds)}</strong>
          <p>
            {finished
              ? "Puoi iniziare il prossimo set."
              : "Respira. Il prossimo set ti aspetta."}
          </p>
          <div className="timer-controls">
            {!finished && (
              <button className="button subtle" onClick={onPause}>
                {paused ? "Riprendi" : "Pausa"}
              </button>
            )}
            <button className="button primary" onClick={onExtend}>
              +30 secondi
            </button>
          </div>
          <button
            className="text-button"
            onClick={() => {
              setExpanded(false);
              onClose();
            }}
          >
            Chiudi recupero
          </button>
        </div>
      </dialog>
    </>
  );
}

