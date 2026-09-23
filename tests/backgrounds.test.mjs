import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {FOREST_LAYERS,layerUV,plantFlowUV} from '../web/backgrounds.js';
import {normalizeSettings} from '../web/simulation.js';

test('background selection is explicit, persistent and compatible with old settings',()=>{
  assert.equal(normalizeSettings({}).background,'original');
  assert.equal(normalizeSettings({background:'missing'}).background,'original');
  assert.equal(normalizeSettings(JSON.parse(JSON.stringify(normalizeSettings({background:'layered'})))).background,'layered');
});

test('six distinct authored PNGs include genuine empty space between foreground objects',()=>{
  const hashes=new Set();
  for(const [i,layer] of FOREST_LAYERS.entries()){
    const png=readFileSync(new URL('../web/assets/river-forest/'+layer.file,import.meta.url));
    hashes.add(createHash('sha256').update(png).digest('hex'));
    assert.equal(png.readUInt32BE(16),1536);assert.equal(png.readUInt32BE(20),1024);
    if(i===0)continue;
    assert.equal(png[25],6,'overlay must be RGBA');assert.equal(png[24],8);assert.equal(png[28],0);
    const chunks=[];for(let p=8;p<png.length;){const n=png.readUInt32BE(p);if(png.toString('ascii',p+4,p+8)==='IDAT')chunks.push(png.subarray(p+8,p+8+n));p+=12+n;}
    const raw=inflateSync(Buffer.concat(chunks)),stride=1536*4;
    let prev=new Uint8Array(stride),empty=0,solid=0;
    const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
    for(let y=0;y<1024;y++){
      const row=new Uint8Array(stride),filter=raw[y*(stride+1)];
      for(let x=0;x<stride;x++){
        const a=x>=4?row[x-4]:0,b=prev[x],c=x>=4?prev[x-4]:0;
        const predictor=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);
        row[x]=(raw[y*(stride+1)+1+x]+predictor)&255;
        if(x%4===3){if(row[x]===0)empty++;if(row[x]>240)solid++;}
      }
      prev=row;
    }
    assert.ok(empty>1536*1024*.45,layer.file+' has an opaque backdrop');
    assert.ok(solid>1536*1024*.005,layer.file+' lacks solid objects');
  }
  assert.equal(hashes.size,6,'layers must not be copies of the same photograph');
});

test('full orbit keeps the base covered, reveals different depths, and closes without a jump',()=>{
  for(const layer of FOREST_LAYERS)for(let t=0;t<=150;t+=.5){
    for(const [x,y] of [[0,0],[1,0],[0,1],[1,1]]){
      const uv=layerUV(x,y,16/9,16/9,t,layer.depth);
      assert.ok(uv.every(v=>v>.01&&v<.99),'insufficient orbit margin');
    }
    const a=layerUV(.5,.5,16/9,16/9,t,layer.depth),b=layerUV(.5,.5,16/9,16/9,t+1/60,layer.depth);
    assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<.00002);
  }
  const travel=depth=>Math.abs(layerUV(.5,.5,16/9,16/9,75,depth)[1]-.5);
  assert.ok(travel(FOREST_LAYERS[5].depth)>travel(FOREST_LAYERS[0].depth)*20);
  const closed=layerUV(.5,.5,16/9,16/9,150,3.3);
  assert.ok(Math.hypot(closed[0]-.5,closed[1]-.5)<1e-10);
});

test('water flow bends independent plant tips while keeping roots and hardscape fixed',()=>{
  for(const i of [1,4,5]){
    const layer=FOREST_LAYERS[i];
    let tipTravel=0;
    for(let t=0;t<=12;t+=.25){
      const root=plantFlowUV(.85,1,t,i,layer.flow);
      assert.deepEqual(root,[.85,1]);
      const tip=plantFlowUV(.85,.22,t,i,layer.flow);
      tipTravel=Math.max(tipTravel,Math.hypot(tip[0]-.85,tip[1]-.22));
    }
    assert.ok(tipTravel>layer.flow*.5,layer.file+' has imperceptible tip movement');
    assert.ok(tipTravel<layer.flow*1.1,layer.file+' bends too far');
  }
  for(const i of [0,2,3])assert.deepEqual(plantFlowUV(.6,.3,4,i,FOREST_LAYERS[i].flow||0),[.6,.3]);
  assert.notDeepEqual(plantFlowUV(.2,.2,3,4,.018),plantFlowUV(.8,.2,3,4,.018));
});
