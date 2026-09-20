import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { population, changeSpecies, resizePopulation } from '../web/population.js';
import { normalizeSettings, seededRandom } from '../web/simulation.js';
import { TetraSimulation } from '../web/simulation3d.js';

test('old saves migrate without adding fish; mixed and single-species saves round-trip', () => {
  const old = normalizeSettings({ count: 72, language: 'en', lighting: 'night' });
  assert.deepEqual(population(old), { neon: 72, rummy: 0 });
  const mixed = changeSpecies(old, 'rummy', 12);
  assert.deepEqual(population(normalizeSettings(JSON.parse(JSON.stringify(mixed)))), { neon: 72, rummy: 12 });
  const rummyOnly = changeSpecies(mixed, 'neon', 0);
  assert.deepEqual(population(rummyOnly), { neon: 0, rummy: 12 });
  assert.deepEqual(population(resizePopulation(rummyOnly, 160)), { neon: 0, rummy: 160 });
  assert.equal(mixed.language, 'en'); assert.equal(mixed.lighting, 'night');
});

test('population limits hold through arbitrary add, remove, resize and corrupt settings', () => {
  const random = seededRandom(83); let settings = normalizeSettings();
  for (let i = 0; i < 1500; i++) {
    settings = normalizeSettings(i % 3 ? changeSpecies(settings, i % 2 ? 'neon' : 'rummy', Math.round(random() * 200 - 10)) : resizePopulation(settings, Math.round(random() * 200)));
    const counts = population(settings);
    assert.equal(counts.neon + counts.rummy, settings.count);
    assert.ok(settings.count >= 12 && settings.count <= 160);
    for (const count of Object.values(counts)) assert.ok(count === 0 || count >= 6);
  }
  assert.equal(normalizeSettings({ rummyCount: Infinity }).rummyCount, 0);
  assert.equal(normalizeSettings({ rummyCount: '24' }).rummyCount, 0);
});

test('adding/removing a school preserves surviving individuals and unique IDs', () => {
  const sim = new TetraSimulation(16/9, { count: 24 }, seededRandom(1)), original = [...sim.fish];
  sim.settings = changeSpecies(sim.settings, 'rummy', 12); sim.setCount(sim.settings.count);
  assert.deepEqual(sim.fish.slice(0,24), original);
  const rummy = sim.fish.filter(f => f.species === 'rummy');
  sim.settings = changeSpecies(sim.settings, 'neon', 0); sim.setCount(sim.settings.count);
  assert.deepEqual(sim.fish, rummy);
  sim.settings = changeSpecies(sim.settings, 'neon', 12); sim.setCount(sim.settings.count);
  assert.equal(new Set(sim.fish.map(f=>f.id)).size,24);
});

test('social steering follows conspecifics, while collision avoidance includes both species', () => {
  const make = () => new TetraSimulation(2,{count:12,rummyCount:6},seededRandom(3));
  const a=make(), b=make();
  for (const sim of [a,b]) for (const [i,f] of sim.fish.entries()) Object.assign(f,{x:f.species==='neon'?.5:1.5,y:.45+i*.006,z:0,vx:.05,vy:0,vz:0,burst:0});
  for (const f of b.fish) if(f.species==='rummy') f.vx=-.08;
  a.step(1/60); b.step(1/60);
  assert.deepEqual(a.fish.filter(f=>f.species==='neon'),b.fish.filter(f=>f.species==='neon'));
  const f=a.fish[0], other=a.fish[6];
  Object.assign(other,{x:f.x,y:f.y+.001,z:f.z});
  a.step(1/60);assert.ok(a.forces[1]<b.forces[1]);
});

test('mixed 160-fish schools remain finite through threats and monitor resizes', () => {
  const sim=new TetraSimulation(16/9,{count:160,rummyCount:80,activity:130},seededRandom(12));
  for(let i=0;i<1200;i++) {
    if(i%200===0)sim.resize([.65,16/9,16/3][Math.floor(i/200)%3]);
    sim.setCursor(sim.aspect*(.5+.4*Math.sin(i*.03)),.5,true,2);sim.step(1/30);
    for(const f of sim.fish) assert.ok(Number.isFinite(f.x+f.y+f.z+f.yaw+f.pitch)&&Math.abs(f.z)<=.34);
  }
  assert.equal(sim.fish.filter(f=>f.species==='rummy').length,80);
});

test('Blender rummy-nose mesh has depth, red head, silver body, patterned tail and valid LOD', () => {
  const root=new URL('../web/assets/rummy-nose/',import.meta.url);
  const meta=JSON.parse(readFileSync(new URL('rummy-nose.mesh.json',root)));
  assert.equal(meta.species,'Petitella bleheri');assert.match(meta.generator,/Blender/);
  for(const [range,file] of [[meta,meta.binary],[meta.lod,meta.lod.binary]]) {
    const bytes=readFileSync(new URL(file,root));assert.equal(bytes.length,(range.opaqueVertices+range.finVertices)*44);
    let red=0,silver=0,darkTail=0,paleTail=0;const depths=[];
    for(let i=0;i<bytes.length;i+=44) {
      const v=Array.from({length:11},(_,j)=>bytes.readFloatLE(i+j*4));assert.ok(v.every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...v.slice(3,6))-1)<.01); depths.push(v[2]);
      if(v[0]>.45&&v[6]>v[7]*4)red++;
      if(v[0]<0&&v[0]>-.5&&v[6]>.2&&Math.abs(v[6]-v[7])<.15)silver++;
      if(v[0]<-.9&&v[10]===1) { if(v[6]<.02)darkTail++;if(v[6]>.5)paleTail++; }
    }
    assert.ok(red>100&&silver>100&&darkTail>20&&paleTail>20);
    assert.ok(Math.max(...depths)-Math.min(...depths)>.2);
  }
});
