import test from 'node:test';
import assert from 'node:assert/strict';
import {unlockTimerAudio,playTimerAlarm} from '../src/lib/timer-audio.ts';
test('alarm is silent until audio is unlocked and schedules a short signal after interaction', async()=>{
 let starts=0;let resumes=0;
 class FakeContext {
  state='suspended';currentTime=10;destination={};
  resume(){resumes++;this.state='running';return Promise.resolve();}
  createOscillator(){return {frequency:{value:0},connect(){},start(){starts++;},stop(){},disconnect(){},onended:null};}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
 }
 globalThis.AudioContext=FakeContext;
 playTimerAlarm();assert.equal(starts,0);
 unlockTimerAudio();await Promise.resolve();playTimerAlarm();assert.equal(resumes,1);assert.equal(starts,3);
 unlockTimerAudio();assert.equal(resumes,1);
});
