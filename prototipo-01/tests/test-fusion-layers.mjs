import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLayers } from '../frontend/js/layers.js';
import { connectAnalysis } from '../frontend/js/analysis.js';

function environment(t) {
  const previous = { document: globalThis.document, localStorage: globalThis.localStorage, fetch: globalThis.fetch, Option: globalThis.Option };
  const elements = new Map(), storage = new Map();
  const stub = () => ({ value: '', hidden: false, disabled: false, textContent: '', children: [],
    replaceChildren() { this.children = []; }, append(...items) { this.children.push(...items); },
    setAttribute() {}, classList: { toggle() {} }, reportValidity: () => true });
  const el = id => { if (!elements.has(id)) elements.set(id, stub()); return elements.get(id); };
  globalThis.document = { getElementById: el, createElement: stub };
  globalThis.localStorage = { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) };
  globalThis.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
  t.after(() => Object.assign(globalThis, previous));
  return { el, storage };
}
const points = (id, type) => ({ type: 'FeatureCollection', features: [{ type: 'Feature', id,
  geometry: { type: 'Point', coordinates: [-50.44, -21.21] }, properties: { copa_id: id, tipo: type } }] });

for (const profile of ['controle-local', 'controle-datageo']) test(`${profile} envia o perfil territorial e identifica a fonte no resultado`, async t => {
  const { el } = environment(t); let sent;
  globalThis.fetch = async (path, options) => {
    const ok = data => ({ ok: true, json: async () => data });
    if (path === '/api/recortes') return ok({ recortes: [], perfis: [{ id: profile, nome: profile }] });
    if (path === '/api/analises/setores') { sent = JSON.parse(options.body); return ok({ analysis_id: 'job' }); }
    if (path === '/api/analises/job') return ok({ estado: 'concluida', duracao_s: 1, criada_em: '2026-11-07T00:00:00Z',
      resumo: { perfil: profile, fonte_imagens: profile === 'controle-local' ? 'acervo_local' : 'datageo_direto_sem_cache', janelas_cache: 0, janelas_locais: 1, janelas_download: profile === 'controle-local' ? 0 : 1 } });
    if (path.endsWith('/geojson')) return ok(points('a', 'copa_individual'));
    throw new Error(path);
  };
  el('analysis-profile').value = profile; el('analysis-profile').selectedOptions = [{ value: profile, textContent: profile }]; el('analysis-score').value = '.15';
  connectAnalysis({ revision: 0, cleared: 0 }, () => {}, () => true, () => {}, () => ({ ids: ['a'], source: 'hash', bounds: [[-21.22,-50.45],[-21.20,-50.43]] }));
  await new Promise(resolve => setImmediate(resolve)); assert.equal(el('analyze').disabled, false);
  await el('analyze').onclick(); assert.equal(sent.perfil, profile);
  assert.match(el('analysis-status').textContent, profile === 'controle-local' ? /acervo local, sem download/ : /sem usar cache/);
});

test('camadas da mesma análise são distintas por finalidade e sobrevivem ao recarregamento', t => {
  const { storage, el } = environment(t);
  const store = createLayers(() => {}, () => {}, () => {});
  const features = points('copa', 'copa_individual').features;
  assert.equal(store.add('Individuais', features, { analysisId: 'job' }, false), true);
  assert.equal(store.add('Grupos', features, { analysisId: 'job', analysisPart: 'pontos-grupos' }, false), true);
  assert.equal(store.add('Complementos', features, { analysisId: 'job', analysisPart: 'pontos-complementos' }, false), true);
  assert.equal(store.add('Duplicado', features, { analysisId: 'job', analysisPart: 'pontos-grupos' }, false), undefined);
  const saved = JSON.parse(storage.get('arboriza-prototipo-01-camadas'));
  assert.equal(saved.layers.length, 4);
  assert.equal(saved.layers[2].analysisPart, 'pontos-grupos');
  createLayers(() => {}, () => {}, () => {}).render();
  assert.equal(el('layer-list').children.length, 4);
});

test('perfil de fusão envia setores e importa indivíduos, grupos e complementos separadamente', async t => {
  const { el } = environment(t), layers = [];
  let sent;
  globalThis.fetch = async (path, options) => {
    const ok = data => ({ ok: true, json: async () => data });
    if (path === '/api/recortes') return ok({ recortes: [], perfis: [{ id: 'fusao', nome: 'Fusão', descricao: 'Teste' }] });
    if (path === '/api/analises/setores') { sent = JSON.parse(options.body); return ok({ analysis_id: 'job' }); }
    if (path === '/api/analises/job') return ok({ estado: 'concluida', duracao_s: 2, criada_em: '2026-11-07T00:00:00Z',
      resumo: { perfil: 'fusao', grupos_copas: 1, complementos_pendentes: 1 } });
    if (path.endsWith('/geojson')) return ok(points('individual', 'copa_individual'));
    if (path.endsWith('/pontos-grupos')) return ok(points('grupo', 'grupo_de_copas'));
    if (path.endsWith('/pontos-complementos')) return ok(points('complemento', 'complemento_pendente'));
    throw new Error(path);
  };
  el('analysis-profile').value = 'fusao'; el('analysis-profile').selectedOptions = [{ value: 'fusao', textContent: 'Fusão' }];
  el('analysis-score').value = '.15';
  const selection = { ids: ['a'], source: 'hash', bounds: [[-21.22, -50.45], [-21.20, -50.43]] };
  connectAnalysis({ revision: 0, cleared: 0 }, (...args) => layers.push(args), () => true, () => {}, () => selection);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(el('analyze').disabled, false);
  await el('analyze').onclick();
  assert.equal(sent.perfil, 'fusao'); assert.equal(layers.length, 3);
  assert.deepEqual(layers.map(l => l[1][0].properties.tipo), ['copa_individual', 'grupo_de_copas', 'complemento_pendente']);
  assert.equal(layers[1][2].analysisId, 'job'); assert.equal(layers[1][2].analysisPart, 'pontos-grupos');
  assert.equal(layers[1][3], false); assert.match(el('analysis-status').textContent, /1 grupos/);
});
