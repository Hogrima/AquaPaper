import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AquariumSimulation, DEFAULTS, normalizeSettings, seededRandom } from '../web/simulation.js';

const make = (settings = DEFAULTS) => new AquariumSimulation(16 / 9, settings, seededRandom(42));

test('cursor proximity changes velocity away from the pointer on the very next frame', () => {
  const baseline = make(), scared = make();
  const f = scared.fish[0];
  scared.setCursor(f.x - .02, f.y, true);
  baseline.step(1 / 60); scared.step(1 / 60);
  assert.ok(scared.fish[0].vx > baseline.fish[0].vx + .015);
  assert.ok(scared.fish[0].panic > .5);
});

test('a fish exactly under the pointer remains finite and escapes', () => {
  const sim = make(); const f = sim.fish[0]; sim.setCursor(f.x, f.y);
  sim.step(1 / 60);
  assert.ok(Number.isFinite(f.vx) && Number.isFinite(f.vy)); assert.ok(f.panic > .95);
});

test('turning off cursor interaction produces identical swimming to no cursor', () => {
  const a = make({ ...DEFAULTS, interaction: false }), b = make({ ...DEFAULTS, interaction: false });
  a.setCursor(a.fish[0].x, a.fish[0].y, true, 4);
  for (let i = 0; i < 60; i++) { a.step(1 / 60); b.step(1 / 60); }
  assert.deepEqual(a.fish, b.fish);
});

test('panic fades and school resumes calm swimming after the pointer leaves', () => {
  const sim = make(); sim.setCursor(sim.fish[0].x, sim.fish[0].y); sim.step(1 / 60);
  sim.cursor.active = false;
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  assert.ok(sim.fish[0].panic < .001);
  assert.ok(Math.hypot(sim.fish[0].vx, sim.fish[0].vy) < .065);
});

test('maximum population stays finite and inside the aquarium under repeated resize and moving cursor', () => {
  const sim = make({ ...DEFAULTS, count: 160, activity: 130 });
  for (let i = 0; i < 2400; i++) {
    if (i % 400 === 0) sim.resize(i % 800 === 0 ? .65 : 2.4);
    sim.setCursor(sim.aspect * (.5 + .45 * Math.sin(i * .031)), .5 + .4 * Math.cos(i * .019), true, 2);
    sim.step(1 / 30);
    for (const f of sim.fish) { assert.ok(Number.isFinite(f.x + f.y + f.vx + f.vy + f.angle)); assert.ok(f.x >= .018 && f.x <= sim.aspect - .018 + 1e-8 && f.y >= .055 && f.y <= .86); }
  }
});

test('population changes preserve existing fish, and corrupted settings recover safely', () => {
  const sim = make(); const original = sim.fish[0]; sim.setCount(160); assert.equal(sim.fish.length, 160); assert.equal(sim.fish[0], original);
  sim.setCount(12); assert.equal(sim.fish.length, 12); assert.equal(sim.fish[0], original);
  const fixed = normalizeSettings({ count: Infinity, activity: -10, lighting: 'invalid', quality: 'ultra', interaction: 'false' });
  assert.equal(fixed.count, 72); assert.equal(fixed.activity, 30); assert.equal(fixed.lighting, 'day'); assert.equal(fixed.quality, 'balanced'); assert.equal(fixed.interaction, true); assert.equal(fixed.fishMode, 'tetra3d'); assert.equal(fixed.language, 'ko');
  assert.deepEqual(normalizeSettings(null), DEFAULTS);
});

test('suspended-frame time gaps cannot launch fish through the walls', () => {
  const sim = make(); const f = sim.fish[0], x = f.x, y = f.y;
  sim.step(100000); assert.ok(Math.hypot(f.x - x, f.y - y) < .02);
  sim.step(NaN); assert.ok(Number.isFinite(sim.time));
});
