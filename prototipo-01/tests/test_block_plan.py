import json
import tempfile
import unittest
from pathlib import Path

from backend.block_plan import plan_blocks
from backend.territory import Territory
from backend.image_cache import import_image
from tests.test_territory import sample


class BlockPlanTests(unittest.TestCase):
    def test_grid_partitions_selected_area_without_images(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            data = root / 'setores.json'
            data.write_text(json.dumps(sample()), encoding='utf-8')
            territory = Territory(data)
            plan = plan_blocks(territory, ['a', 'b'], 500, root / 'empty')
            self.assertGreater(len(plan['blocos']), 1)
            self.assertTrue(all(item['estado'] == 'sem_imagem' for item in plan['blocos']))
            self.assertAlmostEqual(sum(item['area_selecao_m2'] for item in plan['blocos']),
                                   plan['area_selecionada_m2'], delta=.01)
            self.assertEqual(len({item['id'] for item in plan['blocos']}), len(plan['blocos']))
            self.assertEqual(plan['area_coberta_m2'], 0)

    def test_rejects_empty_or_unknown_selection(self):
        with tempfile.TemporaryDirectory() as folder:
            data = Path(folder) / 'setores.json'
            data.write_text(json.dumps(sample()), encoding='utf-8')
            territory = Territory(data)
            for ids in ([], ['nao-existe']):
                with self.assertRaises(ValueError):
                    plan_blocks(territory, ids, 500, Path(folder) / 'cache')

    def test_cached_image_contributes_only_its_valid_area(self):
        import numpy as np
        import rasterio
        from rasterio.transform import from_bounds
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); data = root / 'setores.json'; image = root / 'imagem.tif'
            data.write_text(json.dumps(sample()), encoding='utf-8')
            with rasterio.open(image, 'w', driver='GTiff', width=2, height=2, count=3,
                               dtype='uint8', crs='EPSG:4326', nodata=0,
                               transform=from_bounds(-50.45, -21.21, -50.44, -21.20, 2, 2)) as out:
                values = np.ones((3, 2, 2), dtype='uint8'); values[:, :, 1] = 0; out.write(values)
            import_image(image, {'fonte': 'teste'}, root / 'cache', limit=1000000, reserve=0)
            result = plan_blocks(Territory(data), ['a'], 500, root / 'cache')
            self.assertAlmostEqual(100 * result['area_coberta_m2'] / result['area_selecionada_m2'], 50, delta=.2)
            self.assertTrue(any(block['imagens'] for block in result['blocos']))


if __name__ == '__main__':
    unittest.main()
