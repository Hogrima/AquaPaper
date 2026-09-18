import { renderResolution } from './display.js';
const BACKGROUND_VERTEX = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main(){v_uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}`;
const BACKGROUND_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec2 u_imageSize;
uniform float u_time;
uniform float u_lighting;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
void main(){
 vec2 uv=vec2(v_uv.x,1.-v_uv.y);
 float ar=u_resolution.x/u_resolution.y,iar=u_imageSize.x/u_imageSize.y;
 vec2 cover=ar>iar?vec2(1.,iar/ar):vec2(ar/iar,1.);
 vec2 p=(uv-.5)*cover+.5;
 float t=u_time;
 float edges=smoothstep(.24,.49,abs(p.x-.5));
 float plantMask=edges*(1.-smoothstep(.55,.94,p.y));
 p.x+=sin(p.y*8.+t*.55+p.x*5.)*.0048*plantMask;
 p.x+=sin(p.y*27.+t*.27)*.00043;
 p.y+=sin(p.x*21.+t*.36)*.00035;
 vec3 color=texture(u_image,clamp(p,vec2(.001),vec2(.999))).rgb;
 float surface=noise(vec2(uv.x*9.+t*.10,uv.y*2.-t*.06));
 float rays=pow(max(0.,sin((uv.x+uv.y*.16)*27.+surface*2.+t*.1)),12.);
 rays+=pow(max(0.,sin((uv.x-uv.y*.08)*41.+surface+t*.16)),20.)*.4;
 float topLight=exp(-uv.y*3.3)*(.4+surface*.6);
 color+=vec3(.23,.31,.17)*rays*topLight*.085;
 vec2 q=uv*vec2(ar,1.);
 float caustic=sin(q.x*39.+sin(q.y*29.+t*.33)*2.+t*.35)+sin(q.y*45.+sin(q.x*36.-t*.28)*1.7);
 float causticLight=pow(max(0.,caustic*.5),10.);
 color+=vec3(.24,.29,.16)*causticLight*smoothstep(.68,1.,uv.y)*.045;
 if(u_lighting>.5&&u_lighting<1.5){color*=vec3(1.16,.91,.69);color+=vec3(.024,.010,0.)*topLight;}
 if(u_lighting>1.5){color*=vec3(.34,.54,.76);color+=vec3(.005,.025,.045)*rays*topLight;}
 float vignette=1.-.23*pow(length((uv-.5)*vec2(1.,.8)),1.4);
 color*=vignette;
 outColor=vec4(color,1.);
}`;
const FISH_VERTEX = `#version 300 es
precision highp float;
in vec2 a_position;
in vec4 a_fish;
in vec4 a_detail;
uniform float u_aspect;
out vec2 v_local;
out vec4 v_detail;
void main(){
 v_local=a_position;v_detail=a_detail;
 vec2 p=a_position*vec2(1.48,.60)*a_fish.z;
 p.y+=sin(a_detail.x+(-a_position.x)*3.)*pow(max(0.,-a_position.x),1.8)*a_fish.z*.15;
 float s=sin(a_fish.w),c=cos(a_fish.w);
 vec2 world=a_fish.xy+mat2(c,s,-s,c)*p;
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
const PARTICLE_VERTEX = `#version 300 es
precision highp float;
in vec4 a_particle;
uniform float u_time;
uniform float u_pixelRatio;
out float v_opacity;
out float v_bubble;
void main(){
 float y=fract(a_particle.y-u_time*(.004+a_particle.z*.008));
 float x=fract(a_particle.x+sin(u_time*.20+a_particle.y*25.)*.006);
 gl_Position=vec4(x*2.-1.,1.-y*2.,0.,1.);
 gl_PointSize=(a_particle.w>.83?3.+a_particle.z*4.:.9+a_particle.z*1.7)*u_pixelRatio;
 v_opacity=(.08+a_particle.z*.28)*smoothstep(0.,.07,y)*(1.-smoothstep(.93,1.,y));
 v_bubble=step(.83,a_particle.w);
}`;
const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
in float v_opacity;in float v_bubble;
out vec4 outColor;
void main(){vec2 p=gl_PointCoord*2.-1.;float d=length(p);float a=(1.-smoothstep(.4,1.,d))*.6;
 if(v_bubble>.5){a=(1.-smoothstep(.68,1.,d))*smoothstep(.40,.75,d)*.65;a+=exp(-length(p-vec2(-.27,-.36))*15.)*.8;}
 outColor=vec4(.79,.90,.72,a*v_opacity);}`;

function shader(gl, type, source) {
  const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const error = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(error); } return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram(), v = shader(gl, gl.VERTEX_SHADER, vs), f = shader(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p); gl.deleteShader(v); gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p;
}

