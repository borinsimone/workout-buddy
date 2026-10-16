"use client";

import { useEffect, useRef, useState } from "react";
import { NumberPicker } from "./number-picker";
import { uid, key, clock, type Exercise, type Session } from "@/lib/workout";

function AddExercise({
  onAdd,
  onClose,
  source,
}: {
  onAdd: (exercise: Exercise) => void;
  onClose: () => void;
  source?: Exercise;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"weight" | "time">(source?.mode ?? "weight");
  const [count, setCount] = useState(source?.sets.length ?? 3);
  const [kg, setKg] = useState(source?.sets[0]?.kg ?? 0);
  const [reps, setReps] = useState(source?.sets[0]?.reps ?? 8);
  const [seconds, setSeconds] = useState(source?.sets[0]?.seconds || 60);
  const [rest, setRest] = useState(source?.rest ?? 90);
  const [rpe, setRpe] = useState(source?.rpe ?? false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="session-exercise-dialog"
      aria-label={
        source ? "Sostituisci esercizio" : "Aggiungi esercizio alla sessione"
      }
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
          <h2>{source ? "Sostituisci esercizio" : "Aggiungi esercizio"}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Annulla aggiunta"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="subtext">
          {source
            ? `Sostituisce i set ancora da eseguire di ${source.name}. I risultati già registrati rimangono sull’esercizio originale.`
            : "Verrà aggiunto in fondo a questa sessione."}
        </p>
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
          {source ? "Conferma sostituzione" : "Aggiungi alla sessione"}
        </button>
      </form>
    </dialog>
  );
}

export function SessionExercises({
  session,
  onAdd,
  onRemove,
  onAddSet,
  onRemoveSet,
  onRest,
  onPrioritize,
  onReplace,
}: {
  session: Session;
  onAdd: (exercise: Exercise) => void;
  onRemove: (id: string) => void;
  onAddSet: (id: string) => void;
  onRemoveSet: (id: string, index: number) => void;
  onRest: (id: string, seconds: number) => void;
  onPrioritize: (id: string) => void;
  onReplace: (id: string, exercise: Exercise) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removingSet, setRemovingSet] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const all = session.workout.sections.flatMap((section) => section.exercises);
  const current = all.find((ex) =>
    ex.sets.some((_, i) => !session.results[key(ex, i)])
  );
  const replacementSource = all.find((ex) => ex.id === replacing);
  return (
    <>
      <details className="card session-exercises">
        <summary>Gestisci esercizi della sessione</summary>
        <p className="subtext">
          Modifica set, recuperi e ordine solo in questo allenamento.
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
              <div className="live-exercise-actions">
                <button
                  type="button"
                  className="button subtle small"
                  disabled={
                    current?.id === ex.id ||
                    ex.sets.every((_, i) => session.results[key(ex, i)])
                  }
                  onClick={() => onPrioritize(ex.id)}
                >
                  {current?.id === ex.id ? "In corso" : "Fai adesso"}
                </button>
                <button
                  type="button"
                  className="button subtle small"
                  disabled={ex.sets.every(
                    (_, i) => session.results[key(ex, i)]
                  )}
                  onClick={() => setReplacing(ex.id)}
                >
                  Sostituisci
                </button>
              </div>
              <details className="live-set-editor">
                <summary>Set e recupero · {clock(ex.rest)}</summary>
                <label className="field">
                  Recupero tra i set (secondi)
                  <NumberPicker
                    value={ex.rest}
                    min={0}
                    onChange={(e) => onRest(ex.id, Number(e.target.value))}
                  />
                </label>
                {ex.sets.map((target, index) => {
                  const result = session.results[key(ex, index)];
                  const id = key(ex, index);
                  return (
                    <div className="live-set-item" key={id}>
                      <div className="section-heading">
                        <span>
                          Set {index + 1} ·{" "}
                          {ex.mode === "time"
                            ? `${target.seconds} sec`
                            : `${target.kg} kg × ${target.reps}`}
                          <small className="subtext">
                            {" "}
                            ·{" "}
                            {result?.status === "done"
                              ? "Eseguito"
                              : result?.status === "skipped"
                              ? "Saltato"
                              : "Da eseguire"}
                          </small>
                        </span>
                        <button
                          type="button"
                          className="text-button"
                          disabled={ex.sets.length <= 1}
                          aria-label={`Togli set ${index + 1} di ${ex.name}`}
                          onClick={() => setRemovingSet(id)}
                        >
                          Togli
                        </button>
                      </div>
                      {removingSet === id && (
                        <div role="group" aria-label="Conferma rimozione set">
                          <p>
                            Rimuovere il set {index + 1}
                            {result ? " e il risultato registrato" : ""}?
                          </p>
                          <div className="two-buttons">
                            <button
                              type="button"
                              className="button subtle"
                              onClick={() => setRemovingSet(null)}
                            >
                              Annulla
                            </button>
                            <button
                              type="button"
                              className="button danger"
                              onClick={() => {
                                onRemoveSet(ex.id, index);
                                setRemovingSet(null);
                              }}
                            >
                              Rimuovi set
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="text-button centered"
                  onClick={() => onAddSet(ex.id)}
                >
                  + Aggiungi set
                </button>
                <p className="subtext">
                  Il nuovo set riprende gli obiettivi dell’ultimo.
                </p>
              </details>
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
      {replacementSource && (
        <AddExercise
          source={{
            ...replacementSource,
            sets: replacementSource.sets.filter(
              (_, i) => !session.results[key(replacementSource, i)]
            ),
          }}
          onAdd={(exercise) => onReplace(replacementSource.id, exercise)}
          onClose={() => setReplacing(null)}
        />
      )}
    </>
  );
}
