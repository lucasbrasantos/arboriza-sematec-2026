"""Acervo urbano local: grade fixa UTM, GeoTIFF por bloco e captura retomável."""
import hashlib
import io
import json
import logging
import math
import os
import shutil
import threading
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import httpx
import numpy as np
import rasterio
from PIL import Image
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.features import geometry_mask
from rasterio.transform import from_origin
from shapely import prepare, transform, union_all
from shapely.geometry import box, mapping, shape

from .detector import DATA_ROOT

SOURCE = DATA_ROOT / 'territorial/setores-urbanos-aracatuba-ibge-2022.geojson'
DESTINATION = DATA_ROOT / 'ortofotos/acervo-urbano-25cm'
WMS = 'https://datageo.ambiente.sp.gov.br/geoimage/datageoimg/ows'
LAYER = 'ORTOFOTOS_SP_2023_2024'
CRS = 'EPSG:31982'
BLOCK_M, GSD_M, PIXELS = 500, .25, 2000
MAX_BYTES = 24 * 1024**2
LOG = logging.getLogger('captura_urbana')


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def stamp():
    return datetime.now(timezone.utc).isoformat()


def atomic_json(path, data):
    path = Path(path)
    temporary = path.with_name(path.name + '.' + uuid4().hex + '.part')
    try:
        temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def plan_capture(source=SOURCE, context_m=25):
    if not math.isfinite(context_m) or not 0 <= context_m <= 200:
        raise ValueError('A margem de contexto deve ficar entre 0 e 200 m.')
    collection = json.loads(Path(source).read_text(encoding='utf-8'))
    features = collection['features']
    if not features or len({str(f['id']) for f in features}) != len(features):
        raise ValueError('Malha vazia ou com identificadores duplicados.')
    shapes = [shape(f['geometry']) for f in features]
    if any(g.is_empty or not g.is_valid for g in shapes):
        raise ValueError('A malha contém geometrias inválidas.')
    project = Transformer.from_crs('EPSG:4326', CRS, always_xy=True)
    actual = transform(union_all(shapes), project.transform, interleaved=False)
    context = actual.buffer(context_m) if context_m else actual
    prepare(context)
    west, south, east, north = context.bounds
    blocks, skipped = [], 0
    for y in range(math.floor(south/BLOCK_M), math.ceil(north/BLOCK_M)):
        for x in range(math.floor(west/BLOCK_M), math.ceil(east/BLOCK_M)):
            bounds = [x*BLOCK_M, y*BLOCK_M, (x+1)*BLOCK_M, (y+1)*BLOCK_M]
            square = box(*bounds)
            required = context.intersection(square) if context.intersects(square) else None
            context_area = required.area if required is not None else 0
            if context_area <= .01:
                skipped += 1
                continue
            area = actual.intersection(square).area
            blocks.append({'id': f'31982-500-{x}-{y}', 'bounds_utm': bounds,
                           'geometria_necessaria_utm': mapping(required),
                           'area_setores_m2': round(area, 3), 'area_contexto_m2': round(context_area, 3),
                           'percentual_setores': round(100*area/BLOCK_M**2, 2),
                           'somente_contexto': area <= .01})
    back = Transformer.from_crs(CRS, 'EPSG:4326', always_xy=True)
    return {'schema': 1, 'fonte_url': WMS, 'camada': LAYER, 'crs': CRS,
            'resolucao_m': GSD_M, 'bloco_m': BLOCK_M, 'pixels_por_lado': PIXELS,
            'margem_contexto_m': context_m, 'sha256_malha': digest(source),
            'fonte_malha': collection.get('arboriza', {}).get('sha256_fonte'),
            'ids_setores': [str(f['id']) for f in features], 'area_setores_m2': actual.area,
            'blocos': blocks, 'quadrados_descartados': skipped,
            'geometria_setores': mapping(transform(actual, back.transform, interleaved=False)),
            'geometria_contexto': mapping(transform(context, back.transform, interleaved=False))}


