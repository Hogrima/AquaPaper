export const DEFAULTS = Object.freeze({ count: 72, activity: 65, lighting: 'day', interaction: true, particles: true, quality: 'balanced' });
export function normalizeSettings(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  const number = (v, fallback, lo, hi) => typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
  return {
    count: Math.round(number(value.count, DEFAULTS.count, 12, 160)),
    activity: number(value.activity, DEFAULTS.activity, 30, 130),
    lighting: ['day', 'dusk', 'night'].includes(value.lighting) ? value.lighting : 'day',
    interaction: typeof value.interaction === 'boolean' ? value.interaction : true,
    particles: typeof value.particles === 'boolean' ? value.particles : true,
    quality: ['eco', 'balanced', 'high'].includes(value.quality) ? value.quality : 'balanced',
  };
}
export function seededRandom(seed = 51737) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n; return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const tau = Math.PI * 2;

// All distances use viewport height, so sensing and swimming are independent of resolution.
export class AquariumSimulation {
  constructor(aspect = 16 / 9, settings = DEFAULTS, random = Math.random) {
    this.aspect = aspect;
    this.settings = normalizeSettings(settings);
    this.random = random;
    this.fish = [];
    this.time = 0;
    this.cursor = { x: -10, y: -10, active: false, speed: 0 };
    this.accelerations = new Float32Array(320);
    this.setCount(this.settings.count);
  }
  setCount(count) {
    count = clamp(Math.round(Number.isFinite(count) ? count : DEFAULTS.count), 12, 160);
    this.settings.count = count;
    this.fish.length = Math.min(count, this.fish.length);
    while (this.fish.length < count) {
      const id = this.fish.length, school = id % 3, r = this.random;
      const heading = school === 1 ? Math.PI : 0;
      this.fish.push({
        id, school, x: this.aspect * (.19 + school * .28) + (r() - .5) * .30,
        y: .29 + school * .13 + (r() - .5) * .23,
        vx: Math.cos(heading) * (.035 + r() * .024), vy: (r() - .5) * .014,
        angle: heading, phase: r() * tau, size: .013 + r() * .009,
        depth: .23 + r() * .75, panic: 0,
      });
    }
  }
  resize(aspect) {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    const ratio = aspect / this.aspect;
    for (const f of this.fish) f.x *= ratio;
    this.aspect = aspect;
  }
  setCursor(x, y, active = true, speed = 0) { this.cursor = { x, y, active, speed: clamp(speed, 0, 4) }; }
  step(delta) {
    const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, .04);
    if (!dt) return;
    this.time += dt;
    const fish = this.fish, t = this.time, aspect = this.aspect;
    const pace = this.settings.activity / 65, cursor = this.cursor;
    // Compute from the same frame snapshot before applying forces (no ordering bias).
    for (let i = 0; i < fish.length; i++) {
      const f = fish[i];
      let sx = 0, sy = 0, cx = 0, cy = 0, ax = 0, ay = 0, neighbors = 0;
      for (let j = 0; j < fish.length; j++) {
        if (i === j) continue;
        const o = fish[j], dx = f.x - o.x, dy = f.y - o.y, d2 = dx * dx + dy * dy;
        if (d2 < .0012 && d2 > .0000001) { const d = Math.sqrt(d2); sx += dx / d * (1 - d / .035); sy += dy / d * (1 - d / .035); }
        if (o.school === f.school && d2 < .052) { cx += o.x; cy += o.y; ax += o.vx; ay += o.vy; neighbors++; }
      }
      let fx = sx * .045, fy = sy * .045;
      if (neighbors) { fx += (cx / neighbors - f.x) * .055 + (ax / neighbors - f.vx) * .5; fy += (cy / neighbors - f.y) * .055 + (ay / neighbors - f.vy) * .5; }
      const phase = f.school * 2.094;
      const gx = aspect * (.5 + .30 * Math.sin(t * .045 + phase));
      const gy = .44 + .16 * Math.sin(t * .073 + phase * 1.7);
      fx += (gx - f.x) * .045;
      fy += (gy - f.y) * .045;
      fx += Math.sin(t * .63 + f.phase) * .003;
      fy += Math.cos(t * .51 + f.phase * 2) * .006;
      let startled = false;
      if (this.settings.interaction && cursor.active) {
        const dx = f.x - cursor.x, dy = f.y - cursor.y, d = Math.hypot(dx, dy);
        const radius = .155 + Math.min(cursor.speed, 1.5) * .025;
        if (d < radius) {
          const strength = Math.pow(1 - d / radius, 1.35);
          const nx = d > .00001 ? dx / d : Math.cos(f.phase), ny = d > .00001 ? dy / d : Math.sin(f.phase);
          fx += nx * strength * 1.9;
          fy += ny * strength * 1.9;
          f.panic = Math.max(f.panic, strength);
          startled = true;
        }
      }
      if (!startled) f.panic *= Math.exp(-dt * 1.3);
      // Soft walls turn the school before it reaches the sand or glass.
      const margin = Math.min(.15, aspect * .18);
      if (f.x < margin) fx += (margin - f.x) * 1.1;
      if (f.x > aspect - margin) fx -= (f.x - aspect + margin) * 1.1;
      if (f.y < .13) fy += (.13 - f.y) * 1.2;
      if (f.y > .77) fy -= (f.y - .77) * 1.4;
      this.accelerations[i * 2] = fx;
      this.accelerations[i * 2 + 1] = fy;
    }
    for (let i = 0; i < fish.length; i++) {
      const f = fish[i];
      f.vx += this.accelerations[i * 2] * dt * pace;
      f.vy += this.accelerations[i * 2 + 1] * dt * pace;
      const speed = Math.hypot(f.vx, f.vy), maxSpeed = (.063 + f.panic * .23) * pace, minSpeed = .025 * pace;
      if (speed > maxSpeed) { f.vx *= maxSpeed / speed; f.vy *= maxSpeed / speed; }
      else if (speed < minSpeed && speed > .00001) { f.vx *= 1 + dt * 1.5; f.vy *= 1 + dt * 1.5; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      // Hard bounds handle extreme aspect-ratio changes without teleporting fish through the tank.
      if (f.x < .018) { f.x = .018; f.vx = Math.abs(f.vx); }
      if (f.x > aspect - .018) { f.x = aspect - .018; f.vx = -Math.abs(f.vx); }
      if (f.y < .055) { f.y = .055; f.vy = Math.abs(f.vy); }
      if (f.y > .86) { f.y = .86; f.vy = -Math.abs(f.vy); }
      const target = Math.atan2(f.vy, f.vx), diff = Math.atan2(Math.sin(target - f.angle), Math.cos(target - f.angle));
      f.angle += diff * Math.min(1, dt * (5 + f.panic * 15));
      f.phase += dt * (6 + Math.hypot(f.vx, f.vy) * 90);
    }
  }
}
