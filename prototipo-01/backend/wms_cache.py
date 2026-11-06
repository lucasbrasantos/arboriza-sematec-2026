"""Cache persistente de recortes WMS, indexado pelos parâmetros exatos da imagem."""
import hashlib
import json
import sqlite3
from contextlib import closing
from pathlib import Path
from time import perf_counter

from .detector import ROOT
from .image_cache import DEFAULT_LIMIT, RESERVE, connect, digest, import_image
from .orthophoto_wms import LAYER, WMS_URL, fetch_orthophoto

CACHE_DIR = ROOT / 'data' / 'ortofotos' / 'cache-wms'


def request_identity(bounds, width, height):
    # Versionar se forem alterados o formato, CRS, estilo ou conversão de pixels.
    request = {'versao': 1, 'url': WMS_URL, 'camada': LAYER, 'wms': '1.3.0', 'crs': 'EPSG:4674',
               'formato': 'image/png', 'transparente': True, 'estilo': '',
               'bounds_lon_lat': list(bounds), 'largura': width, 'altura': height}
    encoded = json.dumps(request, sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf-8')
    return hashlib.sha256(encoded).hexdigest(), request


def cached_orthophoto(bounds, width, height, scratch, client=None, root=CACHE_DIR,
                      fetch=fetch_orthophoto, limit=DEFAULT_LIMIT, reserve=RESERVE):
    """Retorna caminho e métricas; verifica o arquivo antes de cada reutilização."""
    root = Path(root).resolve()
    key, request = request_identity(bounds, width, height)
    started = perf_counter()
    with closing(connect(root)) as db:
        db.execute('''CREATE TABLE IF NOT EXISTS requisicoes_wms (
            chave TEXT PRIMARY KEY, sha256 TEXT NOT NULL, metadados TEXT NOT NULL,
            criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(sha256) REFERENCES imagens(sha256))''')
        row = db.execute('''SELECT i.arquivo, i.bytes, i.sha256, r.metadados
                            FROM requisicoes_wms r LEFT JOIN imagens i ON i.sha256=r.sha256
                            WHERE r.chave=?''', (key,)).fetchone()
        if row:
            filename, size, checksum, raw = row
            if not filename or not checksum:
                raise ValueError('O catálogo do cache WMS está inconsistente; revise antes de continuar.')
            path = (root / filename).resolve()
            if path.parent != root or not path.is_file() or path.stat().st_size != size or digest(path) != checksum:
                raise ValueError('Imagem do cache WMS ausente ou alterada; revise antes de reutilizar.')
            metadata = json.loads(raw)
            metadata.update(origem_imagem='cache', aquisicao_s=0.0, leitura_cache_s=perf_counter()-started)
            return path, metadata
    scratch = Path(scratch)
    download = fetch(bounds, width, height, scratch, client=client)
    stable = {k: download[k] for k in ('camada', 'crs', 'bounds_lon_lat', 'largura', 'altura',
                                       'pixels_validos', 'pixels_totais', 'sha256_png', 'bytes_png')}
    imported = import_image(scratch, {'requisicao': request, 'imagem': stable}, root=root, limit=limit, reserve=reserve)
    with closing(connect(root)) as db:
        db.execute('INSERT OR IGNORE INTO requisicoes_wms (chave, sha256, metadados) VALUES (?, ?, ?)',
                   (key, imported['sha256'], json.dumps(stable, ensure_ascii=False, allow_nan=False)))
        existing = db.execute('SELECT sha256 FROM requisicoes_wms WHERE chave=?', (key,)).fetchone()
        if existing[0] != imported['sha256']:
            raise ValueError('A mesma requisição foi registrada com outra imagem; revise o cache.')
        db.commit()
    stable.update(origem_imagem='download', aquisicao_s=download['aquisicao_s'], leitura_cache_s=0.0)
    return Path(imported['arquivo']), stable