def request_for(block):
    return {'SERVICE': 'WMS', 'VERSION': '1.3.0', 'REQUEST': 'GetMap', 'LAYERS': LAYER,
            'STYLES': '', 'CRS': CRS, 'BBOX': ','.join(map(str, block['bounds_utm'])),
            'WIDTH': str(PIXELS), 'HEIGHT': str(PIXELS), 'FORMAT': 'image/png', 'TRANSPARENT': 'TRUE'}


def expected_transform(block):
    west, _, _, north = block['bounds_utm']
    return from_origin(west, north, GSD_M, GSD_M)


def validate_coverage(valid, block):
    required = geometry_mask([block['geometria_necessaria_utm']], out_shape=(PIXELS, PIXELS),
                             transform=expected_transform(block), invert=True)
    missing = int(np.count_nonzero(required & ~valid))
    if missing:
        raise ValueError(f'O WMS deixou {missing} pixels sem cobertura na área necessária deste bloco.')


def inspect_tile(path, block):
    with rasterio.open(path) as raster:
        if (raster.crs != CRS or raster.width != PIXELS or raster.height != PIXELS or raster.count != 3
                or raster.dtypes != ('uint8',)*3 or not raster.transform.almost_equals(expected_transform(block))
                or raster.tags().get('arboriza_requisicao') != json.dumps(request_for(block), sort_keys=True)):
            raise ValueError('GeoTIFF incompatível com a grade/fonte esperada: ' + str(path))
        mask = raster.dataset_mask() > 0
        valid = int(np.count_nonzero(mask))
    if not valid:
        raise ValueError('O bloco não contém pixels válidos: ' + str(path))
    validate_coverage(mask, block)
    return valid


def existing_tile(directory, block):
    path = directory / (block['id'] + '.tif')
    metadata_path = path.with_suffix('.json')
    if not path.exists():
        if metadata_path.exists():
            raise ValueError('Metadados sem a imagem correspondente: ' + str(metadata_path))
        return None
    valid = inspect_tile(path, block)
    checksum = digest(path)
    if metadata_path.exists():
        metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
        if metadata.get('sha256_tif') != checksum or metadata.get('requisicao') != request_for(block):
            raise ValueError('A imagem existente ou seus metadados foram alterados: ' + str(path))
    else:
        # Retoma também uma interrupção entre publicar o TIFF e publicar o JSON.
        metadata = {'id': block['id'], 'requisicao': request_for(block), 'fonte_url': WMS,
                    'sha256_tif': checksum, 'bytes_tif': path.stat().st_size,
                    'pixels_validos': valid, 'recuperado_em': stamp()}
        atomic_json(metadata_path, metadata)
    return {**metadata, 'reutilizado': True, 'arquivo': path.name}


class CaptureCancelled(Exception):
    pass


