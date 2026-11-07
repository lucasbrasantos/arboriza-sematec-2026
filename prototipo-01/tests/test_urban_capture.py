"""Validações offline do capturador, sem requisições ao DataGEO."""
import io
import json
import logging
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image
from pyproj import Transformer
from shapely import transform
from shapely.geometry import box, mapping

from backend.urban_capture import (capture_tile, download_plan, existing_tile, plan_capture,
                                  request_for, validate_coverage)
from scripts.baixar_acervo_urbano import main


class UrbanCaptureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        back = Transformer.from_crs(31982, 4326, always_xy=True)
        features = [{'type': 'Feature', 'id': str(i), 'properties': {},
                     'geometry': mapping(transform(box(x, 7650050, x+50, 7650100), back.transform, interleaved=False))}
                    for i, x in enumerate((540050, 541050))]
        self.source = self.root/'setores.geojson'
        self.source.write_text(json.dumps({'features': features}), encoding='utf-8')
        self.plan = plan_capture(self.source)
        self.block = self.plan['blocos'][0]

    def test_grid_skips_empty_space_and_is_stable_with_context(self):
        self.assertEqual(len(self.plan['blocos']), 2)
        self.assertEqual(self.plan['quadrados_descartados'], 1)
        self.assertTrue(all(b['area_setores_m2'] > 0 for b in self.plan['blocos']))
        no_context = plan_capture(self.source, 0)
        self.assertEqual([b['id'] for b in no_context['blocos']], [b['id'] for b in self.plan['blocos']])
        self.assertGreater(self.block['area_contexto_m2'], no_context['blocos'][0]['area_contexto_m2'])
        self.assertEqual(request_for(self.block)['WIDTH'], '2000')
        w, s, e, n = self.block['bounds_utm']
        self.assertEqual(((e-w)/2000, (n-s)/2000), (.25, .25))

    def test_capture_mocked_png_and_resume_without_network(self):
        content = io.BytesIO()
        Image.new('RGBA', (2000, 2000), (30, 120, 60, 255)).save(content, format='PNG')
        class Response:
            headers = {'content-type': 'image/png'}
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def raise_for_status(self): pass
            def iter_bytes(self): yield content.getvalue()
        class Client:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def stream(self, *args, **kwargs): return Response()
        with patch('backend.urban_capture.httpx.Client', return_value=Client()):
            first = capture_tile(self.root, self.block, threading.Event(), attempts=1)
        self.assertFalse(first['reutilizado'])
        self.assertEqual(first['pixels_validos'], 4_000_000)
        with patch('backend.urban_capture.httpx.Client', side_effect=AssertionError('Rede proibida no teste')):
            second = capture_tile(self.root, self.block, threading.Event())
        self.assertTrue(second['reutilizado'])
        self.assertEqual(first['sha256_tif'], second['sha256_tif'])
        path = self.root/(self.block['id']+'.json')
        data = json.loads(path.read_text(encoding='utf-8')); data['sha256_tif'] = 'alterado'
        path.write_text(json.dumps(data), encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'alterados'):
            existing_tile(self.root, self.block)

    def test_validates_required_area_instead_of_full_square(self):
        valid = np.zeros((2000, 2000), bool)
        # A área necessária do primeiro setor está neste pequeno recorte.
        valid[1500:1950, 0:700] = True
        validate_coverage(valid, self.block)
        valid[:] = False
        with self.assertRaisesRegex(ValueError, 'sem cobertura'):
            validate_coverage(valid, self.block)

    def test_failure_remains_pending_and_does_not_stop_other_blocks(self):
        logging.disable(logging.CRITICAL)
        self.addCleanup(lambda: logging.disable(logging.NOTSET))
        def fake(directory, block, stop, attempts):
            if block['id'] == self.block['id']: raise ValueError('falha simulada')
            return {'reutilizado': True, 'bytes_tif': 100, 'pixels_validos': 4_000_000}
        with patch('backend.urban_capture.capture_tile', side_effect=fake):
            result = download_plan(self.plan, self.root, workers=1, attempts=1)
        self.assertEqual(result['completos'], 1)
        self.assertEqual(result['pendentes'], [self.block['id']])
        self.assertIn(self.block['id'], result['falhas'])
        self.assertFalse(result['interrompido'])

    def test_default_cli_does_not_initiate_download(self):
        with patch('sys.argv', ['baixar_acervo_urbano.py']), \
             patch('scripts.baixar_acervo_urbano.plan_capture', return_value=self.plan), \
             patch('scripts.baixar_acervo_urbano.download_plan') as downloader:
            self.assertEqual(main(), 0)
            downloader.assert_not_called()


if __name__ == '__main__':
    unittest.main()
