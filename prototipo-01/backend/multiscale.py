"""Experimento isolado: Cambridge 200/100 m e agregação por máscaras, sem alterar o piloto."""
import argparse
import gzip
import json
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from uuid import uuid4

import numpy as np
from pycocotools import mask as coco

from .analysis import RECORTES, read_image, save_preview, write_json
from .cambridge import analyze
from .detectree import CambridgeDetector
from .detector import ROOT, sha256


def overlap(a, b):
    """IoU e interseção/área menor em pixels da mesma grade; sem unir por distância."""
    ax, ay = a['offset']
    bx, by = b['offset']
    left, top = max(ax, bx), max(ay, by)
    right = min(ax + a['mask'].shape[1], bx + b['mask'].shape[1])
    bottom = min(ay + a['mask'].shape[0], by + b['mask'].shape[0])
    if right <= left or bottom <= top:
        return 0., 0.
    intersection = np.count_nonzero(a['mask'][top-ay:bottom-ay, left-ax:right-ax]
                                    & b['mask'][top-by:bottom-by, left-bx:right-bx])
    return (float(intersection / (a['area'] + b['area'] - intersection)),
            float(intersection / min(a['area'], b['area'])))


def aggregate(proposals, anchors=(), iou=.5, containment=.9):
    """Mantém âncoras; demais propostas entram por score, com todas as supressões registradas."""
    kept, rejected = list(anchors), []
    for candidate in sorted(proposals, key=lambda p: (-p['score'], p['id'])):
        if not candidate['area']:
            rejected.append({'id': candidate['id'], 'reason': 'mascara_vazia'})
            continue
        for previous in kept:
            union_overlap, smaller_overlap = overlap(candidate, previous)
            if union_overlap >= iou or (containment is not None and smaller_overlap >= containment):
                rejected.append({'id': candidate['id'], 'reason': 'sobreposicao_mascara',
                                 'suppressed_by': previous['id'], 'mask_iou': union_overlap,
                                 'intersection_over_smaller_area': smaller_overlap})
                break
        else:
            kept.append(candidate)
    return kept, rejected


def proposals(report, size, folder):
    prefix = f"cambridge-{report['recorte']}-t{size}m"
    with gzip.open(folder / f'{prefix}-mascaras.json.gz', 'rt') as stream:
        masks = {m['id']: m for m in json.load(stream)}
    output = []
    for row in report['detections']:
        # Reconstrói propostas anteriores ao NMS global de caixas; preserva NMS nativo.
        if row['reason'] not in ('selecionada', 'sobreposicao_nms'):
            continue
        item = masks[row['id']]
        decoded = coco.decode({'size': item['size'], 'counts': item['counts'].encode('ascii')}).astype(bool)
        ys, xs = np.nonzero(decoded)
        if len(xs):
            left, top, right, bottom = xs.min(), ys.min(), xs.max()+1, ys.max()+1
            compact = decoded[top:bottom, left:right]
            offset = [int(item['offset_px'][0]+left), int(item['offset_px'][1]+top)]
        else:
            compact, offset = decoded, item['offset_px']
        output.append({**row, 'id': f'{size}m:{row["id"]}', 'source_id': row['id'],
                       'window_m': size, 'mask': compact, 'offset': offset,
                       'area': int(np.count_nonzero(compact))})
    return output


def export(name, variant, kept, rejected, report, rgb, affine, crs, folder, seconds, threshold=.15):
    from rasterio.warp import transform as project
    features, diagnostics = [], []
    for row in kept:
        x, y = affine * tuple(row['center_px'])
        lng, lat = project(crs, 'EPSG:4326', [x], [y])
        features.append({'type': 'Feature', 'id': row['id'],
                         'geometry': {'type': 'Point', 'coordinates': [lng[0], lat[0]]},
                         'properties': {'score': row['score'], 'modelo': report['model']['model_id'],
                                        'origem': 'detectree2', 'recorte': name, 'revisado': False,
                                        'escala_m': row['window_m'], 'tile_id': row['tile_id'],
                                        'source_id': row['source_id'], 'bbox_px': row['bbox_px'],
                                        'agregacao': variant}})
        diagnostics.append({key: value for key, value in row.items() if key != 'mask'})
    prefix = f'{name}-{variant}-c{threshold:.2f}'
    write_json(folder / f'{prefix}.geojson', {'type': 'FeatureCollection', 'features': features})
    save_preview(rgb, [{**r, 'reason': 'selecionada'} for r in kept],
                 f'{name} | {variant} | score >= {threshold:.2f} | {len(kept)} candidatos', folder/f'{prefix}.png')
    write_json(folder/f'{prefix}.json', {'kept': diagnostics, 'rejected': rejected,
                                       'aggregation_seconds': seconds})
    return {'recorte': name, 'variant': variant, 'candidates': len(kept),
            'rejected': len(rejected), 'file': f'{prefix}.geojson', 'aggregation_seconds': seconds}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida', type=Path, default=ROOT/'resultados/rodada-multiescala')
    args = parser.parse_args()
    folder = args.saida / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid4().hex[:6])
    folder.mkdir(parents=True, exist_ok=False)
    run = {'status': 'processando', 'score_floor': .15, 'window_m': [200,100],
           'overlap': .25, 'mask_iou': .5, 'mask_containment': .9,
           'ordering': 'score_descending; 200m_mask_anchors_preserved_in_combined_variant',
           'input': 'original_RGB8; no_color_filter_or_enhancement',
           'script_sha256': sha256(Path(__file__)), 'gpu_conditions': 'Desktop compartilhado; sem benchmark exclusivo.'}
    write_json(folder/'execucao.json', run)
    try:
        detector = CambridgeDetector(.15)
        summaries = []
        for name, source in RECORTES.items():
            reports = {size: analyze(detector, name, size, .25, .5, [.15], folder) for size in (200,100)}
            rgb, _, affine, crs, _ = read_image(source)
            candidates = {size: proposals(report, size, folder) for size, report in reports.items()}
            control = [r for r in candidates[200] if r['reason']=='selecionada']
            variants = [('controle-200m-caixas', control, [], 0.)]
            tick = perf_counter()
            base, rejected = aggregate(candidates[200])
            variants.append(('200m-mascaras', base, rejected, perf_counter()-tick))
            tick = perf_counter()
            single, rejected = aggregate(candidates[100])
            variants.append(('100m-mascaras', single, rejected, perf_counter()-tick))
            tick = perf_counter()
            combined, rejected = aggregate(candidates[100], anchors=base)
            variants.append(('200m-mais-100m', combined, rejected, perf_counter()-tick))
            for variant, kept, rejected, seconds in variants:
                summary = export(name, variant, kept, rejected, reports[200], rgb, affine, crs, folder, seconds)
                summaries.append(summary)
                print(json.dumps(summary), flush=True)
        write_json(folder/'comparacao.json', summaries)
        run['status'] = 'concluida'
    except Exception as error:
        run.update(status='erro', error=str(error))
        raise
    finally:
        write_json(folder/'execucao.json', run)
        print(f'Resultados: {folder}', flush=True)


if __name__ == '__main__':
    main()
