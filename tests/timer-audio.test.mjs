import test from 'node:test';
import assert from 'node:assert/strict';
import {unlockTimerAudio, playTimerAlarm, playPreparationBeep} from '../src/lib/timer-audio.ts';

test('alarm repeats, respects volume and resumes interrupted iPhone audio', async () => {
  let resumes = 0;
  const instances = [];
  const starts = [], stops = [], levels = [], oscillators = [];
  class FakeContext {
    state = 'suspended'; currentTime = 10; destination = {};
    constructor() { instances.push(this); }
    resume() { resumes++; this.state = 'running'; return Promise.resolve(); }
    createOscillator() {
      const oscillator = {frequency: {value: 0}, type: 'sine', connect() {},
        start(at) {starts.push(at);}, stop(at) {stops.push(at);}, disconnect() {}, onended: null};
      oscillators.push(oscillator); return oscillator;
    }
    createGain() {
      return {gain: {setValueAtTime() {}, linearRampToValueAtTime(value) {if (value > 0) levels.push(value);}},
        connect() {}, disconnect() {}};
    }
  }
  globalThis.AudioContext = FakeContext;
  assert.equal(await playTimerAlarm(), false);
  await unlockTimerAudio();
  assert.equal(await playTimerAlarm(), true);
  assert.equal(resumes, 1);
  assert.equal(starts.length, 9);
  assert.ok(stops.at(-1) - starts[0] > 4);
  assert.ok(oscillators.every(o => o.type === 'triangle'));
  assert.ok(Math.abs(levels[0] - 0.64) < 1e-10);
  assert.equal(await playTimerAlarm(0), false);
  assert.equal(starts.length, 9);
  await playTimerAlarm(25);
  assert.ok(levels.slice(-9).every(n => n === 0.2));
  await playTimerAlarm(200);
  assert.ok(levels.slice(-9).every(n => n === 0.8));
  await playTimerAlarm(-10); assert.equal(starts.length, 27);
  const instance = instances[0];
  instance.state = 'interrupted';
  await playTimerAlarm();
  assert.equal(resumes, 2);
  assert.equal(starts.length, 36);
  instance.state = 'interrupted';
  instance.resume = () => Promise.reject(new Error('Audio blocked'));
  assert.equal(await playTimerAlarm(), false);
  assert.equal(starts.length, 36);
  instance.resume = () => { instance.state = 'running'; return Promise.resolve(); };
  assert.equal(await playPreparationBeep(), true);
  assert.equal(starts.length, 37);
  assert.equal(oscillators.at(-1).frequency.value, 1320);
  assert.ok(stops.at(-1) - starts.at(-1) < 0.5);

  const media = [];
  class FakeAudio {
    currentTime = 0; volume = 1; blocked = false;
    constructor(src) { this.src = src; media.push(this); }
    play() { return this.blocked ? Promise.reject(new Error('Blocked')) : Promise.resolve(); }
    pause() {}
  }
  globalThis.Audio = FakeAudio;
  try {
    await unlockTimerAudio();
    assert.equal(await playTimerAlarm(75), true);
    assert.equal(media[0].src, './sounds/timer-alarm.wav');
    assert.equal(media[0].volume, 0.75);
    assert.equal(await playPreparationBeep(50), true);
    assert.equal(media[1].src, './sounds/timer-start.wav');
    assert.equal(media[1].volume, 0.5);
    assert.equal(starts.length, 37);
    media[0].blocked = true;
    assert.equal(await playTimerAlarm(), true);
    assert.equal(starts.length, 46);
  } finally { delete globalThis.Audio; }
});
