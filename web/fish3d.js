import { createProgram } from './gl.js';
import { CAMERA_DISTANCE } from './simulation3d.js';
import { cameraOrbit } from './scene.js';

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
uniform vec2 u_orbit;
out vec3 v_normal;
out vec3 v_world;
out vec3 v_local;
out vec4 v_color;
out float v_surface;
out float v_cover;
flat out float v_kind;
float flex(float x){
 if(a_swim.w>1.5&&a_swim.w<2.5)return 0.;
 if(a_swim.w>.5&&a_swim.w<1.5)return pow(clamp((.15-x)/1.60,0.,1.),2.)*sin(a_swim.z+x*4.8)*.22*a_swim.x;
 float envelope=pow(clamp((.48-x)/1.68,0.,1.),2.);
 return envelope*(sin(a_pose.w+x*5.2)*(.035+.19*a_swim.x)+a_swim.y);
}
void main(){
 vec3 p=a_position;
 p.z+=flex(p.x);
 // Paired pectoral fins make small stabilizing strokes, including while coasting.
 if((a_swim.w<.5||a_swim.w>2.5)&&a_surface>.5&&a_surface<1.5&&p.x>.0&&p.y<-.035){
   p.z+=sin(a_pose.w*.55+sign(p.z))*.025*smoothstep(.07,.25,abs(p.z));
 }
 if(a_swim.w>5.5&&a_swim.w<6.5&&a_surface>.5&&a_surface<1.5&&p.y>.48){
   p.z+=sin(a_pose.w*.42+p.x*4.2)*.045*smoothstep(.48,1.05,p.y);
 }
 if(a_swim.w>.5&&a_swim.w<1.5){
   if(a_surface>.5&&a_surface<1.5&&p.y>.22)p.y=.22+(p.y-.22)*(.32+.68*a_swim.x);
   if(p.x>.40){p.z*=1.+.009*sin(a_swim.z);if(p.y<-.055)p.y-=.0015*sin(a_swim.z*1.7);}
 }
 vec3 normal=normalize(vec3(a_normal.x-a_normal.z*(flex(p.x+.002)-flex(p.x-.002))/.004,a_normal.yz));
 float cy=cos(a_pose.x),sy=sin(a_pose.x),cp=cos(a_pose.y),sp=sin(a_pose.y);
 vec3 forward=vec3(cy*cp,sp,sy*cp);
 vec3 side=normalize(cross(forward,vec3(0.,1.,0.)));
 vec3 up=cross(side,forward);
 vec3 rolledUp=up*cos(a_pose.z)+side*sin(a_pose.z);
 vec3 rolledSide=side*cos(a_pose.z)-up*sin(a_pose.z);
 mat3 rotation=mat3(forward,rolledUp,rolledSide);
 if(a_swim.w>.5&&a_swim.w<2.5){
   vec4 q=a_pose;vec3 q2=q.xyz*2.;
   rotation=mat3(1.-q.y*q2.y-q.z*q2.z,q.x*q2.y+q.w*q2.z,q.x*q2.z-q.w*q2.y,
                 q.x*q2.y-q.w*q2.z,1.-q.x*q2.x-q.z*q2.z,q.y*q2.z+q.w*q2.x,
                 q.x*q2.z+q.w*q2.y,q.y*q2.z-q.w*q2.x,1.-q.x*q2.x-q.y*q2.y);
 }
 vec3 world=vec3(a_fish.x-u_aspect*.5,.5-a_fish.y,a_fish.z)+rotation*p*a_fish.w;
 world.xy+=vec2(-u_orbit.x,u_orbit.y)*.82;
 float d=u_camera-world.z,nearPlane=.1,farPlane=5.;
 float clipZ=((farPlane+nearPlane)/(farPlane-nearPlane)*d-2.*farPlane*nearPlane/(farPlane-nearPlane))/u_camera;
 gl_Position=vec4(world.x*2./u_aspect,world.y*2.,clipZ,d/u_camera);
 v_normal=rotation*normal;v_world=world;v_local=a_position;v_color=a_color;v_surface=a_surface;v_kind=a_swim.w;v_cover=a_swim.w>.5&&a_swim.w<1.5?a_swim.y:0.;
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec3 v_normal;
in vec3 v_world;
in vec3 v_local;
in vec4 v_color;
in float v_surface;
in float v_cover;
flat in float v_kind;
uniform float u_camera;
uniform float u_lighting;
out vec4 outColor;
const float PI=3.14159265;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec2 skinCell(vec2 uv){
 vec2 cell=floor(uv),local=fract(uv);float first=10.,second=10.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
   vec2 o=vec2(float(x),float(y));vec2 id=cell+o;
   vec2 jitter=vec2(hash(id),hash(id+vec2(53.7,19.1)));
   float d=length(o+.25+jitter*.5-local);
   if(d<first){second=first;first=d;}else second=min(second,d);
 }
 return vec2(first,second-first);
}
vec3 skinNormal(vec3 n,float height){
 vec3 dx=dFdx(v_world),dy=dFdy(v_world),r1=cross(dy,n),r2=cross(n,dx);
 float det=dot(dx,r1);
 return normalize(n-sign(det)*(dFdx(height)*r1+dFdy(height)*r2)/max(abs(det),.0000001));
}

