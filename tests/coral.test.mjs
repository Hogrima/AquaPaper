import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CORAL_LAYERS,layerUV} from '../web/backgrounds.js';
import {normalizeSettings,seededRandom} from '../web/simulation.js';
import {TetraSimulation,coralPopulation} from '../web/simulation3d.js';

test('reef uses ten separately authored depth planes and preserves the full orbit',()=>{
  assert.equal(CORAL_LAYERS.length,10);
  const hashes=new Set();
  for(const [i,layer] of CORAL_LAYERS.entries()){
    const png=readFileSync(new URL('../web/assets/coral-reef/'+layer.file,import.meta.url));
    assert.equal(png.readUInt32BE(16),1536);assert.equal(png.readUInt32BE(20),1024);
    assert.equal(png[25],i?6:2,'foreground must have alpha; base must be opaque');
    hashes.add(createHash('sha256').update(png).digest('hex'));
  }
  assert.equal(hashes.size,10);
  assert.ok(CORAL_LAYERS.every((layer,i)=>!i||layer.depth>CORAL_LAYERS[i-1].depth));
  for(let t=0;t<=150;t+=.5){
    const near=layerUV(.5,.5,16/9,16/9,t,CORAL_LAYERS.at(-1).depth);
    assert.ok(near.every(v=>v>.01&&v<.99));
  }
  assert.ok(Math.abs(layerUV(.5,.5,16/9,16/9,75,CORAL_LAYERS.at(-1).depth)[1]-.5)>
    Math.abs(layerUV(.5,.5,16/9,16/9,75,CORAL_LAYERS[0].depth)[1]-.5)*20);
});

test('five distinct Blender reef species provide colored 3D meshes and lean LODs',()=>{
  const hashes=new Set();
  for(const [id,label] of [['clown','Amphiprion ocellaris'],['yellow-tang','Zebrasoma flavescens'],['blue-tang','Paracanthurus hepatus'],['moorish-idol','Zanclus cornutus'],['dwarf-hawkfish','Cirrhitichthys falco']]){
    const root=new URL('../web/assets/coral-'+id+'/',import.meta.url);
    const meta=JSON.parse(readFileSync(new URL(id+'.mesh.json',root),'utf8'));
    const mesh=readFileSync(new URL(id+'.mesh.bin',root));
    const lod=readFileSync(new URL(id+'.lod.bin',root));
    const glb=readFileSync(new URL(id+'.glb',root));
    const blend=readFileSync(new URL('../assets-source/coral-'+id+'.blend',import.meta.url));
    assert.equal(meta.species,label);assert.equal(meta.generator.startsWith('Blender'),true);
    assert.equal(meta.stride,11);assert.ok(meta.opaqueVertices>10000&&meta.finVertices>1000);
    assert.equal(mesh.byteLength,(meta.opaqueVertices+meta.finVertices)*44);
    assert.equal(lod.byteLength,(meta.lod.opaqueVertices+meta.lod.finVertices)*44);
    assert.ok(lod.byteLength<mesh.byteLength*.55);
    assert.equal(glb.toString('ascii',0,4),'glTF');
    assert.ok(blend.toString('ascii',0,7)==='BLENDER'||blend.readUInt32LE(0)===0xFD2FB528,'missing native Blender source');
    const glbScene=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)));
    assert.ok(glbScene.meshes.flatMap(m=>m.primitives).filter(p=>'COLOR_0' in p.attributes).length>90,'Blender export lost patterned vertex colors');
    const values=new Float32Array(mesh.buffer,mesh.byteOffset,mesh.byteLength/4);
    const body=[];for(let i=6;i<Math.min(values.length,11*15000);i+=11)body.push([values[i],values[i+1],values[i+2]]);
    assert.ok(body.every(rgb=>rgb.every(v=>Number.isFinite(v)&&v>=0&&v<=1)));
    const average=body.reduce((a,rgb)=>a.map((v,i)=>v+rgb[i]),[0,0,0]).map(v=>v/body.length);
    if(id==='clown')assert.ok(average[0]>average[1]*1.8);
    if(id==='yellow-tang')assert.ok(average[0]>average[2]*5&&average[1]>average[2]*3);
    if(id==='blue-tang')assert.ok(average[2]>average[0]*2);
    if(id==='moorish-idol')assert.ok(average[0]>.25&&average[2]<average[0]*.9);
    if(id==='dwarf-hawkfish')assert.ok(average[0]>average[2]*1.3);
    hashes.add(createHash('sha256').update(mesh).digest('hex'));
  }
  assert.equal(hashes.size,5);
});

test('reef settings bring five 3D species, hide plecos, and restore freshwater stock',()=>{
  assert.equal(normalizeSettings({background:'coral',fishMode:'classic'}).fishMode,'tetra3d');
  for(const count of [12,18,72,160]){
    const p=coralPopulation(count);
    assert.equal(p.clown+p.yellowTang+p.blueTang+p.moorishIdol+p.dwarfHawkfish,count);
    assert.ok(Math.min(p.clown,p.yellowTang,p.blueTang)>=3);
    assert.ok(p.moorishIdol>=1&&p.moorishIdol<=4&&p.dwarfHawkfish>=1&&p.dwarfHawkfish<=6);
  }
  const sim=new TetraSimulation(16/9,{background:'coral',count:72,plecoCount:6},seededRandom(51));
  assert.equal(sim.plecos.length,0);assert.equal(sim.shelters.length,0);
  for(const species of ['clown','yellow-tang','blue-tang','moorish-idol','dwarf-hawkfish'])assert.ok(sim.fish.some(f=>f.species===species));
  for(let i=0;i<600;i++)sim.step(1/60);
  assert.ok(sim.fish.every(f=>[f.x,f.y,f.z,f.yaw,f.pitch,f.roll,f.length].every(Number.isFinite)));
  sim.settings=normalizeSettings({background:'layered',count:72,plecoCount:2,rummyCount:24});sim.setCount(72);
  assert.equal(sim.plecos.length,2);
  assert.ok(sim.fish.every(f=>['neon','rummy'].includes(f.species)));
});

test('reef specialists retain distinct size and space-use patterns over time',()=>{
  const sim=new TetraSimulation(16/9,{background:'coral',count:72},seededRandom(42));
  const idols=sim.fish.filter(f=>f.species==='moorish-idol');
  const hawks=sim.fish.filter(f=>f.species==='dwarf-hawkfish');
  assert.ok(idols.every(f=>f.length>hawks[0].length*2.8));
  let perched=0,samples=0,pairDistance=0,otherDistance=0;
  for(let frame=0;frame<5400;frame++){
    sim.step(1/60);
    if(frame%60)continue;
    for(const f of hawks){
      samples++;
      if(f.behavior==='perch'&&Math.hypot(f.x-sim.aspect*f.perch[0],f.y-f.perch[1],f.z-f.perchZ)<.07)perched++;
    }
    pairDistance+=Math.hypot(idols[0].x-idols[1].x,idols[0].y-idols[1].y,idols[0].z-idols[1].z);
    otherDistance+=Math.hypot(idols[0].x-idols[2].x,idols[0].y-idols[2].y,idols[0].z-idols[2].z);
  }
  assert.ok(perched/samples>.55&&perched/samples<.90,'hawkfish should perch often but still make excursions');
  assert.ok(pairDistance<otherDistance*.70,'Moorish idol partner should be nearer than another individual');
});
