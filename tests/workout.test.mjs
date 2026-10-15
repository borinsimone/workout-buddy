import assert from "node:assert/strict";
import test from "node:test";
import {
  initialStore,
  metrics,
  exercises,
  key,
  fromSession,
  validStore,
  appendSessionExercise,
  removeSessionExercise,
} from "../src/lib/workout.ts";

test("live exercise changes preserve templates and other results, and survive backup validation", () => {
  const store = initialStore();
  const original = { ...store.sessions[0], status: "active" };
  const [first, second] = exercises(original.workout);
  original.results = {
    [key(first, 0)]: { ...first.sets[0], status: "done" },
    [key(second, 0)]: { ...second.sets[0], status: "done" },
  };
  const snapshot = structuredClone(original);
  const templateSnapshot = structuredClone(store.templates);
  const extra = { ...structuredClone(first), id: "extra-live", name: "Extra live" };
  const added = appendSessionExercise(original, extra);
  assert.equal(exercises(added.workout).at(-1).id, extra.id);
  assert.deepEqual(added.results, original.results);
  const removed = removeSessionExercise(added, first.id);
  assert.equal(exercises(removed.workout).some(ex => ex.id === first.id), false);
  assert.equal(removed.results[key(first, 0)], undefined);
  assert.deepEqual(removed.results[key(second, 0)], original.results[key(second, 0)]);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(store.templates, templateSnapshot);
  assert.equal(validStore(JSON.parse(JSON.stringify({ ...store, sessions: [removed] }))), true);
  let empty = removed;
  for (const ex of exercises(empty.workout)) empty = removeSessionExercise(empty, ex.id);
  assert.equal(metrics(empty).total, 0);
  assert.equal(metrics(empty).done, 0);
  assert.equal(metrics(empty).volume, 0);
  assert.equal(exercises(appendSessionExercise(empty, extra).workout).length, 1);
  const completed = { ...original, status: "completed" };
  assert.equal(appendSessionExercise(completed, extra), completed);
  assert.equal(removeSessionExercise(completed, first.id), completed);
});

test("volume excludes skipped, incomplete and timed sets", () => {
  const s = initialStore().sessions[0];
  const [weight, , , timed] = exercises(s.workout);
  s.results[key(weight, 0)] = {
    ...weight.sets[0],
    kg: 80,
    reps: 5,
    status: "done",
  };
  s.results[key(weight, 1)] = {
    ...weight.sets[1],
    kg: 200,
    reps: 20,
    status: "skipped",
  };
  s.results[key(timed, 0)] = {
    ...timed.sets[0],
    kg: 999,
    reps: 999,
    seconds: 72,
    status: "done",
  };
  assert.equal(metrics(s).done, 2);
  assert.equal(metrics(s).volume, 400);
});
test("copy uses completed results and retains targets for skipped sets without mutating history", () => {
  const s = initialStore().sessions[0];
  const ex = exercises(s.workout)[0];
  s.results[key(ex, 0)] = { ...ex.sets[0], kg: 85, reps: 4, status: "done" };
  s.results[key(ex, 1)] = { ...ex.sets[1], kg: 1, reps: 1, status: "skipped" };
  const copy = fromSession(s),
    next = exercises(copy)[0];
  assert.notEqual(next.id, ex.id);
  assert.equal(next.sets[0].kg, 85);
  assert.equal(next.sets[1].kg, ex.sets[1].kg);
  next.sets[0].kg = 10;
  assert.equal(s.results[key(ex, 0)].kg, 85);
});
test("backup validates schema and rejects invalid results", () => {
  const store = initialStore();
  assert.equal(validStore(JSON.parse(JSON.stringify(store))), true);
  assert.equal(
    validStore({
      version: 1,
      preparation: 5,
      templates: [],
      sessions: [{ date: "bad" }],
    }),
    false
  );
  const s = store.sessions[1];
  Object.values(s.results)[0].kg = -20;
  assert.equal(validStore(store), false);
});
test("session duration freezes after completion", () => {
  const s = initialStore().sessions[0];
  s.startedAt = 1000;
  s.endedAt = 61000;
  assert.equal(metrics(s, 999999).seconds, 60);
});
