"""Piloto territorial: janelas RGB em cache, inferência e pontos na seleção."""
import math
import hashlib
from time import perf_counter

import httpx
import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.features import geometry_mask
from shapely import STRtree, transform, union_all
from shapely.geometry import Point, box, mapping

from .analysis import write_json
from .orthophoto_wms import fetch_orthophoto, temporary_images
from .wms_cache import CACHE_DIR, cached_orthophoto

WINDOW_M = 200
STRIDE_M = 150
GSD_M = .25


def windows_for_area(area):
    """Células sem sobreposição recebem contexto; centros pertencem a uma só célula."""
    west, south, east, north = area.bounds
    first_x, last_x = math.floor(west / STRIDE_M), math.ceil(east / STRIDE_M)
    first_y, last_y = math.floor(south / STRIDE_M), math.ceil(north / STRIDE_M)
    if (last_x - first_x) * (last_y - first_y) > 100000:
        raise ValueError('Seleção extensa demais para o planejamento territorial.')
    for y in range(first_y, last_y):
        for x in range(first_x, last_x):
            cell = box(x * STRIDE_M, y * STRIDE_M, (x + 1) * STRIDE_M, (y + 1) * STRIDE_M)
            if area.intersection(cell).area > 0:
                yield x, y, cell


def suppress_duplicates(rows, iou=.5):
    """NMS espacial de caixas em metros; janela com contexto pode repetir copas na borda."""
    if not rows:
        return []
    boxes = [r['box'] for r in rows]
    tree = STRtree(boxes)
    suppressed, processed = set(), set()
    kept = []
    for index in sorted(range(len(rows)), key=lambda i: (-rows[i]['score'], i)):
        if index in suppressed:
            continue
        kept.append(rows[index])
        processed.add(index)
        for candidate in tree.query(boxes[index], predicate='intersects'):
            candidate = int(candidate)
            if candidate in processed or candidate in suppressed or rows[candidate]['score'] > rows[index]['score']:
                continue
            intersection = boxes[index].intersection(boxes[candidate]).area
            union = boxes[index].area + boxes[candidate].area - intersection
            if union > 0 and intersection / union > iou:
                suppressed.add(candidate)
    return kept


