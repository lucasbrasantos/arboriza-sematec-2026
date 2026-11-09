import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.transform import from_bounds
from shapely import transform
from shapely.geometry import box, mapping

from arboriza_api.engine.imagery.orthophoto_wms import temporary_images
from arboriza_api.engine.inference.sector_analysis import run_sector_analysis, suppress_duplicates, windows_for_area
from arboriza_api.engine.geography.territory import Territory


class Tensor:
    def __init__(self, values): self.values = np.array(values)
    def numpy(self): return self.values


class Detector:
    manifest = {'model_id': 'fake'}
    def predict(self, image):
        height, width = image.shape[:2]
        boxes = type('Boxes', (), {'tensor': Tensor([[width/2-3, height/2-3, width/2+3, height/2+3]])})()
        return type('Instances', (), {'pred_boxes': boxes, 'scores': Tensor([.9])})()


class SectorAnalysisTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.out = self.root / 'out'
        self.out.mkdir()
        cell_x, cell_y = 3610, 50810
        from_geo = Transformer.from_crs('EPSG:31982', 'EPSG:4326', always_xy=True)
        area = box(cell_x*150+50, cell_y*150+50, cell_x*150+100, cell_y*150+100)
        geometry = transform(area, from_geo.transform, interleaved=False)
        source = {'type': 'FeatureCollection', 'arboriza': {'sha256_fonte': 'teste'},
                  'features': [{'type': 'Feature', 'id': 'a', 'properties': {}, 'geometry': mapping(geometry)}]}
        path = self.root / 'territory.geojson'
        path.write_text(json.dumps(source), encoding='utf-8')
        self.territory = Territory(path)

    def fetch(self, bounds, width, height, path, client, incomplete=False):
        with rasterio.Env(GDAL_TIFF_INTERNAL_MASK=True):
            with rasterio.open(path, 'w', driver='GTiff', width=width, height=height, count=3, dtype='uint8',
                               crs='EPSG:4674', transform=from_bounds(*bounds, width, height)) as dst:
                dst.write(np.ones((3, height, width), dtype='uint8'))
                dst.write_mask(np.full((height, width), 0 if incomplete else 255, dtype='uint8'))
        return {'aquisicao_s': .1, 'pixels_validos': 0 if incomplete else width*height,
                'pixels_totais': width*height, 'sha256_png': 'teste', 'bytes_png': 123,
                'camada': 'teste', 'crs': 'EPSG:4674', 'bounds_lon_lat': list(bounds),
                'largura': width, 'altura': height}

    def test_complete_sector_produces_points_and_cleans_images(self):
        scratch = self.root / 'scratch'
        result = run_sector_analysis(Detector(), self.territory, ['a'], .15, self.out, lambda _: None,
                                     fetch=self.fetch, temporary=lambda: temporary_images(scratch), cache_root=self.root / 'cache')
        self.assertEqual(result['janelas'], 1)
        self.assertEqual(result['candidatos'], 1)
        self.assertEqual(result['cobertura'], 'completa_por_mascara')
        self.assertEqual(len(json.loads((self.out / 'pontos.geojson').read_text())['features']), 1)
        self.assertEqual(list(scratch.iterdir()), [])

    def test_incomplete_image_stops_without_results_and_cleans(self):
        scratch = self.root / 'scratch'
        with self.assertRaisesRegex(ValueError, 'incompleta'):
            run_sector_analysis(Detector(), self.territory, ['a'], .15, self.out, lambda _: None,
                                fetch=lambda *a, **kw: self.fetch(*a, **kw, incomplete=True),
                                temporary=lambda: temporary_images(scratch), cache_root=self.root / 'cache')
        self.assertFalse((self.out / 'pontos.geojson').exists())
        self.assertEqual(list(scratch.iterdir()), [])

    def test_grid_and_nms(self):
        cells = list(windows_for_area(box(0, 0, 300, 150)))
        self.assertEqual(len(cells), 2)
        rows = [{'box': box(0, 0, 10, 10), 'score': .8}, {'box': box(0, 0, 10, 10), 'score': .8},
                {'box': box(30, 0, 40, 10), 'score': .9}]
        self.assertEqual(len(suppress_duplicates(rows)), 2)

    def test_repeated_sector_reuses_cache_without_network(self):
        scratch, cache = self.root / 'scratch', self.root / 'cache'
        first = run_sector_analysis(Detector(), self.territory, ['a'], .15, self.out, lambda _: None,
                                    fetch=self.fetch, temporary=lambda: temporary_images(scratch), cache_root=cache)
        def no_network(*args, **kwargs):
            raise AssertionError('A segunda execução não deveria baixar a imagem')
        second = run_sector_analysis(Detector(), self.territory, ['a'], .15, self.out, lambda _: None,
                                     fetch=no_network, temporary=lambda: temporary_images(scratch), cache_root=cache)
        self.assertEqual((first['janelas_download'], first['janelas_cache']), (1, 0))
        self.assertEqual((second['janelas_download'], second['janelas_cache']), (0, 1))
        self.assertEqual(first['candidatos'], second['candidatos'])
        self.assertEqual(list(scratch.iterdir()), [])

    def test_altered_cache_is_not_used_or_replaced_silently(self):
        scratch, cache = self.root / 'scratch', self.root / 'cache'
        run_sector_analysis(Detector(), self.territory, ['a'], .15, self.out, lambda _: None,
                            fetch=self.fetch, temporary=lambda: temporary_images(scratch), cache_root=cache)
        cached = next(cache.glob('*.tif'))
        cached.write_bytes(b'alterado')
        with self.assertRaisesRegex(ValueError, 'ausente ou alterada'):
            run_sector_analysis(Detector(), self.territory, ['a'], .15, self.out, lambda _: None,
                                fetch=self.fetch, temporary=lambda: temporary_images(scratch), cache_root=cache)
        self.assertEqual(cached.read_bytes(), b'alterado')


if __name__ == '__main__':
    unittest.main()
