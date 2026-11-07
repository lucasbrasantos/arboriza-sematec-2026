"""Janelas locais a 25 cm e inferência Restor/Cambridge; sem alterar o perfil atual."""
import hashlib
import json
import math
from pathlib import Path
from time import perf_counter

import numpy as np
from affine import Affine
from pyproj import Transformer
from rasterio.features import geometry_mask, shapes
from shapely import transform, union_all
from shapely.geometry import box, mapping, shape

from .analysis import write_json
from .crown_fusion import export, fuse
from .detector import ROOT
from .local_imagery import LocalImages

CRS = 'EPSG:31982'
GSD = .25
CACHE = ROOT / '.cache/fusao-mascaras-v1'


class FusionModels:
    def __init__(self):
        from .detectree import CambridgeDetector
        from .restor import RestorDetector
        self.restor = RestorDetector()
        self.cambridge = CambridgeDetector(.05, max_detections=512)
        self.manifest = {'restor': self.restor.manifest, 'cambridge': self.cambridge.manifest,
                         'device': self.cambridge.device, 'max_deteccoes': 512, 'escala_restor': 2.5,
                         'config_restor': self.restor.config, 'config_cambridge': self.cambridge.config}
        import torch
        stable = {'restor': self.restor.manifest, 'cambridge': self.cambridge.manifest,
                  'cfg_r': self.restor.config, 'cfg_c': self.cambridge.config, 'torch': torch.__version__,
                  'cuda': torch.version.cuda, 'engine': 1}
        self.identity = hashlib.sha256(json.dumps(stable, sort_keys=True).encode()).hexdigest()

    def predict(self, engine, rgb):
        return (self.restor if engine == 'restor' else self.cambridge).predict(rgb)



def windows(area, size):
    step = round(size*.75)
    west, south, east, north = area.bounds
    for y in range(math.floor(south/(step*GSD)), math.ceil(north/(step*GSD))):
        for x in range(math.floor(west/(step*GSD)), math.ceil(east/(step*GSD))):
            # Contexto simétrico ao redor da célula de passo; sobreposição de 25%.
            left = x*step*GSD-(size-step)*GSD/2
            bottom = y*step*GSD-(size-step)*GSD/2
            bounds = (left, bottom, left+size*GSD, bottom+size*GSD)
            if area.intersection(box(*bounds)).area > 0:
                yield x, y, bounds


def mask_rows(instances, valid, affine, engine, window_key):
    masks = instances.pred_masks.numpy()
    scores = instances.scores.numpy()
    classes = instances.pred_classes.numpy()
    result = []
    for rank, (mask, score, category) in enumerate(zip(masks, scores, classes)):
        mask = mask.astype(bool) & valid
        yy, xx = np.nonzero(mask)
        if len(xx) < 20:
            continue
        x, y, right, bottom = int(xx.min()), int(yy.min()), int(xx.max())+1, int(yy.max())+1
        cropped = mask[y:bottom, x:right].astype('uint8')
        offset = affine * Affine.translation(x, y)
        pieces = [shape(g) for g, value in shapes(cropped, mask=cropped.astype(bool), transform=offset) if value == 1]
        geometry = union_all(pieces)
        if not geometry.is_valid:
            geometry = geometry.buffer(0)
        if geometry.is_empty or geometry.area <= 0:
            continue
        kind = ('grupo_de_copas' if int(category) == 0 else 'copa_individual') if engine == 'restor' else 'copa_candidata'
        result.append({'key': f'{engine}-{window_key}-{rank}', 'engine': engine, 'score': float(score),
                       'tipo': kind, 'pixel_area_m2': GSD**2, 'geometry': geometry})
    return result


def run_fusion(models, selection, folder, score=.15, progress=print, images=None, sectors=None, cache_root=CACHE):
    folder = Path(folder); folder.mkdir(parents=True, exist_ok=True)
    if selection.is_empty or not selection.is_valid or selection.area <= 0 or not .05 <= score <= 1:
        raise ValueError('Área ou corte de score inválido para a fusão.')
    images = images or LocalImages()
    cache_root = Path(cache_root); cache_root.mkdir(parents=True, exist_ok=True)
    started, rows, timings = perf_counter(), [], []
    for engine, size in (('restor', 512), ('cambridge200', 800), ('cambridge100', 400)):
        planned = list(windows(selection, size))
        for number, (x, y, bounds) in enumerate(planned, 1):
            progress(f'Fusão · {engine} · janela {number}/{len(planned)} · preparando imagem local')
            tick = perf_counter()
            rgb, valid, affine, sources = images.read(bounds, size)
            required = geometry_mask([mapping(selection.intersection(box(*bounds)))], out_shape=valid.shape,
                                     transform=affine, invert=True)
            if not required.any():
                continue
            if (required & ~valid).any():
                raise ValueError(f'Acervo local incompleto na janela {engine}/{x}/{y}. Aguarde os blocos necessários ou forneça uma imagem local a 25 cm.')
            hasher = hashlib.sha256(rgb.tobytes()+valid.tobytes())
            hasher.update(json.dumps([1, models.identity, engine, bounds], sort_keys=True).encode())
            key = hasher.hexdigest(); cached = cache_root/(key+'.json')
            cache_hit = cached.is_file()
            if cache_hit:
                data = json.loads(cached.read_text(encoding='utf-8'))
                local = [{**r, 'geometry': shape(r['geometry'])} for r in data['rows']]
                count, cap = data['deteccoes_brutas'], data['limite_atingido']
            else:
                progress(f'Fusão · {engine} · janela {number}/{len(planned)} · inferência CUDA')
                instances = models.predict(engine, rgb)
                count, cap = len(instances), len(instances) >= 512
                local = mask_rows(instances, valid, affine, engine, f'{x}-{y}')
                serial = [{**r, 'geometry': mapping(r['geometry'])} for r in local]
                # Arquivo publicado somente após uma janela completa.
                from .urban_capture import atomic_json
                atomic_json(cached, {'rows': serial, 'deteccoes_brutas': count, 'limite_atingido': cap})
            rows.extend(local)
            timings.append({'motor': engine, 'janela': [x, y], 'cache_inferencia': cache_hit,
                            'deteccoes_brutas': count, 'limite_atingido': cap, 'fontes': sources,
                            'segundos': round(perf_counter()-tick, 3)})
    progress('Cruzando máscaras, recortando setores e vinculando pontos')
    result = fuse(rows, selection, folder.name, score, sectors)
    result['resumo'].update(janelas=len(timings), medicoes_janelas=timings,
                            janelas_cache_inferencia=sum(t['cache_inferencia'] for t in timings),
                            janelas_no_limite_deteccoes=sum(t['limite_atingido'] for t in timings),
                            duracao_fusao_s=round(perf_counter()-started, 3), resolucao_solicitada_m=GSD,
                            fonte_imagens='local_sem_download_automatico')
    export(result, folder)
    write_json(folder/'modelos.json', models.manifest)
    return result['resumo']
