import test from 'node:test';
import assert from 'node:assert/strict';
import { intensityColor, rankStreets, segmentIntensity } from '../src/features/admin/streets/street-intensity.js';

const feature = (id, name, length, base, individuals, pending = 0, coverage = 0) => ({ id, properties: { nome: name, comprimento_m: length, pontos_base_proximos: base, pontos_proximos: base + pending, individuos_proximos: individuals, grupos_proximos: base - individuals, complementos_proximos: pending, cobertura_copas_base_percentual: coverage } });

test('normalizes street length and excludes pending complements', () => {
  assert.equal(segmentIntensity(feature('1', 'A', 200, 10, 8, 40)), 5);
  assert.equal(segmentIntensity(feature('1', 'A', 200, 10, 8, 40), 'individual-rate'), 4);
  assert.equal(segmentIntensity(feature('1', 'A', 0, 10, 8)), 0);
});

test('ranks grouped streets by aggregate rate rather than raw counts or mean of rates', () => {
  const data = { features: [feature('1', 'Rua A', 100, 10, 10), feature('2', 'rua a', 300, 0, 0), feature('3', 'Rua B', 100, 3, 3)] };
  const ranked = rankStreets(data);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].name, 'Rua B');
  assert.equal(ranked[1].value, 2.5);
  assert.equal(ranked[1].length, 400);
  assert.equal(rankStreets(data, 'base-rate', true)[0].name, 'Rua A');
});

test('coverage is a length-weighted average, not a sum of overlapping canopy areas', () => {
  const data = { features: [feature('1', 'Rua A', 100, 1, 1, 0, 10), feature('2', 'Rua A', 300, 1, 1, 0, 50)] };
  assert.equal(rankStreets(data, 'coverage')[0].value, 40);
});

test('unnamed OSM ways remain distinct and equal rates have stable name ordering', () => {
  const data = { features: [feature('osm1-0-0', 'Via sem nome no OSM', 100, 0, 0), feature('osm2-0-0', 'Via sem nome no OSM', 100, 0, 0), feature('3', 'Rua B', 100, 0, 0), feature('4', 'Rua A', 100, 0, 0)] };
  assert.equal(rankStreets(data).length, 4);
  assert.equal(rankStreets(data)[0].name, 'Rua A');
});

test('palette runs from orange at zero to dark green at the observed maximum', () => {
  assert.equal(intensityColor(0, 10), '#df7416');
  assert.equal(intensityColor(10, 10), '#05846f');
  assert.equal(intensityColor(0, 0), '#df7416');
  assert.equal(intensityColor(100, 10), '#05846f');
  assert.notEqual(intensityColor(5, 10), intensityColor(0, 10));
});
