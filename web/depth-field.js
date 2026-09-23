import { cameraOrbit, SCENE_LAYERS } from './scene.js';

const smooth = (a,b,x) => { const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t); };
const mix = (a,b,t) => a+(b-a)*t;
export const MAX_SCENE_DEPTH = SCENE_LAYERS.at(-1).parallax;
export const BACKGROUND_OVERSCAN = .94;

// One continuous relief surface, guided by six semantic depth regions. These are
// depth weights, NOT opacity masks: each source feature is sampled exactly once.
export function backgroundDepth(x,y) {
  const sides=Math.abs(x-.5)*2;
  let depth=SCENE_LAYERS[0].parallax;
  depth=mix(depth,SCENE_LAYERS[1].parallax,smooth(.16,.50,sides)*(1-smooth(.50,.78,y)));
  depth=mix(depth,SCENE_LAYERS[2].parallax,smooth(.38,.72,x)*smooth(.28,.54,y)*(1-smooth(.72,.87,y)));
  const upper=.24+.64*x,lower=.60+.52*x;
  const wood=smooth(upper-.07,upper+.07,y)*(1-smooth(lower-.07,lower+.07,y))*(1-smooth(.66,.82,x));
  depth=mix(depth,SCENE_LAYERS[3].parallax,wood);
  depth=mix(depth,SCENE_LAYERS[4].parallax,smooth(.70,.97,y));
  const edge=.86-.18*y;
  return mix(depth,SCENE_LAYERS[5].parallax,smooth(edge-.13,edge+.10,sides));
}

export function createDepthField(width=512,height=288) {
  const pixels=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)
    pixels[y*width+x]=Math.round(backgroundDepth((x+.5)/width,(y+.5)/height)/MAX_SCENE_DEPTH*255);
  return {pixels,width,height};
}

// CPU reference of GL_LINEAR + CLAMP_TO_EDGE for regression checks of the
// quantized map actually uploaded to the GPU, including its steepest gradients.
export function sampleDepth(field,x,y) {
  const px=Math.max(0,Math.min(field.width-1,x*field.width-.5));
  const py=Math.max(0,Math.min(field.height-1,y*field.height-.5));
  const x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(x0+1,field.width-1),y1=Math.min(y0+1,field.height-1);
  const top=mix(field.pixels[y0*field.width+x0],field.pixels[y0*field.width+x1],px-x0);
  const bottom=mix(field.pixels[y1*field.width+x0],field.pixels[y1*field.width+x1],px-x0);
  return mix(top,bottom,py-y0)/255*MAX_SCENE_DEPTH;
}
// Inverse depth reprojection, followed by ONE color texture lookup in the GPU.
export function backgroundUV(x,y,aspect,imageAspect,time,parallax=true,field=null) {
  const cover=aspect>imageAspect?[1,imageAspect/aspect]:[aspect/imageAspect,1];
  const base=[(x-.5)*cover[0]*BACKGROUND_OVERSCAN+.5,(y-.5)*cover[1]*BACKGROUND_OVERSCAN+.5];
  const orbit=cameraOrbit(time,parallax),drift=[orbit[0]/aspect*cover[0],orbit[1]*cover[1]];
  let q=[...base];
  for(let i=0;i<3;i++){const d=field?sampleDepth(field,...q):backgroundDepth(...q);q=[base[0]+drift[0]*d,base[1]+drift[1]*d];}
  const plants=smooth(.28,.49,Math.abs(q[0]-.5))*(1-smooth(.62,.97,q[1]));
  q[0]+=Math.sin(q[1]*8+time*.32+q[0]*5)*.00065*plants;
  return q;
}
