import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monitorMap, renderResolution } from '../web/display.js';

test('monitor map preserves negative origins, vertical offsets and gaps', () => {
  const m = monitorMap([{x:0,y:0,width:1920,height:1080}, {x:-1920,y:-200,width:1920,height:1080}, {x:1920,y:0,width:2560,height:1440}]);
  assert.equal(m.boxes[1].left, 0); assert.equal(m.boxes[1].top, 0);
  assert.equal(m.boxes[0].left, 30); assert.ok(m.boxes[0].top > 0);
  assert.equal(m.boxes[2].left + m.boxes[2].mapWidth, 100);
  assert.equal(m.boxes[2].top + m.boxes[2].mapHeight, 100);
});
test('single-screen rendering preserves the previous resolution cap', () => {
  assert.equal(renderResolution(3840,2160,1,'balanced').width,1920);
  assert.equal(renderResolution(3840,2160,1,'eco').width,1280);
});
test('three-screen span preserves 1080p detail across all screens', () => {
  const r = renderResolution(5760,1080,1,'balanced',3);
  assert.equal(r.width,5760); assert.equal(r.height,1080);
  const scaled = renderResolution(4608,864,1.25,'balanced',3);
  assert.equal(scaled.width,5760); assert.equal(scaled.height,1080);
});
test('large and vertically stacked layouts stay within GPU dimensions and pixel budget', () => {
  for (const [w,h] of [[16000,6000],[2160,11520],[40000,2160]]) {
    const r = renderResolution(w,h,2,'high',3,8192);
    assert.ok(r.width <= 8192 && r.height <= 8192);
    assert.ok(r.width*r.height <= 2560*2560*3);
    assert.ok(Math.abs(r.height-r.width*h/w)<=1, 'Aspect error stays within one rounded pixel');
  }
});
