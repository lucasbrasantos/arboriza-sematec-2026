"""Fontes para comparação do Controle, sem alterar modelo, janelas ou cache atual."""
from pathlib import Path
from time import perf_counter


from ..models.detector import DATA_ROOT
from .orthophoto_wms import fetch_orthophoto


def direct_datageo(bounds, width, height, target, client=None):
    metadata = fetch_orthophoto(bounds, width, height, target, client=client, crs='EPSG:31982')
    return Path(target), {**metadata, 'origem_imagem': 'download', 'leitura_cache_s': 0.0}


class LocalControlSource:
    def __init__(self, paths=None, **options):
        from .local_imagery import LocalImages
        if paths is None:
            paths = sorted((DATA_ROOT/'ortofotos/acervo-urbano-25cm').glob('*.tif'))
        self.images = LocalImages(paths, **options)
        if not self.images.sources:
            raise ValueError('Acervo urbano local ausente: conclua a captura de ortofotos a 25 cm.')

    def __call__(self, bounds, width, height, target, client=None):
        started = perf_counter()
        if Path(target).exists():
            raise FileExistsError('O destino temporário já existe.')
        path, metadata = self.images.prepared(bounds, width, height)
        return path, {**metadata, 'origem_imagem': 'acervo_local',
                      'aquisicao_s': 0.0, 'leitura_cache_s': 0.0,
                      'leitura_local_s': perf_counter()-started, 'sha256_png': None}
