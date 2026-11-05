"use client";

import { useEffect, useRef, useState } from "react";
import { NumberPicker } from "./number-picker";
import { SwipeRow } from "./swipe-row";
import { ExerciseGoalOptions, SetGoalFields } from "./exercise-goals";
import {
  uid,
  key,
  clock,
  formatTarget,
  type Exercise,
  type Session,
  type SetTarget,
} from "@/lib/workout";

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
  const [target, setTarget] = useState<SetTarget>(
    source?.sets[0] ?? { kg: 0, reps: 8, seconds: 60 }
  );
  const [loadType, setLoadType] = useState<Exercise["loadType"]>(
    source?.loadType ?? "weight"
  );
  const [perSide, setPerSide] = useState(!!source?.perSide);
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
            loadType,
            perSide,
            sets: Array.from({ length: count }, () => ({ ...target })),
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
            onChange={(e) => {
              const mode = e.target.value as "weight" | "time";
              setMode(mode);
              if (mode === "time")
                setTarget({
                  ...target,
                  seconds:
                    target.targetMode === "max" ? 0 : target.seconds || 60,
                  ...(target.targetMode === "range"
                    ? { targetMode: "fixed", repsMax: undefined }
                    : {}),
                });
            }}
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
        <ExerciseGoalOptions
          exercise={{ mode, loadType, perSide }}
          onChange={(patch) => {
            if (patch.loadType !== undefined) setLoadType(patch.loadType);
            if (patch.perSide !== undefined) setPerSide(patch.perSide);
          }}
        />
        <SetGoalFields
          exercise={{ mode, rpe, loadType }}
          target={target}
          onChange={setTarget}
        />
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
  onEditSet,
}: {
  session: Session;
  onAdd: (exercise: Exercise) => void;
  onRemove: (id: string) => void;
  onAddSet: (id: string) => void;
  onRemoveSet: (id: string, index: number) => void;
  onRest: (id: string, seconds: number) => void;
  onPrioritize: (id: string) => void;
  onReplace: (id: string, exercise: Exercise) => void;
  onEditSet: (exercise: Exercise, index: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removingSet, setRemovingSet] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
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
              <SwipeRow
                label={ex.name}
                onEdit={() => setExpanded(ex.id)}
                onDelete={() => setRemoving(ex.id)}
                fullSwipe
              >
                <div className="section-heading">
                  <span>
                    <strong>{ex.name}</strong>
                    <small className="subtext"> · {ex.sets.length} set</small>
                  </span>
                </div>
              </SwipeRow>
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
              <details
                className="live-set-editor"
                open={expanded === ex.id}
                onToggle={(event) => {
                  if (event.currentTarget.open) setExpanded(ex.id);
                  else
                    setExpanded((previous) =>
                      previous === ex.id ? null : previous
                    );
                }}
              >
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
                      <SwipeRow
                        label={`Set ${index + 1} di ${ex.name}`}
                        onEdit={() => onEditSet(ex, index)}
                        onDelete={() => setRemovingSet(id)}
                        deleteDisabled={ex.sets.length <= 1}
                        fullSwipe
                      >
                        <div className="section-heading">
                          <span>
                            Set {index + 1} · {formatTarget(ex, target)}
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
                        </div>
                      </SwipeRow>
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
                  Il nuovo set copia i valori della serie precedente.
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
