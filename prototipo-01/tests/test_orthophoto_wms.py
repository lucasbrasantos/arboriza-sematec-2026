import io
import tempfile
import unittest
from pathlib import Path

import httpx
import numpy as np
import rasterio
from PIL import Image

from backend.orthophoto_wms import fetch_orthophoto, temporary_images


def png(alpha=255):
    image = np.full((2, 3, 4), 140, dtype='uint8')
    image[:, :, 3] = alpha
    image[0, 0, 3] = 0
    output = io.BytesIO()
    Image.fromarray(image, 'RGBA').save(output, format='PNG')
    return output.getvalue()


class WmsTests(unittest.TestCase):
    def test_metric_request_preserves_easting_northing_axes(self):
        bounds=(558000,7654000,558200,7654200)
        def handler(request):
            self.assertEqual(request.url.params['BBOX'],'558000,7654000,558200,7654200')
            self.assertEqual(request.url.params['CRS'],'EPSG:31982')
            return httpx.Response(200,headers={'Content-Type':'image/png'},content=png())
        metadata=fetch_orthophoto(bounds,3,2,self.root/'utm.tif',self.client(handler),crs='EPSG:31982')
        self.assertEqual(metadata['bounds_utm'],list(bounds))
        with rasterio.open(self.root/'utm.tif') as raster:
            self.assertEqual(raster.crs.to_string(),'EPSG:31982')
            self.assertEqual(tuple(raster.bounds),bounds)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bounds = (-50.44, -21.21, -50.43, -21.20)

    def client(self, handler):
        client = httpx.Client(transport=httpx.MockTransport(handler))
        self.addCleanup(client.close)
        return client

    def test_request_axes_mask_and_cleanup(self):
        def handler(request):
            self.assertEqual(request.url.params['BBOX'], '-21.21,-50.44,-21.2,-50.43')
            self.assertEqual(request.url.params['CRS'], 'EPSG:4674')
            return httpx.Response(200, headers={'Content-Type': 'image/png'}, content=png())
        with temporary_images(self.root) as folder:
            target = folder / 'recorte.tif'
            result = fetch_orthophoto(self.bounds, 3, 2, target, self.client(handler))
            self.assertEqual(result['pixels_validos'], 5)
            with rasterio.open(target) as image:
                self.assertEqual(image.crs.to_string(), 'EPSG:4674')
                self.assertEqual(int((image.read_masks(1) > 0).sum()), 5)
                self.assertEqual(tuple(image.bounds), self.bounds)
        self.assertFalse(folder.exists())

    def test_error_cleanup_and_invalid_response(self):
        client = self.client(lambda request: httpx.Response(200, headers={'Content-Type': 'text/xml'}, content=b'erro'))
        with self.assertRaisesRegex(ValueError, 'PNG'):
            with temporary_images(self.root) as folder:
                fetch_orthophoto(self.bounds, 3, 2, folder / 'recorte.tif', client)
        self.assertFalse(folder.exists())
        empty = self.client(lambda request: httpx.Response(200, headers={'Content-Type': 'image/png'}, content=png(0)))
        with self.assertRaisesRegex(ValueError, 'sem pixels'):
            fetch_orthophoto(self.bounds, 3, 2, self.root / 'vazio.tif', empty)
        self.assertFalse((self.root / 'vazio.tif').exists())

    def test_reject_invalid_input_and_preserve_existing(self):
        target = self.root / 'existente.tif'
        target.write_bytes(b'preservar')
        with self.assertRaises(FileExistsError):
            fetch_orthophoto(self.bounds, 3, 2, target)
        with self.assertRaises(ValueError):
            fetch_orthophoto(self.bounds, 2049, 2, self.root / 'outro.tif')
        self.assertEqual(target.read_bytes(), b'preservar')


if __name__ == '__main__':
    unittest.main()