def run_sector_analysis(detector, territory, ids, score, folder, progress,
                        fetch=fetch_orthophoto, temporary=temporary_images, cache_root=CACHE_DIR,
                        image_provider=None, profile='controle', metric_grid=False):
    selected = territory.selected(ids)
    if not selected:
        raise ValueError('Selecione ao menos um setor.')
    area = transform(union_all(selected), territory.project.transform, interleaved=False)
    to_geo = Transformer.from_crs('EPSG:31982', 'EPSG:4674', always_xy=True)
    to_metric = Transformer.from_crs('EPSG:4674', 'EPSG:31982', always_xy=True)
    cells = list(windows_for_area(area))
    rows, timings = [], []
    with temporary() as scratch, httpx.Client(timeout=httpx.Timeout(30, connect=10), follow_redirects=True) as client:
        for index, (x, y, cell) in enumerate(cells, 1):
            progress(f'Preparando imagem: janela {index}/{len(cells)}')
            context = cell.buffer((WINDOW_M - STRIDE_M) / 2, cap_style='square', join_style='mitre')
            geo_bounds = transform(context, to_geo.transform, interleaved=False).bounds
            # Projeta o comprimento dos eixos para manter aproximadamente 25 cm por pixel.
            west, south, east, north = geo_bounds
            mid_lon, mid_lat = (west + east) / 2, (south + north) / 2
            left, mid_y = to_metric.transform(west, mid_lat)
            right, _ = to_metric.transform(east, mid_lat)
            mid_x, bottom = to_metric.transform(mid_lon, south)
            _, top = to_metric.transform(mid_lon, north)
            width = math.ceil(abs(right - left) / GSD_M)
            height = math.ceil(abs(top - bottom) / GSD_M)
            image_bounds = geo_bounds
            if metric_grid:
                image_bounds = context.bounds
                width = height = round(WINDOW_M/GSD_M)
            temporary_path = scratch / f'{index}.tif'
            started = perf_counter()
            if image_provider is None:
                path, metadata = cached_orthophoto(geo_bounds, width, height, temporary_path,
                                                 client=client, root=cache_root, fetch=fetch)
            else:
                path, metadata = image_provider(image_bounds, width, height, temporary_path, client=client)
            with rasterio.open(path) as src:
                rgb = src.read([1, 2, 3]).transpose(1, 2, 0).copy()
                valid = src.read_masks([1, 2, 3]).all(axis=0)
                affine = src.transform
                raster_to_metric = Transformer.from_crs(src.crs, 'EPSG:31982', always_xy=True)
                raster_to_geo = Transformer.from_crs(src.crs, 'EPSG:4326', always_xy=True)
                metric_to_raster = Transformer.from_crs('EPSG:31982', src.crs, always_xy=True)
                part = area.intersection(cell)
                raster_part = transform(part, metric_to_raster.transform, interleaved=False)
                required = geometry_mask([mapping(raster_part)], out_shape=valid.shape, transform=affine,
                                         all_touched=True, invert=True)
                if not required.any() or (required & ~valid).any():
                    raise ValueError(f'Imagem incompleta na janela {index}/{len(cells)}; análise interrompida.')
                rgb[~valid] = 0
                image_hash = hashlib.sha256(rgb.tobytes()+valid.tobytes()).hexdigest()
            image_seconds = perf_counter()-started
            progress(f'Identificando copas: janela {index}/{len(cells)}')
            tick = perf_counter()
            instances = detector.predict(rgb)
            inference_seconds = perf_counter() - tick
            boxes, scores = instances.pred_boxes.tensor.numpy(), instances.scores.numpy()
            cap = getattr(detector, 'max_detections', None)
            for raw_box, confidence in zip(boxes, scores):
                x1, y1, x2, y2 = map(float, raw_box)
                confidence = float(confidence)
                if not all(math.isfinite(v) for v in (x1, y1, x2, y2, confidence)) or confidence < score or x2 <= x1 or y2 <= y1:
                    continue
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                if not (0 <= cx < width and 0 <= cy < height and valid[int(cy), int(cx)]):
                    continue
                rx, ry = affine * (cx, cy)
                lon, lat = raster_to_geo.transform(rx, ry)
                mx, my = raster_to_metric.transform(rx, ry)
                if not (x * STRIDE_M <= mx < (x + 1) * STRIDE_M and y * STRIDE_M <= my < (y + 1) * STRIDE_M):
                    continue
                if not area.covers(Point(mx, my)):
                    continue
                left_lon, top_lat = affine * (x1, y1)
                right_lon, bottom_lat = affine * (x2, y2)
                geo_box = box(left_lon, bottom_lat, right_lon, top_lat)
                metric_box = transform(geo_box, raster_to_metric.transform, interleaved=False).envelope
                rows.append({'score': confidence, 'lon': lon, 'lat': lat, 'box': metric_box, 'janela': index})
            timings.append({'janela': index, 'aquisicao_s': metadata['aquisicao_s'],
                            'origem_imagem': metadata['origem_imagem'], 'leitura_cache_s': metadata['leitura_cache_s'],
                            'inferencia_s': inference_seconds, 'total_s': perf_counter() - started,
                            'deteccoes_brutas': len(boxes), 'limite_deteccoes_atingido': cap is not None and len(boxes) >= cap,
                            'pixels_validos': metadata['pixels_validos'], 'pixels_totais': metadata['pixels_totais'],
                            'sha256_png': metadata['sha256_png'], 'sha256_rgb_validade': image_hash,
                            'preparacao_imagem_s': image_seconds, 'bounds_lon_lat': list(geo_bounds),
                            'bounds_imagem': list(image_bounds), 'crs_imagem': 'EPSG:31982' if metric_grid else 'EPSG:4674',
                            'largura': width, 'altura': height, 'fontes_locais': metadata.get('fontes', []),
                            'cache_janela_local': metadata.get('cache_janela_local', False),
                            'leitura_local_s': metadata.get('leitura_local_s', 0.0)})
            temporary_path.unlink(missing_ok=True)
    progress('Consolidando possíveis copas')
    kept = suppress_duplicates(rows)
    model = detector.manifest['model_id']
    features = [{'type': 'Feature', 'id': f'{folder.name}-{i}',
                 'geometry': {'type': 'Point', 'coordinates': [row['lon'], row['lat']]},
                 'properties': {'score': row['score'], 'modelo': model, 'origem': 'detectree2',
                                'revisado': False, 'janela': row['janela'], 'analise_id': folder.name, 'perfil': profile}}
                for i, row in enumerate(kept, 1)]
    write_json(folder / 'pontos.geojson', {'type': 'FeatureCollection', 'features': features})
    result = {'candidatos': len(features), 'setores': len(ids), 'ids_setores': list(ids),
              'fonte_malha': territory.metadata['sha256_fonte'], 'area_m2': area.area,
              'modelo': model, 'perfil': profile, 'corte_score': score,
              'janelas': len(cells), 'janela_m': WINDOW_M, 'passo_m': STRIDE_M,
              'resolucao_solicitada_m': GSD_M, 'cobertura': 'completa_por_mascara',
              'janelas_cache': sum(item['origem_imagem'] == 'cache' for item in timings),
              'janelas_download': sum(item['origem_imagem'] == 'download' for item in timings),
              'janelas_cache_acervo': sum(item['cache_janela_local'] for item in timings),
              'janelas_locais': sum(item['origem_imagem'] == 'acervo_local' for item in timings),
              'preparacao_imagens_s': sum(item['preparacao_imagem_s'] for item in timings),
              'download_total_s': sum(item['aquisicao_s'] for item in timings),
              'leitura_local_total_s': sum(item['leitura_local_s'] for item in timings),
              'inferencia_total_s': sum(item['inferencia_s'] for item in timings),
              'propostas_antes_nms': len(rows),
              'janelas_no_limite_deteccoes': sum(item['limite_deteccoes_atingido'] for item in timings),
              'medicoes_janelas': timings}
    write_json(folder / 'resumo.json', result)
    return result
