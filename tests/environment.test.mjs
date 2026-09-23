import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraOrbit, ORBIT_PERIOD, SCENE_LAYERS, projectPoint, particleCounts } from '../web/scene.js';
import { normalizeSettings, seededRandom } from '../web/simulation.js';
import { TetraSimulation } from '../web/simulation3d.js';

test('six depth regions orbit continuously, without a seam or resolution-dependent motion',()=>{
  assert.equal(SCENE_LAYERS.length,6);
  for(let i=1;i<6;i++)assert.ok(SCENE_LAYERS[i].parallax>SCENE_LAYERS[i-1].parallax);
  for(let t=0;t<ORBIT_PERIOD*2;t+=.1){
    const a=cameraOrbit(t),b=cameraOrbit(t+1/60);
    assert.ok(Math.abs(Math.hypot(a[0],a[1]+.008)-.008)<1e-10);
    assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<.000006);
  }
  assert.ok(Math.hypot(...cameraOrbit(ORBIT_PERIOD))<1e-10);
  assert.deepEqual(cameraOrbit(47,false),[0,0]);
});
test('old saves enable atmosphere, explicit off choices survive JSON round-trip',()=>{
  const old=normalizeSettings({count:72});assert.ok(old.parallax&&old.waterSurface&&old.particles);
  const saved=normalizeSettings(JSON.parse(JSON.stringify({...old,parallax:false,waterSurface:false,particles:false})));
  assert.equal(saved.parallax,false);assert.equal(saved.waterSurface,false);assert.equal(saved.particles,false);
});
test('particle budget preserves density on three displays without exceeding the GPU buffer',()=>{
  for(const quality of ['eco','balanced','high'])for(const aspect of [.65,16/9,16/3,12]){
    const p=particleCounts(quality,aspect);assert.ok(p.dust>=100&&p.bubbles>=18&&p.total<=1600);
    assert.equal(p.total,p.dust+p.bubbles);
  }
  assert.equal(particleCounts('balanced',16/3).total,particleCounts('balanced',16/9).total*3);
});
test('cursor escape follows the rendered fish at the far side of the camera orbit',()=>{
  const sim=new TetraSimulation(16/3,{count:24},seededRandom(843));sim.time=ORBIT_PERIOD/2;
  const f=sim.fish[0];f.z=.31;
  const p=projectPoint(f,sim.aspect,sim.time,sim.settings.parallax);
  sim.setCursor(p.x,p.y,true,2);sim.step(1/60);assert.ok(f.panic>.9);
});
test('a glide retains momentum and travels more than one body length without another kick',()=>{
  const sim=new TetraSimulation(4,{count:12,interaction:false},seededRandom(71)),f=sim.fish[0];
  Object.assign(f,{x:2,y:.45,z:0,yaw:0,pitch:0,vx:.115,vy:0,vz:0,burst:.4,cycle:3,burstDuration:.25,cruise:.13,behavior:'school',behaviorTime:20});
  let distance=0,previous=.115;
  for(let i=0;i<60;i++){
    sim.step(1/60);const speed=Math.hypot(f.vx,f.vy,f.vz);
    assert.equal(f.thrust,false);assert.ok(speed/previous>.96);distance+=speed/60;previous=speed;
  }
  assert.ok(distance>f.length*1.3,`glide distance ${distance}, body ${f.length}`);
  assert.ok(previous>.05);
});
test('individuals choose varied behaviors and change intentions without position jumps',()=>{
  const sim=new TetraSimulation(16/9,{count:72,rummyCount:24,interaction:false},seededRandom(123));
  const seen=sim.fish.map(f=>new Set([f.behavior]));
  for(let i=0;i<60*36;i++){
    const before=sim.fish.map(f=>[f.x,f.y,f.z]);sim.step(1/60);
    for(const [j,f] of sim.fish.entries()){
      seen[j].add(f.behavior);assert.ok(Math.hypot(f.x-before[j][0],f.y-before[j][1],f.z-before[j][2])<.004);
    }
  }
  assert.ok(seen.filter(s=>s.size>1).length>40);
  assert.ok(new Set(sim.fish.map(f=>f.behavior)).size>=3);
});
