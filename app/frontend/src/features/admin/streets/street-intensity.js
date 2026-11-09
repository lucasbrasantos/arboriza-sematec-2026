// Rates compare streets of different lengths. Groups are proposals, not tree counts.
export const intensityMetrics = {
  'base-rate': { label: 'Pontos-base por 100 m', unit: '/100 m' },
  'individual-rate': { label: 'Indivíduos por 100 m', unit: '/100 m' },
  coverage: { label: 'Cobertura média por trecho', unit: '%' },
};
const nonnegative = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
export function segmentIntensity(feature, metric = 'base-rate') {
  const p = feature.properties, length = nonnegative(p.comprimento_m);
  if (metric === 'coverage') return Math.min(100, nonnegative(p.cobertura_copas_base_percentual));
  const count = metric === 'individual-rate' ? p.individuos_proximos : p.pontos_base_proximos ?? p.pontos_proximos;
  return length ? nonnegative(count) * 100 / length : 0;
}
const palette = [[223,116,22], [215,166,41], [159,176,70], [75,161,91], [5,132,111]];
export function intensityColor(value, maximum) {
  const ratio = maximum > 0 ? Math.min(1, Math.max(0, value / maximum)) : 0;
  const at = ratio * (palette.length - 1), low = Math.floor(at), high = Math.min(palette.length - 1, low + 1);
  return '#' + palette[low].map((channel, index) => Math.round(channel + (palette[high][index] - channel) * (at - low)).toString(16).padStart(2, '0')).join('');
}
export function rankStreets(data, metric = 'base-rate', ascending = false) {
  const groups = new Map();
  for (const feature of data.features) {
    const p = feature.properties, name = String(p.nome || 'Via sem nome no OSM');
    const unnamed = name === 'Via sem nome no OSM';
    const key = unnamed ? `osm:${String(feature.id).replace(/-\d+-\d+$/, '')}` : name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
    if (!groups.has(key)) groups.set(key, { key, name, ids: [], length: 0, count: 0, individuals: 0, groups: 0, pending: 0, coverageWeighted: 0, partial: 0 });
    const row = groups.get(key), length = nonnegative(p.comprimento_m);
    row.ids.push(String(feature.id)); row.length += length;
    row.count += nonnegative(p.pontos_base_proximos ?? p.pontos_proximos);
    row.individuals += nonnegative(p.individuos_proximos ?? p.pontos_proximos);
    row.groups += nonnegative(p.grupos_proximos); row.pending += nonnegative(p.complementos_proximos);
    row.coverageWeighted += segmentIntensity(feature, 'coverage') * length;
    row.partial += p.vizinhanca_parcial ? 1 : 0;
  }
  return [...groups.values()].map(row => ({ ...row, value: row.length ? (metric === 'coverage' ? row.coverageWeighted : (metric === 'individual-rate' ? row.individuals : row.count) * 100) / row.length : 0 }))
    .sort((a, b) => (ascending ? a.value - b.value : b.value - a.value) || a.name.localeCompare(b.name, 'pt-BR') || a.key.localeCompare(b.key));
}