void main(){
 vec3 n=normalize(v_normal);if(!gl_FrontFacing)n=-n;
 vec3 base=v_color.rgb;float skinRoughness=.62;
 // Object-space detail cannot turn into a magnified low-resolution color texture.
 // Derivative filtering suppresses shimmer at distance and preserves detail close up.
 if(v_kind>.5&&v_kind<1.5&&v_surface<1.5){
   bool membrane=v_surface>.5;
   vec2 uv=membrane?vec2(v_local.x*17.,v_local.y*23.+v_local.z*13.):vec2(v_local.x*16.,v_local.z*27.+v_local.y*9.);
   vec2 cell=skinCell(uv);float aa=max(.012,length(fwidth(uv))*.7);
   float spot=1.-smoothstep(.17-aa,.28+aa,cell.x);
   float belly=membrane?0.:1.-smoothstep(-.045,-.012,v_local.y);
   base=mix(vec3(.15,.113,.042),vec3(.012,.019,.008),spot);
   base=mix(base,vec3(.22,.185,.105)*(1.-spot*.48),belly*.82);
   // Fin rays are separate Blender geometry; keep them legible through the membrane.
   if(membrane)base*=mix(.80,1.24,smoothstep(.72,.80,v_color.a));
   float grain=hash(floor(uv*13.));float grainVisibility=1.-smoothstep(.3,1.,length(fwidth(uv*13.)));
   base*=1.+(grain-.5)*.14*grainVisibility;
   vec2 plates=skinCell(vec2(v_local.x*11.,v_local.z*13.+v_local.y*4.));
   float seam=(1.-smoothstep(.016,.065,plates.y))*(1.-belly)*(membrane?0.:1.);
   base*=1.-seam*.27;
   float abdominalFold=sin(v_local.x*65.+sin(v_local.z*16.)*.8)*belly*.000035;
   float ridge=(1.-seam)*.00022+(grain-.5)*grainVisibility*.000045+abdominalFold;
   n=skinNormal(n,ridge);
   skinRoughness=.46+grain*.13+seam*.12;
 }
 if(v_kind>.5&&v_kind<1.5&&v_surface>2.5){
   vec2 oral=vec2(v_local.x-.72,v_local.z/ .93);
   float radius=length(oral),angle=atan(oral.y,oral.x);
   float grooves=sin(angle*47.+sin(angle*13.)*.6);
   float lip=smoothstep(.10,.14,radius);
   base*=1.+grooves*.12*lip;
   n=skinNormal(n,grooves*.000035*lip);
   skinRoughness=.67;
 }
 if(v_kind>1.5&&v_kind<2.5){
   float grain=sin(v_local.x*72.+v_local.y*61.+sin(v_local.z*4.)*.8);
   float cracks=pow(max(0.,sin(v_local.x*37.+v_local.y*41.+sin(v_local.z*3.)*.4)),18.);
   base=mix(vec3(.032,.015,.005),vec3(.065,.035,.011),grain*.5+.5)*(1.-cracks*.50);
   float moss=smoothstep(.22,.5,v_local.y)*(.5+.5*sin(v_local.z*17.+v_local.x*21.));
   base=mix(base,vec3(.027,.036,.009),moss*.40);n=skinNormal(n,grain*.00005-cracks*.00009);
 }
 vec3 view=normalize(vec3(0.,0.,u_camera)-v_world);
 vec3 light=normalize(vec3(-.35,.8,1.1));
 vec3 halfway=normalize(light+view);
 float ndl=max(.0,dot(n,light)),ndv=max(.025,dot(n,view));
 bool fin=v_surface>.5&&v_surface<1.5;
 bool eye=v_surface>1.5&&v_surface<2.5;
 // Keep structural blue on the flank: the color shifts with viewing angle, not a flat glow.
 float stripe=step(.15,base.b-base.r)*(1.-step(.5,v_surface))*(1.-step(.5,v_kind));
 base=mix(base,mix(vec3(.005,.15,.66),vec3(.01,.64,.82),pow(ndv,.8)),stripe*.72);
 float roughness=v_kind>1.5&&v_kind<2.5?.92:(eye?.13:(v_kind>.5&&v_kind<1.5?skinRoughness:(fin?.48:.36)));
 if(!fin&&!eye&&(v_kind<.5||v_kind>2.5)){
   bool reefSkin=v_kind>2.5;
   vec2 cell=reefSkin?vec2(v_local.x*58.,v_local.y*72.+v_local.z*22.):vec2(v_local.x*85.,v_local.y*120.);
   cell.x+=mod(floor(cell.y),2.)*.5;
   float scale=hash(floor(cell)),visibility=1.-smoothstep(.65,1.8,length(fwidth(cell)));
   vec2 plate=(fract(cell)-.5)*vec2(1.,1.18);
   float seam=smoothstep(.37,.49,length(plate));
   float pigment=(scale-.5)*.22-seam*.13;
   base*=1.+pigment*visibility*(reefSkin?1.:.55);
   roughness+=scale*(reefSkin?.065:.09)*visibility;
   if(reefSkin){
     // Fine displaced plate edges stay in object space while derivative filtering
     // removes detail once a fish is too small to resolve it.
     n=skinNormal(n,(1.-seam)*.00016*visibility);
     if(v_kind>6.5){
       vec2 spots=vec2(v_local.x*8.,v_local.y*13.+v_local.z*4.);
       spots.x+=mod(floor(spots.y),2.)*.35;
       vec2 spotId=floor(spots),spotLocal=fract(spots)-.5;
       spotLocal+=vec2(hash(spotId),hash(spotId+vec2(19.,37.)))*.16-.08;
       float fleck=1.-smoothstep(.20,.34,length(spotLocal*vec2(1.15,.85)));
       float sharp=1.-smoothstep(.5,1.2,length(fwidth(spots)));
       base=mix(base,vec3(.19,.038,.026),fleck*.88*sharp);
     }
     roughness=v_kind>6.5?.48:v_kind>5.5?.32:v_kind>4.5?.28:v_kind>3.5?.35:.39;
     roughness+=scale*.07*visibility;
   }
 }
 if(fin&&v_kind>2.5){
   float rib=.5+.5*sin(v_local.x*124.+v_local.y*56.+v_local.z*32.);
   float detail=1.-smoothstep(.45,1.3,length(fwidth(v_local.xy*vec2(124.,56.))));
   base*=1.+(rib-.5)*.20*detail;
 }
 float a=roughness*roughness,a2=a*a,nh=max(0.,dot(n,halfway));
 float denom=nh*nh*(a2-1.)+1.;
 float distribution=a2/(PI*denom*denom+.0001);
 float k=(roughness+1.)*(roughness+1.)/8.;
 float geometry=(ndl/(ndl*(1.-k)+k))*(ndv/(ndv*(1.-k)+k));
 vec3 f0=eye?vec3(.055):mix(vec3(.045),base,stripe*.52+.18);
 vec3 fresnel=f0+(1.-f0)*pow(1.-max(0.,dot(view,halfway)),5.);
 vec3 specular=distribution*geometry*fresnel/max(.01,4.*ndl*ndv);
 bool reef=v_kind>2.5;
 vec3 ambient=reef?mix(vec3(.075,.14,.28),vec3(.32,.52,.72),n.y*.5+.5):mix(vec3(.09,.15,.12),vec3(.40,.51,.57),n.y*.5+.5);
 vec3 color=base*(ambient+ndl*.66)+specular*ndl*1.65;
 float rim=pow(1.-ndv,3.);
 color+=vec3(.05,.18,.20)*rim*(eye?.1:.28);
 if(fin)color=base*(.65+ndl*.6)+vec3(.12,.18,.20)*rim;
 if(u_lighting>.5&&u_lighting<1.5)color*=vec3(1.10,.84,.62);
 if(u_lighting>1.5)color*=vec3(.32,.50,.76);
 float fog=clamp((.38-v_world.z)*.42,0.,.30);
 color=mix(color,reef?vec3(.015,.09,.24):vec3(.025,.065,.046),fog);
 color*=mix(1.,.18,clamp(v_cover,0.,1.));
 color=pow(max(color,vec3(0.)),vec3(1./2.2));
 outColor=vec4(color,fin?v_color.a:1.);
}`;

export class TetraRenderer {
  constructor(gl) { this.gl = gl; this.ready = false; this.instances = new Float32Array(176*12); }
  async load() {
    const gl = this.gl;
    this.models = {};
    this.program = createProgram(gl, VERTEX, FRAGMENT);
    this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instances.byteLength, gl.DYNAMIC_DRAW);
    this.attributes = ['a_fish','a_pose','a_swim'].map(name => gl.getAttribLocation(this.program,name));
    for (const [id, slug, file] of [['neon','neon-tetra','neon-tetra'],['rummy','rummy-nose','rummy-nose'],['pleco','pleco','pleco'],['shelter','pleco','shelter'],['clown','coral-clown','clown'],['yellow-tang','coral-yellow-tang','yellow-tang'],['blue-tang','coral-blue-tang','blue-tang'],['moorish-idol','coral-moorish-idol','moorish-idol'],['dwarf-hawkfish','coral-dwarf-hawkfish','dwarf-hawkfish']]) {
      const responses = await Promise.all(['mesh.json','mesh.bin','lod.bin'].map(ext => fetch(`assets/${slug}/${file}.${ext}`)));
      if (responses.some(r => !r.ok)) throw new Error(`Missing 3D model: ${slug}`);
      const [meta,data,lodData] = await Promise.all([responses[0].json(),responses[1].arrayBuffer(),responses[2].arrayBuffer()]);
      for (const [ranges,bytes] of [[meta,data],[meta.lod,lodData]]) {
        const total = ranges?.opaqueVertices + ranges?.finVertices;
        if (meta.version !== 1 || meta.stride !== 11 || !Number.isFinite(meta.length) || meta.length <= 0 || !Number.isSafeInteger(total) || total < 3 || total > 300000 || bytes.byteLength !== total * 44) throw new Error(`Invalid 3D model: ${slug}`);
      }
      this.models[id] = {meta, full:this.geometry(data,meta), lod:this.geometry(lodData,meta.lod)};
    }
    this.meta = this.models.neon.meta;
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
  upload(fish) {
    let i=0;
    for (const f of fish) {
      const kind={pleco:1,shelter:2,clown:3,'yellow-tang':4,'blue-tang':5,'moorish-idol':6,'dwarf-hawkfish':7}[f.species]||0;
      const pose=kind===1||kind===2?f.orientation:[f.yaw,f.pitch,f.roll,f.phase];
      this.instances.set([f.x,f.y,f.z,f.length/this.models[f.species].meta.length,...pose,f.tail,kind===1?(f.cover||0):f.bend,kind===1||kind===2?f.phase:f.panic,kind],i); i+=12;
    }
    const gl=this.gl; gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.instances.subarray(0,i));
  }
  instanceOffset(index) {
    const gl=this.gl; gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    this.attributes.forEach((attribute,i) => gl.vertexAttribPointer(attribute,4,gl.FLOAT,false,48,index*48+i*16));
  }
  draw(sim, lighting) {
    if (!this.ready) return;
    const gl=this.gl, quality=sim.settings.quality==='high'?'full':'lod';
    const allFish=[...sim.fish,...(sim.plecos||[]),...(sim.shelters||[])];
    gl.useProgram(this.program);
    gl.uniform1f(this.aspect,sim.aspect);gl.uniform1f(this.camera,CAMERA_DISTANCE);gl.uniform1f(this.lighting,lighting);
    gl.uniform2f(this.orbit??=gl.getUniformLocation(this.program,'u_orbit'),...cameraOrbit(sim.time,sim.settings.parallax));
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
    this.drawnVertices=0;
    // All opaque bodies go first, irrespective of species.
    for (const [id,model] of Object.entries(this.models)) {
      const fish=allFish.filter(f=>f.species===id); if(!fish.length)continue;
      const geometry=model[quality];this.drawnVertices+=geometry.opaqueVertices+geometry.finVertices;
      gl.bindVertexArray(geometry.vao);this.upload(fish);this.instanceOffset(0);
      gl.drawArraysInstanced(gl.TRIANGLES,0,geometry.opaqueVertices,fish.length);
    }
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    // Transparent fins must be depth sorted ACROSS species. Adjacent fish of the same
    // species share an instanced draw; changing the attribute offset keeps that order.
    const fish=allFish.filter(f=>f.species!=='shelter').sort((a,b)=>a.z-b.z);this.upload(fish);
    for (let start=0;start<fish.length;) {
      const id=fish[start].species;let end=start+1;
      while(end<fish.length&&fish[end].species===id)end++;
      const geometry=this.models[id][quality];gl.bindVertexArray(geometry.vao);this.instanceOffset(start);
      gl.drawArraysInstanced(gl.TRIANGLES,geometry.opaqueVertices,geometry.finVertices,end-start);start=end;
    }
    gl.depthMask(true);gl.disable(gl.DEPTH_TEST);
  }
  dispose() {
    const gl=this.gl;
    if(this.program)gl.deleteProgram(this.program);
    for(const model of Object.values(this.models||{}))for(const geometry of [model.full,model.lod]) {
      gl.deleteVertexArray(geometry.vao);gl.deleteBuffer(geometry.mesh);
    }
    if(this.buffer)gl.deleteBuffer(this.buffer);
    this.ready=false;
  }
}
