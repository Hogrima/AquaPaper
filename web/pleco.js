// P. pardalis juveniles/subadults, 20–28 cm in the same 55 cm-height scene as the tetras.
// A behavior-inspired display, not a fitted biological model. See docs/PLECO.md.
import { projectPoint } from './scene.js';
export const MAX_PLECOS = 8;
export const clampPlecos = value => Number.isFinite(value) ? Math.max(0, Math.min(MAX_PLECOS, Math.round(value))) : 0;
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const norm = v => {const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

// Rotation columns are forward, dorsal and right. Unlike Euler angles this also
// supports a fish pointing straight up a pane, with its belly facing the glass.
export function surfaceQuaternion(forward, dorsal) {
  let x=norm(forward), z=cross(x,dorsal);
  if(Math.hypot(...z)<.001) z=cross(x,Math.abs(x[2])<.9?[0,0,1]:[1,0,0]);
  z=norm(z);const y=cross(z,x), m=[x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]];
  const trace=m[0]+m[4]+m[8];let q;
  if(trace>0){const s=Math.sqrt(trace+1)*2;q=[(m[7]-m[5])/s,(m[2]-m[6])/s,(m[3]-m[1])/s,s/4];}
  else if(m[0]>m[4]&&m[0]>m[8]){const s=Math.sqrt(1+m[0]-m[4]-m[8])*2;q=[s/4,(m[1]+m[3])/s,(m[2]+m[6])/s,(m[7]-m[5])/s];}
  else if(m[4]>m[8]){const s=Math.sqrt(1+m[4]-m[0]-m[8])*2;q=[(m[1]+m[3])/s,s/4,(m[5]+m[7])/s,(m[2]-m[6])/s];}
  else{const s=Math.sqrt(1+m[8]-m[0]-m[4])*2;q=[(m[2]+m[6])/s,(m[5]+m[7])/s,s/4,(m[3]-m[1])/s];}
  return norm(q);
}
function orient(f, target, rate) {
  const sign=f.orientation.reduce((sum,v,i)=>sum+v*target[i],0)<0?-1:1;
  f.orientation=norm(f.orientation.map((v,i)=>v+(target[i]*sign-v)*rate));
}

export function shelters(aspect,count) {
  // Stable slots: adding a fish doesn't move the existing homes. Back row sits
  // deeper in the tank, not higher above the substrate. Each fish has its own refuge.
  const columns=Math.max(1,Math.floor(aspect/.38));
  return Array.from({length:clampPlecos(count)},(_,i)=>({
    id:i, species:'shelter', x:aspect*((i%columns)+.5)/columns, y:.93,
    z:-.06-Math.floor(i/columns)*.20, length:.28, orientation:[0,0,0,1], phase:0,tail:0,bend:0,panic:0
  }));
}

