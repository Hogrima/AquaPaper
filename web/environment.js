export const BACKGROUND_VERTEX = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main(){v_uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}`;
export const LIGHT_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform float u_time,u_lighting;
void main(){
 vec2 uv=vec2(v_uv.x,1.-v_uv.y);float t=u_time;
 float beams=pow(max(0.,sin((uv.x+uv.y*.16)*27.+sin(t*.13+uv.x*11.)+t*.08)),14.);
 float caustic=sin(uv.x*48.+sin(uv.y*33.+t*.38)*2.)+sin(uv.y*49.+sin(uv.x*40.-t*.31)*1.8);
 vec3 color=vec3(.19,.24,.13)*beams*exp(-uv.y*3.5)*.10;
 color+=vec3(.25,.30,.19)*pow(max(0.,caustic*.5),9.)*smoothstep(.63,.95,uv.y)*.10;
 if(u_lighting>.5&&u_lighting<1.5)color*=vec3(1.16,.91,.69);
 if(u_lighting>1.5)color*=vec3(.34,.54,.76);
 outColor=vec4(color,1.);
}
`;

export const PARTICLE_VERTEX = `#version 300 es
precision highp float;
in vec4 a_particle;
uniform float u_time,u_pixelRatio,u_aspect,u_bubbles;
uniform vec2 u_orbit;
out float v_opacity,v_bubble,v_focus;
void main(){
 float t=u_time,near=a_particle.z;
 float x,y;
 if(u_bubbles>.5){
   float life=fract(a_particle.y+t*(.028+near*.043));
   float source=a_particle.x<.5?.105:.91;
   x=source+(a_particle.x-.5)*.045+sin(t*(.8+near)+a_particle.w*40.)*(.003+life*.008);
   y=.97-life*.96;
   v_opacity=(.44+near*.38)*smoothstep(0.,.06,life)*(1.-smoothstep(.90,1.,life));
   gl_PointSize=(3.5+near*7.5)*u_pixelRatio;
 }else{
   x=fract(a_particle.x+t*(.0006+near*.0013)+sin(t*.13+a_particle.w*40.)*.012);
   y=fract(a_particle.y-t*.0014+sin(t*.17+a_particle.x*37.)*(.010+near*.009));
   v_opacity=(.26+near*.35)*smoothstep(0.,.045,y)*(1.-smoothstep(.96,1.,y));
   gl_PointSize=(1.4+near*3.2+step(.9,near)*2.)*u_pixelRatio;
 }
 x-=u_orbit.x*(.22+near*1.3)/u_aspect;y-=u_orbit.y*(.22+near*1.3);
 gl_Position=vec4(x*2.-1.,1.-y*2.,0.,1.);
 v_bubble=u_bubbles;v_focus=near;
}`;
export const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
in float v_opacity,v_bubble,v_focus;
out vec4 outColor;
void main(){
 vec2 p=gl_PointCoord*2.-1.;float d=length(p);if(d>1.)discard;
 float alpha;vec3 color;
 if(v_bubble>.5){
   float rim=exp(-pow((d-.74)*11.,2.));
   float glint=exp(-dot(p-vec2(-.30,-.46),p-vec2(-.30,-.46))*42.);
   alpha=(rim*.60+glint*.9+exp(-d*d*7.)*.06)*v_opacity;
   color=mix(vec3(.29,.50,.40),vec3(.86,.96,.86),clamp(.55-p.y*.3+glint,0.,1.));
 }else{
   alpha=exp(-d*d*mix(4.,2.4,step(.9,v_focus)))*v_opacity*(1.-smoothstep(.75,1.,d));
   color=mix(vec3(.59,.71,.48),vec3(.92,.92,.76),v_focus);
 }
 outColor=vec4(color,alpha);
}`;
