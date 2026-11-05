import test from "node:test";
import assert from "node:assert/strict";
import {
  initialStore,
  exercises,
  key,
  copyWorkout,
  fromSession,
  validStore,
  addSessionSet,
  formatTarget,
  formatResult,
  lastPerformance,
} from "../src/lib/workout.ts";
import {
  beginExerciseTimer,
  finishPreparation,
  timerValue,
  resumeTimer,
  completedDuration,
} from "../src/lib/session-timer.ts";

test("goal formatting distinguishes zero external weight, bodyweight, ranges, max and per-side", () => {
  const ex = exercises(initialStore().templates[0])[0];
  const target = { kg: 0, reps: 8, seconds: 60 };
  assert.equal(formatTarget(ex, target), "0 kg × 8");
  assert.equal(
    formatTarget(
      { ...ex, loadType: "bodyweight", perSide: true },
      { ...target, targetMode: "range", repsMax: 10 }
    ),
    "PC × 8–10 per lato"
  );
  assert.equal(
    formatTarget(
      { ...ex, loadType: "bodyweight" },
      { ...target, kg: 10, targetMode: "max" }
    ),
    "PC + 10 kg × max"
  );
  assert.equal(
    formatTarget({ ...ex, mode: "time" }, { ...target, targetMode: "max" }),
    "Tempo max"
  );
  assert.equal(
    formatResult(ex, { ...target, reps: 12, rpe: 0, status: "done" }),
    "0 kg × 12 · RPE 0"
  );
});

test("legacy backups stay valid; goal metadata validates separately from actual results", () => {
  const store = initialStore();
  assert.equal(validStore(store), true);
  const ex = exercises(store.templates[0])[0];
  ex.loadType = "bodyweight";
  ex.perSide = true;
  ex.sets[0].targetMode = "range";
  ex.sets[0].repsMax = 10;
  assert.equal(validStore(store), true);
  ex.sets[0].repsMax = 3;
  assert.equal(validStore(store), false);
  ex.sets[0].repsMax = 10;
  ex.perSide = "yes";
  assert.equal(validStore(store), false);
  ex.perSide = true;
  ex.loadType = "unknown";
  assert.equal(validStore(store), false);
  ex.loadType = "bodyweight";
  delete ex.sets[0].repsMax;
  assert.equal(validStore(store), false);
  ex.sets[0].targetMode = "max";
  assert.equal(validStore(store), true);
  const timed = exercises(store.templates[0]).find((ex) => ex.mode === "time");
  timed.sets[0] = {
    kg: 0,
    reps: 8,
    seconds: 60,
    targetMode: "range",
    repsMax: 10,
  };
  assert.equal(validStore(store), false);
  timed.sets[0] = { kg: 0, reps: 0, seconds: 0, targetMode: "max" };
  assert.equal(validStore(store), true);
  const session = store.sessions[0],
    exercise = exercises(session.workout)[0];
  exercise.sets[0] = { ...exercise.sets[0], targetMode: "range", repsMax: 10 };
  session.results[key(exercise, 0)] = {
    ...exercise.sets[0],
    reps: 12,
    status: "done",
  };
  assert.equal(validStore(JSON.parse(JSON.stringify(store))), true);
});

