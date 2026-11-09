import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.transform import from_origin
from shapely import transform
from shapely.geometry import Polygon, box, shape

from backend.crown_fusion import export, fuse
from backend.fusion_engine import LocalImages, run_fusion


def proposal(key, engine, geometry, score=.8, kind='copa_individual'):
    return {'key': key, 'engine': engine, 'geometry': geometry, 'score': score, 'tipo': kind, 'pixel_area_m2': .0625}


class FusionTests(unittest.TestCase):
    def test_linked_outputs_groups_complements_and_union_coverage(self):
        area = box(540000, 7650000, 540100, 7650100)
        rows = [proposal('r1', 'restor', box(540010, 7650010, 540020, 7650020)),
                proposal('r2', 'restor', box(540015, 7650015, 540025, 7650025), kind='grupo_de_copas'),
                proposal('c1', 'cambridge200', box(540010, 7650010, 540020, 7650020), kind='copa_candidata'),
                proposal('c2', 'cambridge200', box(540050, 7650050, 540060, 7650060), kind='copa_candidata'),
                proposal('c3', 'cambridge100', box(540050, 7650050, 540060, 7650060), kind='copa_candidata')]
        out = fuse(rows, area, 'job', sectors={'setor': area})
        self.assertEqual([len(out[n]['features']) for n in ('pontos', 'pontos-grupos', 'pontos-complementos', 'copas')], [1, 1, 1, 3])
        self.assertEqual(out['resumo']['cobertura_operacional_m2'], 175)
        self.assertEqual(out['resumo']['cobertura_confirmada_m2'], 0)
        self.assertEqual(out['resumo']['cobertura_por_setor']['setor']['cobertura_operacional_m2'], 175)
        polygons = {f['id']: f for f in out['copas']['features']}
        for point in out['pontos-todos']['features']:
            self.assertEqual(point['properties'], polygons[point['id']]['properties'])
            self.assertTrue(shape(polygons[point['id']]['geometry']).covers(shape(point['geometry'])))
        self.assertEqual(out['pontos']['features'][0]['properties']['evidencia'], 'ambos')

    def test_clipping_and_centroid_outside_concave_crown(self):
        a, b = 540000, 7650000
        concave = Polygon([(a,b),(a+10,b),(a+10,b+10),(a+8,b+10),(a+8,b+2),(a+2,b+2),(a+2,b+10),(a,b+10)])
        out = fuse([proposal('r', 'restor', concave)], box(a-1,b-1,a+9,b+11), 'job')
        point, crown = out['pontos']['features'][0], out['copas']['features'][0]
        self.assertTrue(shape(crown['geometry']).covers(shape(point['geometry'])))
        self.assertLess(crown['properties']['area_copa_m2'], concave.area)
        with tempfile.TemporaryDirectory() as temp:
            export(out, Path(temp))
            saved = json.loads((Path(temp)/'pontos-grupos.geojson').read_text(encoding='utf-8'))
            self.assertEqual(saved['features'], [])

    def test_local_raster_window_is_metric_and_ignores_invalid_pixels(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'local.tif'
            affine = from_origin(540000, 7650100, .25, .25)
            with rasterio.Env(GDAL_TIFF_INTERNAL_MASK=True):
                with rasterio.open(path,'w',driver='GTiff',width=400,height=400,count=3,dtype='uint8',crs='EPSG:31982',transform=affine) as src:
                    src.write(np.full((3,400,400), 120, dtype='uint8'))
                    valid=np.full((400,400),255,dtype='uint8');valid[:20,:20]=0;src.write_mask(valid)
            rgb, valid, output, sources = LocalImages([path], cache_root=Path(temp)/'imagens-cache').read((540000,7650000,540100,7650100),400)
            self.assertEqual(rgb.shape, (400,400,3));self.assertFalse(valid[0,0]);self.assertTrue(valid[200,200])
            self.assertEqual(output,affine);self.assertEqual(len(sources),1)

    def test_missing_local_coverage_fails_before_model_prediction(self):
        class Images:
            def read(self,bounds,size):
                return np.zeros((size,size,3),'uint8'),np.zeros((size,size),bool),from_origin(bounds[0],bounds[3],.25,.25),[]
        class Models:
            identity='test';manifest={}
            def predict(self,*args):raise AssertionError('Não deve inferir sem cobertura')
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError,'Acervo local incompleto'):
                run_fusion(Models(),box(540000,7650000,540010,7650010),Path(temp),images=Images(),cache_root=Path(temp)/'cache',progress=lambda _:None)


if __name__ == '__main__':unittest.main()
