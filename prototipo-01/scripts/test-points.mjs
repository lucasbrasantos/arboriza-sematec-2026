import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PointLayer, readPoints } from '../points.js';

const feature = (numero, id) => ({ type: 'Feature', ...(id === undefined ? {} : { id }),
  geometry: { type: 'Point', coordinates: [-50.4384, -21.2082] },
  properties: { origem: 'manual', ...(numero === undefined ? {} : { numero }) } });
const collection = features => ({ type: 'FeatureCollection', features });

test('arquivo antigo recebe IDs sem modificar o original; reimportação preserva a identidade', () => {
  const old = collection([feature(), feature()]);
  const layer = new PointLayer('manual', readPoints(old));
  const saved = layer.geojson();
  assert.equal(old.features[0].id, undefined);
  assert.deepEqual(saved.features.map(f => f.properties.numero), [1, 2]);
  assert.notEqual(saved.features[0].id, saved.features[1].id);
  assert.deepEqual(new PointLayer('reimportado', readPoints(saved)).geojson(), saved);
});

test('números com lacunas e ordem diferente sobrevivem; novos pontos usam o próximo número', () => {
  const layer = new PointLayer('manual', readPoints(collection([feature(66), feature(14), feature()])));
  assert.deepEqual(layer.points.map(p => p.number), [66, 14, 67]);
  layer.add([-50.44, -21.21]);
  assert.equal(layer.points.at(-1).number, 68);
});

test('mover, apagar, desfazer e refazer preservam o ID e o número', () => {
  const layer = new PointLayer('manual', [feature(66, 'arvore-66')]);
  const point = layer.points[0];
  layer.move(new Map([[point.key, [-50.439, -21.209]]]));
  assert.equal(layer.geojson().features[0].id, 'arvore-66');
  layer.selected.add(point.key); layer.remove();
  assert.equal(layer.points.length, 0);
  layer.history();
  assert.equal(layer.points[0].number, 66);
  assert.equal(layer.points[0].feature.id, 'arvore-66');
  layer.history(true);
  assert.equal(layer.points.length, 0);
});

test('metadados do detector e ID numérico zero são preservados', () => {
  const value = feature(14, 0);
  value.properties = { ...value.properties, modelo: 'detectree2-cambridge', score: .882, revisado: false };
  const saved = new PointLayer('IA', [value]).geojson().features[0];
  assert.equal(saved.id, 0);
  assert.deepEqual(saved.properties, value.properties);
});

test('números duplicados ou inválidos são rejeitados com uma mensagem de recuperação', () => {
  for (const values of [[feature(0)], [feature('66')], [feature(1), feature(1)]]) {
    assert.throws(() => readPoints(collection(values)), /inteiros positivos e únicos/);
  }
});
