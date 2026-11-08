import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pyproj import Transformer
from shapely import transform
from shapely.geometry import box, mapping

from arboriza_api.engine.geography.street_catalog import build_catalog, load_roads, query_for
from arboriza_api.engine.geography.street_analysis import analyze_streets
from arboriza_api.engine.geography.territory import Territory


class StreetCatalogTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.database = self.root/'roads.sqlite3'
        self.back = Transformer.from_crs(31982, 4326, always_xy=True)
        self.ids = ['350280405000001', '350280405000002']
        collection = {'type': 'FeatureCollection', 'arboriza': {'sha256_fonte': 'test-mesh'},
                      'features': [{'type': 'Feature', 'id': ident, 'properties': {},
                                    'geometry': mapping(transform(box(x, 7650000, x+100, 7650100),
                                                                  self.back.transform, interleaved=False))}
                                   for ident, x in zip(self.ids, [540000, 540100])]}
        path = self.root/'territory.json'
        path.write_text(json.dumps(collection), encoding='utf-8')
        self.territory = Territory(path)
        self.payload = {'elements': [self.way(1, [(540010, 7650020), (540090, 7650020)]),
                                     self.way(2, [(540010, 7650050), (540190, 7650050)]),
                                     self.way(3, [(541000, 7650050), (541100, 7650050)])]}

    def way(self, ident, coordinates):
        return {'type': 'way', 'id': ident, 'tags': {'name': f'Rua {ident}', 'highway': 'residential'},
                'geometry': [dict(zip(('lon', 'lat'), self.back.transform(*p))) for p in coordinates]}

    def build(self, payload=None):
        return build_catalog(payload or self.payload, self.territory, self.database,
                             {'coletado_em': 'test-date'}, lambda _: None)

    def test_filter_membership_deduplication_and_no_network(self):
        metadata = self.build()
        self.assertEqual(metadata['vias'], 2)  # a terceira via está fora do escopo
        self.assertEqual(metadata['vinculos'], 3)
        self.assertEqual(metadata['setores_sem_vias'], [])
        with patch('httpx.Client.send', side_effect=AssertionError('Rede proibida')):
            a, _, _ = load_roads(self.database, [self.ids[0]], 'test-mesh')
            b, _, _ = load_roads(self.database, [self.ids[1]], 'test-mesh')
            both, _, meta = load_roads(self.database, self.ids, 'test-mesh')
        self.assertEqual(set(a), {'1', '2'})
        self.assertEqual(set(b), {'2'})
        self.assertEqual(set(both), {'1', '2'})
        self.assertEqual(meta['setores_catalogados'], 2)

    def test_same_diagnostic_as_geojson_and_reads_current_points(self):
        self.build()
        pilot = self.root/'pilot'
        pilot.mkdir()
        features = [{'type': 'Feature', 'id': str(w['id']), 'properties': w['tags'],
                     'geometry': {'type': 'LineString', 'coordinates': [[p['lon'], p['lat']] for p in w['geometry']]}}
                    for w in self.payload['elements']]
        for ident in self.ids:
            (pilot/(ident+'.geojson')).write_text(json.dumps({'type': 'FeatureCollection', 'features': features,
                'arboriza': {'setor': ident, 'fonte_malha': 'test-mesh', 'coletado_em': 'test-date'}}), encoding='utf-8')
        points = [list(self.back.transform(540040, 7650021)), list(self.back.transform(540140, 7650051))]
        with patch('httpx.Client.send', side_effect=AssertionError('Rede proibida')):
            local = analyze_streets(self.territory, self.ids, points, 25, catalog_path=self.database)
            old = analyze_streets(self.territory, self.ids, points, 25, pilot)
            revised = analyze_streets(self.territory, self.ids, points[:1], 25, catalog_path=self.database)
        self.assertEqual(local['features'], old['features'])
        self.assertEqual(sum(f['properties']['pontos_proximos'] for f in local['features']), 2)
        self.assertEqual(sum(f['properties']['pontos_proximos'] for f in revised['features']), 1)

    def test_wrong_mesh_missing_sector_and_partial_response_preserve_catalog(self):
        self.build()
        with self.assertRaisesRegex(ValueError, 'malha atual'):
            load_roads(self.database, self.ids, 'outro-hash')
        with self.assertRaisesRegex(ValueError, 'todos os setores'):
            load_roads(self.database, ['350280405000999'], 'test-mesh')
        checksum = hashlib.sha256(self.database.read_bytes()).hexdigest()
        with self.assertRaisesRegex(ValueError, 'incompleta'):
            self.build({'elements': self.payload['elements'], 'remark': 'runtime error: timeout'})
        self.assertEqual(hashlib.sha256(self.database.read_bytes()).hexdigest(), checksum)

    def test_cache_invalidates_after_database_replacement(self):
        self.build()
        first, _, _ = load_roads(self.database, self.ids, 'test-mesh')
        self.assertEqual(first['1']['properties']['name'], 'Rua 1')
        before = self.database.stat().st_mtime_ns
        self.payload['elements'][0]['tags']['name'] = 'Rua atualizada'
        self.build()
        os.utime(self.database, ns=(before+1_000_000_000, before+1_000_000_000))
        second, _, _ = load_roads(self.database, self.ids, 'test-mesh')
        self.assertEqual(second['1']['properties']['name'], 'Rua atualizada')

    def test_query_uses_one_bbox_and_reports_sectors_with_no_osm_roads(self):
        query, bounds = query_for(self.territory)
        self.assertIn('out body geom', query)
        self.assertIn('way["highway"', query)
        self.assertEqual(len(bounds), 4)
        result = self.build({'elements': [self.payload['elements'][0]]})
        self.assertEqual(result['setores_sem_vias'], [self.ids[1]])
        roads, _, _ = load_roads(self.database, [self.ids[1]], 'test-mesh')
        self.assertEqual(roads, {})


if __name__ == '__main__':
    unittest.main()
