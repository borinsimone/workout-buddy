export type SessionTimer = {
  exerciseId?: string;
  finished?: boolean;
  end: number;
  kind: "rest" | "prep" | "exercise";
  duration: number;
  paused?: number;
  countUp?: boolean;
  startedAt?: number;
};
export function timerValue(timer: SessionTimer, now: number) {
  return (
    timer.paused ??
    (timer.countUp && timer.kind === "exercise"
      ? Math.max(0, Math.floor((now - (timer.startedAt ?? now)) / 1000))
      : Math.max(0, Math.ceil((timer.end - now) / 1000)))
  );
}
export function beginExerciseTimer(
  seconds: number,
  preparation: number,
  now: number,
  exerciseId: string,
  countUp = false
): SessionTimer {
  return {
    kind: preparation ? "prep" : "exercise",
    exerciseId,
    duration: seconds,
    end: now + (preparation || seconds) * 1000,
    countUp,
    startedAt: now,
  };
}
export function finishPreparation(timer: SessionTimer): SessionTimer {
  return {
    kind: "exercise",
    exerciseId: timer.exerciseId,
    duration: timer.duration,
    end: timer.end + timer.duration * 1000,
    countUp: timer.countUp,
    startedAt: timer.end,
  };
}
export function resumeTimer(timer: SessionTimer, now: number): SessionTimer {
  if (timer.paused === undefined) return timer;
  return {
    ...timer,
    end: now + timer.paused * 1000,
    startedAt:
      timer.countUp && timer.kind === "exercise"
        ? now - timer.paused * 1000
        : timer.startedAt,
    paused: undefined,
  };
}
export function completedDuration(timer: SessionTimer, now: number) {
  const value = timerValue(timer, now);
  return timer.countUp ? value : Math.max(0, timer.duration - value);
}
export function measuredDuration(timer: SessionTimer | null, now: number, exerciseId: string, manual?: number): number | null {
  if (timer?.kind === "prep") return null;
  if (manual !== undefined && Number.isFinite(manual) && manual > 0) return manual;
  if (timer?.kind !== "exercise" || (timer.exerciseId && timer.exerciseId !== exerciseId)) return null;
  const seconds = completedDuration(timer, now);
  return seconds > 0 ? seconds : null;
}
