import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from shapely.geometry import box

from backend.service import AnalysisService


class V2SourcesTests(unittest.TestCase):
    def test_v2_uses_only_urban_archive_and_reports_its_source(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root/'data/ortofotos/acervo-urbano-25cm'
            archive.mkdir(parents=True)
            tile = archive/'block.tif'
            tile.touch()
            output = root/'output'
            output.mkdir()
            service = AnalysisService()
            service.fusion = object()
            with patch('backend.detector.ROOT', root), patch('backend.fusion_engine.LocalImages') as reader, \
                 patch('backend.fusion_engine.run_fusion', return_value={}) as run:
                reader.return_value.sources = [tile]
                reader.return_value.index_seconds = .01
                reader.return_value.metadata_opens = 1
                result = service.run_fusion(box(1, 1, 2, 2), .15, output, lambda _: None)
                reader.assert_called_once_with([tile])
                self.assertIs(run.call_args.args[5], reader.return_value)
            self.assertEqual(result['fonte_imagens'], 'acervo_local')
            self.assertEqual(result['versao_modelo'], 2)

    def test_missing_archive_fails_before_loading_gpu_models(self):
        with tempfile.TemporaryDirectory() as temp:
            with patch('backend.detector.ROOT', Path(temp)), \
                 patch('backend.fusion_engine.LocalImages') as reader, \
                 patch('backend.fusion_engine.FusionModels') as models:
                reader.return_value.sources = []
                with self.assertRaisesRegex(ValueError, 'acervo local'):
                    AnalysisService().run_fusion(box(1, 1, 2, 2), .15, Path(temp), lambda _: None)
                models.assert_not_called()

    def test_named_crop_preserves_boundary_but_does_not_supply_old_tiff(self):
        with tempfile.TemporaryDirectory() as temp:
            service = AnalysisService()
            with patch('backend.service.recorte_footprint', return_value=box(-50.441, -21.211, -50.439, -21.209)), \
                 patch.object(service, 'run_fusion', return_value={}) as run:
                result = service.run('centro', 'fusao', .15, Path(temp), lambda _: None)
            self.assertEqual(len(run.call_args.args), 4)
            self.assertEqual(run.call_args.kwargs, {})
            self.assertEqual(result['recorte'], 'centro')


if __name__ == '__main__':
    unittest.main()
