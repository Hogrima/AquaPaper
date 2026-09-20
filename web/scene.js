// A small camera orbit measured in tank-height units. One revolution takes 150 s.
// The same projection is used by drawing and cursor hit testing.
export const ORBIT_PERIOD = 150;
export const SCENE_LAYERS = Object.freeze([
  { name: 'distant-water', parallax: .12 },
  { name: 'rear-plants', parallax: .28 },
  { name: 'rear-bank', parallax: .46 },
  { name: 'driftwood', parallax: .70 },
  { name: 'sand-and-rocks', parallax: 1.00 },
  { name: 'near-plants', parallax: 1.38 },
]);
export function cameraOrbit(time, enabled = true) {
  if (!enabled || !Number.isFinite(time)) return [0, 0];
  const phase = (time % ORBIT_PERIOD) / ORBIT_PERIOD * Math.PI * 2;
  return [Math.sin(phase) * .008, (Math.cos(phase) - 1) * .008];
}
export function projectPoint(point, aspect, time = 0, parallax = true) {
  const [x, y] = cameraOrbit(time, parallax), w = 1 - point.z / 2.7;
  return { x: aspect / 2 + (point.x - aspect / 2 - x * .82) / w,
    y: .5 + (point.y - .5 - y * .82) / w, w };
}
export function particleCounts(quality, aspect) {
  const scale = Math.max(.65, Math.min(3, aspect / (16/9)));
  const dust = Math.round((quality === 'eco' ? 180 : quality === 'high' ? 460 : 340) * scale);
  const bubbles = Math.round((quality === 'eco' ? 28 : 52) * scale);
  return { dust, bubbles, total: dust + bubbles };
}
