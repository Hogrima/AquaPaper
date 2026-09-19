import { createProgram } from './gl.js';
import { CAMERA_DISTANCE } from './simulation3d.js';

const VERTEX = `#version 300 es
precision highp float;
in vec3 a_position;
in vec3 a_normal;
in vec4 a_color;
in float a_surface;
in vec4 a_fish;
in vec4 a_pose;
in vec4 a_swim;
uniform float u_aspect;
uniform float u_camera;
out vec3 v_normal;
out vec3 v_world;
out vec3 v_local;
out vec4 v_color;
out float v_surface;
float flex(float x){
 float envelope=pow(clamp((.48-x)/1.68,0.,1.),2.);
 return envelope*(sin(a_pose.w+x*5.2)*(.035+.19*a_swim.x)+a_swim.y);
}
void main(){
 vec3 p=a_position;
 p.z+=flex(p.x);
 // Paired pectoral fins make small stabilizing strokes, including while coasting.
 if(a_surface>.5&&a_surface<1.5&&p.x>.0&&p.y<-.035){
   p.z+=sin(a_pose.w*.55+sign(p.z))*.025*smoothstep(.07,.25,abs(p.z));
 }
 vec3 normal=normalize(vec3(a_normal.x-a_normal.z*(flex(p.x+.002)-flex(p.x-.002))/.004,a_normal.yz));
 float cy=cos(a_pose.x),sy=sin(a_pose.x),cp=cos(a_pose.y),sp=sin(a_pose.y);
 vec3 forward=vec3(cy*cp,sp,sy*cp);
 vec3 side=normalize(cross(forward,vec3(0.,1.,0.)));
 vec3 up=cross(side,forward);
 vec3 rolledUp=up*cos(a_pose.z)+side*sin(a_pose.z);
 vec3 rolledSide=side*cos(a_pose.z)-up*sin(a_pose.z);
 mat3 rotation=mat3(forward,rolledUp,rolledSide);
 vec3 world=vec3(a_fish.x-u_aspect*.5,.5-a_fish.y,a_fish.z)+rotation*p*a_fish.w;
 float d=u_camera-world.z,nearPlane=.1,farPlane=5.;
 float clipZ=((farPlane+nearPlane)/(farPlane-nearPlane)*d-2.*farPlane*nearPlane/(farPlane-nearPlane))/u_camera;
 gl_Position=vec4(world.x*2./u_aspect,world.y*2.,clipZ,d/u_camera);
 v_normal=rotation*normal;v_world=world;v_local=a_position;v_color=a_color;v_surface=a_surface;
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec3 v_normal;
in vec3 v_world;
in vec3 v_local;
in vec4 v_color;
in float v_surface;
uniform float u_camera;
uniform float u_lighting;
out vec4 outColor;
const float PI=3.14159265;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec3 n=normalize(v_normal);if(!gl_FrontFacing)n=-n;
 vec3 view=normalize(vec3(0.,0.,u_camera)-v_world);
 vec3 light=normalize(vec3(-.35,.8,1.1));
 vec3 halfway=normalize(light+view);
 float ndl=max(.0,dot(n,light)),ndv=max(.025,dot(n,view));
 bool fin=v_surface>.5&&v_surface<1.5;
 bool eye=v_surface>1.5;
 vec3 base=v_color.rgb;
 // Keep structural blue on the flank: the color shifts with viewing angle, not a flat glow.
 float stripe=step(.15,base.b-base.r)*(1.-step(.5,v_surface));
 base=mix(base,mix(vec3(.005,.15,.66),vec3(.01,.64,.82),pow(ndv,.8)),stripe*.72);
 float roughness=eye?.13:(fin?.48:.36);
 if(!fin&&!eye){
   vec2 cell=vec2(v_local.x*85.,v_local.y*120.);
   cell.x+=mod(floor(cell.y),2.)*.5;
   float scale=hash(floor(cell));
   float edge=smoothstep(.32,.49,length(fract(cell)-.5));
   base*=.92+scale*.13-edge*.065;
   roughness+=scale*.09;
 }
 float a=roughness*roughness,a2=a*a,nh=max(0.,dot(n,halfway));
 float denom=nh*nh*(a2-1.)+1.;
 float distribution=a2/(PI*denom*denom+.0001);
 float k=(roughness+1.)*(roughness+1.)/8.;
 float geometry=(ndl/(ndl*(1.-k)+k))*(ndv/(ndv*(1.-k)+k));
 vec3 f0=eye?vec3(.055):mix(vec3(.045),base,stripe*.52+.18);
 vec3 fresnel=f0+(1.-f0)*pow(1.-max(0.,dot(view,halfway)),5.);
 vec3 specular=distribution*geometry*fresnel/max(.01,4.*ndl*ndv);
 vec3 ambient=mix(vec3(.09,.15,.12),vec3(.40,.51,.57),n.y*.5+.5);
 vec3 color=base*(ambient+ndl*.66)+specular*ndl*1.65;
 float rim=pow(1.-ndv,3.);
 color+=vec3(.05,.18,.20)*rim*(eye?.1:.28);
 if(fin)color=base*(.65+ndl*.6)+vec3(.12,.18,.20)*rim;
 if(u_lighting>.5&&u_lighting<1.5)color*=vec3(1.10,.84,.62);
 if(u_lighting>1.5)color*=vec3(.32,.50,.76);
 float fog=clamp((.38-v_world.z)*.42,0.,.30);
 color=mix(color,vec3(.025,.065,.046),fog);
 color=pow(max(color,vec3(0.)),vec3(1./2.2));
 outColor=vec4(color,fin?v_color.a:1.);
}`;

