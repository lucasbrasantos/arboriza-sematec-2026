import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PointLayer } from '../frontend/js/points.js';
import { readStudyArea, studyAreaFor, recortes } from '../frontend/js/map.js';

const point = (lng, lat, recorte) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { recorte } });

test('camadas antigas do modelo recuperam o recorte conhecido, inclusive vazias', () => {
  const layer = new PointLayer('modelo', [point(-50.441, -21.207, 'centro-norte')]);
  assert.deepEqual(studyAreaFor(layer), { recorte: 'norte', bounds: recortes.norte });
  const empty = new PointLayer('vazia'); empty.recorte = 'centro';
  assert.deepEqual(studyAreaFor(empty).bounds, recortes.centro);
  const manual = new PointLayer('arboriza-pontos_centro_2026-11-05_17-17-15.geojson', [point(-50.439, -21.209)]);
  assert.equal(studyAreaFor(manual).recorte, 'centro');
});

test('recorte personalizado mantém seus limites mesmo depois de serializar e reimportar', () => {
  const area = { recorte: 'custom', bounds: [[-21.22, -50.45], [-21.20, -50.43]] };
  const layer = new PointLayer('manual', [point(-50.44, -21.21)]); layer.studyArea = area;
  const saved = JSON.parse(JSON.stringify({ ...layer.geojson(), arboriza: { area: studyAreaFor(layer) } }));
  assert.deepEqual(readStudyArea(saved.arboriza.area), area);
  assert.notEqual(readStudyArea(area).bounds, area.bounds);
});

test('metadados inválidos são ignorados; limites diferentes não habilitam análise de um recorte conhecido', () => {
  for (const bounds of [null, [[NaN, 0], [1, 1]], [[1, 1], [0, 0]], [[-91, 0], [0, 1]]]) {
    assert.equal(readStudyArea({ recorte: 'custom', bounds }), undefined);
  }
  assert.equal(readStudyArea({ recorte: 'centro', bounds: [[-22, -51], [-21, -50]] }).recorte, 'custom');
});

test('camada antiga sem recorte enquadra todos os pontos; edição fora do recorte expande a área', () => {
  const layer = new PointLayer('antiga', [point(-50.44, -21.21)]);
  const inferred = studyAreaFor(layer);
  assert.equal(inferred.recorte, 'custom');
  assert.ok(inferred.bounds[0][0] < -21.21 && inferred.bounds[1][0] > -21.21);
  layer.studyArea = { recorte: 'centro', bounds: recortes.centro };
  layer.add([-50.46, -21.23]);
  const expanded = studyAreaFor(layer);
  assert.equal(expanded.recorte, 'custom');
  assert.deepEqual(expanded.bounds[0], [-21.23, -50.46]);
  assert.equal(studyAreaFor(new PointLayer('vazia')), undefined);
});
