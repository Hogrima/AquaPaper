import { clampPlecos } from './pleco.js';
import { population, changeSpecies, SPECIES } from './population.js';
import { coralPopulation } from './simulation3d.js';

export function settingsControls(host, getSettings, apply, t) {
  const $ = id => document.getElementById(id);
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function select(tab, focus = false) {
    for (const item of tabs) {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1;
      $(item.getAttribute('aria-controls')).hidden = !active;
    }
    document.querySelector('.settings-content').scrollTop = 0;
    if (focus) tab.focus();
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', e => {
      const i = tabs.indexOf(tab);
      const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
      if (next >= 0) { e.preventDefault(); select(tabs[next], true); }
    });
  }
  let startup = { enabled: false, available: Boolean(host), busy: false, error: null };
  $('start-with-windows').addEventListener('change', e => {
    if (!host || startup.busy) return;
    const enabled = e.target.checked; startup.busy = true; refresh();
    host.postMessage({ type: 'startup', enabled });
  });
  for (const id of SPECIES) {
    $(`${id}-toggle`).addEventListener('click', () => {
      const settings = getSettings(), count = population(settings)[id];
      apply(changeSpecies(settings, id, count ? 0 : 12));
    });
    $(`${id}-count`).addEventListener('change', e => apply(changeSpecies(getSettings(), id, e.target.valueAsNumber)));
  }
  $('pleco-toggle').addEventListener('click', () => apply({ ...getSettings(), plecoCount: getSettings().plecoCount ? 0 : 1 }));
  $('pleco-count').addEventListener('change', e => apply({ ...getSettings(), plecoCount: clampPlecos(e.target.valueAsNumber) }));
  function refresh() {
    const settings = getSettings(), counts = population(settings);
    const coral=settings.background==='coral';
    $('species-list').hidden = settings.fishMode !== 'tetra3d'||coral;
    $('coral-species').hidden = !coral;
    $('pleco-section').hidden = settings.fishMode !== 'tetra3d'||coral;
    if(coral){const reef=coralPopulation(settings.count);$('clown-count').textContent=reef.clown;$('yellow-tang-count').textContent=reef.yellowTang;$('blue-tang-count').textContent=reef.blueTang;$('moorish-idol-count').textContent=reef.moorishIdol;$('dwarf-hawkfish-count').textContent=reef.dwarfHawkfish;}
    const plecos=clampPlecos(settings.plecoCount);
    $('pleco-toggle').textContent=t(plecos?'removeSpecies':'addSpecies');
    $('pleco-toggle').setAttribute('aria-label',`${t(plecos?'removeSpecies':'addSpecies')} · ${t('plecoName')}`);
    $('pleco-count').value=plecos; $('pleco-count').disabled=!plecos;
    $('pleco-count').setAttribute('aria-label',t('plecoCountLabel'));
    $('pleco-card').classList.toggle('species-inactive',!plecos);
    for (const id of SPECIES) {
      const other = id === 'neon' ? 'rummy' : 'neon';
      const active = counts[id] > 0, button = $(`${id}-toggle`), input = $(`${id}-count`);
      button.textContent = t(active ? 'removeSpecies' : 'addSpecies');
      button.setAttribute('aria-label', `${t(active ? 'removeSpecies' : 'addSpecies')} · ${t(id + 'Name')}`);
      button.disabled = active ? !counts[other] : settings.count > 154;
      input.setAttribute('aria-label', `${t(id + 'Name')} · ${t('schoolCount')}`);
      input.disabled = !active; input.value = counts[id]; input.min = counts[other] ? 6 : 12; input.max = 160 - counts[other];
      $(`${id}-card`).classList.toggle('species-inactive', !active);
    }
    const control = $('start-with-windows');
    control.checked = startup.enabled; control.disabled = !startup.available || startup.busy;
    $('startup-status').textContent = startup.error || t(!host ? 'startupNativeOnly' : startup.busy ? 'startupSaving' : startup.enabled ? 'startupEnabled' : 'startupDisabled');
    $('display-native-note').hidden = Boolean(host);
  }
  return { refresh, startup(message) { startup = { ...message, busy: false }; refresh(); } };
}
