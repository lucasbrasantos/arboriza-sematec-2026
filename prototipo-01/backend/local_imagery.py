"""Catálogo espacial persistente e cache limitado de janelas RGB, nunca de detecções."""
import hashlib
import json
import os
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import ColorInterp, Resampling
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_bounds
from rasterio.windows import Window
from shapely.geometry import box

from .analysis import RECORTES
from .detector import DATA_ROOT, ROOT

CRS = 'EPSG:31982'
CACHE = ROOT / '.cache/acervo-local-v1'
LIMIT_BYTES = 10 * 1024**3


class LocalImages:
    """Atualiza apenas metadados alterados; consulta RTree sem abrir os TIFFs restantes.

    Uma instância representa o inventário no início da análise. Novos arquivos são
    descobertos na análise seguinte; mudanças nos arquivos usados invalidam a janela.
    """
    def __init__(self, paths=None, cache_root=CACHE, limit_bytes=LIMIT_BYTES):
        started = time.perf_counter()
        if paths is None:
            paths = list((DATA_ROOT/'ortofotos/acervo-urbano-25cm').glob('*.tif'))
            paths += [p for p in RECORTES.values() if p.is_file()]
            paths += list((DATA_ROOT/'ortofotos/cache-wms').glob('*.tif'))
        self.paths = list(dict.fromkeys(Path(p).resolve() for p in paths))
        self.cache_root = Path(cache_root)
        self.cache_root.mkdir(parents=True, exist_ok=True)
        self.database = self.cache_root/'catalogo.sqlite3'
        self.limit_bytes = limit_bytes
        self.last_metadata = {}
        self.metadata_opens = 0
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS sources (
                    id INTEGER PRIMARY KEY, path TEXT UNIQUE NOT NULL,
                    size INTEGER NOT NULL, modified_ns INTEGER NOT NULL,
                    bounds TEXT NOT NULL, usable INTEGER NOT NULL);
                CREATE VIRTUAL TABLE IF NOT EXISTS spatial USING rtree(id, west, east, south, north);
                CREATE TABLE IF NOT EXISTS windows (
                    key TEXT PRIMARY KEY, metadata TEXT NOT NULL, size INTEGER NOT NULL,
                    accessed REAL NOT NULL);
                CREATE INDEX IF NOT EXISTS windows_accessed ON windows(accessed);
            ''')
            if 'auxiliary' not in {row[1] for row in db.execute('PRAGMA table_info(sources)')}:
                db.execute("ALTER TABLE sources ADD COLUMN auxiliary TEXT NOT NULL DEFAULT ''")
            self._refresh(db)
        self.index_seconds = time.perf_counter()-started

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.database, timeout=30)
        try:
            with db:
                yield db
        finally:
            db.close()

    def _refresh(self, db):
        rows = {row[1]: row for row in db.execute('SELECT * FROM sources')}
        inventory = {parent: {p.name for p in parent.iterdir()} for parent in {p.parent for p in self.paths}}
        self.sources = []
        self.identities = {}
        for path in self.paths:
            revision = path.stat()
            auxiliary = self._auxiliary(path, inventory[path.parent])
            row = rows.get(str(path))
            if row is None or (row[2], row[3], row[6]) != (revision.st_size, revision.st_mtime_ns, auxiliary):
                with rasterio.open(path) as src:
                    self.metadata_opens += 1
                    if not src.crs or src.count < 3 or src.dtypes[:3] != ('uint8',)*3:
                        raise ValueError('Fonte local sem georreferência/RGB8: '+str(path))
                    bounds = transform_bounds(src.crs, CRS, *src.bounds, densify_pts=21)
                    usable = max((bounds[2]-bounds[0])/src.width, (bounds[3]-bounds[1])/src.height) <= .27
                db.execute('''INSERT INTO sources(path,size,modified_ns,bounds,usable,auxiliary) VALUES(?,?,?,?,?,?)
                    ON CONFLICT(path) DO UPDATE SET size=excluded.size, modified_ns=excluded.modified_ns,
                    bounds=excluded.bounds, usable=excluded.usable, auxiliary=excluded.auxiliary''',
                    (str(path), revision.st_size, revision.st_mtime_ns, json.dumps(bounds), usable, auxiliary))
                row = db.execute('SELECT * FROM sources WHERE path=?', (str(path),)).fetchone()
                db.execute('INSERT OR REPLACE INTO spatial VALUES(?,?,?,?,?)',
                           (row[0], bounds[0], bounds[2], bounds[1], bounds[3]))
            if row[5]:
                self.sources.append((path, box(*json.loads(row[4]))))
                self.identities[row[0]] = (path, row[2], row[3], row[6])

    @staticmethod
    def _auxiliary(path, names=None):
        revisions = []
        for suffix in ('.msk', '.aux.xml', '.ovr'):
            auxiliary = Path(str(path)+suffix)
            if names is not None and auxiliary.name not in names:
                continue
            try:
                stat = auxiliary.stat()
            except FileNotFoundError:
                continue
            revisions.append((suffix, stat.st_size, stat.st_mtime_ns))
        return json.dumps(revisions)

    def _candidates(self, bounds, crs):
        west, south, east, north = transform_bounds(crs, CRS, *bounds, densify_pts=21)
        with self.connect() as db:
            ids = {row[0] for row in db.execute(
                'SELECT id FROM spatial WHERE west<=? AND east>=? AND south<=? AND north>=?',
                (east, west, north, south))}
        selected = [value for key, value in self.identities.items() if key in ids]
        # Invalidação antes de reutilizar pixels, inclusive em instâncias já criadas.
        if any((p.stat().st_size, p.stat().st_mtime_ns, self._auxiliary(p)) != (size, modified, aux)
               for p, size, modified, aux in selected):
            with self.connect() as db:
                self._refresh(db)
            return self._candidates(bounds, crs)
        return selected

    def prepared(self, bounds, width, height, crs=CRS):
        started = time.perf_counter()
        candidates = self._candidates(bounds, crs)
        identity = {'version': 1, 'bounds': list(bounds), 'width': width, 'height': height,
                    'crs': str(crs), 'sources': [(str(p), size, ns, aux) for p, size, ns, aux in candidates]}
        key = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
        target = self.cache_root/(key+'.tif')
        with self.connect() as db:
            row = db.execute('SELECT metadata,size FROM windows WHERE key=?', (key,)).fetchone()
            if row and target.is_file() and target.stat().st_size == row[1]:
                metadata = json.loads(row[0])
                db.execute('UPDATE windows SET accessed=? WHERE key=?', (time.time(), key))
                metadata.update(cache_janela_local=True, leitura_local_s=time.perf_counter()-started)
                self.last_metadata = metadata
                return target, metadata
        rgb, valid, affine, sources = self._compose(bounds, width, height, crs, candidates)
        metadata = {'fontes': sources, 'pixels_validos': int(valid.sum()), 'pixels_totais': width*height}
        # Sem DEFLATE nas janelas derivadas: prioriza CPU/latência; originais permanecem comprimidos.
        temporary = self.cache_root/(key+'.'+uuid.uuid4().hex+'.tmp')
        try:
            with rasterio.Env(GDAL_TIFF_INTERNAL_MASK=True):
                with rasterio.open(temporary, 'w', driver='GTiff', width=width, height=height,
                                   count=3, dtype='uint8', crs=crs, transform=affine,
                                   tiled=True, blockxsize=256, blockysize=256) as out:
                    out.write(rgb.transpose(2, 0, 1))
                    out.write_mask(valid.astype('uint8')*255)
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)
        with self.connect() as db:
            db.execute('INSERT OR REPLACE INTO windows VALUES(?,?,?,?)',
                       (key, json.dumps(metadata), target.stat().st_size, time.time()))
            self._prune(db, key)
        metadata.update(cache_janela_local=False, leitura_local_s=time.perf_counter()-started)
        self.last_metadata = metadata
        return target, metadata

    def _prune(self, db, keep):
        total = db.execute('SELECT COALESCE(SUM(size),0) FROM windows').fetchone()[0]
        for key, size in db.execute('SELECT key,size FROM windows WHERE key<>? ORDER BY accessed', (keep,)).fetchall():
            if total <= self.limit_bytes:
                break
            try:
                (self.cache_root/(key+'.tif')).unlink(missing_ok=True)
            except PermissionError:  # outra análise pode estar lendo a janela no Windows
                continue
            db.execute('DELETE FROM windows WHERE key=?', (key,))
            total -= size

    def read(self, bounds, size):
        return self.read_grid(bounds, size, size, CRS)

    def read_grid(self, bounds, width, height, crs):
        path, metadata = self.prepared(bounds, width, height, crs)
        with rasterio.open(path) as src:
            return src.read([1, 2, 3]).transpose(1, 2, 0), src.dataset_mask()>0, src.transform, metadata['fontes']

    def _compose(self, bounds, width, height, crs, candidates):
        affine = from_bounds(*bounds, width, height)
        rgb = np.zeros((height, width, 3), dtype='uint8')
        valid = np.zeros((height, width), bool)
        sources = []
        for path, _, _, _ in candidates:
            with rasterio.open(path) as src:
                native = ~src.transform * affine
                aligned = src.crs == rasterio.crs.CRS.from_user_input(crs) and all(
                    abs(a-b) < 1e-6 for a, b in zip(tuple(native)[:6],
                        (1, 0, round(native.c), 0, 1, round(native.f))))
                if aligned:
                    window = Window(round(native.c), round(native.f), width, height)
                    observed = src.dataset_mask(window=window, boundless=True)>0
                    pixels = src.read([1, 2, 3], window=window, boundless=True).transpose(1, 2, 0)
                else:
                    with WarpedVRT(src, crs=crs, transform=affine, width=width, height=height,
                                   resampling=Resampling.bilinear,
                                   add_alpha=ColorInterp.alpha not in src.colorinterp) as vrt:
                        observed = vrt.dataset_mask()>0
                        pixels = vrt.read([1, 2, 3]).transpose(1, 2, 0)
                use = observed & ~valid
                if use.any():
                    rgb[use] = pixels[use]
                    valid |= observed
                    sources.append(str(path))
            if valid.all():
                break
        return rgb, valid, affine, sources