export class TetraRenderer {
  constructor(gl) { this.gl = gl; this.ready = false; this.instances = new Float32Array(160*12); }
  async load() {
    const [metaResponse, bufferResponse] = await Promise.all([
      fetch('assets/neon-tetra/neon-tetra.mesh.json'), fetch('assets/neon-tetra/neon-tetra.mesh.bin')]);
    if (!metaResponse.ok || !bufferResponse.ok) throw new Error('3D 네온테트라 모델 파일을 읽지 못했습니다. 설치 파일 전체를 확인하세요.');
    const meta = await metaResponse.json(), data = await bufferResponse.arrayBuffer();
    const total = meta.opaqueVertices+meta.finVertices;
    if (meta.version!==1 || meta.stride!==11 || !Number.isSafeInteger(total) || total<3 || total>300000 || data.byteLength!==total*44) throw new Error('3D 모델 형식이 올바르지 않습니다.');
    const lodResponse = await fetch('assets/neon-tetra/neon-tetra.lod.bin');
    if (!lodResponse.ok) throw new Error('3D 경량 모델을 읽지 못했습니다.');
    const lodData = await lodResponse.arrayBuffer(), lodTotal = meta.lod?.opaqueVertices+meta.lod?.finVertices;
    if (!Number.isSafeInteger(lodTotal) || lodTotal<3 || lodTotal>total || lodData.byteLength!==lodTotal*44) throw new Error('3D 경량 모델 형식이 올바르지 않습니다.');
    const gl = this.gl;
    this.meta = meta; this.program = createProgram(gl,VERTEX,FRAGMENT);
    this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.instances.byteLength,gl.DYNAMIC_DRAW);
    this.full = this.geometry(data,meta);
    this.lod = this.geometry(lodData,meta.lod);
    this.aspect=gl.getUniformLocation(this.program,'u_aspect');this.camera=gl.getUniformLocation(this.program,'u_camera');this.lighting=gl.getUniformLocation(this.program,'u_lighting');
    gl.bindVertexArray(null);this.ready=true;
  }
  geometry(data, ranges) {
    const gl=this.gl, vao=gl.createVertexArray();gl.bindVertexArray(vao);
    const mesh=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,mesh);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    for(const [name,size,offset] of [['a_position',3,0],['a_normal',3,12],['a_color',4,24],['a_surface',1,40]]){
      const a=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,44,offset);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    for(const [name,offset] of [['a_fish',0],['a_pose',16],['a_swim',32]]){
      const a=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,4,gl.FLOAT,false,48,offset);gl.vertexAttribDivisor(a,1);
    }
    return {vao,mesh,...ranges};
  }
  draw(sim, lighting) {
    if (!this.ready) return;
    const gl=this.gl;
    // Sort instances, not simulation state. Fin membranes blend back-to-front; opaque
    // meshes use a depth buffer, so overlaps and turns are genuinely three-dimensional.
    const fish=[...sim.fish].sort((a,b)=>a.z-b.z);
    let i=0;
    for(const f of fish){
      this.instances.set([f.x,f.y,f.z,f.length/this.meta.length,f.yaw,f.pitch,f.roll,f.phase,f.tail,f.bend,f.panic,0],i);i+=12;
    }
    const geometry=sim.settings.quality==='high'?this.full:this.lod;
    this.drawnVertices=geometry.opaqueVertices+geometry.finVertices;
    gl.useProgram(this.program);gl.bindVertexArray(geometry.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.instances.subarray(0,i));
    gl.uniform1f(this.aspect,sim.aspect);gl.uniform1f(this.camera,CAMERA_DISTANCE);gl.uniform1f(this.lighting,lighting);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
    gl.drawArraysInstanced(gl.TRIANGLES,0,geometry.opaqueVertices,fish.length);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    gl.drawArraysInstanced(gl.TRIANGLES,geometry.opaqueVertices,geometry.finVertices,fish.length);
    gl.depthMask(true);gl.disable(gl.DEPTH_TEST);
  }
  dispose() {
    const gl=this.gl;
    if(this.program)gl.deleteProgram(this.program);
    for(const geometry of [this.full,this.lod])if(geometry){gl.deleteVertexArray(geometry.vao);gl.deleteBuffer(geometry.mesh);}
    if(this.buffer)gl.deleteBuffer(this.buffer);
    this.ready=false;
  }
}
