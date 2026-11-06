import test from 'node:test';
import assert from 'node:assert/strict';
import { readSessionRuntimes } from '../src/lib/session-runtime.ts';
import { beginExerciseTimer, finishPreparation, measuredDuration, timerValue } from '../src/lib/session-timer.ts';

test('each active workout restores its own draft and timer after visiting another workout', () => {
  const timer = {kind:'rest',end:91000,duration:90,exerciseId:'bench'};
  const actual = {kg:62.5,reps:7,seconds:0,rpe:8};
  const saved = {first:{timer,actuals:{'bench:0':actual}},second:{timer:null,actuals:{'bench:0':{...actual,kg:20}}},finished:{timer,actuals:{}}};
  const restored = readSessionRuntimes(JSON.parse(JSON.stringify(saved)), ['first','second']);
  assert.equal(restored.first.actuals['bench:0'].kg,62.5);
  assert.equal(restored.second.actuals['bench:0'].kg,20);
  assert.equal(timerValue(restored.first.timer,31000),60);
  assert.equal(restored.finished,undefined);
});

test('legacy workout runtime is migrated without marking a planned duration as measured', () => {
  const actual = {kg:0,reps:0,seconds:60,rpe:8};
  const restored = readSessionRuntimes({sessionId:'legacy',timer:null,actuals:{'plank:0':actual}}, ['legacy']);
  assert.equal(restored.legacy.actuals['plank:0'].seconds,60);
  assert.equal(restored.legacy.actuals['plank:0'].durationEntered,false);
  assert.equal(measuredDuration(null,1000,'plank'),null);
});

test('a timed set accepts measured or manually entered seconds, never the target by itself', () => {
  const prep = beginExerciseTimer(60,5,1000,'plank');
  const running = finishPreparation(prep);
  assert.equal(measuredDuration(prep,4000,'plank',20),null);
  assert.equal(measuredDuration(running,6000,'plank'),null);
  assert.equal(measuredDuration(running,26000,'plank'),20);
  assert.equal(measuredDuration(running,26000,'other'),null);
  assert.equal(measuredDuration(null,26000,'plank',27),27);
  assert.equal(measuredDuration(null,26000,'plank',0),null);
  const stopwatch=beginExerciseTimer(0,0,1000,'plank',true);
  assert.equal(measuredDuration({...stopwatch,paused:12},99999,'plank'),12);
});
