export const SPECIES = ['neon', 'rummy'];
export function population(settings) {
  const total = Math.max(12, Math.min(160, Math.round(Number.isFinite(settings.count) ? settings.count : 72)));
  let rummy = Math.max(0, Math.min(total, Math.round(Number.isFinite(settings.rummyCount) ? settings.rummyCount : 0)));
  if (rummy > 0) rummy = Math.max(6, rummy);
  if (total - rummy > 0 && total - rummy < 6) rummy = total - 6;
  return { neon: total - rummy, rummy };
}

// Preserve the other school, cap the total, and never leave an empty aquarium.
export function changeSpecies(settings, species, requested) {
  if (!SPECIES.includes(species)) return settings;
  const counts = population(settings), other = species === 'neon' ? 'rummy' : 'neon';
  if (!Number.isFinite(requested)) return settings;
  let count = Math.round(requested);
  count = count <= 0 ? 0 : Math.max(6, count);
  count = Math.min(160 - counts[other], count);
  if (!counts[other]) count = Math.max(12, count);
  if (count > 0 && count < 6) return settings;
  counts[species] = count;
  if (counts.neon + counts.rummy < 12) counts[other] = 12;
  return { ...settings, count: counts.neon + counts.rummy, rummyCount: counts.rummy };
}

export function resizePopulation(settings, total) {
  const counts = population(settings);
  const ratio = counts.rummy / (counts.neon + counts.rummy);
  return { ...settings, count: total, rummyCount: Math.round(total * ratio) };
}
