"""Georreferenciamento e limites que poderiam deslocar/inventar pontos no mapa."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import rasterio
from rasterio.transform import Affine

from .analysis import locate, read_image, write_json


def box(x1, y1, x2, y2, score=.5):
    return dict(zip(("xmin", "ymin", "xmax", "ymax", "score"), (x1, y1, x2, y2, score)))


class GeographyTests(unittest.TestCase):
    def test_continuous_pixel_center_has_no_extra_half_pixel(self):
        transform = Affine(.001, 0, -50.44, 0, -.001, -21.20)
        data, rows = locate([box(0, 0, 2, 2)], transform, "EPSG:4326",
                            np.ones((4, 4), bool), "centro", .5)
        point = data["features"][0]
        self.assertAlmostEqual(point["geometry"]["coordinates"][0], -50.439)
        self.assertAlmostEqual(point["geometry"]["coordinates"][1], -21.201)
        self.assertFalse(point["properties"]["revisado"])
        self.assertEqual(rows[0]["reason"], "selecionada")

    def test_projected_crs_is_converted_to_longitude_latitude(self):
        data, _ = locate([box(0, 0, 2, 2)], Affine(10, 0, -10, 0, -10, 10),
                         "EPSG:3857", np.ones((4, 4), bool), "centro", .5)
        lng, lat = data["features"][0]["geometry"]["coordinates"]
        self.assertAlmostEqual(lng, 0)
        self.assertAlmostEqual(lat, 0)

    def test_nodata_edges_threshold_and_invalid_boxes(self):
        valid = np.ones((4, 4), bool)
        valid[1, 1] = False
        boxes = [box(0, 0, 2, 2), box(3, 3, 5, 5), box(-3, 0, -1, 2),
                 box(0, 0, 0, 2), box(2, 2, 4, 4, .49), box(3, 3, 4, 4, .5)]
        data, rows = locate(boxes, Affine.identity(), "EPSG:4326", valid, "centro", .5)
        self.assertEqual([r["reason"] for r in rows], ["pixel_invalido", "fora_da_imagem",
                         "fora_da_imagem", "caixa_invalida", "confianca_baixa", "selecionada"])
        self.assertEqual(len(data["features"]), 1)
        self.assertEqual(data["features"][0]["geometry"]["coordinates"], [3.5, 3.5])

    def test_empty_result_is_valid_geojson(self):
        import json
        data, rows = locate([], Affine.identity(), "EPSG:4326", np.ones((2, 2), bool), "centro", .5)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "empty.geojson"
            write_json(path, data)
            self.assertEqual(json.loads(path.read_text())["features"], [])
        self.assertEqual(rows, [])

    def test_rgb_order_mask_and_black_pixels_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "test.tif"
            pixels = np.zeros((3, 4, 4), dtype="uint8")
            pixels[:, 2, 2] = [10, 20, 30]
            mask = np.full((4, 4), 255, dtype="uint8")
            mask[0, 0] = 0
            with rasterio.open(path, "w", driver="GTiff", width=4, height=4, count=3,
                               dtype="uint8", crs="EPSG:4326",
                               transform=Affine(.001, 0, -50.44, 0, -.001, -21.20)) as dst:
                dst.write(pixels)
                dst.write_mask(mask)
            rgb, valid, _, _, metadata = read_image(path)
            self.assertEqual(rgb[2, 2].tolist(), [10, 20, 30])
            self.assertTrue(valid[1, 1])  # preto não é automaticamente NoData
            self.assertFalse(valid[0, 0])
            self.assertEqual(metadata["valid_pixels"], 15)

    def test_cuda_unavailable_never_falls_back_to_cpu(self):
        from .detector import Detector
        with patch("torch.cuda.is_available", return_value=False):
            with self.assertRaisesRegex(RuntimeError, "CUDA indisponível"):
                Detector()


if __name__ == "__main__":
    unittest.main()
