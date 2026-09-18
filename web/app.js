import { AquariumSimulation, DEFAULTS, normalizeSettings } from './simulation.js';
import { AquariumRenderer } from './renderer.js';
import { displayControls } from './display.js';

const $ = id => document.getElementById(id);
const host = window.chrome?.webview;
const updateDisplays = displayControls(host);
let monitorCount = 1, displayMode = 'single';
let settings = { ...DEFAULTS };
try { settings = normalizeSettings(JSON.parse(localStorage.getItem('aquapaper.settings') || '{}')); } catch { /* Recover corrupt/disabled storage. */ }
let simulation, renderer, userPaused = false, systemPaused = false, wallpaper = false, ready = false;
let lastFrame = 0, lastDraw = 0, frames = 0, fpsStart = 0, animation = 0, lastActivity = performance.now();
let actualFps = 0, toastTimeout, nativeFullscreen = false, booting = false;
const errors = [];
window.addEventListener('error', e => errors.push(e.message));
function send(type, data = {}) { host?.postMessage({ type, ...data }); }
function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 4800); }
function wake() { lastActivity = performance.now(); if (!wallpaper) document.body.classList.remove('idle'); }
function updateUi() {
  $('fish-count').value = settings.count; $('fish-value').textContent = `${settings.count} 마리`; $('fish-label').textContent = `${settings.count} 마리`;
  $('activity').value = settings.activity; $('activity-value').textContent = settings.activity < 65 ? '느긋하게' : settings.activity < 95 ? '차분하게' : '활기차게';
  $('interaction').checked = settings.interaction; $('particles').checked = settings.particles;
  for (const name of ['lighting', 'quality']) for (const b of $(name).querySelectorAll('button')) { const selected = b.dataset.value === settings[name]; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); }
  document.body.classList.toggle('paused', userPaused);
  $('pause').setAttribute('aria-label', userPaused ? '재생' : '일시정지'); $('pause').title = userPaused ? '재생 (Space)' : '일시정지 (Space)';
  $('pause-icon').innerHTML = userPaused ? '<path d="m8 5 11 7-11 7Z"/>' : '<path d="M9 5v14M15 5v14"/>';
  $('live-label').innerHTML = `<i></i> ${userPaused ? 'A MOMENT OF PAUSE' : 'LIVE AQUARIUM'}`;
  if (userPaused) $('fps').textContent = 'PAUSED';
}
function applySettings(value, persist = true) {
  const before = settings; settings = normalizeSettings(value);
  if (simulation) { simulation.settings = { ...settings }; simulation.setCount(settings.count); }
  if (renderer && before.quality !== settings.quality) renderer.resize(settings.quality, monitorCount);
  updateUi();
  if (ready) renderer.render(simulation, settings);
  if (persist) { try { localStorage.setItem('aquapaper.settings', JSON.stringify(settings)); } catch {} send('settings', { settings }); }
}
function panel(open) { $('settings').hidden = !open; $('settings-toggle').setAttribute('aria-expanded', String(open)); wake(); if (open) { send('displayRefresh'); $('close-settings').focus(); } else $('settings-toggle').focus(); }
function pause(value = !userPaused) { userPaused = value; updateUi(); wake(); if (host) send('pause', { paused: userPaused }); else startLoop(); }
function startLoop() { if (!animation && ready) { lastFrame = lastDraw = 0; animation = requestAnimationFrame(frame); } }
function frame(now) {
  animation = 0;
  if (!ready || systemPaused || (document.hidden && !wallpaper)) return;
  const interval = settings.quality === 'eco' ? 1000 / 30 : 1000 / 60;
  if (!lastDraw) lastDraw = now;
  if (now >= lastDraw - .5) {
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .04) : 1 / 60;
    lastFrame = now;
    // Advance the next deadline, not the preceding frame. This also caps 75/144 Hz monitors.
    lastDraw += interval;
    if (lastDraw < now - interval) lastDraw = now + interval;
    if (!userPaused) { simulation.step(dt); renderer.render(simulation, settings); frames++; }
    if (now - fpsStart > 1000) { actualFps = Math.round(frames * 1000 / (now - fpsStart)); $('fps').textContent = userPaused ? 'PAUSED' : `${actualFps} FPS`; frames = 0; fpsStart = now; }
    if (!wallpaper && $('settings').hidden && now - lastActivity > 8500 && !document.querySelector('button:focus-visible,input:focus-visible')) document.body.classList.add('idle');
  }
  // Paused scenes need no GPU redraw; a light timer still lets the controls fade away.
  animation = userPaused ? -1 : requestAnimationFrame(frame);
  if (userPaused) setTimeout(() => { animation = 0; startLoop(); }, 160);
}
async function fullscreen() {
  if (host) { send('fullscreen'); return; }
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('이 환경에서는 전체 화면을 사용할 수 없습니다.'); }
}
$('pause').addEventListener('click', () => pause());
$('settings-toggle').addEventListener('click', () => panel($('settings').hidden));
$('close-settings').addEventListener('click', () => panel(false));
$('fullscreen').addEventListener('click', fullscreen);
$('apply').addEventListener('click', () => { if (host) send('wallpaper'); else toast('Windows 앱 AquaPaper.exe에서 바탕화면에 적용할 수 있습니다.'); });
$('fish-count').addEventListener('input', e => applySettings({ ...settings, count: Number(e.target.value) }));
$('activity').addEventListener('input', e => applySettings({ ...settings, activity: Number(e.target.value) }));
for (const name of ['interaction', 'particles']) $(name).addEventListener('change', e => applySettings({ ...settings, [name]: e.target.checked }));
for (const name of ['lighting', 'quality']) $(name).addEventListener('click', e => { const b = e.target.closest('button'); if (b) applySettings({ ...settings, [name]: b.dataset.value }); });
$('reset').addEventListener('click', () => { applySettings(DEFAULTS); toast('수족관 설정을 처음 상태로 되돌렸습니다.'); });
$('reload').addEventListener('click', () => location.reload());
document.addEventListener('keydown', e => {
  wake(); if (e.target.matches('input,select,textarea')) return;
  if (e.code === 'Space' && !e.target.closest('button')) { e.preventDefault(); pause(); }
  if (e.key.toLowerCase() === 'f') fullscreen();
  if (e.key.toLowerCase() === 's') panel($('settings').hidden);
  if (e.key === 'Escape') { if (!$('settings').hidden) panel(false); else if (nativeFullscreen) send('fullscreen'); else if (document.fullscreenElement) document.exitFullscreen(); }
});
let lastPointer;
window.addEventListener('pointermove', e => {
  wake(); if (!simulation || wallpaper) return;
  const now = performance.now(), x = e.clientX / innerHeight, y = e.clientY / innerHeight;
  const speed = lastPointer ? Math.hypot(x - lastPointer.x, y - lastPointer.y) / Math.max(.008, (now - lastPointer.t) / 1000) : 0;
  simulation.setCursor(x, y, !e.target.closest('.control-bar,.settings,.header'), speed);
  lastPointer = { x, y, t: now };
});
document.addEventListener('pointerleave', () => { if (simulation && !wallpaper) simulation.cursor.active = false; lastPointer = null; });
window.addEventListener('blur', () => { if (simulation && !wallpaper) simulation.cursor.active = false; });
window.addEventListener('resize', () => { if (renderer) { renderer.resize(settings.quality, monitorCount); simulation.resize(innerWidth / innerHeight); if (ready) renderer.render(simulation, settings); } });
document.addEventListener('visibilitychange', () => { lastFrame = 0; if (!document.hidden) startLoop(); });
window.addEventListener('storage', e => { if (e.key === 'aquapaper.settings' && e.newValue) { try { applySettings(JSON.parse(e.newValue), false); } catch {} } });
host?.addEventListener('message', e => {
  const m = e.data;
  if (m.type === 'init') { wallpaper = Boolean(m.wallpaper); monitorCount = wallpaper ? Math.max(1, m.monitorCount || 1) : 1; displayMode = m.displayMode || 'single'; document.body.classList.toggle('wallpaper', wallpaper); if (m.settings) applySettings(m.settings, false); renderer?.resize(settings.quality, monitorCount); userPaused = Boolean(m.paused); updateUi(); }
  if (m.type === 'displays') updateDisplays(m);
  if (m.type === 'settings') applySettings(m.settings, false);
  if (m.type === 'cursor' && simulation) simulation.setCursor(m.x * simulation.aspect, m.y, m.active, m.speed || 0);
  if (m.type === 'pause') { userPaused = m.paused; updateUi(); startLoop(); }
  if (m.type === 'suspend') { systemPaused = m.paused; lastFrame = 0; if (!systemPaused) startLoop(); }
  if (m.type === 'fullscreen') { nativeFullscreen = m.active; wake(); }
  if (m.type === 'toast') toast(m.text);
  if (m.type === 'showSettings') panel(true);
});
function fail(error) { errors.push(String(error)); $('loading').classList.add('finished'); $('error').hidden = false; $('error-text').textContent = error.message || String(error); send('error', { message: String(error) }); }
async function boot() {
  if (booting) return; booting = true;
  try {
    renderer = new AquariumRenderer($('aquarium'));
    simulation = new AquariumSimulation(innerWidth / innerHeight, settings);
    renderer.resize(settings.quality, monitorCount);
    await renderer.load('assets/aquarium.png');
    ready = true; $('error').hidden = true; renderer.render(simulation, settings); updateUi();
    $('loading').classList.add('finished'); lastActivity = performance.now(); fpsStart = lastActivity;
    send('ready'); startLoop();
  } catch (e) { fail(e); } finally { booting = false; }
}
$('aquarium').addEventListener('webglcontextlost', e => { e.preventDefault(); ready = false; cancelAnimationFrame(animation); animation = 0; toast('그래픽 연결을 복구하고 있습니다.'); });
$('aquarium').addEventListener('webglcontextrestored', () => boot());
// Read-only diagnostics consumed by the native smoke test; never exposed to remote content.
window.aquariumDiagnostics = () => ({ ready, fish: simulation?.fish.length || 0, fps: actualFps, time: simulation?.time || 0, errors: [...errors], settings: { ...settings }, paused: userPaused, systemPaused, wallpaper, monitorCount, displayMode, cursorActive: simulation?.cursor.active, width: renderer?.canvas.width, height: renderer?.canvas.height, webglError: renderer?.gl.getError() ?? -1 });
boot();
