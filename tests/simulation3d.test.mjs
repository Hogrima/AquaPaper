import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TetraSimulation, projectFish, TANK_DEPTH } from '../web/simulation3d.js';
import { DEFAULTS, normalizeSettings, seededRandom } from '../web/simulation.js';
const make = (extra={}) => new TetraSimulation(16/9,{...DEFAULTS,fishMode:'tetra3d',...extra},seededRandom(543));
const advance = (sim,seconds) => {for(let i=0;i<seconds*60;i++)sim.step(1/60);};

test('missing settings use the 3D default and explicit choices round-trip',()=>{
  assert.equal(normalizeSettings({count:40}).fishMode,'tetra3d');
  assert.equal(normalizeSettings({fishMode:'unknown'}).fishMode,'tetra3d');
  assert.equal(normalizeSettings(JSON.parse(JSON.stringify(make().settings))).fishMode,'tetra3d');
});
test('3D neighbors have changing depth, independent thrust phases and bounded turns',()=>{
  const sim=make(); const z=sim.fish.map(f=>f.z), yaws=sim.fish.map(f=>f.yaw);
  sim.step(1/60);
  assert.ok(sim.fish.some(f=>f.thrust)&&sim.fish.some(f=>!f.thrust));
  for(let i=0;i<sim.fish.length;i++)assert.ok(Math.abs(sim.fish[i].yaw-yaws[i])<=1.65/60+1e-6);
  advance(sim,3);
  assert.ok(sim.fish.filter((f,i)=>Math.abs(f.z-z[i])>.025).length>12);
});
test('thrust increases speed and coasting decreases it without freezing the fish',()=>{
  const sim=make(), f=sim.fish[0]; f.burst=0;f.cycle=.8;f.burstDuration=.2;
  f.vx=.05;f.vy=0;f.vz=0;f.yaw=0;
  sim.step(1/60);const burstSpeed=Math.hypot(f.vx,f.vy,f.vz);
  assert.ok(burstSpeed>.05);f.burst=.35;
  sim.step(1/60);const coastSpeed=Math.hypot(f.vx,f.vy,f.vz);
  assert.ok(coastSpeed<burstSpeed&&coastSpeed>0);
});
test('cursor targeting uses projected depth and starts an immediate escape and dive',()=>{
  const a=make(),b=make(),f=a.fish[0];f.z=.25;b.fish[0].z=.25;
  const p=projectFish(f,a.aspect);a.setCursor(p.x-.015,p.y,true,2);
  a.step(1/60);b.step(1/60);
  assert.ok(a.fish[0].panic>.7);assert.ok(a.fish[0].vz<b.fish[0].vz);
  assert.ok(Math.hypot(a.fish[0].vx,a.fish[0].vy,a.fish[0].vz)>Math.hypot(b.fish[0].vx,b.fish[0].vy,b.fish[0].vz));
});
test('disabling cursor interaction leaves the seeded 3D school unchanged',()=>{
  const a=make({interaction:false}),b=make({interaction:false});a.setCursor(.8,.4,true,4);
  advance(a,2);advance(b,2);assert.deepEqual(a.fish,b.fish);
});
test('alarm dies away after disturbance and fish recover local companionship',()=>{
  const sim=make({count:24});const p=projectFish(sim.fish[0],sim.aspect);sim.setCursor(p.x,p.y,true,3);
  advance(sim,.5);sim.cursor.active=false;advance(sim,35);
  assert.ok(sim.fish.every(f=>f.panic<.005));
  const social=sim.fish.filter(f=>sim.fish.some(o=>o!==f&&Math.hypot(f.x-o.x,f.y-o.y,f.z-o.z)<.36));
  assert.ok(social.length>=sim.fish.length*.9);
});
test('close fish steer apart even behind one another',()=>{
  const sim=make({count:12}),a=sim.fish[0],b=sim.fish[1];
  Object.assign(a,{x:.8,y:.45,z:0,vx:.05,vy:0,vz:0,yaw:0,pitch:0,burst:0});
  Object.assign(b,{x:.8,y:.453,z:.002,vx:.05,vy:0,vz:0,yaw:0,pitch:0,burst:0});
  sim.step(1/60);assert.ok(a.vy<b.vy);assert.ok(a.vz<b.vz);
});
test('160 fish stay finite and inside the volume through moving threats and mixed layouts',()=>{
  const sim=make({count:160,activity:130});
  for(let i=0;i<2400;i++){
    if(i%300===0)sim.resize([.65,16/9,16/3,1][Math.floor(i/300)%4]);
    sim.setCursor(sim.aspect*(.5+.45*Math.sin(i*.017)),.45+.3*Math.cos(i*.023),true,3);
    sim.step(1/30);
    for(const f of sim.fish){
      assert.ok(Number.isFinite(f.x+f.y+f.z+f.vx+f.vy+f.vz+f.yaw+f.pitch+f.phase));
      assert.ok(f.x>=.04&&f.x<=sim.aspect-.04&&f.y>=.085&&f.y<=.85&&Math.abs(f.z)<=TANK_DEPTH);
    }
  }
});
test('invalid deltas and count updates preserve existing fish and bounded time',()=>{
  const sim=make(),f=sim.fish[0];sim.setCount(160);assert.equal(sim.fish[0],f);sim.setCount(12);assert.equal(sim.fish.length,12);
  sim.step(NaN);sim.step(-1);assert.equal(sim.time,0);sim.step(1000);assert.ok(sim.time<=.040001);
});
test('Blender runtime mesh has real depth, unit normals, both eyes and valid opaque/fin ranges',()=>{
  const url=new URL('../web/assets/neon-tetra/',import.meta.url);
  const meta=JSON.parse(readFileSync(new URL('neon-tetra.mesh.json',url)));
  const data=readFileSync(new URL('neon-tetra.mesh.bin',url));
  assert.equal(data.length,(meta.opaqueVertices+meta.finVertices)*meta.stride*4);
  const floats=new Float32Array(data.buffer,data.byteOffset,data.length/4);let minZ=Infinity,maxZ=-Infinity,eyes=0;
  for(let i=0;i<floats.length;i+=11){
    for(let k=0;k<11;k++)assert.ok(Number.isFinite(floats[i+k]));
    assert.ok(Math.abs(Math.hypot(floats[i+3],floats[i+4],floats[i+5])-1)<.002);
    minZ=Math.min(minZ,floats[i+2]);maxZ=Math.max(maxZ,floats[i+2]);
    if(floats[i+10]===2)eyes++;
    assert.equal(floats[i+10]===1,i/11>=meta.opaqueVertices);
  }
  assert.ok(maxZ-minZ>.4&&eyes>500);
  const glb=readFileSync(new URL('neon-tetra.glb',url));assert.equal(glb.subarray(0,4).toString(),'glTF');assert.equal(glb.readUInt32LE(4),2);
  const lod=readFileSync(new URL('neon-tetra.lod.bin',url));
  assert.equal(lod.length,(meta.lod.opaqueVertices+meta.lod.finVertices)*44);
  assert.ok(lod.length<data.length*.5);
  const low=new Float32Array(lod.buffer,lod.byteOffset,lod.length/4);
  for(let i=0;i<low.length;i+=11){
    for(let k=0;k<11;k++)assert.ok(Number.isFinite(low[i+k]));
    assert.ok(Math.abs(Math.hypot(low[i+3],low[i+4],low[i+5])-1)<.002);
    assert.equal(low[i+10]===1,i/11>=meta.lod.opaqueVertices);
  }
});
