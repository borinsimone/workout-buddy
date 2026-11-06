import type { SessionTimer } from "./session-timer";

export type ActualValues = { kg: number; reps: number; seconds: number; rpe?: number; durationEntered?: boolean };
type Runtime = { timer: SessionTimer | null; actuals: Record<string, ActualValues> };
export type SessionRuntimes = Record<string, Runtime>;
export const emptyRuntime: Runtime = { timer: null, actuals: {} };

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

export function readSessionRuntimes(value: unknown, activeIds: string[]): SessionRuntimes {
  if (!object(value)) return {};
  const entries = typeof value.sessionId === "string" ? [[value.sessionId, value]] as const : Object.entries(value);
  return Object.fromEntries(entries.flatMap(([id, runtime]) => {
    if (!activeIds.includes(id) || !object(runtime)) return [];
    const t = runtime.timer;
    const timer = object(t) && ["rest", "prep", "exercise"].includes(String(t.kind)) && finite(t.end) && finite(t.duration) &&
      (t.paused === undefined || finite(t.paused)) && (t.countUp === undefined || typeof t.countUp === "boolean") &&
      (!t.countUp || t.kind !== "exercise" || finite(t.startedAt)) ? t as unknown as SessionTimer : null;
    const actuals = object(runtime.actuals) ? Object.fromEntries(Object.entries(runtime.actuals).flatMap(([key, result]) => {
      if (!object(result) || !finite(result.kg) || !finite(result.reps) || !finite(result.seconds)) return [];
      return [[key, {kg:result.kg, reps:result.reps, seconds:result.seconds, rpe:finite(result.rpe) && result.rpe<=10 ? result.rpe : undefined, durationEntered:result.durationEntered===true}]];
    })) : {};
    return [[id, {timer, actuals}]];
  }));
}
