import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectAnalysis } from '../frontend/js/analysis.js';
import { createAnalysisVisual } from '../frontend/js/analysis-visual.js';

const catalog = { recortes: [{ id: 'centro', nome: 'Centro', disponivel: true }],
  perfis: [{ id: 'controle', nome: 'Controle', descricao: 'Mesmo modelo' }] };
const ok = value => ({ ok: true, json: async () => value });

function setup(fetch) {
  const previous = { document: globalThis.document, fetch: globalThis.fetch, Option: globalThis.Option };
  const elements = new Map(), map = { dataset: {} };
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', disabled: false, hidden: false,
      classList: { toggle() {} }, replaceChildren() {}, reportValidity: () => true });
    return elements.get(id);
  };
  globalThis.document = { getElementById: element, querySelector: () => map };
  globalThis.fetch = fetch;
  globalThis.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
  element('area').value = 'centro'; element('analysis-score').value = '.15';
  element('analysis-profile').value = 'controle';
  element('analysis-profile').selectedOptions = [{ value: 'controle', textContent: 'Controle' }];
  return { element, map, restore() { Object.assign(globalThis, previous); } };
}

test('o indicador mostra etapa e tempo reais e desaparece ao concluir', async () => {
  let finish, started;
  const gate = new Promise(resolve => { finish = resolve; });
  const monitoring = new Promise(resolve => { started = resolve; });
  const states = [];
  const ctx = setup(async path => {
    if (path === '/api/recortes') return ok(catalog);
    if (path === '/api/analises') return ok({ analysis_id: 'a1' });
    if (path === '/api/analises/a1') {
      started(); await gate;
      return ok({ estado: 'concluida', etapa: 'Concluída', duracao_s: 2.4,
        recorte: 'centro', criada_em: '2026-11-06T00:00:00Z' });
    }
    if (path === '/api/analises/a1/geojson') return ok({ type: 'FeatureCollection', features: [] });
    throw new Error(`Pedido inesperado: ${path}`);
  });
  try {
    const draw = createAnalysisVisual();
    connectAnalysis({ revision: 0, cleared: 0 }, () => {}, () => false, state => { states.push(state); draw(state); });
    await new Promise(resolve => setImmediate(resolve));
    const running = ctx.element('analyze').onclick();
    await monitoring;
    assert.equal(ctx.map.dataset.analysisState, 'running');
    assert.equal(ctx.element('analysis-map-indicator').hidden, false);
    assert.equal(ctx.element('analysis-map-time').textContent, '—');
    finish(); await running;
    assert.ok(states.some(state => state.stage === 'Centro · Concluída' && state.seconds === 2.4));
    assert.ok(states.some(state => state.stage === 'Centro · Carregando resultado…'));
    assert.equal(ctx.element('analysis-map-indicator').hidden, true);
    assert.equal(ctx.map.dataset.analysisState, undefined);
  } finally { ctx.restore(); }
});

test('perda de conexão pausa o indicador e retomar acompanha o mesmo pedido', async () => {
  let statusRequests = 0, posts = 0;
  const states = [];
  const ctx = setup(async (path, options) => {
    if (path === '/api/recortes') return ok(catalog);
    if (path === '/api/analises' && options.method === 'POST') { posts++; return ok({ analysis_id: 'a2' }); }
    if (path === '/api/analises/a2') {
      if (++statusRequests === 1) throw new Error('Conexão indisponível');
      return ok({ estado: 'concluida', etapa: 'Concluída', duracao_s: 3.1,
        recorte: 'centro', criada_em: '2026-11-06T00:00:00Z' });
    }
    if (path === '/api/analises/a2/geojson') return ok({ type: 'FeatureCollection', features: [] });
    throw new Error(`Pedido inesperado: ${path}`);
  });
  try {
    connectAnalysis({ revision: 0, cleared: 0 }, () => {}, () => false, state => states.push(state));
    await new Promise(resolve => setImmediate(resolve));
    await ctx.element('analyze').onclick();
    assert.equal(states.at(-1).mode, 'waiting');
    assert.match(states.at(-1).stage, /pode continuar/);
    assert.equal(ctx.element('retry-analysis').hidden, false);
    await ctx.element('retry-analysis').onclick();
    assert.equal(states.at(-1).mode, 'idle');
    assert.equal(posts, 1, 'retomar não deve iniciar outra análise');
  } finally { ctx.restore(); }
});

test('o indicador distingue acompanhamento interrompido e mantém o último tempo conhecido', () => {
  const ctx = setup(async () => { throw new Error('Não deve consultar a rede'); });
  try {
    const draw = createAnalysisVisual();
    draw({ mode: 'running', stage: 'Centro · janela 2/4', seconds: 2.4 });
    assert.equal(ctx.element('analysis-map-stage').textContent, 'Centro · janela 2/4');
    assert.equal(ctx.element('analysis-map-time').textContent, '2,4 s');
    draw({ mode: 'waiting', stage: 'Retome no painel.', seconds: 2.4 });
    assert.equal(ctx.map.dataset.analysisState, 'waiting');
    assert.equal(ctx.element('analysis-map-label').textContent, 'Acompanhamento interrompido');
    assert.equal(ctx.element('analysis-map-time').textContent, '2,4 s');
    draw({ mode: 'idle' });
    assert.equal(ctx.map.dataset.analysisState, undefined);
    assert.equal(ctx.element('analysis-map-indicator').hidden, true);
  } finally { ctx.restore(); }
});

test('falha ao iniciar não deixa o mapa em carregamento', async () => {
  const states = [];
  const ctx = setup(async path => {
    if (path === '/api/recortes') return ok(catalog);
    throw new Error('Não foi possível iniciar');
  });
  try {
    connectAnalysis({ revision: 0, cleared: 0 }, () => {}, () => false, state => states.push(state));
    await new Promise(resolve => setImmediate(resolve));
    await ctx.element('analyze').onclick();
    assert.equal(states[0].mode, 'running');
    assert.equal(states.at(-1).mode, 'idle');
    assert.equal(ctx.element('analyze').disabled, false);
    assert.match(ctx.element('analysis-status').textContent, /Não foi possível iniciar/);
  } finally { ctx.restore(); }
});
