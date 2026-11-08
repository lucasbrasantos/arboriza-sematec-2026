import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectStreetAnalysis } from '../frontend/js/street-analysis.js';
import { outsideRings, streetCategory, streetEntries, streetTotals, visibleStreets } from '../frontend/js/street-data.js';

const feature = (id, name, count, partial = false) => ({ id, properties: { nome: name, pontos_proximos: count, vizinhanca_parcial: partial } });
const result = { features: [feature('a', 'Rua A', 1, true), feature('b', 'Rua B', 0)], arboriza: {} };
function setup(t, overrides = {}) {
  const previous = { document: globalThis.document, fetch: globalThis.fetch };
  const elements = new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id, { value: '25', classList: { toggle() {} }, reportValidity: () => true, focus() {} });
    return elements.get(id);
  };
  globalThis.document = { getElementById: el, body: { dataset: {} } };
  const layer = { id: 'layer', analysisId: 'job', points: [{ feature: { id: 'p', geometry: { coordinates: [-50.4, -21.2] } } }] };
  const state = { layer, drawn: [], modes: [], focused: [], selections: [], lists: [], details: [] };
  globalThis.fetch = async (path, options) => {
    state.sent = { path, body: JSON.parse(options.body), signal: options.signal };
    return { ok: true, json: async () => result };
  };
  const diagnostic = connectStreetAnalysis({ map: {}, current: () => state.layer,
    onDiagnostic: active => state.modes.push(active), shouldFocus: () => state.fit,
    createMapView: (map, select) => { state.mapSelect = select; return {
      draw: (...data) => state.drawn.push(data), clear() {}, filter(ids) { state.ids = ids; },
      select: id => state.selections.push(id), focus: id => state.focused.push(id), showBoundary() {} }; },
    createPanel: actions => { state.actions = actions; return { open() {}, close() {}, background() {}, ready() {},
      detail: e => state.details.push(e), error: message => { state.error = message; }, list: entries => state.lists.push(entries) }; },
    ...overrides });
  t.after(() => Object.assign(globalThis, previous));
  return { el, state, diagnostic };
}

test('cruza a camada atual, preserva pontos e liga seleção, filtros e enquadramento opcional', async t => {
  const { el, state, diagnostic } = setup(t);
  const before = JSON.stringify(state.layer);
  await el('street-analyze').onclick();
  assert.equal(diagnostic.active, true);
  assert.deepEqual(state.sent.body, { analysis_id: 'job', distancia_m: 25, pontos: [[-50.4, -21.2]] });
  assert.equal(state.drawn.length, 1);
  state.actions.select('a', 'list');
  assert.equal(state.details.at(-1).feature.id, 'a');
  assert.equal(state.selections.at(-1), 'a');
  assert.deepEqual(state.focused, []);
  state.fit = true; state.actions.select('b', 'list');
  assert.deepEqual(state.focused, ['b']);
  state.mapSelect('a'); assert.deepEqual(state.focused, ['b']);
  state.actions.filter('no-points', null);
  assert.deepEqual([...state.ids], ['b']);
  assert.equal(state.details.at(-1), null);
  state.actions.presentation('normal'); assert.equal(document.body.dataset.streetBackground, 'normal');
  diagnostic.close();
  assert.equal(diagnostic.active, false);
  assert.deepEqual(state.modes, [true, false]);
  assert.equal(document.body.dataset.streetBackground, undefined);
  assert.equal(JSON.stringify(state.layer), before);
});

test('invalida ao editar pontos e desabilita quando a camada fica vazia', async t => {
  const { el, state, diagnostic } = setup(t);
  await el('street-analyze').onclick();
  state.layer.points[0].feature.geometry.coordinates = [-50.41, -21.2]; diagnostic.refresh();
  assert.equal(diagnostic.active, false); assert.match(el('street-status').textContent, /mudaram/);
  state.layer.points = []; diagnostic.refresh(); assert.equal(el('street-analyze').disabled, true);
});