def capture_tile(directory, block, stop, attempts=5):
    if stop.is_set():
        raise CaptureCancelled('Captura interrompida.')
    existing = existing_tile(directory, block)
    if existing:
        return existing
    path = directory / (block['id'] + '.tif')
    started = time.perf_counter()
    with httpx.Client(timeout=httpx.Timeout(60, connect=15), follow_redirects=True) as client:
        for attempt in range(1, attempts+1):
            if stop.is_set():
                raise CaptureCancelled('Captura interrompida.')
            retry_after = 0
            try:
                LOG.info('BUSCANDO %s | tentativa %d/%d | setor no bloco %.2f%% | %s',
                         block['id'], attempt, attempts, block['percentual_setores'],
                         'somente contexto' if block['somente_contexto'] else 'cruza setores')
                with client.stream('GET', WMS, params=request_for(block)) as response:
                    raw_retry = response.headers.get('retry-after', '')
                    retry_after = min(60, int(raw_retry)) if raw_retry.isdigit() else 0
                    response.raise_for_status()
                    if response.headers.get('content-type', '').split(';')[0].strip().lower() != 'image/png':
                        raise ValueError('O WMS não retornou PNG; possível mensagem de erro do servidor.')
                    chunks, size = [], 0
                    for chunk in response.iter_bytes():
                        if stop.is_set():
                            raise CaptureCancelled('Captura interrompida.')
                        size += len(chunk)
                        if size > MAX_BYTES:
                            raise ValueError('A imagem excedeu o limite de 24 MiB por resposta.')
                        chunks.append(chunk)
                content = b''.join(chunks)
                with Image.open(io.BytesIO(content)) as picture:
                    if picture.format != 'PNG' or picture.size != (PIXELS, PIXELS):
                        raise ValueError('Dimensões/formato inesperados no bloco recebido.')
                    rgba = np.asarray(picture.convert('RGBA'))
                valid = rgba[:, :, 3] > 0
                if not valid.any():
                    raise ValueError('Bloco sem cobertura válida. Não será registrado como completo.')
                validate_coverage(valid, block)
                if shutil.disk_usage(directory).free < 1024**3 + PIXELS**2*5:
                    raise OSError('Espaço insuficiente para preservar 1 GiB livre no disco.')
                temporary = path.with_name(path.name + '.' + uuid4().hex + '.part')
                try:
                    with rasterio.Env(GDAL_TIFF_INTERNAL_MASK=True):
                        with rasterio.open(temporary, 'w', driver='GTiff', width=PIXELS, height=PIXELS,
                                           count=3, dtype='uint8', crs=CRS, transform=expected_transform(block),
                                           tiled=True, blockxsize=512, blockysize=512, compress='deflate', predictor=2) as output:
                            output.write(rgba[:, :, :3].transpose(2, 0, 1))
                            output.write_mask(valid.astype('uint8')*255)
                            output.update_tags(arboriza_requisicao=json.dumps(request_for(block), sort_keys=True),
                                               arboriza_fonte=WMS, arboriza_capturado_em=stamp())
                            output.build_overviews([2, 4, 8], Resampling.average)
                            output.update_tags(ns='rio_overview', resampling='average')
                    inspect_tile(temporary, block)
                    temporary.rename(path)
                finally:
                    temporary.unlink(missing_ok=True)
                metadata = {'id': block['id'], 'arquivo': path.name, 'capturado_em': stamp(),
                            'fonte_url': WMS, 'requisicao': request_for(block), 'sha256_png': hashlib.sha256(content).hexdigest(),
                            'sha256_tif': digest(path), 'bytes_png': len(content), 'bytes_tif': path.stat().st_size,
                            'pixels_validos': int(valid.sum()), 'pixels_totais': PIXELS**2,
                            'segundos': round(time.perf_counter()-started, 3), 'tentativas': attempt}
                atomic_json(path.with_suffix('.json'), metadata)
                return {**metadata, 'reutilizado': False}
            except CaptureCancelled:
                raise
            except (httpx.HTTPError, ValueError, OSError) as error:
                # Se o TIFF já foi publicado, não sobrescrever nem baixá-lo novamente neste processo.
                if path.exists():
                    raise
                LOG.warning('FALHA %s | %s', block['id'], error)
                if attempt == attempts:
                    raise
                delay = max(min(30, 2**attempt), retry_after)
                LOG.warning('REPETINDO %s em %ds', block['id'], delay)
                if stop.wait(delay):
                    raise CaptureCancelled('Captura interrompida.')


@contextmanager
def exclusive_capture(directory):
    # Trava liberada pelo SO inclusive após queda; o arquivo não precisa ser apagado.
    with (directory / '.captura.lock').open('a+b') as stream:
        stream.seek(0, 2)
        if stream.tell() == 0:
            stream.write(b'0'); stream.flush()
        stream.seek(0)
        if os.name == 'nt':
            import msvcrt
            msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            stream.seek(0)
            if os.name == 'nt':
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def download_plan(plan, directory=DESTINATION, workers=3, attempts=5):
    if not 1 <= workers <= 4 or not 1 <= attempts <= 8:
        raise ValueError('Use de 1 a 4 downloads paralelos e de 1 a 8 tentativas.')
    directory = Path(directory).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    handler = logging.FileHandler(directory / 'captura.log', encoding='utf-8')
    handler.setFormatter(logging.Formatter('%(asctime)s | %(levelname)s | %(message)s'))
    LOG.addHandler(handler)
    try:
        with exclusive_capture(directory):
            return _download_locked(plan, directory, workers, attempts)
    finally:
        LOG.removeHandler(handler); handler.close()


