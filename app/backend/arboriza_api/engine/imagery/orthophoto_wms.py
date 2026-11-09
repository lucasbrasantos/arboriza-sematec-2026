"""Aquisição limitada de recortes WMS IGC em diretório temporário por execução."""
import hashlib
import io
import math
import tempfile
from contextlib import contextmanager
from pathlib import Path
from time import perf_counter

import httpx
import numpy as np
import rasterio
from PIL import Image, UnidentifiedImageError
from rasterio.transform import from_bounds

from ..models.detector import DATA_ROOT

WMS_URL = 'https://datageo.ambiente.sp.gov.br/geoimage/datageoimg/ows'
LAYER = 'ORTOFOTOS_SP_2023_2024'
TEMP_ROOT = DATA_ROOT / 'ortofotos' / 'temporario'
MAX_IMAGE_BYTES = 20 * 1024 * 1024
MAX_DIMENSION = 2048


@contextmanager
def temporary_images(root=TEMP_ROOT):
    """Remove somente o diretório criado pela execução, inclusive em falhas comuns."""
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='analise-', dir=root) as folder:
        yield Path(folder)


def fetch_orthophoto(bounds, width, height, target, client=None, crs='EPSG:4674'):
    """PNG WMS para GeoTIFF RGB8/máscara; bounds no CRS informado (geográfico ou UTM)."""
    if crs not in ('EPSG:4674', 'EPSG:31982'):
        raise ValueError('CRS não suportado para aquisição.')
    if (len(bounds) != 4 or not all(math.isfinite(v) for v in bounds)
            or not (bounds[0] < bounds[2] and bounds[1] < bounds[3])
            or (crs == 'EPSG:4674' and not (-180 <= bounds[0] < bounds[2] <= 180 and -90 <= bounds[1] < bounds[3] <= 90))
            or (crs == 'EPSG:31982' and not (0 <= bounds[0] < bounds[2] <= 1000000 and 0 <= bounds[1] < bounds[3] <= 10000000))):
        raise ValueError('Limites geográficos inválidos.')
    if (isinstance(width, bool) or isinstance(height, bool) or not isinstance(width, int)
            or not isinstance(height, int) or not 1 <= width <= MAX_DIMENSION or not 1 <= height <= MAX_DIMENSION):
        raise ValueError('Dimensões da imagem inválidas.')
    target = Path(target)
    if target.exists():
        raise FileExistsError('O destino da imagem temporária já existe.')
    west, south, east, north = bounds
    axis_bounds = (south, west, north, east) if crs == 'EPSG:4674' else bounds
    params = {'SERVICE': 'WMS', 'VERSION': '1.3.0', 'REQUEST': 'GetMap', 'LAYERS': LAYER,
              'STYLES': '', 'CRS': crs, 'BBOX': ','.join(map(str, axis_bounds)),
              'WIDTH': str(width), 'HEIGHT': str(height), 'FORMAT': 'image/png', 'TRANSPARENT': 'TRUE'}
    own_client = client is None
    client = client or httpx.Client(timeout=httpx.Timeout(30, connect=10), follow_redirects=True)
    started = perf_counter()
    try:
        with client.stream('GET', WMS_URL, params=params) as response:
            response.raise_for_status()
            if response.headers.get('content-type', '').split(';')[0].strip().lower() != 'image/png':
                raise ValueError('O serviço não retornou uma imagem PNG válida.')
            chunks, total = [], 0
            for chunk in response.iter_bytes():
                total += len(chunk)
                if total > MAX_IMAGE_BYTES:
                    raise ValueError('A resposta de imagem excedeu o limite permitido.')
                chunks.append(chunk)
        content = b''.join(chunks)
        try:
            with Image.open(io.BytesIO(content)) as image:
                if image.format != 'PNG' or image.size != (width, height):
                    raise ValueError('A imagem retornada tem formato ou dimensões inesperadas.')
                rgba = np.asarray(image.convert('RGBA'))
        except (UnidentifiedImageError, OSError) as error:
            raise ValueError('O serviço retornou uma imagem inválida.') from error
        valid = rgba[:, :, 3] > 0
        if not valid.any():
            raise ValueError('O serviço retornou uma imagem inteiramente sem pixels válidos.')
        try:
            with rasterio.Env(GDAL_TIFF_INTERNAL_MASK=True):
                with rasterio.open(target, 'w', driver='GTiff', width=width, height=height, count=3,
                                   dtype='uint8', crs=crs, transform=from_bounds(*bounds, width, height),
                                   compress='deflate') as output:
                    output.write(rgba[:, :, :3].transpose(2, 0, 1))
                    output.write_mask(valid.astype('uint8') * 255)
        except Exception:
            target.unlink(missing_ok=True)
            raise
        return {'camada': LAYER, 'crs': crs,
                ('bounds_lon_lat' if crs == 'EPSG:4674' else 'bounds_utm'): list(bounds),
                'largura': width, 'altura': height, 'pixels_validos': int(valid.sum()),
                'pixels_totais': width * height, 'sha256_png': hashlib.sha256(content).hexdigest(),
                'bytes_png': len(content), 'aquisicao_s': perf_counter() - started}
    finally:
        if own_client:
            client.close()