export class PlecoColony {
  constructor(aspect,settings,random=Math.random) {
    this.aspect=aspect;this.settings=settings;this.random=random;this.fish=[];this.homes=[];this.nextId=0;this.time=0;
    this.setCount(settings.plecoCount);
  }
  setCount(count) {
    count=clampPlecos(count);this.fish.length=Math.min(count,this.fish.length);this.homes=shelters(this.aspect,count);
    const r=this.random;
    while(this.fish.length<count) {
      const slot=this.fish.length, cm=20+r()*8;
      const f={id:this.nextId++,slot,species:'pleco',length:cm/55,centimeters:cm,x:0,y:0,z:0,vx:0,vy:0,vz:0,
        orientation:[0,0,0,1],phase:r()*Math.PI*2,tail:0,bend:0,panic:0,noise:r()*6.28,
        state:'rest',surface:'front',dwell:18+r()*30,threat:0,cooldown:0,path:[],travelTime:0};
      const target=this.spot(f,slot%3===0?'front':slot%3===1?'cave':'floor');
      Object.assign(f,{x:target.x,y:target.y,z:target.z,surface:target.surface,state:target.surface==='cave'?'hide':'rest'});
      if(target.surface==='front')target.x=this.aspect*(.2+.6*((slot/3)%3)/2);
      f.x=target.x;f.heading=target.heading;f.orientation=surfaceQuaternion(target.heading,target.up);
      this.fish.push(f);
    }
  }
  spot(f,surface) {
    const r=this.random, pad=Math.min(this.aspect*.43,f.length*.57), scale=f.length/2.4;
    const angle=-Math.PI*.5+(r()-.5)*1.1, home=this.homes[f.slot];
    if(surface==='cave') return {x:home.x,y:.93-.085*scale,z:home.z-.27,surface,heading:[0,0,-1],up:[0,1,0]};
    if(surface==='floor') return {x:pad+r()*Math.max(0,this.aspect-pad*2),y:.93-.085*scale,z:.18+r()*.10,surface,heading:[r()>.5?1:-1,0,0],up:[0,1,0]};
    return {x:pad+r()*Math.max(0,this.aspect-pad*2),y:.31+r()*.32,z:surface==='front'?.42-.085*scale:-.67+.085*scale,
      surface,heading:[Math.cos(angle),-Math.sin(angle),0],up:surface==='front'?[0,0,-1]:[0,0,1]};
  }
  route(f,target,escape=false) {
    const home=this.homes[f.slot];f.path=[];
    if(f.surface==='cave') f.path.push({...this.spot(f,'cave'),z:home.z+.28,heading:[0,0,1],surface:'free'});
    if(target.surface==='cave') f.path.push({...target,z:home.z+.28,surface:'free'});
    f.path.push(target);f.state=escape?'flee':'travel';f.surface='free';f.travelTime=0;
  }
  resize(aspect) {
    if(!Number.isFinite(aspect)||aspect<=0)return;
    const ratio=aspect/this.aspect;this.aspect=aspect;this.homes=shelters(aspect,this.fish.length);
    for(const f of this.fish){f.x*=ratio;for(const p of f.path)p.x*=ratio;
      // Attached fish track the same physical pane; hidden fish remain inside their home.
      if(f.state==='hide'){const p=this.spot(f,'cave');f.x=p.x;f.y=p.y;f.z=p.z;}
      else if(f.path.at(-1)?.surface==='cave')this.route(f,this.spot(f,'cave'),f.state==='flee');
    }
  }
  step(dt,settings,cursor) {
    if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.04);this.settings=settings;this.time+=dt;
    const dark=settings.lighting==='night'?1:settings.lighting==='dusk'?.6:0,r=this.random;
    for(const f of this.fish) {
      f.cooldown=Math.max(0,f.cooldown-dt);f.panic*=Math.exp(-dt*1.4);
      const {x:px,y:py}=projectPoint(f,this.aspect,this.time,settings.parallax);
      const close=settings.interaction&&cursor.active&&Math.hypot(px-cursor.x,py-cursor.y)<f.length*.35+.08;
      f.threat=close?f.threat+dt:Math.max(0,f.threat-dt*2);
      if(close&&f.state!=='hide'&&f.state!=='flee'&&!f.cooldown&&(f.threat>.3||cursor.speed>.6)) {
        f.panic=1;f.cooldown=6;this.route(f,this.spot(f,'cave'),true);
      }
      if(f.state==='travel'||f.state==='flee') {
        const p=f.path[0];if(!p)continue;
        const dx=p.x-f.x,dy=p.y-f.y,dz=p.z-f.z,d=Math.hypot(dx,dy,dz);
        f.travelTime+=dt;
        const speed=(f.state==='flee'?.24:.045+dark*.025)*clamp(settings.activity/65,.6,1.5);
        f.speed=(f.speed||0)+(Math.min(speed,Math.sqrt(.045*d))-(f.speed||0))*Math.min(1,dt*5);
        const step=Math.min(d,f.speed*dt);let direction=norm([dx,dy,dz]);
        // Slow near another pleco; do not form a school or force two mouths onto one spot.
        const crowded=this.fish.some(o=>o!==f&&Math.hypot(o.x-f.x,o.y-f.y,o.z-f.z)<(o.length+f.length)*.13);
        if(crowded && p.surface !== 'cave') {
          for(const o of this.fish)if(o!==f&&o.state!=='hide') {
            const ox=f.x-o.x,oz=f.z-o.z,dist=Math.hypot(ox,f.y-o.y,oz),radius=(o.length+f.length)*.15;
            if(dist<radius){const avoid=(1-dist/radius)*.7;direction=norm([direction[0]+(ox||.01)*avoid/Math.max(.01,dist),direction[1],direction[2]+(oz||.02)*avoid/Math.max(.01,dist)]);}
          }
        }
        const move=step;
        f.vx=direction[0]*move/dt;f.vy=direction[1]*move/dt;f.vz=direction[2]*move/dt;
        f.x+=f.vx*dt;f.y+=f.vy*dt;f.z+=f.vz*dt;
        const near=d<.06, heading=near?p.heading:[direction[0],-direction[1],direction[2]];
        orient(f,surfaceQuaternion(heading,near?p.up:[0,1,0]),Math.min(1,dt*(f.state==='flee'?7:3)));
        f.tail+=(.55+f.panic*.35-f.tail)*Math.min(1,dt*8);
        if(d<.002) {
          f.x=p.x;f.y=p.y;f.z=p.z;f.heading=p.heading;f.path.shift();
          if(!f.path.length){f.surface=p.surface;f.state=p.surface==='cave'?'hide':'rest';f.vx=f.vy=f.vz=0;f.speed=0;
            f.dwell=f.state==='hide'?(dark?10+r()*22:40+r()*85):(dark?5+r()*16:18+r()*50);
            f.orientation=surfaceQuaternion(p.heading,p.up);
          }
        }
      } else {
        f.vx=f.vy=f.vz=0;f.dwell-=dt;f.tail+=(0-f.tail)*Math.min(1,dt*6);
        if(f.state==='graze'&&!close) {
          // Slow surface rasping/crawling while the belly stays on the pane/substrate.
          const v=.0035*(1+dark), h=f.heading;
          f.x+=h[0]*v*dt;f.y-=h[1]*v*dt;f.z+=h[2]*v*dt;
          f.x=clamp(f.x,Math.min(this.aspect*.4,f.length*.55),Math.max(this.aspect*.6,this.aspect-f.length*.55));
          if(f.surface!=='floor')f.y=clamp(f.y,.24,.73);
        }
        if(f.dwell<=0) {
          if(f.state==='rest'&&r()<.65){f.state='graze';f.dwell=8+r()*15;}
          else {
            const chance=r(),surface=chance<(dark?.12:.48)?'cave':chance<.68?'floor':chance<.90?'front':'back';
            this.route(f,this.spot(f,surface));
          }
        }
      }
      const home=this.homes[f.slot];
      f.cover=Math.abs(f.x-home.x)<.11&&f.y>.82?clamp((home.z+.10-f.z)/.34,0,1):0;
      // Rasping and opercular breathing continue while attached; large tail beats do not.
      f.phase+=dt*(f.state==='travel'||f.state==='flee'?8+f.panic*9:2.7);
    }
  }
}
