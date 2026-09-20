import { cameraOrbit, particleCounts, SCENE_LAYERS } from './scene.js';
import { BACKGROUND_VERTEX, BACKGROUND_FRAGMENT, LAYER_BAKE_FRAGMENT, LIGHT_FRAGMENT, WATER_FRAGMENT, PARTICLE_VERTEX, PARTICLE_FRAGMENT } from './environment.js';
import { renderResolution } from './display.js';
import { createProgram as program } from './gl.js';
import { TetraRenderer } from './fish3d.js';
const FISH_VERTEX = `#version 300 es
precision highp float;
in vec2 a_position;
in vec4 a_fish;
in vec4 a_detail;
uniform float u_aspect;
uniform vec2 u_orbit;
out vec2 v_local;
out vec4 v_detail;
void main(){
 v_local=a_position;v_detail=a_detail;
 vec2 p=a_position*vec2(1.48,.60)*a_fish.z;
 p.y+=sin(a_detail.x+(-a_position.x)*3.)*pow(max(0.,-a_position.x),1.8)*a_fish.z*.15;
 float s=sin(a_fish.w),c=cos(a_fish.w);
 vec2 world=a_fish.xy+mat2(c,s,-s,c)*p;
 world-=u_orbit*.82;
 gl_Position=vec4(world.x/u_aspect*2.-1.,1.-world.y*2.,0.,1.);
}`;
const FISH_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_local;
in vec4 v_detail;
uniform float u_lighting;
out vec4 outColor;
float ellipse(vec2 p,vec2 center,vec2 radius){return length((p-center)/radius)-1.;}
void main(){
 vec2 p=v_local;
 float body=ellipse(p,vec2(.08,0.),vec2(.67,.33));
 float aa=max(fwidth(body),.01);
 float bodyAlpha=1.-smoothstep(-aa,aa,body);
 float tailY=abs(p.y-sin(v_detail.x)*.028);
 float tailWidth=(-p.x-.45)*.86;
 float tail=(1.-smoothstep(tailWidth-.025,tailWidth+.025,tailY))*smoothstep(-.99,-.92,p.x)*(1.-smoothstep(-.54,-.45,p.x));
 float notch=1.-(1.-smoothstep(.0,.16,abs(p.y)))*(1.-smoothstep(-.93,-.73,p.x));
 tail*=max(.25,notch);
 float dorsal=(1.-smoothstep(.0,.035,abs(p.x+.1)*.85+abs(p.y+.29)-.24))*(1.-bodyAlpha)*.36;
 float ventral=(1.-smoothstep(.0,.03,abs(p.x-.05)*1.1+abs(p.y-.28)-.17))*(1.-bodyAlpha)*.3;
 float alpha=max(bodyAlpha,max(tail*.79,max(dorsal,ventral)));
 if(alpha<.012)discard;
 float roundness=sqrt(max(0.,1.-pow(p.y/.34,2.)));
 vec3 bodyColor=mix(vec3(.13,.24,.20),vec3(.67,.78,.66),roundness);
 bodyColor=mix(bodyColor,vec3(.83,.87,.72),exp(-pow((p.y+.10)*13.,2.))*.65);
 float red=(1.-smoothstep(-.04,.29,p.x))*smoothstep(-.05,.07,p.y);
 bodyColor=mix(bodyColor,vec3(.76,.105,.07)*(.65+roundness*.42),red*.94);
 float stripe=exp(-pow((p.y+.045)*34.,2.))*smoothstep(-.57,-.34,p.x)*(1.-smoothstep(.43,.59,p.x));
 bodyColor=mix(bodyColor,vec3(.15,.79,.82),stripe*.86);
 bodyColor+=vec3(.24,.50,.47)*stripe*.21;
 float scales=sin(p.x*83.+p.y*15.)*sin(p.y*58.)*.025;
 bodyColor+=scales*bodyAlpha;
 float gill=exp(-pow((p.x-.38)*40.,2.))*(1.-smoothstep(.05,.27,abs(p.y)));
 bodyColor*=1.-gill*.26;
 float eye=length((p-vec2(.52,-.075))*vec2(1.,1.2));
 bodyColor=mix(bodyColor,vec3(.75,.77,.55),1.-smoothstep(.059,.077,eye));
 bodyColor=mix(bodyColor,vec3(.018,.029,.023),1.-smoothstep(.038,.050,eye));
 bodyColor+=vec3(.9)*(1.-smoothstep(.010,.023,length(p-vec2(.535,-.09))));
 vec3 tailColor=mix(vec3(.4,.08,.045),vec3(.93,.24,.13),smoothstep(.1,.35,tailY));
 tailColor+=sin(atan(p.y,-p.x-.43)*43.)*.04;
 vec3 color=mix(tailColor,bodyColor,bodyAlpha);
 if(dorsal>bodyAlpha&&dorsal>tail||ventral>bodyAlpha&&ventral>tail)color=vec3(.62,.73,.57);
 color=mix(vec3(.12,.23,.18),color,.43+v_detail.y*.57);
 color*=.80+v_detail.y*.2;
 if(u_lighting>.5&&u_lighting<1.5)color*=vec3(1.12,.9,.7);
 if(u_lighting>1.5)color*=vec3(.48,.7,.9);
 outColor=vec4(color,alpha*(.51+v_detail.y*.49));
}`;
export class AquariumRenderer {
  constructor(canvas, random = Math.random) {
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: true, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL 2를 사용할 수 없습니다. 그래픽 드라이버와 Microsoft Edge WebView2를 업데이트해 주세요.');
    this.bgProgram = program(gl, BACKGROUND_VERTEX, BACKGROUND_FRAGMENT);
    this.waterProgram = program(gl, BACKGROUND_VERTEX, WATER_FRAGMENT);
    this.lightProgram = program(gl, BACKGROUND_VERTEX, LIGHT_FRAGMENT);
    this.fishProgram = program(gl, FISH_VERTEX, FISH_FRAGMENT);
    this.particleProgram = program(gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT);
    this.uniforms = new Map();
    this.quad = gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    this.bgVao = this.createQuad(this.bgProgram);
    this.waterVao = this.createQuad(this.waterProgram);
    this.lightVao = this.createQuad(this.lightProgram);
    this.fishVao = this.createQuad(this.fishProgram);
    gl.bindVertexArray(this.fishVao);
    this.fishBuffer = gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.fishBuffer);
    this.fishData = new Float32Array(160*8);gl.bufferData(gl.ARRAY_BUFFER,this.fishData.byteLength,gl.DYNAMIC_DRAW);
    for (const [name,offset] of [['a_fish',0],['a_detail',16]]) { const a=gl.getAttribLocation(this.fishProgram,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,4,gl.FLOAT,false,32,offset);gl.vertexAttribDivisor(a,1); }
    this.particleVao=gl.createVertexArray();gl.bindVertexArray(this.particleVao);
    this.particleBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.particleBuffer);
    const particles=new Float32Array(1600*4);for(let i=0;i<particles.length;i++)particles[i]=random();
    gl.bufferData(gl.ARRAY_BUFFER,particles,gl.STATIC_DRAW);
    const attr=gl.getAttribLocation(this.particleProgram,'a_particle');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,4,gl.FLOAT,false,16,0);
    this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([17,42,30,255]));
    this.imageSize=[16,9];this.renderScale=1;
    this.tetra = new TetraRenderer(gl);
  }
  createQuad(p) { const gl=this.gl,vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);const a=gl.getAttribLocation(p,'a_position');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);return vao; }
  uniform(p,name) {let map=this.uniforms.get(p);if(!map){map=new Map();this.uniforms.set(p,map);}if(!map.has(name))map.set(name,this.gl.getUniformLocation(p,name));return map.get(name);}
  async load(url) {
    const img=new Image();img.src=url;await img.decode();const gl=this.gl;
    gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
    this.imageSize=[img.naturalWidth,img.naturalHeight];this.bakeLayers();
  }
  bakeLayers() {
    const gl=this.gl,p=program(gl,BACKGROUND_VERTEX,LAYER_BAKE_FRAGMENT),vao=this.createQuad(p),frame=gl.createFramebuffer();
    this.layerTextures=[];
    try {
      gl.bindFramebuffer(gl.FRAMEBUFFER,frame);gl.viewport(0,0,...this.imageSize);
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(p);gl.bindVertexArray(vao);
      gl.uniform1i(gl.getUniformLocation(p,'u_image'),0);
      for(let i=0;i<SCENE_LAYERS.length;i++){
        const texture=gl.createTexture();this.layerTextures.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,...this.imageSize,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Background layer framebuffer is incomplete');
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
        gl.uniform1f(gl.getUniformLocation(p,'u_layer'),i);gl.drawArrays(gl.TRIANGLES,0,6);
        gl.bindTexture(gl.TEXTURE_2D,texture);gl.generateMipmap(gl.TEXTURE_2D);
      }
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);
      gl.bindVertexArray(null);gl.deleteFramebuffer(frame);gl.deleteVertexArray(vao);gl.deleteProgram(p);
    }
  }
  resize(quality='balanced',monitorCount=1) {
    const limits=this.gl.getParameter(this.gl.MAX_VIEWPORT_DIMS);
    const size=renderResolution(innerWidth,innerHeight,window.devicePixelRatio||1,quality,monitorCount,Math.min(limits[0],limits[1],this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE)));
    this.renderScale=size.scale;
    this.canvas.width=size.width;this.canvas.height=size.height;
    this.gl.viewport(0,0,this.canvas.width,this.canvas.height);
  }
  render(sim,settings) {
    const gl=this.gl,t=sim.time,light={day:0,dusk:1,night:2}[settings.lighting],w=this.canvas.width,h=this.canvas.height;
    const orbit=cameraOrbit(t,settings.parallax);
    gl.disable(gl.DEPTH_TEST);gl.depthMask(true);gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);gl.useProgram(this.bgProgram);gl.bindVertexArray(this.bgVao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.uniform2f(this.uniform(this.bgProgram,'u_resolution'),w,h);gl.uniform2f(this.uniform(this.bgProgram,'u_imageSize'),...this.imageSize);
    gl.uniform1f(this.uniform(this.bgProgram,'u_time'),t);gl.uniform1f(this.uniform(this.bgProgram,'u_lighting'),light);
    gl.uniform2f(this.uniform(this.bgProgram,'u_orbit'),...orbit);
    // Six independently projected cached planes, composited in one framebuffer write.
    // This avoids six fullscreen blend passes on every monitor without reducing layers.
    this.layerCount=SCENE_LAYERS.length;
    for(let layer=0;layer<SCENE_LAYERS.length;layer++){
      gl.activeTexture(gl.TEXTURE0+layer);
      gl.bindTexture(gl.TEXTURE_2D,this.layerTextures[layer]);
      gl.uniform1i(this.uniform(this.bgProgram,`u_layer${layer}`),layer);
    }
    gl.drawArrays(gl.TRIANGLES,0,6);gl.activeTexture(gl.TEXTURE0);gl.enable(gl.BLEND);
    gl.useProgram(this.lightProgram);gl.bindVertexArray(this.lightVao);gl.blendFunc(gl.ONE,gl.ONE);
    gl.uniform1f(this.uniform(this.lightProgram,'u_time'),t);gl.uniform1f(this.uniform(this.lightProgram,'u_lighting'),light);gl.drawArrays(gl.TRIANGLES,0,6);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    if(settings.fishMode==='tetra3d') this.tetra.draw(sim,light);
    else {
    gl.useProgram(this.fishProgram);gl.bindVertexArray(this.fishVao);gl.bindBuffer(gl.ARRAY_BUFFER,this.fishBuffer);
    let i=0;for(const f of sim.fish){this.fishData[i++]=f.x;this.fishData[i++]=f.y;this.fishData[i++]=f.size*(.72+f.depth*.28);this.fishData[i++]=f.angle;this.fishData[i++]=f.phase;this.fishData[i++]=f.depth;this.fishData[i++]=f.panic;this.fishData[i++]=f.school;}
    gl.bufferSubData(gl.ARRAY_BUFFER,0,this.fishData.subarray(0,i));gl.uniform1f(this.uniform(this.fishProgram,'u_aspect'),sim.aspect);gl.uniform1f(this.uniform(this.fishProgram,'u_lighting'),light);gl.uniform2f(this.uniform(this.fishProgram,'u_orbit'),...orbit);gl.drawArraysInstanced(gl.TRIANGLES,0,6,sim.fish.length);
    }
    // Every pass declares its depth/blend state; particles cannot inherit the fish depth buffer.
    gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    this.visibleParticles=settings.particles?particleCounts(settings.quality,sim.aspect):{dust:0,bubbles:0,total:0};
    if(settings.particles){
      gl.useProgram(this.particleProgram);gl.bindVertexArray(this.particleVao);
      gl.uniform1f(this.uniform(this.particleProgram,'u_time'),t);gl.uniform1f(this.uniform(this.particleProgram,'u_pixelRatio'),this.renderScale);
      gl.uniform1f(this.uniform(this.particleProgram,'u_aspect'),sim.aspect);gl.uniform2f(this.uniform(this.particleProgram,'u_orbit'),...orbit);
      gl.uniform1f(this.uniform(this.particleProgram,'u_bubbles'),0);gl.drawArrays(gl.POINTS,0,this.visibleParticles.dust);
      gl.uniform1f(this.uniform(this.particleProgram,'u_bubbles'),1);gl.drawArrays(gl.POINTS,this.visibleParticles.dust,this.visibleParticles.bubbles);
    }
    if(settings.waterSurface){
      gl.useProgram(this.waterProgram);gl.bindVertexArray(this.waterVao);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.uniform1i(this.uniform(this.waterProgram,'u_image'),0);gl.uniform1f(this.uniform(this.waterProgram,'u_time'),t);
      gl.uniform1f(this.uniform(this.waterProgram,'u_lighting'),light);gl.uniform2f(this.uniform(this.waterProgram,'u_resolution'),w,h);
      // Only shade the strip occupied by the surface, even across a panorama.
      gl.enable(gl.SCISSOR_TEST);gl.scissor(0,Math.floor(h*.86),w,Math.ceil(h*.14));
      gl.drawArrays(gl.TRIANGLES,0,6);gl.disable(gl.SCISSOR_TEST);
    }
    gl.depthMask(true);
    gl.bindVertexArray(null);
  }
  dispose(){this.tetra.dispose();const gl=this.gl;for(const p of [this.bgProgram,this.waterProgram,this.lightProgram,this.fishProgram,this.particleProgram])gl.deleteProgram(p);for(const b of [this.quad,this.fishBuffer,this.particleBuffer])gl.deleteBuffer(b);for(const v of [this.bgVao,this.waterVao,this.lightVao,this.fishVao,this.particleVao])gl.deleteVertexArray(v);for(const texture of this.layerTextures||[])gl.deleteTexture(texture);gl.deleteTexture(this.texture);}
}
