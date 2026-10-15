"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { createPortal } from "react-dom";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> & {
  value: number | string;
  onChange: (event: { target: { value: string } }) => void;
};

function Wheel({
  values,
  value,
  onChange,
  label,
}: {
  values: number[];
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const initial = useRef({ values, value });
  const positioned = useRef(false);
  useEffect(() => {
    // The parent opens the dialog in an effect. Hidden dialogs have no scroll
    // layout, so wait until it is visible before centering the current value.
    const frame = requestAnimationFrame(() => {
      const wheel = ref.current;
      if (!wheel) return;
      wheel.scrollTo({
        top: Math.max(0, initial.current.values.indexOf(initial.current.value)) * 48,
        behavior: "instant",
      });
      positioned.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="picker-column">
      <span className="subtext">{label}</span>
      <div
        ref={ref}
        className="picker-wheel"
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onScroll={(event) => {
          if (!positioned.current) return;
          const index = Math.max(
            0,
            Math.min(
              values.length - 1,
              Math.round(event.currentTarget.scrollTop / 48)
            )
          );
          onChange(values[index]);
        }}
        onKeyDown={(event) => {
          if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const index = values.indexOf(value);
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
              ? values.length - 1
              : Math.max(
                  0,
                  Math.min(
                    values.length - 1,
                    index + (event.key === "ArrowDown" ? 1 : -1)
                  )
                );
          ref.current?.scrollTo({ top: next * 48, behavior: "instant" });
          onChange(values[next]);
        }}
      >
        {values.map((n, index) => (
          <button
            type="button"
            role="option"
            aria-selected={n === value}
            tabIndex={-1}
            key={n}
            onClick={() => {
              ref.current?.scrollTo({ top: index * 48, behavior: "instant" });
              onChange(n);
            }}
          >
            {n.toLocaleString("it-IT")}
          </button>
        ))}
      </div>
    </div>
  );
}

function PickerDialog({
  initial,
  title,
  min,
  max,
  step,
  onConfirm,
  onClose,
}: {
  initial: string;
  title: string;
  min: number;
  max?: number;
  step: number;
  onConfirm: (value: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [keyboard, setKeyboard] = useState(false);
  const [raw, setRaw] = useState(initial);
  const [error, setError] = useState("");
  const duration = /second|durata|recuper/i.test(title);
  const numeric = Number(raw.replace(",", ".")) || 0;
  const [minutes, setMinutes] = useState(Math.floor(numeric / 60));
  const [seconds, setSeconds] = useState(Math.floor(numeric % 60));
  const [selected, setSelected] = useState(numeric);
  const ceiling = Math.max(max ?? (step < 1 ? 300 : 200), numeric);
  const values = Array.from(
    { length: Math.floor((ceiling - min) / step) + 1 },
    (_, i) => Number((min + i * step).toFixed(3))
  );
  if (numeric >= min && !values.includes(numeric)) values.push(numeric);
  values.sort((a, b) => a - b);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const chosen = duration ? minutes * 60 + seconds : selected;
  return createPortal(
    <dialog
      ref={dialog}
      className="number-picker-dialog"
      aria-label={title}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="section-heading">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Annulla selezione"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="segmented">
        <button
          type="button"
          className={!keyboard ? "selected" : ""}
          onClick={() => {
            if (!keyboard) return;
            const number = Number(raw.replace(",", "."));
            if (
              raw.trim() &&
              Number.isFinite(number) &&
              (step < 1 || Number.isInteger(number)) &&
              number >= min &&
              (max === undefined || number <= max)
            ) {
              setSelected(number);
              setMinutes(Math.floor(number / 60));
              setSeconds(Math.floor(number % 60));
              setKeyboard(false);
              setError("");
            } else
              setError("Inserisci un valore valido prima di usare la rotella.");
          }}
        >
          Rotella
        </button>
        <button
          type="button"
          className={keyboard ? "selected" : ""}
          onClick={() => {
            if (keyboard) return;
            setRaw(String(chosen));
            setKeyboard(true);
            setError("");
          }}
        >
          Usa tastiera
        </button>
      </div>
      {keyboard ? (
        <label className="field">
          {duration ? "Valore in secondi" : "Valore"}
          <input
            autoFocus
            type="text"
            inputMode={step < 1 ? "decimal" : "numeric"}
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
          />
        </label>
      ) : (
        <div className="picker-wheels">
          <div className="picker-highlight" aria-hidden="true" />
          {duration ? (
            <>
              <Wheel
                label="Minuti"
                values={Array.from(
                  { length: Math.max(120, minutes) + 1 },
                  (_, i) => i
                )}
                value={minutes}
                onChange={setMinutes}
              />
              <Wheel
                label="Secondi"
                values={Array.from({ length: 60 }, (_, i) => i)}
                value={seconds}
                onChange={setSeconds}
              />
            </>
          ) : (
            <Wheel
              label={
                step < 1 && max !== 10
                  ? "Kg"
                  : max === 10
                  ? "RPE"
                  : /numero.*set/i.test(title) ? "Set" : "Ripetizioni"
              }
              values={values}
              value={selected}
              onChange={setSelected}
            />
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="subtext">
          {error}
        </p>
      )}
      <button
        type="button"
        className="button primary full"
        onClick={() => {
          const text = keyboard ? raw.trim().replace(",", ".") : String(chosen);
          const n = Number(text);
          if (
            !text ||
            !Number.isFinite(n) ||
            n < min ||
            (max !== undefined && n > max) ||
            (step >= 1 && !Number.isInteger(n))
          ) {
            setError(
              `Inserisci ${
                step >= 1 ? "un numero intero" : "un numero"
              } da ${min}${max !== undefined ? ` a ${max}` : " in su"}.`
            );
            return;
          }
          onConfirm(String(n));
          onClose();
        }}
      >
        Conferma
      </button>
      {max === 10 && (
        <button
          type="button"
          className="text-button centered"
          onClick={() => {
            onConfirm("");
            onClose();
          }}
        >
          Non impostare RPE
        </button>
      )}
    </dialog>,
    document.body
  );
}

export function NumberPicker({ value, onChange, ...props }: Props) {
  const [title, setTitle] = useState<string | null>(null);
  return (
    <>
      <input
        {...props}
        type="text"
        value={value}
        readOnly
        aria-haspopup="dialog"
        onClick={(event) =>
          setTitle(
            props["aria-label"] ??
              event.currentTarget.labels?.[0]?.textContent?.trim() ??
              "Seleziona valore"
          )
        }
        onKeyDown={(event) => {
          if (["Enter", " "].includes(event.key)) {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}
      />
      {title && (
        <PickerDialog
          initial={String(value)}
          title={title}
          min={Number(props.min ?? 0)}
          max={props.max === undefined ? undefined : Number(props.max)}
          step={Number(props.step ?? 1)}
          onConfirm={(next) => onChange({ target: { value: next } })}
          onClose={() => setTitle(null)}
        />
      )}
    </>
  );
}