test('sair durante a consulta aborta e ignora resposta tardia', async t => {
  const { el, state, diagnostic } = setup(t);
  let finish; globalThis.fetch = async (path, options) => { state.signal = options.signal; await new Promise(r => { finish = r; }); return { ok: true, json: async () => result }; };
  const request = el('street-analyze').onclick(); diagnostic.close(); finish(); await request;
  assert.equal(state.signal.aborted, true); assert.equal(state.drawn.length, 0); assert.equal(diagnostic.active, false);
});

test('troca de camada antes da resposta não desenha dados da anterior', async t => {
  const { el, state, diagnostic } = setup(t);
  let finish; globalThis.fetch = async () => { await new Promise(r => { finish = r; }); return { ok: true, json: async () => result }; };
  const request = el('street-analyze').onclick(); state.layer = { ...state.layer, id: 'other' }; finish(); await request;
  assert.equal(state.drawn.length, 0); assert.equal(diagnostic.active, false); assert.match(el('street-status').textContent, /mudaram/);
});

test('erro mantém retorno acessível e permite tentar novamente', async t => {
  const { el, state, diagnostic } = setup(t);
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ detail: 'Sem amostra local.' }) });
  await el('street-analyze').onclick(); assert.equal(state.error, 'Sem amostra local.'); assert.equal(diagnostic.active, true);
  globalThis.fetch = async () => ({ ok: true, json: async () => result });
  await state.actions.retry(); assert.equal(state.drawn.length, 1); diagnostic.close();
});

test('encerra seleção territorial antes de diagnosticar', async t => {
  let territory = true, exits = 0;
  const { el, diagnostic } = setup(t, { isTerritoryActive: () => territory, exitTerritory: () => { territory = false; exits++; } });
  await el('street-analyze').onclick(); assert.equal(exits, 1); assert.equal(diagnostic.active, true); diagnostic.close();
});

test('categorias descritivas independem da cobertura e busca aceita acentos', () => {
  const entries = streetEntries({ features: [feature('z', 'Rua São José', 2, true), feature('a', 'Avenida Brasil', 0)] });
  assert.equal(entries[0].feature.id, 'a');
  assert.equal(streetCategory(entries[1].feature), 'with-points');
  assert.deepEqual(streetTotals(entries), { all: 2, 'with-points': 1, 'no-points': 1, partial: 1 });
  assert.equal(visibleStreets(entries, 'all', 'sao jose')[0].feature.id, 'z');
  assert.equal(visibleStreets(entries, 'no-points', 'sao').length, 0);
});

test('máscara preserva ilhas e buracos dos setores e troca longitude/latitude', () => {
  const a = [[-50, -21], [-49, -21], [-49, -20], [-50, -21]], hole = [[-49.8, -20.8], [-49.7, -20.8], [-49.8, -20.7], [-49.8, -20.8]];
  assert.equal(outsideRings({ type: 'Polygon', coordinates: [a, hole] }).length, 3);
  const rings = outsideRings({ type: 'MultiPolygon', coordinates: [[a, hole], [a]] });
  assert.equal(rings.length, 4); assert.deepEqual(rings[1][0], [-21, -50]);
  assert.throws(() => outsideRings(null), /limites/);
});

test('v2 envia múltiplas camadas por IDs e invalida ao excluir em uma camada secundária', async t => {
  const individual={id:'ind',analysisId:'job',modelVersion:2,points:[{feature:{id:'i',properties:{copa_id:'i'},geometry:{coordinates:[-50.4,-21.2]}}}]};
  const group={id:'grupos',analysisId:'job',modelVersion:2,points:[{feature:{id:'g',properties:{copa_id:'g'},geometry:{coordinates:[-50.41,-21.21]}}}]};
  const selected=[individual,group];
  const {el,state,diagnostic}=setup(t,{createPicker:()=>({selection:()=>selected,refresh(){}})});
  state.layer=individual;diagnostic.refresh();
  await el('street-analyze').onclick();
  assert.deepEqual(state.sent.body.camadas,[{id_camada:'ind',ids_copas:['i']},{id_camada:'grupos',ids_copas:['g']}]);
  assert.equal(state.sent.body.pontos,undefined);assert.equal(diagnostic.active,true);
  group.points=[];diagnostic.refresh();assert.equal(diagnostic.active,false);
  assert.match(el('street-status').textContent,/mudaram/);
});
