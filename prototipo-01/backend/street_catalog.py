"""Eixos OSM locais: geometria métrica, RTree e vínculos pré-calculados por setor."""
import hashlib
import json
import math
import os
import sqlite3
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from time import perf_counter
from uuid import uuid4

from pyproj import Transformer
from shapely import STRtree, from_wkb, transform, union_all
from shapely.geometry import LineString

from .detector import DATA_ROOT

DIRECTORY = DATA_ROOT/'ruas/acervo-urbano-osm'
DATABASE = DIRECTORY/'ruas.sqlite3'
ENDPOINT = 'https://overpass-api.de/api/interpreter'
ROAD_TYPES = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified',
              'residential', 'living_street', 'service', 'primary_link', 'secondary_link',
              'tertiary_link', 'trunk_link'}
VERSION = 1


def query_for(territory, margin_m=50):
    if not math.isfinite(margin_m) or not 0 <= margin_m <= 200:
        raise ValueError('Margem de consulta inválida.')
    metric = transform(union_all(territory.geometries), territory.project.transform, interleaved=False)
    back = Transformer.from_crs(31982, 4326, always_xy=True)
    west, south, east, north = transform(metric.buffer(margin_m), back.transform, interleaved=False).bounds
    regex = '|'.join(sorted(ROAD_TYPES))
    query = (f'[out:json][timeout:180][maxsize:268435456];'
             f'way["highway"~"^({regex})$"]({south:.7f},{west:.7f},{north:.7f},{east:.7f});out body geom;')
    return query, [west, south, east, north]


def build_catalog(payload, territory, destination=DATABASE, provenance=None, progress=print):
    """Publica somente um banco completo; nunca modifica as amostras do piloto."""
    started = perf_counter()
    if payload.get('remark') or not isinstance(payload.get('elements'), list):
        raise ValueError('Resposta Overpass incompleta ou inválida; catálogo anterior preservado.')
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name+'.'+uuid4().hex+'.part')
    geometries = [transform(g, territory.project.transform, interleaved=False) for g in territory.geometries]
    tree = STRtree(geometries)
    context = union_all(geometries).buffer(50)
    metadata = {**(provenance or {}), 'versao': VERSION, 'fonte': 'OpenStreetMap',
                'licenca': 'ODbL', 'atribuicao': '© OpenStreetMap contributors',
                'fonte_malha': territory.metadata['sha256_fonte'], 'crs': 'EPSG:31982',
                'coletado_em': (provenance or {}).get('coletado_em', datetime.now(timezone.utc).isoformat()),
                'timestamp_osm': payload.get('osm3s', {}).get('timestamp_osm_base'),
                'classes': sorted(ROAD_TYPES), 'setores': len(territory.ids)}
    db = sqlite3.connect(temporary)
    try:
        db.executescript('''
            CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE roads (id INTEGER PRIMARY KEY, name TEXT, highway TEXT NOT NULL,
                                geometry BLOB NOT NULL, tags TEXT NOT NULL);
            CREATE VIRTUAL TABLE spatial USING rtree(id, west, east, south, north);
            CREATE TABLE sectors (id TEXT PRIMARY KEY);
            CREATE TABLE sector_roads (sector_id TEXT NOT NULL, road_id INTEGER NOT NULL,
                                      PRIMARY KEY(sector_id, road_id)) WITHOUT ROWID;
            CREATE INDEX roads_sector ON sector_roads(road_id, sector_id);
        ''')
        db.executemany('INSERT INTO sectors VALUES(?)', [(i,) for i in territory.ids])
        seen = set()
        for number, way in enumerate(payload['elements'], 1):
            if way.get('type') != 'way' or way.get('tags', {}).get('highway') not in ROAD_TYPES:
                continue
            ident = way.get('id')
            if not isinstance(ident, int) or isinstance(ident, bool) or not 0 < ident < 2**63 or ident in seen:
                raise ValueError('Identidade de via inválida ou duplicada na resposta OSM.')
            seen.add(ident)
            coordinates = [(p['lon'], p['lat']) for p in way.get('geometry', [])]
            if (len(coordinates) < 2 or any(not math.isfinite(x) or not math.isfinite(y)
                    or abs(x) > 180 or abs(y) > 90 for x, y in coordinates)):
                raise ValueError(f'Geometria incompleta na via OSM {ident}; banco anterior preservado.')
            geometry = transform(LineString(coordinates), territory.project.transform, interleaved=False)
            if not geometry.is_valid or geometry.is_empty or geometry.length == 0:
                raise ValueError(f'Geometria inválida na via OSM {ident}.')
            if not geometry.intersects(context):
                continue
            tags = way['tags']
            db.execute('INSERT INTO roads VALUES(?,?,?,?,?)',
                       (ident, tags.get('name'), tags['highway'], geometry.wkb, json.dumps(tags, ensure_ascii=False)))
            west, south, east, north = geometry.bounds
            db.execute('INSERT INTO spatial VALUES(?,?,?,?,?)', (ident, west, east, south, north))
            for index in tree.query(geometry, predicate='intersects'):
                # Interseção linear real: um toque isolado não gera trecho para diagnóstico.
                if geometry.intersection(geometries[int(index)]).length > .01:
                    db.execute('INSERT INTO sector_roads VALUES(?,?)', (territory.ids[int(index)], ident))
            if number % 1000 == 0:
                progress(f'Indexação: {number}/{len(payload["elements"])} vias recebidas examinadas')
        metadata.update(vias=db.execute('SELECT COUNT(*) FROM roads').fetchone()[0],
                        vinculos=db.execute('SELECT COUNT(*) FROM sector_roads').fetchone()[0],
                        setores_sem_vias=[r[0] for r in db.execute('SELECT id FROM sectors WHERE NOT EXISTS '
                            '(SELECT 1 FROM sector_roads WHERE sector_id=sectors.id) ORDER BY id')],
                        indexacao_s=round(perf_counter()-started, 3))
        if not metadata['vias']:
            raise ValueError('Nenhuma via encontrada no entorno dos setores; catálogo anterior preservado.')
        db.executemany('INSERT INTO metadata VALUES(?,?)',
                       [(k, json.dumps(v, ensure_ascii=False)) for k, v in metadata.items()])
        db.commit()
        db.execute('ANALYZE')
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('Falha de integridade no catálogo de ruas.')
        db.close()
        os.replace(temporary, destination)
    finally:
        db.close()
        temporary.unlink(missing_ok=True)
    progress(f'Catálogo pronto: {metadata["vias"]} vias, {metadata["vinculos"]} vínculos, '
             f'{len(metadata["setores_sem_vias"])} setores sem eixo viário cadastrado dentro do setor')
    return metadata


