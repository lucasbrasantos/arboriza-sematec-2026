import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from pyproj import Transformer
from shapely import transform
from shapely.geometry import box, mapping

from backend.api import create_app
from backend.street_analysis import analyze_streets
from backend.street_canopies import CanopyCoverage, select_canopies
from backend.territory import Territory


class StreetCanopiesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.ident = '20261108T010300Z-04ea89a4'
        self.folder = self.root/self.ident
        self.folder.mkdir()
        self.back = Transformer.from_crs(31982, 4326, always_xy=True)
        self.sector = '350280405000001'
        territory = {'arboriza': {'sha256_fonte': 'test'}, 'features': [{'type': 'Feature', 'id': self.sector,
            'geometry': self.geographic(box(540000, 7650000, 540200, 7650200)), 'properties': {}}]}
        self.territory_path = self.root/'territory.json'
        self.territory_path.write_text(json.dumps(territory), encoding='utf-8')
        self.territory = Territory(self.territory_path)
        (self.folder/'resumo.json').write_text(json.dumps({'perfil': 'fusao', 'ids_setores': [self.sector], 'fonte_malha': 'test'}))
        self.write_originals()
        self.roads = self.root/'roads'
        self.roads.mkdir()
        road = {'type': 'Feature', 'id': '1', 'properties': {'name': 'Rua teste', 'highway': 'residential'},
                'geometry': {'type': 'LineString', 'coordinates': [self.coord(540010, 7650100), self.coord(540190, 7650100)]}}
        (self.roads/(self.sector+'.geojson')).write_text(json.dumps({'features': [road],
            'arboriza': {'setor': self.sector, 'fonte_malha': 'test', 'coletado_em': 'teste'}}))

    def coord(self, x, y):
        return list(self.back.transform(x, y))

    def geographic(self, geometry):
        return mapping(transform(geometry, self.back.transform, interleaved=False))

    def write_originals(self):
        points, masks = [], []
        for ident, kind, geometry, coordinates in [
            ('i', 'copa_individual', box(540030, 7650095, 540050, 7650110), self.coord(540040, 7650101)),
            # Centro longe do eixo, mas a máscara chega à faixa de 25 m.
            ('g', 'grupo_de_copas', box(540040, 7650120, 540100, 7650190), self.coord(540070, 7650160)),
            ('p', 'complemento_pendente', box(540100, 7650090, 540140, 7650110), self.coord(540120, 7650100)),
        ]:
            props = {'copa_id': ident, 'tipo': kind, 'analise_id': self.ident}
            points.append({'type': 'Feature', 'id': ident, 'properties': props, 'geometry': {'type': 'Point', 'coordinates': coordinates}})
            masks.append({'type': 'Feature', 'id': ident, 'properties': props, 'geometry': self.geographic(geometry)})
        for name, features in [('pontos-todos', points), ('copas', masks)]:
            (self.folder/(name+'.geojson')).write_text(json.dumps({'type': 'FeatureCollection', 'arboriza': {'perfil': 'fusao'}, 'features': features}))

    def test_union_does_not_double_count_and_pending_is_excluded(self):
        coverage = CanopyCoverage([
            {'tipo': 'copa_individual', 'geometry': box(0, 0, 10, 10)},
            {'tipo': 'grupo_de_copas', 'geometry': box(5, 0, 15, 10)},
            {'tipo': 'complemento_pendente', 'geometry': box(0, 0, 20, 10)},
        ])
        measured = coverage.measure(box(0, 0, 20, 10))
        self.assertEqual(measured['area_copas_base_m2'], 150)
        self.assertEqual(measured['cobertura_copas_base_percentual'], 75)
        self.assertEqual(measured['mascaras_na_faixa_por_tipo']['grupo_de_copas'], 1)
        # Denominador é a faixa efetivamente avaliada, não a área fora dos setores.
        self.assertEqual(coverage.measure(box(0, 0, 10, 10))['cobertura_copas_base_percentual'], 100)

    def test_deduplication_and_deletions_change_input_without_mutating_original(self):
        before = (self.folder/'copas.geojson').read_bytes()
        records, metadata = select_canopies(self.ident, self.root, [
            {'id_camada': 'individuais', 'ids_copas': ['i']}, {'id_camada': 'copia', 'ids_copas': ['i', 'g']}])
        self.assertEqual([r['id'] for r in records], ['i', 'g'])
        self.assertEqual(metadata['duplicados_ignorados'], 1)
        revised, _ = select_canopies(self.ident, self.root, [{'id_camada': 'individuais', 'ids_copas': ['i']}])
        self.assertEqual(len(revised), 1)
        self.assertEqual((self.folder/'copas.geojson').read_bytes(), before)
        with self.assertRaisesRegex(ValueError, 'não pertence'):
            select_canopies(self.ident, self.root, [{'id_camada': 'outra', 'ids_copas': ['outra-execucao']}])

    def test_mask_crossing_corridor_counts_coverage_without_counting_group_as_individual(self):
        records, _ = select_canopies(self.ident, self.root, [{'id_camada': 'todos', 'ids_copas': ['i', 'g', 'p']}])
        result = analyze_streets(self.territory, [self.sector], [r['coordinates'] for r in records], 25,
                                 self.roads, canopies=records)
        self.assertEqual(sum(f['properties']['individuos_proximos'] for f in result['features']), 1)
        self.assertEqual(sum(f['properties']['grupos_proximos'] for f in result['features']), 0)
        self.assertEqual(sum(f['properties']['complementos_proximos'] for f in result['features']), 1)
        self.assertTrue(any(f['properties']['mascaras_na_faixa_por_tipo']['grupo_de_copas'] == 1 for f in result['features']))
        self.assertTrue(all(0 <= f['properties']['cobertura_copas_base_percentual'] <= 100 for f in result['features']))

    def test_http_contract_uses_originals_and_rejects_mixed_modes(self):
        def diagnostic(territory, ids, points, distance, **kwargs):
            return analyze_streets(territory, ids, points, distance, self.roads, **kwargs)
        body = {'analysis_id': self.ident, 'camadas': [{'id_camada': 'individuais', 'ids_copas': ['i']},
                 {'id_camada': 'grupos', 'ids_copas': ['g']}], 'distancia_m': 25}
        with patch('backend.street_analysis.analyze_streets', side_effect=diagnostic), TestClient(create_app(output=self.root, territory_path=self.territory_path)) as client:
            result = client.post('/api/ruas/diagnostico', json=body)
            self.assertEqual(result.status_code, 200, result.text)
            meta = result.json()['arboriza']
            self.assertTrue(meta['multicamadas'])
            self.assertEqual(meta['totais_por_tipo'], {'copa_individual': 1, 'grupo_de_copas': 1, 'complemento_pendente': 0})
            self.assertEqual(client.post('/api/ruas/diagnostico', json={**body, 'pontos': [self.coord(540040, 7650101)]}).status_code, 422)
            self.assertEqual(client.post('/api/ruas/diagnostico', json={**body, 'camadas': [{'id_camada': 'outro', 'ids_copas': ['desconhecido']}]}).status_code, 422)
            empty = {**body, 'camadas': [{'id_camada': 'vazia', 'ids_copas': []}]}
            self.assertEqual(client.post('/api/ruas/diagnostico', json=empty).status_code, 422)


if __name__ == '__main__':
    unittest.main()
