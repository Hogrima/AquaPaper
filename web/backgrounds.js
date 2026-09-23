import { cameraOrbit } from './scene.js';

// Separately authored RGBA images, not masks cut from a flattened photograph.
export const FOREST_LAYERS = Object.freeze([
  { file:'01-water.png', depth:.12, sway:0, scale:1, anchor:[.5,.5] },
  { file:'02-rear-plants.png', depth:.55, flow:.009, scale:.58, anchor:[.42,.24] },
  { file:'03-driftwood.png', depth:1.05, sway:0, scale:.90, anchor:[0,1] },
  { file:'04-stones.png', depth:1.45, sway:0, scale:.70, anchor:[.32,.96] },
  { file:'05-left-plants.png', depth:2.5, flow:.018, scale:1, anchor:[0,1] },
  { file:'06-right-plants.png', depth:3.3, flow:.014, scale:.55, anchor:[.86,.85] },
]);
// Independently painted photographic planes. The added blue-distance reefs
// form a receding canyon before the original ridge and near coral outcrops.
export const CORAL_LAYERS = Object.freeze([
  { file:'01-water.png', depth:.12, flow:0, scale:1, anchor:[.5,.5] },
  { file:'01a-abyssal-ridge.png', depth:.20, flow:0, scale:.96, anchor:[.5,.87] },
  { file:'01b-far-left-spires.png', depth:.26, flow:0, scale:.91, anchor:[.08,.82] },
  { file:'01c-far-right-arch.png', depth:.33, flow:0, scale:.91, anchor:[.92,.84] },
  { file:'01d-middle-canyon.png', depth:.40, flow:0, scale:.89, anchor:[.5,.88] },
  { file:'02-reef-ridge.png', depth:.46, flow:0, scale:.84, anchor:[.5,.82] },
  { file:'03-left-reef.png', depth:1.06, flow:0, scale:.70, anchor:[.12,.80] },
  { file:'04-right-reef.png', depth:1.58, flow:0, scale:.70, anchor:[.88,.80] },
  { file:'05-foreground-left.png', depth:2.50, flow:0, scale:.82, anchor:[0,1] },
  { file:'06-foreground-right.png', depth:3.30, flow:0, scale:.66, anchor:[1,1] },
]);
export const LAYER_OVERSCAN=.86;
export const normalizeBackground=value=>['layered','coral'].includes(value)?value:'original';

// Texture-space inverse flow: each stem has its own phase, and the root stays
// planted at the bottom of its authored transparent plate.
export function plantFlowUV(x,y,time,layer,strength){
  if(!strength)return [x,y];
  const height=Math.max(0,Math.min(1,(.98-y)/.78));
  const bend=height*height*(3-2*height);
  const wave=Math.sin(time*.87+x*14.7-y*4.1+layer*1.83)*.78
    +Math.sin(time*1.31-x*23.2+y*6.7+layer*2.51)*.22;
  return [x-wave*strength*bend,y-Math.sin(time*.69+x*12.3+layer*1.37)*strength*.11*bend];
}

// Reference for full-orbit edge-margin checks. All planes share framing.
export function layerUV(x,y,aspect,imageAspect,time,depth,enabled=true){
  const cover=aspect>imageAspect?[1,imageAspect/aspect]:[aspect/imageAspect,1];
  const orbit=cameraOrbit(time,enabled);
  return [(x-.5)*cover[0]*LAYER_OVERSCAN+.5+orbit[0]/aspect*cover[0]*depth,
    (y-.5)*cover[1]*LAYER_OVERSCAN+.5+orbit[1]*cover[1]*depth];
}

export const BACKDROP_FRAGMENT=`#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_image;
uniform vec2 u_resolution,u_imageSize,u_orbit,u_anchor;
uniform float u_time,u_lighting,u_waterSurface,u_depth,u_flow,u_layer,u_overscan,u_scale;
void main(){
 vec2 uv=vec2(v_uv.x,1.-v_uv.y);
 float ar=u_resolution.x/u_resolution.y,iar=u_imageSize.x/u_imageSize.y;
 vec2 cover=ar>iar?vec2(1.,iar/ar):vec2(ar/iar,1.);
 vec2 q=(uv-.5)*cover*u_overscan+.5+u_orbit*vec2(1./ar,1.)*cover*u_depth;
 q=(q-u_anchor)/u_scale+u_anchor;
 // Only transparent vegetation planes bend; wood, stone and water never warp.
 if(u_flow>0.){
   float stemX=q.x;
   float height=clamp((.98-q.y)/.78,0.,1.);
   float bend=height*height*(3.-2.*height);
   float wave=sin(u_time*.87+stemX*14.7-q.y*4.1+u_layer*1.83)*.78
     +sin(u_time*1.31-stemX*23.2+q.y*6.7+u_layer*2.51)*.22;
   q.x=stemX-wave*u_flow*bend;
   q.y-=sin(u_time*.69+stemX*12.3+u_layer*1.37)*u_flow*.11*bend;
 }
 if(u_layer>.5&&(any(lessThan(q,vec2(0.)))||any(greaterThan(q,vec2(1.))))){outColor=vec4(0.);return;}
 float shimmer=1.;
 // Animate the surface already photographed in the distant-water plate.
 // No colored overlay or synthetic horizon band sits in front of the plants.
 if(u_waterSurface>.5&&u_layer<.5&&q.y<.22){
   float surface=1.-smoothstep(.035,.20,q.y);
   vec2 p=vec2(q.x*iar*32.,q.y*110.);
   float longWave=sin(p.x*.55+p.y*.16-u_time*.63);
   float ripple=sin(p.x*.91-p.y*.48+sin(p.x*.23+u_time*.27)-u_time*1.15);
   q+=vec2(longWave*.0015+ripple*.0009,cos(p.x*.31+p.y*.8+u_time*.81)*.0017)*surface;
   shimmer+=surface*.055*(longWave*.4+ripple*.6);
 }
 vec4 color=texture(u_image,q);
 color.rgb*=shimmer;
 if(u_lighting>.5&&u_lighting<1.5)color.rgb*=vec3(1.16,.91,.69);
 if(u_lighting>1.5)color.rgb*=vec3(.34,.54,.76);
 outColor=color;
}`;
