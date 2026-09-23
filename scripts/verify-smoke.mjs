import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const report = JSON.parse(await readFile(process.argv[2] || new URL('../artifacts/smoke-test.json', import.meta.url), 'utf8'));
const is3D = report.preview.settings.fishMode === 'tetra3d';
for(const d of report.environmentCases || []) {
  assert.equal(d.webglError,0);assert.deepEqual(d.errors,[]);
  assert.equal(d.environment.layers,d.settings.background==='coral'?10:d.settings.background==='layered'?6:1);
  assert.equal(d.environment.loadedImages,6);
  assert.equal(d.environment.loadedCoralImages,10);
  assert.equal(d.environment.coralError,null);
  assert.equal(d.environment.backgroundError,null);
  assert.equal(d.environment.waterSurface,d.settings.waterSurface);
  if(d.settings.particles){assert.ok(d.environment.particles.dust>=100);assert.ok(d.environment.particles.bubbles>=18);}
  else assert.equal(d.environment.particles.total,0);
  if(!d.settings.parallax)assert.deepEqual(d.environment.orbit,[0,0]);
  else assert.ok(Math.hypot(...d.environment.orbit)>0);
}
if(report.depthFrames?.length){
  assert.deepEqual(report.depthFrames.map(f=>f.time),[0,37.5,75,112.5,75.5,76]);
  for(const f of report.depthFrames){
    assert.equal(f.diagnostics.webglError,0);assert.deepEqual(f.diagnostics.errors,[]);
    assert.equal(f.diagnostics.environment.loadedImages,6);
    assert.equal(f.diagnostics.environment.loadedCoralImages,10);
  }
}
for(const d of report.backgroundCases||[]){
  assert.equal(d.environment.layers,d.settings.background==='coral'?10:d.settings.background==='layered'?6:1);
  assert.equal(d.environment.loadedImages,6);assert.equal(d.environment.loadedCoralImages,10);assert.equal(d.environment.backgroundError,null);assert.equal(d.environment.coralError,null);
  assert.equal(d.webglError,0);assert.deepEqual(d.errors,[]);
}
function verify3D(d, label) {
  assert.equal(d.settings.fishMode, 'tetra3d', `${label}: 3D mode fell back unexpectedly`);
  if (d.tetra.population) {
    const expectedPlecos = d.settings.background==='coral'?0:(d.plecoAllocation ?? d.settings.plecoCount ?? 0);
    assert.equal(d.tetra.population.pleco || 0, expectedPlecos, `${label}: pleco allocation mismatch`);
    assert.ok(expectedPlecos <= 8);
    assert.equal(d.fish, d.settings.count + expectedPlecos);
    for (const p of d.tetra.plecos || []) {
      assert.ok(p.centimeters >= 20 && p.centimeters <= 28);
      assert.ok(Number.isFinite(p.x+p.y+p.z));
      assert.ok(Math.abs(Math.hypot(...p.orientation)-1)<1e-5);
    }
    if(d.settings.background==='coral'){
      for(const species of ['clown','yellow-tang','blue-tang','moorish-idol','dwarf-hawkfish'])assert.ok(d.tetra.population[species]>=1,`${label}: missing ${species}`);
      assert.equal(['clown','yellow-tang','blue-tang','moorish-idol','dwarf-hawkfish'].reduce((n,s)=>n+d.tetra.population[s],0),d.settings.count);
      assert.equal(d.tetra.population.neon||0,0);assert.equal(d.tetra.population.rummy||0,0);
    } else {
      assert.equal(d.tetra.population.rummy || 0, d.settings.rummyCount || 0, `${label}: rummy school count mismatch`);
      assert.equal(d.tetra.population.neon || 0, d.settings.count - (d.settings.rummyCount || 0), `${label}: neon school count mismatch`);
    }
  }
  assert.ok(d.tetra.ready && !d.tetra.error && d.tetra.vertices > 1000, `${label}: missing Blender mesh`);
  assert.ok(d.tetra.depthRange[1] - d.tetra.depthRange[0] > .01, `${label}: fish have no depth distribution`);
  for (const f of d.tetra.sample) assert.ok(Object.values(f).every(Number.isFinite), `${label}: invalid 3D pose`);
}
for (const key of ['preview', 'pausedAt', 'pausedLater', 'wallpaper', 'restored']) {
  assert.ok(report[key]?.ready, `${key} did not initialize`);
  assert.deepEqual(report[key].errors, [], `${key} reported JavaScript errors`);
  assert.equal(report[key].webglError, 0, `${key} reported a WebGL error`);
  assert.ok(report[key].fish >= 12 && report[key].fish <= 168);
  if (is3D) verify3D(report[key], key);
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
if (is3D) {
  assert.equal(report.modeSwitch.classic.settings.fishMode, 'classic');
  assert.equal(report.modeSwitch.classic.webglError, 0);
  assert.deepEqual(report.modeSwitch.classic.errors, []);
  verify3D(report.modeSwitch.back, 'switch back');
  assert.ok(report.modeSwitch.escaped.tetra.sample[0].panic > .1, 'Projected cursor did not start 3D escape');
  if (report.qualityCases?.length) {
    assert.equal(report.qualityCases.length, 2);
    for (const d of report.qualityCases) {
      verify3D(d, d.settings.quality);
      assert.equal(d.settings.count, 160);
      assert.equal(d.webglError, 0);
      assert.deepEqual(d.errors, []);
      assert.ok(d.fps > 0 && d.fps <= (d.settings.quality === 'eco' ? 31 : 61));
    }
    assert.ok(report.qualityCases[0].tetra.vertices > report.qualityCases[1].tetra.vertices * 2, 'LOD did not reduce mesh complexity');
  }
  console.log('3D: Blender mesh, depth, classic/3D switching and native projected cursor escape verified.');
}
for (const c of report.cases || []) {
  const expected = c.mode === 'separate' ? report.monitors.length : 1;
  assert.equal(c.views.length, expected, `${c.mode}: wrong window count`);
  for (const v of c.views) {
    assert.ok(v.attached, `${c.mode}: window was not parented to desktop`);
    assert.deepEqual(v.actual, v.target, `${c.mode}: DPI/position mismatch for ${v.key}`);
    assert.ok(v.diagnostics.ready, `${c.mode}: renderer is not ready`);
    assert.equal(v.diagnostics.webglError, 0);
    assert.deepEqual(v.diagnostics.errors, []);
    if (is3D) verify3D(v.diagnostics, c.mode);
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

for (const c of report.cases || []) {
  const total=c.views.reduce((sum,v)=>sum+(v.diagnostics.tetra.population?.pleco||0),0);
  assert.ok(total<=8, `Global pleco limit exceeded in ${c.mode}`);
  assert.equal(total,c.views[0].diagnostics.settings.plecoCount||0, `Pleco population lost in ${c.mode}`);
}
