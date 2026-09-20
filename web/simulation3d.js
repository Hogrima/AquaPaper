import { PlecoColony } from './pleco.js';
import { population, SPECIES } from './population.js';
import { normalizeSettings } from './simulation.js';
import { projectPoint } from './scene.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TAU = Math.PI * 2;
export const TANK_DEPTH = .34;
export const CAMERA_DISTANCE = 2.7;
export const projectFish = projectPoint;

// A behavior-inspired model, not a fitted biological predictor. See docs/3D-BEHAVIOR.md.
// Units are tank-height units; a 0.055-long fish represents roughly 3 cm in a 55 cm view.
export class TetraSimulation {
  constructor(aspect = 16 / 9, settings = {}, random = Math.random) {
    this.aspect = aspect;
    this.settings = normalizeSettings(settings);
    this.random = random;
    this.time = 0;
    this.fish = [];
    this.nextId = 0;
    this.cursor = { x: -10, y: -10, active: false, speed: 0 };
    this.forces = new Float32Array(160 * 3);
    this.nextPanic = new Float32Array(160);
    this.ids = new Int16Array(6);
    this.distances = new Float64Array(6);
    this.bottomFish = new PlecoColony(aspect, this.settings, random);
    this.setCount(this.settings.count);
  }
  get plecos() { return this.bottomFish.fish; }
  get shelters() { return this.bottomFish.homes; }
  setCount(count) {
    count = clamp(Math.round(Number.isFinite(count) ? count : 72), 12, 160);
    this.settings.count = count;
    this.bottomFish.setCount(this.settings.plecoCount);
    const counts = population(this.settings);
    this.settings.rummyCount = counts.rummy;
    const retained = { neon: 0, rummy: 0 };
    this.fish = this.fish.filter(f => ++retained[f.species] <= counts[f.species]);
    const r = this.random, groups = Math.max(1, Math.min(3, Math.floor(count / 24)));
    for (const species of SPECIES) {
    let remaining = counts[species] - this.fish.filter(f => f.species === species).length;
    while (remaining-- > 0) {
      const id = this.nextId++, group = species === 'rummy' ? 0 : id % groups, yaw = group % 2 ? Math.PI - .25 : .25;
      const length = (species === 'rummy' ? .073 : .057) + (r() - .5) * .014;
      this.fish.push({ id, species, x: this.aspect * (.22 + .56 * (group + .5) / groups) + (r() - .5) * .36,
        y: .42 + (r() - .5) * .24, z: (r() - .5) * .42,
        vx: Math.cos(yaw) * .08, vy: (r() - .5) * .008, vz: Math.sin(yaw) * .08,
        yaw, pitch: 0, roll: 0, phase: r() * TAU, length, panic: 0, tail: .5, bend: 0,
        burst: r() * 1.1, burstDuration: .24 + r() * .12, cycle: .95 + r() * .60,
        noise: r() * TAU, personality: .72 + r() * .56, thrust: false,
        behavior: ['school','school','school','explore','hover','forage'][id%6],
        behaviorTime: 4+r()*16, curiosity: r(), preferredY: .28+r()*.32, preferredZ: (r()-.5)*.32,
        cruise: .11, effort: .45 });
    }
    }
  }
  resize(aspect) {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    for (const f of this.fish) f.x *= aspect / this.aspect;
    this.aspect = aspect;
    this.bottomFish.resize(aspect);
  }
  setCursor(x, y, active = true, speed = 0) {
    this.cursor = { x, y, active: active && Number.isFinite(x + y), speed: clamp(Number.isFinite(speed) ? speed : 0, 0, 4) };
  }
  step(delta) {
    const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, .04);
    const steps = Math.ceil(dt * 60);
    for (let i = 0; i < steps; i++) this.integrate(dt / steps);
  }
  integrate(dt) {
    this.time += dt;
    this.bottomFish.step(dt, this.settings, this.cursor);
    const fish = this.fish, aspect = this.aspect, pace = this.settings.activity / 65;
    const cursor = this.cursor, ids = this.ids, distances = this.distances;
    // Every fish reads the same position/velocity/alarm snapshot. There is no permanent leader
    // or assigned school ID: local visual neighbors can change as groups meet and separate.
    for (let i = 0; i < fish.length; i++) {
      const f = fish[i], speed = Math.max(.001, Math.hypot(f.vx, f.vy, f.vz));
      f.behaviorTime-=dt;
      if(f.behaviorTime<=0){
        const choice=this.random(), school=f.species==='rummy'?.64:.48;
        f.behavior=choice<school?'school':choice<school+.19?'explore':choice<school+.29?'hover':'forage';
        f.behaviorTime=(f.behavior==='school'?12:5)+this.random()*13;
      }
      ids.fill(-1); distances.fill(Infinity);
      let sx = 0, sy = 0, sz = 0, closest = -1, closestD = Infinity;
      for (let j = 0; j < fish.length; j++) {
        if (i === j) continue;
        const o = fish[j], dx = o.x - f.x, dy = o.y - f.y, dz = o.z - f.z, d2 = dx*dx + dy*dy + dz*dz;
        if (o.species === f.species && d2 < closestD) { closestD = d2; closest = j; }
        const d = Math.sqrt(d2), bubble = (f.length + o.length) * .50;
        if (d < bubble) {
          // Lateral-line-like short-range repulsion also works in the rear blind sector.
          const strength = .40 * (1 - d / bubble), inv = 1 / Math.max(d, .0001);
          sx -= (d > .0001 ? dx * inv : Math.cos(i * 2.4)) * strength;
          sy -= (d > .0001 ? dy * inv : Math.sin(i * 2.4)) * strength;
          sz -= dz * inv * strength;
        }
        const visible = d < .36 && (dx*f.vx + dy*f.vy + dz*f.vz) / (Math.max(d, .0001)*speed) > -.86;
        if (o.species === f.species && visible && d2 < distances[5]) {
          let k = 5;
          while (k > 0 && d2 < distances[k-1]) { ids[k] = ids[k-1]; distances[k] = distances[k-1]; k--; }
          ids[k] = j; distances[k] = d2;
        }
      }
      for (const p of this.plecos) {
        if (p.state === 'hide') continue;
        const dx=f.x-p.x,dy=f.y-p.y,dz=f.z-p.z,d=Math.hypot(dx,dy,dz),radius=p.length*.32;
        if(d<radius){const force=(1-d/radius)*.12/Math.max(.001,d);sx+=dx*force;sy+=dy*force;sz+=dz*force;}
      }
      let fx = sx, fy = sy, fz = sz, cx = 0, cy = 0, cz = 0, ax = 0, ay = 0, az = 0, weight = 0, alarm = 0;
      for (let k = 0; k < 6 && ids[k] >= 0; k++) {
        const o = fish[ids[k]], w = 1 / (1 + distances[k] * 45);
        cx += (o.x - f.x)*w; cy += (o.y - f.y)*w; cz += (o.z - f.z)*w;
        ax += (o.vx - f.vx)*w; ay += (o.vy - f.vy)*w; az += (o.vz - f.vz)*w; weight += w;
        // Subcritical alarm transfer avoids an indefinitely self-sustaining panic loop.
        alarm = Math.max(alarm, o.panic * Math.max(0, 1 - Math.sqrt(distances[k]) / .24) * .72);
      }
      const independence = {school:1,explore:.38,hover:.68,forage:.50}[f.behavior];
      const social = f.panic > .5 ? .28 : independence;
      if (weight) {
        const cohesion = (f.species === 'rummy' ? .52 : .43) * social, alignment = (f.species === 'rummy' ? 1.35 : 1.1) * social;
        fx += (cx * cohesion + ax * alignment) / weight;
        fy += (cy * cohesion + ay * alignment) / weight;
        fz += (cz * cohesion + az * alignment) / weight;
      } else if (closest >= 0) {
        // An isolated fish seeks a nearby conspecific instead of orbiting a scripted waypoint.
        const o = fish[closest], d = Math.sqrt(closestD) || 1;
        fx += (o.x - f.x)/d*.055; fy += (o.y - f.y)/d*.045; fz += (o.z - f.z)/d*.045;
      }
      const exploration=f.behavior==='explore'?2.8:1;
      fx += Math.sin(f.noise + this.time * (.19+f.curiosity*.15)) * .011*exploration;
      const preferredY=f.behavior==='forage'?.65:f.preferredY;
      fy += Math.sin(f.noise * 1.7 + this.time * .21) * .004 + (preferredY-f.y)*.026;
      fz += Math.sin(f.noise * 2.3 + this.time * .23) * .014*exploration + (f.preferredZ-f.z)*.022;
      let panic = Math.max(f.panic * Math.exp(-dt * 1.25), alarm);
      if (this.settings.interaction && cursor.active) {
        const projected = projectFish(f, aspect,this.time,this.settings.parallax), dx = projected.x-cursor.x, dy = projected.y-cursor.y;
        const d = Math.hypot(dx, dy), radius = .135 + Math.min(cursor.speed, 1.8)*.022;
        if (d < radius) {
          const response = (1-d/radius)**1.4, inv = 1/Math.max(d,.001);
          fx += (d > .001 ? dx*inv : Math.cos(f.noise))*response*1.15;
          fy += (d > .001 ? dy*inv : Math.sin(f.noise))*response*.85;
          fz -= response*.40;
          panic = Math.max(panic, response);
        }
      }
      // Look ahead to turn before glass/sand. Z limits are the actual 3D tank depth.
      const ahead = .65, px = f.x+f.vx*ahead, py = f.y+f.vy*ahead, pz = f.z+f.vz*ahead;
      const margin = Math.min(.16, aspect*.18);
      fx += Math.max(0, margin-px)*1.5 - Math.max(0, px-aspect+margin)*1.5;
      fy += Math.max(0, .18-py)*1.7 - Math.max(0, py-.74)*1.9;
      fz += Math.max(0, -TANK_DEPTH+.07-pz)*1.6 - Math.max(0, pz-TANK_DEPTH+.07)*1.6;
      this.forces[i*3] = fx; this.forces[i*3+1] = fy; this.forces[i*3+2] = fz;
      this.nextPanic[i] = panic;
    }
    for (let i = 0; i < fish.length; i++) {
      const f = fish[i]; f.panic = this.nextPanic[i];
      f.burst += dt * pace;
      if (f.burst >= f.cycle) {
        f.burst %= f.cycle;
        f.cycle = (.95 + this.random()*.60)/Math.sqrt(f.personality);
        f.burstDuration = .24 + this.random()*.12;
      }
      f.thrust = f.burst < f.burstDuration || f.panic > .28;
      const steering = f.thrust ? 1 : .60;
      const oldSpeed = Math.max(.0001, Math.hypot(f.vx,f.vy,f.vz));
      let nx = f.vx + this.forces[i*3]*dt*steering*pace;
      let ny = f.vy + this.forces[i*3+1]*dt*steering*pace;
      let nz = f.vz + this.forces[i*3+2]*dt*steering*pace;
      const norm = Math.hypot(nx,ny,nz) || 1; nx/=norm;ny/=norm;nz/=norm;
      let yaw = Math.atan2(nz,nx), pitch = Math.asin(clamp(-ny,-1,1));
      const turn = Math.atan2(Math.sin(yaw-f.yaw),Math.cos(yaw-f.yaw));
      const maxTurn = (1.65 + f.panic*5.5)*dt*pace;
      const yawChange = clamp(turn,-maxTurn,maxTurn);
      f.yaw += yawChange;
      f.pitch += clamp(pitch-f.pitch,-maxTurn*.65,maxTurn*.65);
      f.pitch = clamp(f.pitch,-.55-f.panic*.25,.55+f.panic*.25);
      // One smooth kick carries the body through a long glide. Low drag avoids the
      // previous start/stop look; an intent change eases toward a new cruise speed.
      const intentSpeed={school:.125,explore:.15,hover:.045,forage:.075}[f.behavior]*f.personality*pace;
      f.cruise+=(intentSpeed-f.cruise)*(1-Math.exp(-dt*.9));
      const pulse=.32+.68*Math.sin(Math.PI*clamp(f.burst/f.burstDuration,0,1));
      const acceleration = f.thrust ? (.28*pulse + f.panic*.75)*f.personality*pace*pace : 0;
      const drag=.58*pace+Math.max(0,oldSpeed-f.cruise-f.panic*.25)*16;
      const speed = clamp((oldSpeed+acceleration*dt)*Math.exp(-dt*drag),.022*pace,(.18+f.panic*.23)*pace);
      f.vx = Math.cos(f.yaw)*Math.cos(f.pitch)*speed;
      f.vy = -Math.sin(f.pitch)*speed;
      f.vz = Math.sin(f.yaw)*Math.cos(f.pitch)*speed;
      f.x += f.vx*dt;f.y += f.vy*dt;f.z += f.vz*dt;
      const x = clamp(f.x,.04,Math.max(.04,aspect-.04)), y = clamp(f.y,.085,.85), z = clamp(f.z,-TANK_DEPTH,TANK_DEPTH);
      // Emergency correction is only for extreme resizing; normal turns use the soft walls.
      if (x !== f.x) { f.vx = -f.vx; f.yaw = Math.atan2(f.vz,f.vx); } f.x=x;
      if (y !== f.y) { f.vy=-f.vy; f.pitch=-f.pitch; } f.y=y;
      if (z !== f.z) { f.vz=-f.vz; f.yaw=Math.atan2(f.vz,f.vx); } f.z=z;
      const angularRate = yawChange/dt;
      f.roll += (clamp(-angularRate*.07,-.22,.22)-f.roll)*Math.min(1,dt*7);
      f.bend += (clamp(angularRate*.08,-.32,.32)-f.bend)*Math.min(1,dt*9);
      f.effort += ((f.thrust ? .80+f.panic*.2 : .06)-f.effort)*(1-Math.exp(-dt*8));
      f.tail += (f.effort-f.tail)*(1-Math.exp(-dt*9));
      f.phase += dt*TAU*(.30+speed*2.5+f.effort*(2.0+speed*7));
    }
  }
}
