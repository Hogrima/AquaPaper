import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeSettings, seededRandom } from '../web/simulation.js';
import { PlecoColony, clampPlecos, surfaceQuaternion } from '../web/pleco.js';
import { TetraSimulation } from '../web/simulation3d.js';
const inactive={active:false,x:-10,y:-10,speed:0};
const make=(settings={})=>{const options=normalizeSettings({plecoCount:8,...settings});return new PlecoColony(16/9,options,seededRandom(932));};
const advance=(sim,seconds,cursor=inactive)=>{for(let i=0;i<seconds*60;i++)sim.step(1/60,sim.settings,cursor);};

test('pleco settings are opt-in, bounded to eight and independent of schooling counts',()=>{
  assert.equal(normalizeSettings({count:72,rummyCount:24}).plecoCount,0);
  for(const value of [-100,0,1,8,99,1e30,NaN,Infinity,'8',null]) {
    const settings=normalizeSettings({count:72,rummyCount:24,plecoCount:value});
    assert.ok(settings.plecoCount>=0&&settings.plecoCount<=8);
    assert.equal(settings.count,72);assert.equal(settings.rummyCount,24);
    const sim=new TetraSimulation(16/9,settings,seededRandom(1));
    assert.equal(sim.plecos.length,settings.plecoCount);assert.equal(sim.fish.length,72);
  }
  assert.equal(clampPlecos(1e30),8);assert.equal(clampPlecos('8'),0);
  const mixed=normalizeSettings({plecoCount:7,count:36,rummyCount:12});
  assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(mixed))),mixed);
});

test('20–28 cm bodies use the same world scale as the neon tetras',()=>{
  const sim=make();for(const f of sim.fish){assert.ok(f.centimeters>=20&&f.centimeters<=28);assert.equal(f.length,f.centimeters/55);assert.ok(f.length/.057>6);}
  const first=sim.fish[0];sim.setCount(2);sim.setCount(8);assert.equal(sim.fish[0],first);assert.equal(new Set(sim.fish.map(f=>f.id)).size,8);
  sim.setCount(1000);assert.equal(sim.fish.length,8);sim.setCount(0);assert.equal(sim.homes.length,0);
});

test('attached rest stays fixed while respiration continues and the tail settles',()=>{
  const sim=make(),f=sim.fish[0],before=[f.x,f.y,f.z],phase=f.phase;
  advance(sim,5);assert.deepEqual([f.x,f.y,f.z],before);assert.equal(f.state,'rest');assert.ok(f.phase>phase);assert.equal(f.tail,0);
  f.state='graze';f.dwell=10;const z=f.z;advance(sim,2);assert.equal(f.z,z);assert.ok(Math.hypot(f.x-before[0],f.y-before[1])>0);
});

function rotate(q,v){const [x,y,z,w]=q;const t=[2*(y*v[2]-z*v[1]),2*(z*v[0]-x*v[2]),2*(x*v[1]-y*v[0])];return [v[0]+w*t[0]+y*t[2]-z*t[1],v[1]+w*t[1]+z*t[0]-x*t[2],v[2]+w*t[2]+x*t[1]-y*t[0]];}
test('wall orientation faces the ventral sucker into the pane even when pointing up',()=>{
  const q=surfaceQuaternion([0,1,0],[0,0,-1]);const ventral=rotate(q,[0,-1,0]);
  assert.ok(Math.hypot(ventral[0],ventral[1],ventral[2]-1)<1e-6);
  const floor=surfaceQuaternion([1,0,0],[0,1,0]);assert.ok(Math.hypot(...rotate(floor,[0,-1,0]).map((v,i)=>v-[0,-1,0][i]))<1e-6);
});

test('cursor disturbance releases adhesion and leads through the mouth into a refuge',()=>{
  const sim=make({plecoCount:1}),f=sim.fish[0],w=1-f.z/2.7;
  const cursor={active:true,speed:2,x:sim.aspect*.5+(f.x-sim.aspect*.5)/w,y:.5+(f.y-.5)/w};
  sim.step(1/60,sim.settings,cursor);assert.equal(f.state,'flee');assert.equal(f.path.length,2);
  assert.equal(f.path[0].surface,'free');assert.equal(f.path[1].surface,'cave');
  let arrived=false;for(let i=0;i<60*40;i++){sim.step(1/60,sim.settings,inactive);if(f.state==='hide'){arrived=true;break;}}
  assert.ok(arrived);assert.equal(f.surface,'cave');assert.equal(f.x,sim.homes[0].x);assert.ok(f.cover>.9);
  const pos=[f.x,f.y,f.z];advance(sim,4);assert.deepEqual([f.x,f.y,f.z],pos);
});

test('interaction off suppresses cursor escape and night increases movement over a long sample',()=>{
  const a=make({interaction:false}),b=make({interaction:false});
  advance(a,2,{active:true,x:.5,y:.5,speed:4});advance(b,2);assert.deepEqual(a.fish,b.fish);
  const day=make(),night=make({lighting:'night'});let activeDay=0,activeNight=0;
  for(let i=0;i<60*480;i++){
    for(const sim of [day,night])sim.step(1/60,sim.settings,inactive);
    if(i%60===0){activeDay+=day.fish.filter(f=>['travel','flee','graze'].includes(f.state)).length;activeNight+=night.fish.filter(f=>['travel','flee','graze'].includes(f.state)).length;}
  }
  assert.ok(activeNight>activeDay*1.1,`day ${activeDay}, night ${activeNight}`);
});

test('hidden homes, unit orientations and finite motion survive mixed-aspect monitor changes',()=>{
  const sim=make();for(let i=0;i<1800;i++){
    if(i%180===0)sim.resize([.65,16/9,16/3][Math.floor(i/180)%3]);
    sim.step(1/30,sim.settings,{active:true,speed:2,x:sim.aspect*(.5+.3*Math.sin(i*.1)),y:.6});
    for(const f of sim.fish){assert.ok(Number.isFinite(f.x+f.y+f.z+f.tail));assert.ok(Math.abs(Math.hypot(...f.orientation)-1)<1e-6);assert.ok(f.x>=0&&f.x<=sim.aspect);}
  }
});

test('Blender pleco and shelter files contain valid geometry, fins, ventral mouth and LOD',()=>{
  for(const slug of ['pleco','shelter']){
    const root=new URL('../web/assets/pleco/',import.meta.url),meta=JSON.parse(readFileSync(new URL(`${slug}.mesh.json`,root)));
    assert.match(meta.generator,/Blender/);const body=readFileSync(new URL(meta.binary,root));
    assert.equal(body.length,(meta.opaqueVertices+meta.finVertices)*44);
    let mouth=0,eyes=0;for(let i=0;i<body.length;i+=44){const v=Array.from({length:11},(_,j)=>body.readFloatLE(i+j*4));assert.ok(v.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...v.slice(3,6))-1)<.01);if(v[10]===3&&v[1]<0)mouth++;if(v[10]===2)eyes++;}
    if(slug==='pleco'){assert.ok(mouth>100&&eyes>100);assert.ok(meta.finVertices>1000);}
    assert.ok(meta.lod.opaqueVertices<meta.opaqueVertices);
    assert.equal(readFileSync(new URL(meta.lod.binary,root)).length,(meta.lod.opaqueVertices+meta.lod.finVertices)*44);
  }
});