export class AquariumRenderer {
  constructor(canvas, random = Math.random) {
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL 2를 사용할 수 없습니다. 그래픽 드라이버와 Microsoft Edge WebView2를 업데이트해 주세요.');
    this.bgProgram = program(gl, BACKGROUND_VERTEX, BACKGROUND_FRAGMENT);
    this.fishProgram = program(gl, FISH_VERTEX, FISH_FRAGMENT);
    this.particleProgram = program(gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT);
    this.uniforms = new Map();
    this.quad = gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    this.bgVao = this.createQuad(this.bgProgram);
    this.fishVao = this.createQuad(this.fishProgram);
    gl.bindVertexArray(this.fishVao);
    this.fishBuffer = gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.fishBuffer);
    this.fishData = new Float32Array(160*8);gl.bufferData(gl.ARRAY_BUFFER,this.fishData.byteLength,gl.DYNAMIC_DRAW);
    for (const [name,offset] of [['a_fish',0],['a_detail',16]]) { const a=gl.getAttribLocation(this.fishProgram,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,4,gl.FLOAT,false,32,offset);gl.vertexAttribDivisor(a,1); }
    this.particleVao=gl.createVertexArray();gl.bindVertexArray(this.particleVao);
    this.particleBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.particleBuffer);
    const particles=new Float32Array(240*4);for(let i=0;i<particles.length;i++)particles[i]=random();
    gl.bufferData(gl.ARRAY_BUFFER,particles,gl.STATIC_DRAW);
    const attr=gl.getAttribLocation(this.particleProgram,'a_particle');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,4,gl.FLOAT,false,16,0);
    this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([17,42,30,255]));
    this.imageSize=[16,9];this.renderScale=1;
  }
  createQuad(p) { const gl=this.gl,vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);const a=gl.getAttribLocation(p,'a_position');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);return vao; }
  uniform(p,name) {let map=this.uniforms.get(p);if(!map){map=new Map();this.uniforms.set(p,map);}if(!map.has(name))map.set(name,this.gl.getUniformLocation(p,name));return map.get(name);}
  async load(url) { const img=new Image();img.src=url;await img.decode();const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);this.imageSize=[img.naturalWidth,img.naturalHeight]; }
  resize(quality='balanced',monitorCount=1) {
    const limits=this.gl.getParameter(this.gl.MAX_VIEWPORT_DIMS);
    const size=renderResolution(innerWidth,innerHeight,window.devicePixelRatio||1,quality,monitorCount,Math.min(limits[0],limits[1],this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE)));
    this.renderScale=size.scale;
    this.canvas.width=size.width;this.canvas.height=size.height;
    this.gl.viewport(0,0,this.canvas.width,this.canvas.height);
  }
  render(sim,settings) {
    const gl=this.gl,t=sim.time,light={day:0,dusk:1,night:2}[settings.lighting],w=this.canvas.width,h=this.canvas.height;
    gl.disable(gl.BLEND);gl.useProgram(this.bgProgram);gl.bindVertexArray(this.bgVao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.uniform1i(this.uniform(this.bgProgram,'u_image'),0);gl.uniform2f(this.uniform(this.bgProgram,'u_resolution'),w,h);gl.uniform2f(this.uniform(this.bgProgram,'u_imageSize'),...this.imageSize);
    gl.uniform1f(this.uniform(this.bgProgram,'u_time'),t);gl.uniform1f(this.uniform(this.bgProgram,'u_lighting'),light);gl.drawArrays(gl.TRIANGLES,0,6);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.fishProgram);gl.bindVertexArray(this.fishVao);gl.bindBuffer(gl.ARRAY_BUFFER,this.fishBuffer);
    let i=0;for(const f of sim.fish){this.fishData[i++]=f.x;this.fishData[i++]=f.y;this.fishData[i++]=f.size*(.72+f.depth*.28);this.fishData[i++]=f.angle;this.fishData[i++]=f.phase;this.fishData[i++]=f.depth;this.fishData[i++]=f.panic;this.fishData[i++]=f.school;}
    gl.bufferSubData(gl.ARRAY_BUFFER,0,this.fishData.subarray(0,i));gl.uniform1f(this.uniform(this.fishProgram,'u_aspect'),sim.aspect);gl.uniform1f(this.uniform(this.fishProgram,'u_lighting'),light);gl.drawArraysInstanced(gl.TRIANGLES,0,6,sim.fish.length);
    if(settings.particles){gl.useProgram(this.particleProgram);gl.bindVertexArray(this.particleVao);gl.uniform1f(this.uniform(this.particleProgram,'u_time'),t);gl.uniform1f(this.uniform(this.particleProgram,'u_pixelRatio'),this.renderScale);gl.drawArrays(gl.POINTS,0,settings.quality==='eco'?100:240);}
    gl.bindVertexArray(null);
  }
  dispose(){const gl=this.gl;for(const p of [this.bgProgram,this.fishProgram,this.particleProgram])gl.deleteProgram(p);for(const b of [this.quad,this.fishBuffer,this.particleBuffer])gl.deleteBuffer(b);for(const v of [this.bgVao,this.fishVao,this.particleVao])gl.deleteVertexArray(v);gl.deleteTexture(this.texture);}
}
