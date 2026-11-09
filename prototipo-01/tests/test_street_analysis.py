import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from pyproj import Transformer
from shapely import transform
from shapely.geometry import Point, box, mapping, shape

from backend.api import create_app
from backend.street_analysis import analyze_streets, read_sector_analysis
from backend.territory import Territory


class StreetAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.sector = '350280405000340'
        self.to_geo = Transformer.from_crs('EPSG:31982', 'EPSG:4326', always_xy=True)
        area = transform(box(540000, 7650000, 540200, 7650200), self.to_geo.transform, interleaved=False)
        data = {'type': 'FeatureCollection', 'arboriza': {'sha256_fonte': 'fonte'},
                'features': [{'type': 'Feature', 'id': self.sector, 'properties': {}, 'geometry': mapping(area)}]}
        path = self.root / 'territory.json'; path.write_text(json.dumps(data), encoding='utf-8')
        self.territory = Territory(path)
        self.road_dir = self.root / 'roads'; self.road_dir.mkdir()
        road = {'type': 'FeatureCollection', 'arboriza': {'setor': self.sector, 'fonte_malha': 'fonte', 'coletado_em': '2026'},
                'features': [self.road('1', [(540010, 7650100), (540190, 7650100)]),
                             self.road('2', [(540010, 7650110), (540190, 7650110)])]}
        (self.road_dir / f'{self.sector}.geojson').write_text(json.dumps(road), encoding='utf-8')
        self.output = self.root / 'results'; self.ident = '20261106T123127Z-42678fff'
        (self.output / self.ident).mkdir(parents=True)
        (self.output / self.ident / 'resumo.json').write_text(json.dumps({'ids_setores': [self.sector], 'fonte_malha': 'fonte'}))

    def coord(self, x, y): return list(self.to_geo.transform(x, y))

    def road(self, ident, coords):
        return {'type': 'Feature', 'id': ident, 'properties': {'name': f'Rua {ident}', 'highway': 'residential'},
                'geometry': {'type': 'LineString', 'coordinates': [self.coord(*c) for c in coords]}}

    def test_single_nearest_assignment_and_outside_points(self):
        points = [self.coord(540050, 7650101), self.coord(540160, 7650109), self.coord(540050, 7650180),
                  self.coord(540400, 7650400)]
        result = analyze_streets(self.territory, [self.sector], points, 25, self.road_dir)
        self.assertEqual(len(result['features']), 4)
        self.assertEqual(sum(x['properties']['pontos_proximos'] for x in result['features']), 2)
        self.assertEqual(result['arboriza']['pontos_sem_via_proxima'], 1)
        self.assertEqual(result['arboriza']['pontos_fora_selecao'], 1)
        self.assertTrue(any(x['properties']['vizinhanca_parcial'] for x in result['features']))
        self.assertEqual(result['arboriza']['tamanho_trecho_m'], 100)

    def test_coverage_is_geometric_and_assignments_keep_input_indices(self):
        points = [self.coord(540050, 7650101), self.coord(540160, 7650109), self.coord(540400, 7650400)]
        result = analyze_streets(self.territory, [self.sector], points, 25, self.road_dir)
        assigned = []
        for feature in result['features']:
            p = feature['properties']
            self.assertEqual(len(p['pontos_associados']), p['pontos_proximos'])
            self.assertGreater(p['cobertura_entorno_percentual'], 0)
            self.assertLessEqual(p['cobertura_entorno_percentual'], 100)
            if p['vizinhanca_parcial']:
                self.assertLess(p['cobertura_entorno_percentual'], 100)
            for point in p['pontos_associados']:
                assigned.append(point['indice'])
                self.assertGreaterEqual(point['posicao_m'], 0)
                self.assertLessEqual(point['posicao_m'], p['comprimento_m'] + .01)
                self.assertLessEqual(point['distancia_m'], 25)
        self.assertEqual(sorted(assigned), [0, 1])
        self.assertEqual(len(set(assigned)), len(assigned))
        self.assertEqual(len(assigned) + result['arboriza']['pontos_sem_via_proxima'] + result['arboriza']['pontos_fora_selecao'], len(points))

    def test_complete_corridor_has_full_coverage_even_with_no_points(self):
        path = self.road_dir / f'{self.sector}.geojson'
        data = json.loads(path.read_text(encoding='utf-8'))
        data['features'] = [self.road('1', [(540050, 7650100), (540150, 7650100)])]
        path.write_text(json.dumps(data), encoding='utf-8')
        result = analyze_streets(self.territory, [self.sector], [self.coord(540100, 7650190)], 25, self.road_dir)
        p = result['features'][0]['properties']
        self.assertEqual(p['cobertura_entorno_percentual'], 100)
        self.assertFalse(p['vizinhanca_parcial'])
        self.assertEqual(p['pontos_proximos'], 0)

    def test_bad_area_invalid_points_and_analysis_source(self):
        self.assertEqual(read_sector_analysis(self.ident, self.output, self.territory), [self.sector])
        for bad in ('../../elsewhere', 'missing'):
            with self.assertRaises(ValueError): read_sector_analysis(bad, self.output, self.territory)
        with self.assertRaises(ValueError):
            analyze_streets(self.territory, [self.sector], [[float('nan'), 0]], 25, self.road_dir)
        with self.assertRaises(ValueError):
            analyze_streets(self.territory, [self.sector], [self.coord(540050, 7650101)], 25, self.root / 'missing')

    def test_visual_margin_reveals_context_without_expanding_analysis(self):
        # Este ponto está 10 m fora do setor, mas na nova margem visual de 20 m.
        outside_point = self.coord(540210, 7650100)
        result = analyze_streets(self.territory, [self.sector],
                                 [self.coord(540050, 7650101), outside_point], 25, self.road_dir)
        meta = result['arboriza']
        real = transform(shape(meta['geometria_setores']), self.territory.project.transform, interleaved=False)
        visual = transform(shape(meta['geometria_contexto_visual']), self.territory.project.transform, interleaved=False)
        self.assertEqual(meta['margem_contexto_visual_m'], 20)
        self.assertTrue(visual.covers(Point(540210, 7650100)))
        self.assertFalse(visual.covers(Point(540230, 7650100)))
        self.assertAlmostEqual(visual.bounds[2] - real.bounds[2], 20, places=3)
        self.assertEqual(meta['pontos_fora_selecao'], 1)
        self.assertEqual(sum(f['properties']['pontos_proximos'] for f in result['features']), 1)
        for feature in result['features']:
            road = transform(shape(feature['geometry']), self.territory.project.transform, interleaved=False)
            self.assertTrue(real.buffer(.001).covers(road))

    def test_http_rejects_invalid_and_uses_current_points(self):
        path = self.root / 'territory.json'
        with patch('backend.street_analysis.ROAD_DIR', self.road_dir), \
             patch('backend.street_analysis.analyze_streets', wraps=lambda territory, ids, points, distance: analyze_streets(territory, ids, points, distance, self.road_dir)):
            with TestClient(create_app(output=self.output, territory_path=path)) as client:
                body = {'analysis_id': self.ident, 'pontos': [self.coord(540050, 7650101)], 'distancia_m': 25}
                response = client.post('/api/ruas/diagnostico', json=body)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(sum(f['properties']['pontos_proximos'] for f in response.json()['features']), 1)
                for update in ({'analysis_id': '../bad'}, {'pontos': []}, {'distancia_m': 101}):
                    self.assertEqual(client.post('/api/ruas/diagnostico', json={**body, **update}).status_code, 422)


if __name__ == '__main__':
    unittest.main()
