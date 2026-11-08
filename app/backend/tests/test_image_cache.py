import tempfile
import unittest
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

from arboriza_api.engine.imagery.image_cache import cache_status, import_image


class ImageCacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'original.tif'
        with rasterio.open(self.source, 'w', driver='GTiff', width=4, height=4, count=3,
                           dtype='uint8', crs='EPSG:4326', transform=from_origin(-50.4, -21.2, .001, .001)) as out:
            out.write(np.ones((3, 4, 4), dtype='uint8'))
        self.original = self.source.read_bytes()
        self.cache = self.root / 'cache'

    def test_import_reuses_verified_copy_and_preserves_original(self):
        first = import_image(self.source, {'fonte': 'teste'}, self.cache, limit=1000000, reserve=0)
        second = import_image(self.source, {'fonte': 'teste'}, self.cache, limit=1000000, reserve=0)
        self.assertEqual(first['situacao'], 'importada')
        self.assertEqual(second['situacao'], 'reutilizada')
        self.assertEqual(self.source.read_bytes(), self.original)
        self.assertEqual(cache_status(self.cache)['imagens'], 1)
        with self.assertRaisesRegex(ValueError, 'procedência'):
            import_image(self.source, {'fonte': 'outra'}, self.cache, limit=1000000, reserve=0)
        Path(first['arquivo']).write_bytes(b'alterado')
        with self.assertRaisesRegex(ValueError, 'alterado'):
            import_image(self.source, {'fonte': 'teste'}, self.cache, limit=1000000, reserve=0)

    def test_limit_never_deletes_existing_data(self):
        self.cache.mkdir()
        orphan = self.cache / 'existente.tif'
        orphan.write_bytes(b'preservar')
        with self.assertRaisesRegex(ValueError, 'limite'):
            import_image(self.source, {'fonte': 'teste'}, self.cache, limit=10, reserve=0)
        self.assertEqual(orphan.read_bytes(), b'preservar')
        self.assertEqual(self.source.read_bytes(), self.original)

    def test_external_mask_is_not_silently_lost(self):
        with rasterio.Env(GDAL_TIFF_INTERNAL_MASK=False):
            with rasterio.open(self.source, 'r+') as image:
                image.write_mask(np.array([[255, 0, 255, 0]] * 4, dtype='uint8'))
        with self.assertRaisesRegex(ValueError, 'arquivos auxiliares'):
            import_image(self.source, {'fonte': 'teste'}, self.cache, limit=1000000, reserve=0)


if __name__ == '__main__':
    unittest.main()
