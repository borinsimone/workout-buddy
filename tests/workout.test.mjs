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
  addSessionSet,
  removeSessionSet,
  remapRemovedSet,
  changeSessionExercise,
  prioritizeSessionExercise,
  replaceSessionExercise,
} from "../src/lib/workout.ts";

test("removing a middle set remaps actuals and recorded results without changing other exercises", () => {
  const store = initialStore();
  const session = { ...store.sessions[0], status: "active" };
  const [ex, other] = exercises(session.workout);
  session.results = {
    [key(ex, 0)]: {...ex.sets[0], kg: 10, status: "done"},
    [key(ex, 1)]: {...ex.sets[1], kg: 20, status: "done"},
    [key(ex, 2)]: {...ex.sets[2], kg: 30, status: "skipped"},
    [key(other, 0)]: {...other.sets[0], status: "done"},
  };
  const snapshot = structuredClone(session);
  const next = removeSessionSet(session, ex.id, 1);
  assert.equal(exercises(next.workout)[0].sets.length, ex.sets.length - 1);
  assert.equal(next.results[key(ex, 1)].kg, 30);
  assert.equal(next.results[key(ex, 1)].status, "skipped");
  assert.equal(next.results[key(ex, 2)], undefined);
  assert.deepEqual(next.results[key(other, 0)], session.results[key(other, 0)]);
  assert.deepEqual(session, snapshot);
  const pending = {[key(ex, 2)]: {kg: 99}, [key(other, 1)]: {kg: 55}};
  assert.deepEqual(remapRemovedSet(pending, ex.id, 1), {[key(ex, 1)]: {kg:99}, [key(other, 1)]: {kg:55}});
  const added = addSessionSet(next, ex.id);
  assert.deepEqual(exercises(added.workout)[0].sets.at(-1), exercises(next.workout)[0].sets.at(-1));
  assert.deepEqual(added.results, next.results);
  const rest = changeSessionExercise(added, ex.id, {rest:45});
  assert.equal(exercises(rest.workout)[0].rest, 45);
  assert.deepEqual(rest.results, added.results);
  let last = rest;
  while (exercises(last.workout)[0].sets.length > 1) last = removeSessionSet(last, ex.id, 0);
  assert.equal(removeSessionSet(last, ex.id, 0), last);
  assert.equal(removeSessionSet(rest, ex.id, -1), rest);
  assert.equal(validStore({...store, sessions:[rest]}), true);
});

test("anticipating exercises preserves recorded results and the saved template", () => {
  const store = initialStore();
  const session = {...store.sessions[0], status: "active"};
  const list = exercises(session.workout);
  session.results = { [key(list[0], 0)]: {...list[0].sets[0], status:"done"} };
  const snapshot = structuredClone(session);
  const templates = structuredClone(store.templates);
  const next = prioritizeSessionExercise(session, list.at(-1).id);
  assert.equal(exercises(next.workout)[0].id, list.at(-1).id);
  assert.deepEqual(next.results, session.results);
  assert.deepEqual(session, snapshot);
  assert.deepEqual(store.templates, templates);
  assert.equal(validStore(JSON.parse(JSON.stringify({...store,sessions:[next]}))), true);
});

test("replacing only pending sets retains original modes, results and volume for recorded sets", () => {
  const store = initialStore();
  const session = {...store.sessions[0], status:"active"};
  const [old, other] = exercises(session.workout);
  session.results = {
    [key(old, 1)]: {...old.sets[1], kg:80, reps:5, status:"done"},
    [key(other, 0)]: {...other.sets[0], status:"skipped"},
  };
  const snapshot = structuredClone(session);
  const replacement = {...structuredClone(old), id:"replacement", name:"Plank", mode:"time", sets:[{kg:0,reps:0,seconds:60}]};
  const next = replaceSessionExercise(session, old.id, replacement);
  const nextExercises = exercises(next.workout);
  assert.equal(nextExercises[0].sets.length, 1);
  assert.equal(nextExercises[0].mode, "weight");
  assert.equal(nextExercises[1].id, replacement.id);
  assert.equal(next.results[key(old, 0)].kg, 80);
  assert.equal(next.results[key(old, 1)], undefined);
  assert.deepEqual(next.results[key(other, 0)], session.results[key(other, 0)]);
  assert.equal(metrics(next).volume, 400);
  assert.equal(metrics(next).done, 1);
  assert.deepEqual(session, snapshot);
  assert.equal(validStore(JSON.parse(JSON.stringify({...store, sessions:[next]}))), true);
  const clean = {...session,results:{}};
  assert.equal(exercises(replaceSessionExercise(clean, old.id, replacement).workout)[0].id, replacement.id);
  const completed = {...session,status:"completed"};
  assert.equal(prioritizeSessionExercise(completed, other.id), completed);
  assert.equal(replaceSessionExercise(completed, old.id, replacement), completed);
  assert.equal(addSessionSet(completed, old.id), completed);
  assert.equal(removeSessionSet(completed, old.id, 0), completed);
});

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
