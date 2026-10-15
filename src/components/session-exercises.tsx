"use client";

import { useEffect, useRef, useState } from "react";
import { NumberPicker } from "./number-picker";
import { uid, type Exercise, type Session } from "@/lib/workout";

function AddExercise({
  onAdd,
  onClose,
}: {
  onAdd: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"weight" | "time">("weight");
  const [count, setCount] = useState(3);
  const [kg, setKg] = useState(0);
  const [reps, setReps] = useState(8);
  const [seconds, setSeconds] = useState(60);
  const [rest, setRest] = useState(90);
  const [rpe, setRpe] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="session-exercise-dialog"
      aria-label="Aggiungi esercizio alla sessione"
      onCancel={onClose}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !name.trim() ||
            !Number.isInteger(count) ||
            count < 1 ||
            count > 50
          )
            return;
          onAdd({
            id: uid(),
            name: name.trim(),
            mode,
            rest,
            rpe,
            sets: Array.from({ length: count }, () => ({ kg, reps, seconds })),
          });
          onClose();
        }}
      >
        <div className="section-heading">
          <h2>Aggiungi esercizio</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Annulla aggiunta"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="subtext">Verrà aggiunto in fondo a questa sessione.</p>
        <label className="field">
          Nome esercizio
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. Curl manubri"
          />
        </label>
        <label className="field">
          Modalità
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "weight" | "time")}
          >
            <option value="weight">Carico e ripetizioni</option>
            <option value="time">Durata</option>
          </select>
        </label>
        <label className="field">
          Numero di set
          <NumberPicker
            value={count}
            min={1}
            max={50}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
        {mode === "weight" ? (
          <>
            <label className="field">
              Carico (kg)
              <NumberPicker
                value={kg}
                min={0}
                step={0.5}
                onChange={(e) => setKg(Number(e.target.value))}
              />
            </label>
            <label className="field">
              Ripetizioni
              <NumberPicker
                value={reps}
                min={0}
                onChange={(e) => setReps(Number(e.target.value))}
              />
            </label>
          </>
        ) : (
          <label className="field">
            Durata (secondi)
            <NumberPicker
              value={seconds}
              min={1}
              onChange={(e) => setSeconds(Number(e.target.value))}
            />
          </label>
        )}
        <label className="field">
          Recupero (secondi)
          <NumberPicker
            value={rest}
            min={0}
            onChange={(e) => setRest(Number(e.target.value))}
          />
        </label>
        <label className="switch-row">
          <span>Registra RPE</span>
          <input
            type="checkbox"
            checked={rpe}
            onChange={(e) => setRpe(e.target.checked)}
          />
        </label>
        <button type="submit" className="button primary full">
          Aggiungi alla sessione
        </button>
      </form>
    </dialog>
  );
}

export function SessionExercises({
  session,
  onAdd,
  onRemove,
}: {
  session: Session;
  onAdd: (exercise: Exercise) => void;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  return (
    <>
      <details className="card session-exercises">
        <summary>Gestisci esercizi della sessione</summary>
        <p className="subtext">
          Aggiungi o togli esercizi solo da questo allenamento.
        </p>
        {session.workout.sections
          .flatMap((section) => section.exercises)
          .map((ex) => (
            <div className="session-exercise-item" key={ex.id}>
              <div className="section-heading">
                <span>
                  <strong>{ex.name}</strong>
                  <small className="subtext"> · {ex.sets.length} set</small>
                </span>
                <button
                  type="button"
                  className="text-button"
                  aria-label={`Rimuovi ${ex.name}`}
                  onClick={() => setRemoving(ex.id)}
                >
                  Rimuovi
                </button>
              </div>
              {removing === ex.id && (
                <div
                  className="card"
                  role="group"
                  aria-label={`Conferma rimozione ${ex.name}`}
                >
                  <p>
                    Rimuovere {ex.name}? Verranno rimossi anche i suoi risultati
                    già registrati in questa sessione.
                  </p>
                  <div className="two-buttons">
                    <button
                      type="button"
                      className="button subtle"
                      onClick={() => setRemoving(null)}
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      className="button danger"
                      onClick={() => {
                        onRemove(ex.id);
                        setRemoving(null);
                      }}
                    >
                      Rimuovi esercizio
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        <button
          type="button"
          className="button subtle full"
          onClick={() => setAdding(true)}
        >
          + Aggiungi esercizio
        </button>
      </details>
      {adding && <AddExercise onAdd={onAdd} onClose={() => setAdding(false)} />}
    </>
  );
}
