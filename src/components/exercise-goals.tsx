"use client";
import { NumberPicker } from "./number-picker";
import type { Exercise, SetTarget } from "@/lib/workout";

export function ExerciseGoalOptions({
  exercise,
  onChange,
}: {
  exercise: Pick<Exercise, "mode" | "loadType" | "perSide">;
  onChange: (patch: Partial<Exercise>) => void;
}) {
  return (
    <div className="exercise-goal-options">
      {exercise.mode === "weight" && (
        <label className="field">
          Tipo di carico
          <select
            value={exercise.loadType ?? "weight"}
            onChange={(e) =>
              onChange({ loadType: e.target.value as Exercise["loadType"] })
            }
          >
            <option value="weight">Carico esterno (kg)</option>
            <option value="bodyweight">
              Peso corporeo (PC), con eventuali kg extra
            </option>
          </select>
        </label>
      )}
      <label className="switch-row">
        <span>
          Per lato<small>Ripetizioni o durata riferite a ciascun lato</small>
        </span>
        <input
          type="checkbox"
          checked={!!exercise.perSide}
          onChange={(e) => onChange({ perSide: e.target.checked })}
        />
      </label>
    </div>
  );
}

export function SetGoalFields({
  exercise,
  target,
  onChange,
}: {
  exercise: Pick<Exercise, "mode" | "rpe" | "loadType">;
  target: SetTarget;
  onChange: (target: SetTarget) => void;
}) {
  const mode = target.targetMode ?? "fixed";
  return (
    <div className="set-goal-fields">
      <label className="field set-goal-kind">
        Obiettivo
        <select
          value={mode}
          onChange={(e) => {
            const kind = e.target.value as SetTarget["targetMode"];
            const next = { ...target, targetMode: kind };
            if (kind === "range") {
              next.reps = target.reps || 8;
              next.repsMax = Math.max(next.reps, target.repsMax ?? 10);
            } else {
              delete next.repsMax;
              if (kind === "max") {
                next.reps = 0;
                next.seconds = 0;
              } else if (exercise.mode === "time")
                next.seconds = target.seconds || 60;
              else next.reps = target.reps || 8;
            }
            onChange(next);
          }}
        >
          <option value="fixed">
            {exercise.mode === "time" ? "Durata fissa" : "Ripetizioni fisse"}
          </option>
          {exercise.mode === "weight" && (
            <option value="range">Intervallo di ripetizioni</option>
          )}
          <option value="max">
            {exercise.mode === "time"
              ? "Tempo massimo (cronometro)"
              : "Massimo di ripetizioni"}
          </option>
        </select>
      </label>
      <div className="set-goal-values">
        {exercise.mode === "weight" && (
          <label className="field">
            {exercise.loadType === "bodyweight" ? "Kg extra (0 = PC)" : "Kg"}
            <NumberPicker
              value={target.kg}
              min={0}
              step={0.5}
              onChange={(e) =>
                onChange({ ...target, kg: Number(e.target.value) })
              }
            />
          </label>
        )}
        {mode !== "max" &&
          (exercise.mode === "time" ? (
            <label className="field">
              Secondi
              <NumberPicker
                value={target.seconds}
                min={1}
                onChange={(e) =>
                  onChange({ ...target, seconds: Number(e.target.value) })
                }
              />
            </label>
          ) : (
            <label className="field">
              {mode === "range" ? "Rip. min" : "Ripetizioni"}
              <NumberPicker
                value={target.reps}
                min={0}
                onChange={(e) => {
                  const reps = Number(e.target.value);
                  onChange({
                    ...target,
                    reps,
                    ...(mode === "range"
                      ? { repsMax: Math.max(reps, target.repsMax ?? reps) }
                      : {}),
                  });
                }}
              />
            </label>
          ))}
        {mode === "range" && (
          <label className="field">
            Rip. max
            <NumberPicker
              value={target.repsMax ?? target.reps}
              min={target.reps}
              onChange={(e) =>
                onChange({ ...target, repsMax: Number(e.target.value) })
              }
            />
          </label>
        )}
        {exercise.rpe && (
          <label className="field">
            RPE
            <NumberPicker
              value={target.rpe ?? ""}
              min={0}
              max={10}
              step={0.5}
              onChange={(e) =>
                onChange({
                  ...target,
                  rpe:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
        )}
      </div>
      {mode === "max" && (
        <p className="subtext">
          {exercise.mode === "time"
            ? "Avvia il cronometro e completa il set per registrare il tempo."
            : "Inserisci le ripetizioni effettive prima di completare il set."}
        </p>
      )}
    </div>
  );
}
