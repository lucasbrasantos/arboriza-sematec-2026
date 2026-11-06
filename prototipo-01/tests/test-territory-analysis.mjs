import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectAnalysis } from '../frontend/js/analysis.js';

test('a seleção territorial impede iniciar análise e devolve o recorte ao sair', async () => {
  const previous = { document: globalThis.document, fetch: globalThis.fetch, Option: globalThis.Option };
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', disabled: false, hidden: false,
      classList: { toggle() {} }, replaceChildren() {}, reportValidity: () => true });
    return elements.get(id);
  };
  let territoryActive = true, calls = 0;
  globalThis.document = { getElementById: element };
  globalThis.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, json: async () => ({ recortes: [{ id: 'centro', disponivel: true }],
      perfis: [{ id: 'controle', nome: 'Controle', descricao: 'Mesmo modelo' }] }) };
  };
  try {
    element('area').value = 'centro'; element('analysis-profile').value = 'controle';
    const analysis = connectAnalysis({}, () => {}, () => territoryActive);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(element('analyze').disabled, true);
    assert.match(element('analysis-status').textContent, /seleção por setores/);
    await element('analyze').onclick();
    assert.equal(calls, 1, 'nenhum pedido de análise deve ser enviado');
    territoryActive = false;
    analysis.refresh();
    assert.equal(element('analyze').disabled, false);
    assert.equal(element('analysis-status').textContent, 'Pronto para analisar este recorte.');
  } finally {
    globalThis.document = previous.document; globalThis.fetch = previous.fetch; globalThis.Option = previous.Option;
  }
});

test('uma análise em andamento não interrompe a seleção territorial quando termina', async () => {
  const previous = { document: globalThis.document, fetch: globalThis.fetch, Option: globalThis.Option };
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', disabled: false, hidden: false,
      classList: { toggle() {} }, replaceChildren() {}, reportValidity: () => true });
    return elements.get(id);
  };
  let territoryActive = false, finish, started;
  const gate = new Promise(resolve => { finish = resolve; });
  const monitoring = new Promise(resolve => { started = resolve; });
  const layerCalls = [];
  globalThis.document = { getElementById: element };
  globalThis.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
  globalThis.fetch = async (path, options) => {
    if (path === '/api/recortes') return { ok: true, json: async () => ({
      recortes: [{ id: 'centro', nome: 'Centro', disponivel: true }],
      perfis: [{ id: 'controle', nome: 'Controle', descricao: 'Mesmo modelo' }] }) };
    if (path === '/api/analises' && options.method === 'POST') return { ok: true, json: async () => ({ analysis_id: 'abc' }) };
    if (path === '/api/analises/abc') {
      started(); await gate;
      return { ok: true, json: async () => ({ estado: 'concluida', duracao_s: 1, recorte: 'centro', criada_em: '2026-11-06T00:00:00Z' }) };
    }
    if (path === '/api/analises/abc/geojson') return { ok: true, json: async () => ({ type: 'FeatureCollection', features: [] }) };
    throw new Error(`Pedido inesperado: ${path}`);
  };
  try {
    element('area').value = 'centro'; element('analysis-score').value = '.15';
    element('analysis-profile').value = 'controle';
    element('analysis-profile').selectedOptions = [{ value: 'controle', textContent: 'Controle' }];
    const analysis = connectAnalysis({ revision: 0, cleared: 0 }, (...args) => layerCalls.push(args), () => territoryActive);
    await new Promise(resolve => setImmediate(resolve));
    const running = element('analyze').onclick();
    await monitoring;
    territoryActive = true; analysis.refresh(); finish();
    await running;
    assert.equal(layerCalls.length, 1);
    assert.equal(layerCalls[0][3], false, 'a camada nova não deve assumir a seleção durante a revisão territorial');
    assert.equal(element('analyze').disabled, true);
    assert.match(element('analysis-status').textContent, /Camada adicionada/);
  } finally {
    globalThis.document = previous.document; globalThis.fetch = previous.fetch; globalThis.Option = previous.Option;
  }
});

test('envia uma cópia dos setores selecionados para análise territorial', async () => {
  const previous = { document: globalThis.document, fetch: globalThis.fetch, Option: globalThis.Option };
  const elements = new Map(), calls = [], layers = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', disabled: false, hidden: false,
      classList: { toggle() {} }, replaceChildren() {}, reportValidity: () => true });
    return elements.get(id);
  };
  globalThis.document = { getElementById: element };
  globalThis.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
  globalThis.fetch = async (path, options) => {
    if (path === '/api/recortes') return { ok: true, json: async () => ({ recortes: [],
      perfis: [{ id: 'controle', nome: 'Controle', descricao: 'Mesmo modelo' }] }) };
    calls.push([path, options]);
    if (path === '/api/analises/setores') return { ok: true, json: async () => ({ analysis_id: 'id' }) };
    if (path === '/api/analises/id') return { ok: true, json: async () => ({ estado: 'concluida', duracao_s: 1, criada_em: '2026-11-06T00:00:00Z' }) };
    if (path === '/api/analises/id/geojson') return { ok: true, json: async () => ({ type: 'FeatureCollection', features: [] }) };
    throw new Error(path);
  };
  try {
    element('analysis-score').value = '.15'; element('analysis-profile').value = 'controle';
    element('analysis-profile').selectedOptions = [{ value: 'controle', textContent: 'Controle' }];
    const selection = { ids: ['a'], source: 'hash', bounds: [[-21.2, -50.5], [-21.1, -50.4]] };
    connectAnalysis({ revision: 0, cleared: 0 }, (...args) => layers.push(args), () => true, () => {}, () => selection);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(element('analyze').disabled, false);
    await element('analyze').onclick();
    assert.deepEqual(JSON.parse(calls[0][1].body), { ids: ['a'], fonte_malha: 'hash', score: .15 });
    assert.equal(layers.length, 1);
    assert.equal(layers[0][3], false);
    assert.deepEqual(layers[0][2].studyArea.bounds, selection.bounds);
    assert.match(element('analysis-status').textContent, /Camada adicionada/);
  } finally {
    globalThis.document = previous.document; globalThis.fetch = previous.fetch; globalThis.Option = previous.Option;
  }
});
