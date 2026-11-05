import test from 'node:test';
import assert from 'node:assert/strict';
import {swipeAxis,swipeDestination} from '../src/lib/swipe.ts';

test('a tap or vertical page scroll does not begin a swipe action',()=>{
  assert.equal(swipeAxis(3,4),null);
  assert.equal(swipeAxis(-4,24),'y');
  assert.equal(swipeAxis(-22,20),'y');
  assert.equal(swipeAxis(-35,3),'x');
});
test('short drags close and deliberate swipes reveal actions',()=>{
  assert.equal(swipeDestination(-15,152,360,false),'closed');
  assert.equal(swipeDestination(-90,152,360,false),'open');
  assert.equal(swipeDestination(10,152,360,false),'closed');
  assert.equal(swipeDestination(-76,76,320,false),'open');
});
test('a full swipe only requests deletion when explicitly allowed, including last-set protection',()=>{
  assert.equal(swipeDestination(-290,152,360,true),'delete');
  assert.equal(swipeDestination(-240,152,360,true),'open');
  assert.equal(swipeDestination(-290,152,360,false),'open');
  assert.equal(swipeDestination(-100,152,100,true),'open');
});
