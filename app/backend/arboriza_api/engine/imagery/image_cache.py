"""Cache local de ortofotos; importa somente arquivos já existentes e autorizados."""
import hashlib
import json
import shutil
import sqlite3
from contextlib import closing
from pathlib import Path
from uuid import uuid4

import rasterio

from ..models.detector import DATA_ROOT

CACHE_DIR = DATA_ROOT / 'ortofotos' / 'cache-blocos'
DEFAULT_LIMIT = 10 * 1024**3
RESERVE = 1024**3


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def connect(root):
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(root / 'catalogo.sqlite3', timeout=30)
    connection.execute('''CREATE TABLE IF NOT EXISTS imagens (
        sha256 TEXT PRIMARY KEY, arquivo TEXT NOT NULL UNIQUE, bytes INTEGER NOT NULL,
        origem TEXT NOT NULL, metadados TEXT NOT NULL, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)''')
    return connection


def import_image(source, source_metadata, root=CACHE_DIR, limit=DEFAULT_LIMIT, reserve=RESERVE):
    source, root = Path(source), Path(root)
    if limit <= 0 or reserve < 0:
        raise ValueError('Limite e reserva de espaço inválidos.')
    if not source.is_file() or not isinstance(source_metadata, dict) or not source_metadata:
        raise ValueError('Informe um raster local existente e seus metadados de origem.')
    with rasterio.open(source) as raster:
        if not raster.crs or raster.count < 3 or any(dtype != 'uint8' for dtype in raster.dtypes[:3]):
            raise ValueError('A imagem deve ter CRS e pelo menos três bandas RGB8.')
        if any(Path(item).resolve() != source.resolve() for item in raster.files):
            raise ValueError('A imagem depende de arquivos auxiliares; incorpore a máscara e o georreferenciamento antes de importar.')
        metadata = {'crs': raster.crs.to_string(), 'bounds': list(raster.bounds),
                    'resolucao': list(raster.res), 'largura': raster.width, 'altura': raster.height,
                    'nodata': raster.nodata, 'fonte': source_metadata}
    checksum, size = digest(source), source.stat().st_size
    root.mkdir(parents=True, exist_ok=True)
    with closing(connect(root)) as db:
        db.execute('BEGIN IMMEDIATE')
        previous = db.execute('SELECT arquivo, bytes, metadados FROM imagens WHERE sha256 = ?', (checksum,)).fetchone()
        if previous:
            target = root / previous[0]
            if not target.is_file() or target.stat().st_size != previous[1] or digest(target) != checksum:
                raise ValueError('O arquivo registrado no cache está ausente ou foi alterado; revise antes de reutilizá-lo.')
            if json.loads(previous[2]).get('fonte') != source_metadata:
                raise ValueError('A imagem já existe no cache com outros metadados de origem; revise a procedência.')
            return {'situacao': 'reutilizada', 'sha256': checksum, 'arquivo': str(target), 'bytes': size}
        # Inclui arquivos órfãos e temporários: nunca apagar dados para abrir espaço.
        used = sum(p.stat().st_size for p in root.iterdir() if p.is_file() and p.suffix.lower() in ('.tif', '.part'))
        if used + size > limit:
            raise ValueError('O limite configurado para imagens em cache seria excedido.')
        if shutil.disk_usage(root).free - size < reserve:
            raise ValueError('Espaço livre insuficiente para manter a reserva configurada.')
        temporary = root / f'{uuid4().hex}.part'
        target = root / f'{checksum}.tif'
        if target.exists():
            raise ValueError('Existe um arquivo não catalogado com este nome; revise o cache antes de continuar.')
        moved = False
        try:
            with source.open('rb') as original, temporary.open('xb') as copy:
                shutil.copyfileobj(original, copy, length=1024*1024)
            if temporary.stat().st_size != size or digest(temporary) != checksum:
                raise ValueError('A cópia não passou na verificação de integridade.')
            temporary.rename(target)
            moved = True
            db.execute('INSERT INTO imagens (sha256, arquivo, bytes, origem, metadados) VALUES (?, ?, ?, ?, ?)',
                       (checksum, target.name, size, source.name, json.dumps(metadata, ensure_ascii=False, allow_nan=False)))
            db.commit()
        except Exception:
            temporary.unlink(missing_ok=True)
            # Apenas o arquivo criado nesta operação pode ser removido em caso de erro.
            if moved and target.is_file() and digest(target) == checksum:
                target.unlink()
            raise
    return {'situacao': 'importada', 'sha256': checksum, 'arquivo': str(target), 'bytes': size}


def cache_status(root=CACHE_DIR, limit=DEFAULT_LIMIT):
    root = Path(root)
    with closing(connect(root)) as db:
        count, catalogued = db.execute('SELECT COUNT(*), COALESCE(SUM(bytes), 0) FROM imagens').fetchone()
    actual = sum(p.stat().st_size for p in root.iterdir() if p.is_file() and p.suffix.lower() in ('.tif', '.part'))
    return {'imagens': count, 'bytes_catalogados': catalogued, 'bytes_imagens_em_disco': actual,
            'limite_bytes': limit, 'livre_no_disco_bytes': shutil.disk_usage(root).free}


def verified_images(root=CACHE_DIR):
    """Retorna somente registros íntegros; falha explicitamente em caso de corrupção."""
    root = Path(root).resolve()
    if not (root / 'catalogo.sqlite3').is_file():
        return []
    with closing(sqlite3.connect(root / 'catalogo.sqlite3')) as db:
        rows = db.execute('SELECT sha256, arquivo, bytes, origem FROM imagens ORDER BY sha256').fetchall()
    images = []
    for checksum, filename, size, origin in rows:
        path = (root / filename).resolve()
        if path.parent != root or not path.is_file() or path.stat().st_size != size or digest(path) != checksum:
            raise ValueError('Uma imagem do cache está ausente ou alterada. Confira o catálogo antes de continuar.')
        images.append({'sha256': checksum, 'path': path, 'origem': origin})
    return images
