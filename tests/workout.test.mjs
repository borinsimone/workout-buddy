import assert from "node:assert/strict";
import test from "node:test";
import {
  initialStore,
  metrics,
  exercises,
  key,
  fromSession,
  validStore,
} from "../src/lib/workout.ts";

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
