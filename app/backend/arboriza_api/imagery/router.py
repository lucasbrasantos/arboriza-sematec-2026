"""Tiles transparentes do acervo local, sobrepostos à base cartográfica remota."""
import io
import hashlib
import json
import math
import time
from functools import lru_cache
from pathlib import Path
from threading import Lock, BoundedSemaphore
from uuid import uuid4

import numpy as np
from PIL import Image
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from ..core.config import DATA_DIR, CACHE_DIR
from ..engine.imagery.local_imagery import LocalImages

router = APIRouter(prefix='/api/imagery', tags=['Imagens'])
_reader = None
_version = None
_lock = Lock()
_prune_lock = Lock()
_last_prune = 0.0
_work = BoundedSemaphore(4)
RADIUS = 20037508.342789244
TILE_CACHE_LIMIT = 2 * 1024**3


def prune_tile_cache(root: Path, keep: Path):
    global _last_prune
    now = time.monotonic()
    if now - _last_prune < 21600 or not root.exists() or not _prune_lock.acquire(blocking=False):
        return
    try:
        _last_prune = now
        files = []
        total = 0
        for path in root.rglob('*.webp'):
            try:
                stat = path.stat()
            except FileNotFoundError:
                continue
            files.append((stat.st_mtime, stat.st_size, path))
            total += stat.st_size
        if total <= TILE_CACHE_LIMIT:
            return
        for _, size, path in sorted(files):
            if path == keep:
                continue
            path.unlink(missing_ok=True)
            total -= size
            if total <= TILE_CACHE_LIMIT * .8:
                break
    finally:
        _prune_lock.release()


def reader():
    global _reader, _version
    with _lock:
        if _reader is None:
            paths = sorted((DATA_DIR / 'ortofotos' / 'acervo-urbano-25cm').glob('*.tif'))
            if not paths:
                raise FileNotFoundError('Acervo local de ortofotos indisponível.')
            _reader = LocalImages(paths, cache_root=CACHE_DIR / 'mapa-local-index')
            identity = [(str(path), size, modified, aux)
                        for _, (path, size, modified, aux) in sorted(_reader.identities.items())]
            _version = hashlib.sha256(json.dumps(identity, ensure_ascii=False).encode()).hexdigest()[:20]
        return _reader


@lru_cache(maxsize=512)
def render(z: int, x: int, y: int) -> bytes:
    n = 2 ** z
    size = 2 * RADIUS / n
    bounds = (-RADIUS + x * size, RADIUS - (y + 1) * size,
              -RADIUS + (x + 1) * size, RADIUS - y * size)
    local = reader()
    cached = CACHE_DIR / 'mapa-local-tiles' / str(_version) / str(z) / str(x) / f'{y}.webp'
    if cached.is_file():
        return cached.read_bytes()
    with _work:
        candidates = local._candidates(bounds, 'EPSG:3857')
        rgb, valid, _, _ = local._compose(bounds, 256, 256, 'EPSG:3857', candidates)
    rgba = np.dstack((rgb, valid.astype('uint8') * 255))
    out = io.BytesIO()
    Image.fromarray(rgba, mode='RGBA').save(out, format='WEBP', quality=88, method=0)
    result = out.getvalue()
    cached.parent.mkdir(parents=True, exist_ok=True)
    temporary = cached.with_name(cached.name + '.' + uuid4().hex + '.tmp')
    try:
        temporary.write_bytes(result)
        temporary.replace(cached)
    finally:
        temporary.unlink(missing_ok=True)
    prune_tile_cache(CACHE_DIR / 'mapa-local-tiles', cached)
    return result


@router.get('/tiles/{z}/{x}/{y}.webp')
def tile(z: int, x: int, y: int):
    if not 14 <= z <= 20 or not 0 <= x < 2 ** z or not 0 <= y < 2 ** z:
        raise HTTPException(404, 'Tile indisponível.')
    # Delimita requisições a um entorno amplo de Araçatuba, antes de acessar o raster.
    n = 2 ** z
    lon = (x + .5) / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + .5) / n))))
    if not (-51 < lon < -50 and -22 < lat < -20.5):
        raise HTTPException(404, 'Tile fora do acervo.')
    try:
        return Response(render(z, x, y), media_type='image/webp', headers={'Cache-Control': 'public, max-age=300'})
    except (OSError, ValueError) as error:
        raise HTTPException(503, 'Acervo local indisponível.') from error
