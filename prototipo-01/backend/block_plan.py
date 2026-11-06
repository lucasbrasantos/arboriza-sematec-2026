"""Prévia de blocos sobre a seleção, sem criar imagens ou iniciar inferência."""
import math

from pyproj import Transformer
from shapely import transform, union_all
from shapely.geometry import box

from .coverage import valid_footprint
from .image_cache import CACHE_DIR, verified_images


def plan_blocks(territory, ids, block_m, cache_dir=CACHE_DIR):
    if not isinstance(block_m, int) or not 50 <= block_m <= 2000:
        raise ValueError('Tamanho de bloco inválido.')
    selected = territory.selected(ids)
    if not selected:
        raise ValueError('Selecione ao menos um setor.')
    area = transform(union_all(selected), territory.project.transform, interleaved=False)
    to_metric = Transformer.from_crs('EPSG:4326', 'EPSG:31982', always_xy=True)
    sources = []
    for image in verified_images(cache_dir):
        path = image['path']; info = path.stat()
        footprint = valid_footprint(str(path), info.st_size, info.st_mtime_ns)
        sources.append((image, transform(footprint, to_metric.transform, interleaved=False)))
    coverage = union_all([source[1] for source in sources])
    west, south, east, north = area.bounds
    first_x, last_x = math.floor(west / block_m), math.ceil(east / block_m)
    first_y, last_y = math.floor(south / block_m), math.ceil(north / block_m)
    if (last_x - first_x) * (last_y - first_y) > 100000:
        raise ValueError('Seleção extensa demais para gerar esta prévia.')
    blocks = []
    for x in range(first_x, last_x):
        for y in range(first_y, last_y):
            square = box(x*block_m, y*block_m, (x+1)*block_m, (y+1)*block_m)
            if not area.intersects(square):
                continue
            part = area.intersection(square)
            if part.area <= 0:
                continue
            covered = min(part.area, part.intersection(coverage).area) if sources else 0
            # Tolerância apenas para ruído numérico ao comparar áreas em m².
            state = 'sem_imagem' if covered <= 0.001 else ('completo' if part.area-covered <= 0.01 else 'parcial')
            blocks.append({'id': f'31982-{block_m}-{x}-{y}', 'bounds_utm': list(square.bounds),
                           'area_selecao_m2': part.area, 'area_coberta_m2': covered, 'estado': state,
                           'imagens': [image['sha256'] for image, footprint in sources
                                       if part.intersection(footprint).area > 0]})
    return {'crs': 'EPSG:31982', 'tamanho_m': block_m, 'fonte_malha': territory.metadata['sha256_fonte'],
            'setores': list(ids), 'blocos': blocks, 'area_selecionada_m2': area.area,
            'area_coberta_m2': sum(item['area_coberta_m2'] for item in blocks)}
