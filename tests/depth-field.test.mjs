import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backgroundDepth, backgroundUV, createDepthField, sampleDepth } from '../web/depth-field.js';
import { SCENE_LAYERS } from '../web/scene.js';

const field=createDepthField();
test('the relief preserves distant water, middle wood and close vegetation without opacity planes',()=>{
  assert.equal(field.pixels.byteLength,512*288);
  assert.ok(SCENE_LAYERS.at(-1).parallax-SCENE_LAYERS[0].parallax>=1.4);
  assert.ok(backgroundDepth(.5,.15)<.3);
  assert.ok(backgroundDepth(.32,.57)>.6);
  assert.ok(backgroundDepth(.04,.5)>1.3);
  for(let y=0;y<=1;y+=.01)for(let x=0;x<=1;x+=.01){
    const d=sampleDepth(field,x,y);
    assert.ok(d>=SCENE_LAYERS[0].parallax-.005&&d<=SCENE_LAYERS.at(-1).parallax+.005);
    assert.ok(Math.abs(d-backgroundDepth(x,y))<.008);
  }
});

test('full camera revolution retains edge margin and never folds or duplicates the projected surface',()=>{
  const aspect=16/9,epsilon=.0001;
  for(let t=0;t<=150;t+=2.5)for(let y=0;y<=1;y+=1/30)for(let x=0;x<=1;x+=1/50){
    const uv=backgroundUV(x,y,aspect,aspect,t,true,field);
    // Margin also covers the water refraction displacement (<.001 in UV space).
    assert.ok(uv.every(v=>v>.003&&v<.997),`edge at ${x},${y},${t}: ${uv}`);
    const dx=backgroundUV(x+epsilon,y,aspect,aspect,t,true,field);
    const dy=backgroundUV(x,y+epsilon,aspect,aspect,t,true,field);
    const determinant=((dx[0]-uv[0])*(dy[1]-uv[1])-(dx[1]-uv[1])*(dy[0]-uv[0]))/epsilon**2;
    assert.ok(determinant>.6&&determinant<1.25,`fold/stretch: ${determinant}`);
    const next=backgroundUV(x,y,aspect,aspect,t+1/60,true,field);
    assert.ok(Math.hypot(next[0]-uv[0],next[1]-uv[1])<.000018,'frame discontinuity');
  }
});

test('near plants move farther than open water, and disabling the camera stops depth movement',()=>{
  const movement=(x,y)=>{
    const a=backgroundUV(x,y,16/9,16/9,0,true,field),b=backgroundUV(x,y,16/9,16/9,75,true,field);
    return Math.abs(b[1]-a[1]);
  };
  assert.ok(movement(.03,.45)>movement(.5,.15)*7);
  assert.deepEqual(backgroundUV(.5,.5,16/9,16/9,0,false,field),backgroundUV(.5,.5,16/9,16/9,75,false,field));
});
