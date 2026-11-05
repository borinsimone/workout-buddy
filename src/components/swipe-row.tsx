"use client";

// Swipe-to-reveal pattern: https://reactbits.dev/micro/swipe-row
// Local implementation for variable-height rows, nested inputs and existing confirmations.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icon";
import { swipeAxis, swipeDestination } from "@/lib/swipe";

type Props = {
  children: ReactNode;
  label: string;
  onEdit?: () => void;
  editInline?: boolean;
  editLabel?: string;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  fullSwipe?: boolean;
  className?: string;
};
export function SwipeRow({
  children,
  label,
  onEdit,
  editInline = false,
  editLabel = "Modifica",
  onDelete,
  deleteDisabled = false,
  fullSwipe = false,
  className = "",
}: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    offset: number;
    lastOffset: number;
    axis: "x" | null;
  } | null>(null);
  const suppressClick = useRef(false);
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const editable = !!onEdit || editInline;
  const actionsWidth = (Number(editable) + Number(!!onDelete)) * 76;
  const close = () => {
    setOpen(false);
    setOffset(0);
  };
  const reveal = () => {
    window.dispatchEvent(new CustomEvent("workout:swipe-open", { detail: id }));
    setOpen(true);
    setOffset(-actionsWidth);
  };
  useEffect(() => {
    const other = (event: Event) => {
      if ((event as CustomEvent).detail !== id) {
        setOpen(false);
        setOffset(0);
      }
    };
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setOffset(0);
      }
    };
    const reset = () => {
      gesture.current = null;
      setDragging(false);
      setOpen(false);
      setOffset(0);
    };
    window.addEventListener("workout:swipe-open", other);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", reset);
    return () => {
      window.removeEventListener("workout:swipe-open", other);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", reset);
    };
  }, [id]);
  const edit = () => {
    suppressClick.current = false;
    close();
    if (onEdit) onEdit();
    else {
      const input = surface.current?.querySelector<HTMLInputElement>(
        "input:not([disabled])"
      );
      requestAnimationFrame(() => {
        if (input?.isConnected) {
          input.focus();
          input.click();
        }
      });
    }
  };
  const remove = () => {
    suppressClick.current = false;
    close();
    if (!deleteDisabled) onDelete?.();
  };
  return (
    <div
      ref={root}
      className={`swipe-item ${className}`}
      role="group"
      aria-label={label}
      data-open={open || undefined}
      data-dragging={dragging || undefined}
      data-full-swipe={fullSwipe || undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          close();
          root.current
            ?.querySelector<HTMLButtonElement>("[data-swipe-toggle]")
            ?.focus();
        }
      }}
    >
      <div
        className="swipe-item-actions"
        id={`${id}-actions`}
        aria-hidden={!open}
        inert={!open}
      >
        {editable && (
          <button
            type="button"
            className="swipe-item-edit"
            aria-label={`${editLabel}: ${label}`}
            onClick={edit}
          >
            <Icon name="settings" size={18} />
            <span>{editLabel}</span>
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="swipe-item-delete"
            disabled={deleteDisabled}
            aria-label={`Elimina: ${label}`}
            onClick={remove}
          >
            <Icon name="trash" size={18} />
            <span>Elimina</span>
          </button>
        )}
      </div>
      <div
        ref={surface}
        className="swipe-item-surface"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(event) => {
          if (!event.currentTarget.contains(event.target as Node)) return;
          suppressClick.current = false;
          if (
            event.button !== 0 ||
            gesture.current ||
            (event.target as HTMLElement).closest(
              "input:not([readonly]), textarea, select, [data-swipe-toggle]"
            )
          )
            return;
          gesture.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            offset,
            lastOffset: offset,
            axis: null,
          };
        }}
        onPointerMove={(event) => {
          const g = gesture.current;
          if (!g || g.id !== event.pointerId) return;
          const dx = event.clientX - g.x,
            dy = event.clientY - g.y;
          if (!g.axis) {
            const axis = swipeAxis(dx, dy);
            if (axis === "y") {
              gesture.current = null;
              return;
            }
            if (!axis) return;
            g.axis = "x";
            setDragging(true);
            suppressClick.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            window.dispatchEvent(
              new CustomEvent("workout:swipe-open", { detail: id })
            );
          }
          const limit =
            fullSwipe && onDelete && !deleteDisabled
              ? root.current?.clientWidth ?? actionsWidth
              : actionsWidth;
          const next = g.offset + dx;
          g.lastOffset = Math.max(-limit, Math.min(0, next));
          setOffset(g.lastOffset);
        }}
        onPointerUp={(event) => {
          const g = gesture.current;
          if (!g || g.id !== event.pointerId) return;
          gesture.current = null;
          setDragging(false);
          if (!g.axis) return;
          const decision = swipeDestination(
            g.lastOffset,
            actionsWidth,
            root.current?.clientWidth ?? actionsWidth,
            fullSwipe && !!onDelete && !deleteDisabled
          );
          if (decision === "delete") remove();
          else if (decision === "open") reveal();
          else close();
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setDragging(false);
          close();
        }}
        onLostPointerCapture={() => {
          if (gesture.current) {
            gesture.current = null;
            setDragging(false);
            close();
          }
        }}
        onClickCapture={(event) => {
          if (!event.currentTarget.contains(event.target as Node)) return;
          if (suppressClick.current) {
            event.preventDefault();
            event.stopPropagation();
            suppressClick.current = false;
            return;
          }
          if (
            open &&
            !(event.target as HTMLElement).closest("[data-swipe-toggle]")
          ) {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            close();
          }
        }}
      >
        <div className="swipe-item-content">{children}</div>
        <button
          type="button"
          data-swipe-toggle
          className="swipe-item-toggle"
          aria-label={`${open ? "Nascondi" : "Mostra"} azioni: ${label}`}
          aria-controls={`${id}-actions`}
          aria-expanded={open}
          onClick={(event) => {
            if (open) close();
            else {
              reveal();
              if (event.detail === 0)
                requestAnimationFrame(() =>
                  root.current
                    ?.querySelector<HTMLButtonElement>(
                      ".swipe-item-actions button:not(:disabled)"
                    )
                    ?.focus()
                );
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              reveal();
              requestAnimationFrame(() =>
                root.current
                  ?.querySelector<HTMLButtonElement>(
                    ".swipe-item-actions button:not(:disabled)"
                  )
                  ?.focus()
              );
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              close();
            }
          }}
        >
          •••
        </button>
      </div>
    </div>
  );
}
