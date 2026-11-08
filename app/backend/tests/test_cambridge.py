"""Proteções contra deslocamentos, cores trocadas e supressões incorretas no piloto."""
import unittest
from unittest.mock import MagicMock

import numpy as np
from rasterio.transform import Affine

from arboriza_api.engine.inference.analysis import locate
from arboriza_api.engine.inference.cambridge import deduplicate, pixel_size_m, tile_windows
from arboriza_api.engine.models.detectree import CambridgeDetector


def box(coords, score):
    return dict(zip(("xmin", "ymin", "xmax", "ymax", "score"), [*coords, score]))


class CambridgeTests(unittest.TestCase):
    def test_windows_cover_image_and_anchor_edges_without_padding(self):
        covered = np.zeros((980, 1066), bool)
        windows = tile_windows(1066, 980, 820, 769, .25)
        self.assertEqual(len(windows), 4)
        for x, y, right, bottom in windows:
            self.assertEqual((right-x, bottom-y), (820, 769))
            covered[y:bottom, x:right] = True
        self.assertTrue(covered.all())
        self.assertEqual(tile_windows(20, 10, 820, 769, .25), [(0, 0, 20, 10)])

    def test_metric_scale_and_model_metadata(self):
        affine = Affine(.25, 0, 500000, 0, -.25, 7650000)
        sizes, crs = pixel_size_m(affine, "EPSG:32722", 1066, 980)
        self.assertEqual(crs, "EPSG:32722")
        np.testing.assert_allclose(sizes, [.25, .25], atol=1e-6)
        geojson, _ = locate([box((0, 0, 2, 2), .7)], affine, "EPSG:32722",
                            np.ones((4, 4), bool), "centro", .15, "cambridge", "detectree2")
        props = geojson["features"][0]["properties"]
        self.assertEqual((props["modelo"], props["origem"], props["revisado"]),
                         ("cambridge", "detectree2", False))

    def test_nms_preserves_distinct_neighbors_and_records_suppressor(self):
        _, rows = locate([box((0, 0, 10, 10), .9), box((1, 1, 9, 9), .8),
                          box((11, 0, 19, 10), .7)], Affine.identity(), "EPSG:4326",
                         np.ones((20, 20), bool), "centro", .15)
        deduplicate(rows, .5)
        self.assertEqual([row["reason"] for row in rows],
                         ["selecionada", "sobreposicao_nms", "selecionada"])
        self.assertEqual(rows[1]["suppressed_by"], rows[0]["id"])

    def test_invalid_center_cannot_suppress_valid_detection(self):
        _, rows = locate([box((-6, 0, 4, 10), .99), box((-3, 0, 7, 10), .2)],
                         Affine.identity(), "EPSG:4326", np.ones((12, 12), bool), "centro", .15)
        deduplicate(rows, .5)
        self.assertEqual([row["reason"] for row in rows], ["fora_da_imagem", "selecionada"])
        deduplicate([], .5)

    def test_predictor_receives_contiguous_bgr_from_rgb(self):
        detector = CambridgeDetector.__new__(CambridgeDetector)
        detector.predictor = MagicMock(return_value={"instances": MagicMock()})
        detector.predict(np.array([[[10, 20, 30]]], dtype=np.uint8))
        supplied = detector.predictor.call_args.args[0]
        self.assertEqual(supplied.tolist(), [[[30, 20, 10]]])
        self.assertTrue(supplied.flags.c_contiguous)


if __name__ == "__main__":
    unittest.main()