@lru_cache(maxsize=64)
def _read(path, size, modified_ns, sectors, mesh_hash):
    # A revisão do arquivo invalida automaticamente a memória após atualizar o acervo.
    db = sqlite3.connect(Path(path).as_uri()+'?mode=ro', uri=True)
    try:
        metadata = {k: json.loads(v) for k, v in db.execute('SELECT key,value FROM metadata')}
        if metadata.get('versao') != VERSION or metadata.get('fonte_malha') != mesh_hash:
            raise ValueError('O catálogo viário não corresponde à malha atual. Atualize o acervo de ruas.')
        marks = ','.join('?' for _ in sectors)
        count = db.execute(f'SELECT COUNT(*) FROM sectors WHERE id IN ({marks})', sectors).fetchone()[0]
        if count != len(sectors):
            raise ValueError('O catálogo de ruas não contém todos os setores selecionados.')
        rows = db.execute(f'SELECT DISTINCT r.id,r.name,r.highway,r.geometry FROM roads r '
                          f'JOIN sector_roads s ON s.road_id=r.id WHERE s.sector_id IN ({marks}) ORDER BY r.id', sectors)
        roads = {str(ident): {'id': str(ident), 'properties': {'name': name, 'highway': kind},
                             'metric_geometry': from_wkb(geometry)} for ident, name, kind, geometry in rows}
        return roads, metadata
    finally:
        db.close()


def load_roads(path, ids, mesh_hash):
    started = perf_counter()
    if not ids or len(ids) != len(set(ids)):
        raise ValueError('Seleção de setores inválida para o catálogo de ruas.')
    path = Path(path).resolve()
    revision = path.stat()
    roads, metadata = _read(str(path), revision.st_size, revision.st_mtime_ns, tuple(sorted(ids)), mesh_hash)
    sources = [{'setor': i, 'coletado_em': metadata['coletado_em']} for i in ids]
    return roads, sources, {'tipo_base_viaria': 'acervo_urbano_osm', 'setores_catalogados': metadata['setores'],
                            'vias_consultadas': len(roads), 'leitura_base_viaria_s': perf_counter()-started,
                            'timestamp_osm': metadata.get('timestamp_osm')}


def query_identity(query, mesh_hash):
    return hashlib.sha256((query+'\n'+mesh_hash).encode()).hexdigest()