test("history uses latest prior completed session, real completed slots and stable copy lineage", () => {
  const store = initialStore();
  const make = (id, endedAt) => ({
    ...structuredClone(store.sessions[0]),
    id,
    status: "completed",
    startedAt: endedAt - 1000,
    endedAt,
    results: {},
  });
  const old = make("old", 10000),
    recent = make("recent", 20000),
    future = make("future", 40000),
    active = make("active", 25000);
  active.status = "active";
  for (const s of [old, recent, future, active]) {
    const ex = exercises(s.workout)[0];
    s.results[key(ex, 0)] = {
      ...ex.sets[0],
      kg: s.endedAt / 1000,
      status: "done",
    };
    s.results[key(ex, 1)] = { ...ex.sets[1], kg: 999, status: "skipped" };
  }
  const current = {
    ...make("current", 30000),
    status: "active",
    startedAt: 30000,
    workout: copyWorkout(recent.workout),
  };
  const ex = exercises(current.workout)[0];
  const before = JSON.stringify([old, recent, future, active, current]);
  const previous = lastPerformance(
    [old, recent, future, active, current],
    current,
    ex
  );
  assert.equal(previous.session.id, "recent");
  assert.equal(previous.sets[0].kg, 20);
  assert.equal(previous.sets[1], null);
  assert.equal(previous.sets[2], null);
  assert.equal(JSON.stringify([old, recent, future, active, current]), before);
  const skipOnly = make("skip-only", 29000),
    skipEx = exercises(skipOnly.workout)[0];
  skipOnly.results[key(skipEx, 0)] = { ...skipEx.sets[0], status: "skipped" };
  assert.equal(
    lastPerformance([old, recent, skipOnly], current, ex).session.id,
    "recent"
  );
  assert.equal(lastPerformance([old], current, { ...ex, perSide: true }), null);
  assert.equal(
    lastPerformance([old], current, { ...ex, loadType: "bodyweight" }),
    null
  );
  assert.equal(lastPerformance([old], current, { ...ex, mode: "time" }), null);
  assert.equal(
    lastPerformance([old], current, {
      ...ex,
      name: "Esercizio completamente diverso",
    }),
    null
  );
});

test("legacy name fallback is conservative and does not guess between duplicate exercises", () => {
  const base = initialStore().sessions[0];
  const old = {
    ...structuredClone(base),
    id: "old",
    status: "completed",
    endedAt: 10000,
    results: {},
  };
  const ex = exercises(old.workout)[0];
  old.results[key(ex, 0)] = { ...ex.sets[0], status: "done" };
  const current = { ...base, id: "new", status: "active", startedAt: 20000 };
  const renamed = { ...ex, id: "new-id", name: "  PANCA   PIANA BILANCIERE  " };
  assert.equal(lastPerformance([old], current, renamed).session.id, "old");
  old.workout.sections[0].exercises.push({
    ...structuredClone(ex),
    id: "duplicate",
  });
  assert.equal(lastPerformance([old], current, renamed), null);
});

test("reusing and adding sets preserves ranges and max goals while keeping actuals separate", () => {
  const session = {
    ...initialStore().sessions[0],
    status: "active",
    results: {},
  };
  const ex = exercises(session.workout)[0];
  ex.loadType = "bodyweight";
  ex.perSide = true;
  ex.sets = ex.sets.map((set) => ({
    ...set,
    reps: 8,
    repsMax: 10,
    targetMode: "range",
  }));
  ex.sets.forEach((set, index) => {
    session.results[key(ex, index)] = {
      ...set,
      kg: 15,
      reps: 12,
      status: "done",
    };
  });
  const copied = fromSession(session),
    next = exercises(copied)[0];
  assert.equal(next.historyId, ex.id);
  assert.equal(next.loadType, "bodyweight");
  assert.equal(next.perSide, true);
  assert.equal(next.sets[0].kg, 15);
  assert.equal(next.sets[0].reps, 8);
  assert.equal(next.sets[0].repsMax, 10);
  const added = addSessionSet(session, ex.id),
    last = exercises(added.workout)[0].sets.at(-1);
  assert.equal(last.reps, 8);
  assert.equal(last.repsMax, 10);
  assert.equal(last.kg, 15);
  assert.equal(added.results[key(ex, ex.sets.length)], undefined);
});

test("max-duration stopwatch starts after preparation and survives pause, resume and reload", () => {
  const prep = beginExerciseTimer(0, 5, 1000, "plank", true);
  assert.equal(timerValue(prep, 3000), 3);
  const running = finishPreparation(prep);
  assert.equal(timerValue(running, 8000), 2);
  const paused = { ...running, paused: timerValue(running, 18000) };
  assert.equal(timerValue(paused, 50000), 12);
  const resumed = resumeTimer(paused, 50000);
  assert.equal(timerValue(JSON.parse(JSON.stringify(resumed)), 55000), 17);
  assert.equal(completedDuration(resumed, 55000), 17);
  const countdown = beginExerciseTimer(60, 0, 1000, "plank");
  assert.equal(completedDuration(countdown, 21000), 20);
  assert.equal(completedDuration({ ...countdown, paused: 40 }, 999999), 20);
});
