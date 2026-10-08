import test from 'node:test';
import assert from 'node:assert/strict';
import {unlockTimerAudio,playTimerAlarm} from '../src/lib/timer-audio.ts';
test('alarm is silent until audio is unlocked and schedules a short signal after interaction', async()=>{
 let starts=0;let resumes=0;const levels=[];
 class FakeContext {
  state='suspended';currentTime=10;destination={};
  resume(){resumes++;this.state='running';return Promise.resolve();}
  createOscillator(){return {frequency:{value:0},connect(){},start(){starts++;},stop(){},disconnect(){},onended:null};}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(value){levels.push(value);},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
 }
 globalThis.AudioContext=FakeContext;
 playTimerAlarm();assert.equal(starts,0);
 unlockTimerAudio();await Promise.resolve();playTimerAlarm();assert.equal(resumes,1);assert.equal(starts,3);
 unlockTimerAudio();assert.equal(resumes,1);
 assert.ok(Math.abs(levels[0]-0.64)<1e-10);
 playTimerAlarm(0);assert.equal(starts,3);
 playTimerAlarm(25);assert.deepEqual(levels.slice(-3),[0.2,0.2,0.2]);
 playTimerAlarm(200);assert.deepEqual(levels.slice(-3),[0.8,0.8,0.8]);
 playTimerAlarm(-10);assert.equal(starts,9);
});