def _download_locked(plan, directory, workers, attempts):
    atomic_json(directory / 'plano.json', plan)
    started = time.perf_counter()
    stop, records, failures = threading.Event(), {}, {}
    blocks = iter(plan['blocos'])
    pending = {}
    total = len(plan['blocos'])
    pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix='ortofoto')
    interrupted, last_heartbeat = False, started

    def submit():
        block = next(blocks, None)
        if block is not None:
            pending[pool.submit(capture_tile, directory, block, stop, attempts)] = block

    def save():
        data = {'atualizado_em': stamp(), 'total': total, 'completos': len(records),
                'novos': sum(not r['reutilizado'] for r in records.values()),
                'reutilizados': sum(r['reutilizado'] for r in records.values()),
                'falhas': failures, 'interrompido': interrupted,
                'segundos': round(time.perf_counter()-started, 2), 'blocos': records,
                'pendentes': [b['id'] for b in plan['blocos'] if b['id'] not in records]}
        atomic_json(directory / 'progresso.json', data)
        return data

    LOG.info('CAPTURA INICIADA | %d blocos | %d conexões | destino %s', total, workers, directory)
    try:
        for _ in range(workers):
            submit()
        while pending:
            done, _ = wait(pending, timeout=1, return_when=FIRST_COMPLETED)
            now = time.perf_counter()
            if now-last_heartbeat >= 20:
                LOG.info('EM ANDAMENTO | %d/%d completos | %d conexões em trabalho | %.1f min decorridos',
                         len(records), total, len(pending), (now-started)/60)
                last_heartbeat = now
            for future in done:
                block = pending.pop(future)
                try:
                    record = future.result()
                    records[block['id']] = record
                    failures.pop(block['id'], None)
                    downloaded = sum(not r['reutilizado'] for r in records.values())
                    remaining = total-len(records)-len(failures)
                    eta = (time.perf_counter()-started)/downloaded*remaining/60 if downloaded >= 3 else None
                    LOG.info('[%d/%d] %s %s | %.2f MiB | válidos %.2f%% | ETA aproximada %s',
                             len(records), total, 'REUTILIZADO' if record['reutilizado'] else 'SALVO', block['id'],
                             record['bytes_tif']/1024**2, 100*record['pixels_validos']/PIXELS**2,
                             f'{eta:.1f} min' if eta is not None else 'aguardando amostra')
                except Exception as error:
                    failures[block['id']] = str(error)
                    LOG.error('PENDENTE %s | %s', block['id'], error)
                save()
                submit()
    except KeyboardInterrupt:
        interrupted = True; stop.set()
        LOG.warning('Interrupção solicitada. Aguardando os trabalhadores encerrarem; blocos válidos serão preservados.')
    finally:
        stop.set()
        pool.shutdown(wait=True, cancel_futures=True)
        # Trabalhadores que terminaram após Ctrl+C também são contabilizados.
        for future, block in pending.items():
            if future.done() and not future.cancelled():
                try:
                    records[block['id']] = future.result()
                except Exception:
                    pass
        result = save()
    LOG.info('RESUMO | %d/%d completos | %d novos | %d reutilizados | %d pendentes | %.2f min',
             result['completos'], total, result['novos'], result['reutilizados'], len(result['pendentes']), result['segundos']/60)
    LOG.info('Disco: %.2f GiB livres | log: %s | manifesto: %s',
             shutil.disk_usage(directory).free/1024**3, directory/'captura.log', directory/'progresso.json')
    return result
