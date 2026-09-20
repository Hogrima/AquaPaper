// Six depth planes cached once on the GPU at load time from the existing aquarium artwork.
// Overlapping feathered masks and a small overscan cover newly exposed boundaries.
export const BACKGROUND_VERTEX = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main(){v_uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}`;
export const LAYER_BAKE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_image;
uniform float u_layer;
float band(float a,float b,float x){return smoothstep(a,b,x);}
float maskAt(vec2 p){
 float sides=abs(p.x-.5)*2.;
 if(u_layer<.5)return 1.;
 if(u_layer<1.5)return band(.14,.43,sides)*(1.-band(.50,.69,p.y));
 if(u_layer<2.5)return band(.34,.59,p.x)*band(.28,.50,p.y)*(1.-band(.71,.82,p.y));
 if(u_layer<3.5){
   float upper=.24+.64*p.x,lower=.60+.52*p.x;
   return band(upper-.025,upper+.025,p.y)*(1.-band(lower-.035,lower+.03,p.y))*(1.-band(.70,.78,p.x));
 }
 if(u_layer<4.5)return band(.73,.86,p.y);
 float edge=.88-.20*p.y+.035*sin(p.y*8.);
 return band(edge-.06,edge+.06,sides);
}

void main(){vec2 p=vec2(v_uv.x,1.-v_uv.y);outColor=vec4(texture(u_image,p).rgb,maskAt(p));}
`;
export const BACKGROUND_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_layer0,u_layer1,u_layer2,u_layer3,u_layer4,u_layer5;
uniform vec2 u_resolution,u_imageSize,u_orbit;
uniform float u_time,u_lighting;
vec4 plane(sampler2D image,vec2 p,vec2 drift,float depth,float phase){
 p+=drift*depth;
 float plants=smoothstep(.25,.49,abs(p.x-.5))*(1.-smoothstep(.62,.95,p.y));
 p.x+=sin(p.y*8.+u_time*.35+p.x*5.+phase)*.0022*plants;
 return texture(image,clamp(vec2(p.x,1.-p.y),vec2(.001),vec2(.999)));
}
void main(){
 vec2 uv=vec2(v_uv.x,1.-v_uv.y);
 float ar=u_resolution.x/u_resolution.y,iar=u_imageSize.x/u_imageSize.y;
 vec2 cover=ar>iar?vec2(1.,iar/ar):vec2(ar/iar,1.);
 vec2 p=(uv-.5)*cover*.975+.5,drift=u_orbit*vec2(1./ar,1.)*cover;
 vec3 color=plane(u_layer0,p,drift,.12,0.).rgb;
 vec4 layer=plane(u_layer1,p,drift,.28,.27);color=mix(color,layer.rgb,layer.a);
 layer=plane(u_layer2,p,drift,.46,.54);color=mix(color,layer.rgb,layer.a);
 layer=plane(u_layer3,p,drift,.70,.81);color=mix(color,layer.rgb,layer.a);
 layer=plane(u_layer4,p,drift,1.,1.08);color=mix(color,layer.rgb,layer.a);
 layer=plane(u_layer5,p,drift,1.38,1.35);color=mix(color,layer.rgb,layer.a);
 if(u_lighting>.5&&u_lighting<1.5)color*=vec3(1.16,.91,.69);
 if(u_lighting>1.5)color*=vec3(.34,.54,.76);
 outColor=vec4(color,1.);
}
`;
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

// Viewed from below: crossed capillary waves, a refracted reflection of the tank,
// Fresnel brightening at grazing angles and broken overhead highlights.
export const WATER_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_image;
uniform float u_time,u_lighting;
uniform vec2 u_resolution;
void main(){
 vec2 uv=vec2(v_uv.x,1.-v_uv.y);float t=u_time,ar=u_resolution.x/u_resolution.y;
 float line=.095+.004*sin(uv.x*ar*7.+t*.45)+.002*sin(uv.x*ar*19.-t*.65);
 if(uv.y>line+.025)discard;
 float depth=clamp(uv.y/line,0.,1.);
 vec2 q=vec2(uv.x*ar*2.6,1./(.20+depth)*.36);
 q+=vec2(sin(q.y*3.1+t*.12),sin(q.x*2.7-t*.10))*.15;
 vec2 slope=vec2(cos(q.x*8.+q.y*5.+t*.75)*.36+cos(q.x*15.-q.y*9.-t*.51)*.15,
                 sin(q.y*13.+q.x*3.-t*.62)*.26+sin(q.x*11.+q.y*8.+t*.47)*.14);
 vec3 n=normalize(vec3(slope.x,.85,slope.y));
 vec3 light=normalize(vec3(-.3,1.,.6)),view=normalize(vec3(0.,.22+depth*.4,1.));
 float highlight=pow(max(0.,dot(n,normalize(light+view))),44.);
 float wave=sin(q.x*19.+q.y*17.+t*.62)+sin(q.x*12.-q.y*23.-t*.53);
 float lace=pow(max(0.,wave*.5),7.);
 vec2 reflected=vec2(uv.x,clamp(.08+depth*.26+slope.y*.025,.001,.5))+slope*.012;
 vec3 environment=texture(u_image,clamp(reflected,vec2(.001),vec2(.999))).rgb;
 float fresnel=.02+.78*pow(1.-max(0.,dot(n,view)),5.);
 vec3 color=mix(vec3(.075,.16,.12),environment, .56+fresnel*.30);
 color+=vec3(.80,.90,.67)*(highlight*.85+lace*.18);
 if(u_lighting>.5&&u_lighting<1.5)color*=vec3(1.15,.85,.58);
 if(u_lighting>1.5)color*=vec3(.28,.52,.8);
 float alpha=(1.-smoothstep(line-.024,line+.012,uv.y))*(.42+highlight*.22+lace*.12);
 outColor=vec4(color,alpha);
}`;

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
