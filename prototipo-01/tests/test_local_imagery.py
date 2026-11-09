import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.vrt import WarpedVRT

from backend.local_imagery import LocalImages


class LocalImageryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.cache = self.root/'cache'

    def source(self, name='source', left=500000, value=17, external=False):
        path = self.root/(name+'.tif')
        pixels = np.random.default_rng(value).integers(0, 256, (3, 80, 80), dtype='uint8')
        mask = np.ones((80, 80), dtype='uint8')*255
        mask[10:15, 10:15] = 0
        with rasterio.Env(GDAL_TIFF_INTERNAL_MASK=not external):
            with rasterio.open(path, 'w', driver='GTiff', width=80, height=80, count=3,
                               dtype='uint8', crs='EPSG:31982', transform=from_origin(left, 7600020, .25, .25)) as out:
                out.write(pixels)
                out.write_mask(mask)
        return path

    def test_restart_uses_catalog_without_opening_any_source(self):
        path = self.source()
        first = LocalImages([path], cache_root=self.cache)
        bounds = (500000, 7600000, 500020, 7600020)
        a = first.read(bounds, 80)
        self.assertFalse(first.last_metadata['cache_janela_local'])
        second = LocalImages([path], cache_root=self.cache)
        self.assertEqual(second.metadata_opens, 0)
        with patch.object(second, '_compose', side_effect=AssertionError('Recorte não deve ser repetido')):
            b = second.read(bounds, 80)
        self.assertTrue(second.last_metadata['cache_janela_local'])
        np.testing.assert_array_equal(a[0], b[0])
        np.testing.assert_array_equal(a[1], b[1])

    def test_native_read_preserves_warped_pixels_mask_and_adjacent_seam(self):
        paths = [self.source(), self.source('adjacent', left=500020, value=41)]
        reader = LocalImages(paths, cache_root=self.cache)
        # Includes the seam, a source mask hole and pixels outside the mosaic.
        bounds = (499995, 7599995, 500045, 7600025)
        rgb, valid, affine, _ = reader.read_grid(bounds, 200, 120, 'EPSG:31982')
        expected = np.zeros_like(rgb)
        observed = np.zeros_like(valid)
        for path in paths:
            with rasterio.open(path) as src:
                with WarpedVRT(src, crs='EPSG:31982', transform=affine, width=200, height=120,
                               resampling=Resampling.bilinear, add_alpha=True) as vrt:
                    mask = vrt.dataset_mask()>0
                    pixels = vrt.read([1, 2, 3]).transpose(1, 2, 0)
                    use = mask & ~observed
                    expected[use] = pixels[use]
                    observed |= mask
        np.testing.assert_array_equal(rgb, expected)
        np.testing.assert_array_equal(valid, observed)

    def test_source_change_invalidates_prepared_window_and_catalog(self):
        path = self.source()
        reader = LocalImages([path], cache_root=self.cache)
        bounds = (500000, 7600000, 500020, 7600020)
        old, _ = reader.prepared(bounds, 80, 80)
        before = path.stat().st_mtime_ns
        self.source(value=62)
        os.utime(path, ns=(before+1_000_000_000, before+1_000_000_000))
        new, metadata = reader.prepared(bounds, 80, 80)
        self.assertNotEqual(old, new)
        self.assertFalse(metadata['cache_janela_local'])
        self.assertEqual(reader.metadata_opens, 2)

    def test_added_removed_files_and_different_grids_do_not_reuse_wrong_pixels(self):
        a = self.source()
        bounds = (500000, 7600000, 500040, 7600020)
        first = LocalImages([a], cache_root=self.cache)
        _, valid, _, _ = first.read_grid(bounds, 160, 80, 'EPSG:31982')
        self.assertEqual(int(valid.sum()), 6375)
        b = self.source('new', left=500020)
        second = LocalImages([a, b], cache_root=self.cache)
        full, metadata = second.prepared(bounds, 160, 80)
        self.assertEqual(metadata['pixels_validos'], 12750)
        self.assertFalse(metadata['cache_janela_local'])
        other, _ = second.prepared(bounds, 80, 40)
        self.assertNotEqual(full, other)
        a.unlink()
        third = LocalImages([b], cache_root=self.cache)
        _, valid, _, _ = third.read_grid(bounds, 160, 80, 'EPSG:31982')
        self.assertEqual(int(valid.sum()), 6375)

    def test_lru_removes_derived_windows_only(self):
        path = self.source()
        reader = LocalImages([path], cache_root=self.cache, limit_bytes=1)
        first, _ = reader.prepared((500000, 7600000, 500010, 7600020), 40, 80)
        second, _ = reader.prepared((500010, 7600000, 500020, 7600020), 40, 80)
        self.assertFalse(first.exists())
        self.assertTrue(second.exists())
        self.assertTrue(path.exists())

    def test_external_mask_change_invalidates_without_changing_tiff(self):
        path = self.source(external=True)
        # GDAL também aceita máscara externa; ela participa da revisão da fonte.
        reader = LocalImages([path], cache_root=self.cache)
        bounds = (500000, 7600000, 500020, 7600020)
        first, _ = reader.prepared(bounds, 80, 80)
        tiff_stat = path.stat()
        mask_path = Path(str(path)+'.msk')
        with rasterio.open(mask_path, 'r+') as src:
            src.write(np.zeros((1, 80, 80), dtype='uint8'))
        self.assertEqual(path.stat().st_mtime_ns, tiff_stat.st_mtime_ns)
        second, metadata = reader.prepared(bounds, 80, 80)
        self.assertNotEqual(first, second)
        self.assertEqual(metadata['pixels_validos'], 0)


if __name__ == '__main__':
    unittest.main()
