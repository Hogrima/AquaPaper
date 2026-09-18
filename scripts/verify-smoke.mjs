import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const report = JSON.parse(await readFile(process.argv[2] || new URL('../artifacts/smoke-test.json', import.meta.url), 'utf8'));
for (const key of ['preview', 'pausedAt', 'pausedLater', 'wallpaper', 'restored']) {
  assert.ok(report[key]?.ready, `${key} did not initialize`);
  assert.deepEqual(report[key].errors, [], `${key} reported JavaScript errors`);
  assert.equal(report[key].webglError, 0, `${key} reported a WebGL error`);
  assert.ok(report[key].fish >= 12 && report[key].fish <= 160);
}
assert.ok(report.desktopAttached, 'Wallpaper did not attach to the native desktop parent');
assert.equal(report.pausedAt.time, report.pausedLater.time, 'Simulation continued while paused');
assert.ok(report.restored.time > report.pausedLater.time, 'Preview did not resume after wallpaper teardown');
for (const key of ['preview', 'wallpaper']) {
  const limit = report[key].settings.quality === 'eco' ? 30 : 60;
  assert.ok(report[key].fps > 0 && report[key].fps <= limit + 1, `${key} FPS exceeds the configured limit: ${report[key].fps}`);
}
console.log(`Native integration passed: ${report.preview.fps} FPS preview / ${report.wallpaper.fps} FPS wallpaper, desktop attach/detach, pause/resume, zero WebGL errors.`);
assert.ok(report.cleanedUp, 'Wallpaper windows leaked after stop');
for (const c of report.cases || []) {
  const expected = c.mode === 'separate' ? report.monitors.length : 1;
  assert.equal(c.views.length, expected, `${c.mode}: wrong window count`);
  for (const v of c.views) {
    assert.ok(v.attached, `${c.mode}: window was not parented to desktop`);
    assert.deepEqual(v.actual, v.target, `${c.mode}: DPI/position mismatch for ${v.key}`);
    assert.ok(v.diagnostics.ready, `${c.mode}: renderer is not ready`);
    assert.equal(v.diagnostics.webglError, 0);
    assert.deepEqual(v.diagnostics.errors, []);
    assert.ok(v.diagnostics.fps > 0 && v.diagnostics.fps <= 61, `${c.mode}: unexpected frame rate`);
    const activeSamples = v.cursorSamples.filter(s => s.active);
    assert.equal(activeSamples.length, c.mode === 'span' ? report.monitors.length : 1, `${c.mode}: incorrect cursor routing`);
    for (const sample of activeSamples) assert.ok(sample.x >= 0 && sample.x <= 1 && sample.y >= 0 && sample.y <= 1);
    if (c.mode === 'span') {
      assert.equal(v.diagnostics.monitorCount, report.monitors.length);
      if (v.target.width === 5760 && v.target.height === 1080 && v.diagnostics.settings.quality === 'balanced') {
        assert.equal(v.diagnostics.width, 5760, 'Three-screen 1080p panorama was downscaled unexpectedly');
      }
    }
  }
  if (c.pausedAt) assert.deepEqual(c.pausedAt, c.pausedLater, `${c.mode}: not every screen paused`);
  console.log(`${c.mode}: ${c.views.length} view(s), physical bounds, cursor routing, rendering and pause verified.`);
}
