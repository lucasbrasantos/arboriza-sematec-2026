import io
import math
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image
from fastapi import HTTPException

from arboriza_api.imagery import router


class TileTest(unittest.TestCase):
    def test_rgba_preserves_uncovered_pixels(self):
        class FakeReader:
            def _candidates(self, bounds, crs):
                self.bounds, self.crs = bounds, crs
                return []

            def _compose(self, bounds, width, height, crs, candidates):
                pixels = np.full((height, width, 3), 127, dtype='uint8')
                valid = np.zeros((height, width), dtype=bool)
                valid[:, :128] = True
                return pixels, valid, None, []

        z = 17
        x = int((-50.44 + 180) / 360 * 2**z)
        y = int((1 - math.asinh(math.tan(math.radians(-21.21))) / math.pi) / 2 * 2**z)
        router.render.cache_clear()
        with patch.object(router, 'reader', return_value=FakeReader()):
            image = Image.open(io.BytesIO(router.tile(z, x, y).body))
        alpha = np.asarray(image)[:, :, 3]
        self.assertEqual(image.size, (256, 256))
        self.assertTrue(np.all(alpha[:, :128] == 255))
        self.assertTrue(np.all(alpha[:, 128:] == 0))
        router.render.cache_clear()

    def test_unrelated_tiles_do_not_read_sources(self):
        with patch.object(router, 'reader') as mocked:
            with self.assertRaises(HTTPException):
                router.tile(10, 1, 1)
            with self.assertRaises(HTTPException):
                router.tile(17, 1, 1)
            mocked.assert_not_called()


if __name__ == '__main__':
    unittest.main()
