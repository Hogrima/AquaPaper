import { translate } from './i18n.js';

export function monitorMap(monitors) {
  if (!monitors.length) return { aspect: 16 / 9, boxes: [] };
  const left = Math.min(...monitors.map(m => m.x)), top = Math.min(...monitors.map(m => m.y));
  const width = Math.max(...monitors.map(m => m.x + m.width)) - left;
  const height = Math.max(...monitors.map(m => m.y + m.height)) - top;
  return { aspect: width / height, boxes: monitors.map(m => ({ ...m, left: (m.x - left) / width * 100, top: (m.y - top) / height * 100, mapWidth: m.width / width * 100, mapHeight: m.height / height * 100 })) };
}

// Preserve per-monitor detail when one WebGL canvas spans multiple displays; cap GPU allocation.
export function renderResolution(width, height, dpr, quality, monitorCount = 1, limit = 16384) {
  const base = quality === 'high' ? 2560 : quality === 'eco' ? 1280 : 1920;
  const count = Math.max(1, Math.min(8, monitorCount));
  const pixelBudget = base * base * count;
  const scale = Math.min(dpr || 1, base * count / Math.max(width, height), Math.sqrt(pixelBudget / (width * height)), limit / width, limit / height);
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale };
}

export function displayControls(host, getLanguage = () => document.documentElement.lang) {
  const $ = id => document.getElementById(id);
  let state = { mode: 'single', monitors: [], effectiveMonitorId: null, monitorId: null, busy: false, active: false };
  const request = options => { host?.postMessage({ type: 'display', options }); };
  $('display-section').hidden = !host;
  $('display-mode').addEventListener('click', e => {
    const button = e.target.closest('button[data-value]'); if (!button || state.busy) return;
    request({ mode: button.dataset.value, monitorId: state.monitorId });
  });
  $('monitor-select').addEventListener('change', e => request({ mode: 'single', monitorId: e.target.value }));
  $('monitor-map').addEventListener('click', e => {
    const button = e.target.closest('button[data-id]'); if (!button || state.busy || state.mode !== 'single') return;
    request({ mode: 'single', monitorId: button.dataset.id });
  });
  const render = message => {
    if (message) state = message;
    const language = getLanguage();
    const t = (key, variables = {}) => translate(language, key, variables);
    $('monitor-count').textContent = t('monitorsConnected', { count: state.monitors.length });
    for (const b of $('display-mode').querySelectorAll('button')) {
      b.classList.toggle('selected', b.dataset.value === state.mode); b.setAttribute('aria-pressed', String(b.dataset.value === state.mode)); b.disabled = state.busy;
    }
    const missing = state.mode === 'single' && state.monitorId !== state.effectiveMonitorId;
    $('display-description').textContent = missing ? t('displayFallback') : t({
      single: 'displaySingleDescription',
      span: 'displaySpanDescription',
      separate: 'displaySeparateDescription',
    }[state.mode]);
    $('monitor-select-row').hidden = state.mode !== 'single';
    const select = $('monitor-select'); select.replaceChildren(); select.disabled = state.busy;
    for (const m of state.monitors) { const option = document.createElement('option'); option.value = m.id; option.textContent = t('monitorName', { number: m.number, width: m.width, height: m.height, primary: m.primary ? t('primaryParenthetical') : '' }); select.append(option); }
    select.value = state.effectiveMonitorId;
    const map = monitorMap(state.monitors), stage = $('monitor-map'); stage.replaceChildren();
    stage.style.aspectRatio = map.aspect; stage.classList.toggle('spanned', state.mode === 'span');
    for (const m of map.boxes) {
      const box = document.createElement('button'); box.className = 'monitor-box'; box.dataset.id = m.id;
      box.textContent = m.number; box.title = t('monitorName', { number: m.number, width: m.width, height: m.height, primary: m.primary ? t('primaryInline') : '' });
      box.setAttribute('aria-label', box.title); box.setAttribute('aria-pressed', String(state.mode !== 'single' || m.id === state.effectiveMonitorId));
      box.disabled = state.busy || state.mode !== 'single';
      box.style.left = `${m.left}%`; box.style.top = `${m.top}%`; box.style.width = `${m.mapWidth}%`; box.style.height = `${m.mapHeight}%`;
      stage.append(box);
    }
    $('display-status').textContent = state.busy ? t('displayBusy') : state.active ? t('displayActive') : t('displayInactive');
    $('apply').disabled = state.busy;
  };
  render.refreshLanguage = () => render();
  return render;
}
