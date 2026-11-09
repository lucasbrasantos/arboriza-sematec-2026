"""Consolidação global em disco com as mesmas regras da fusão V2."""
import json
import sqlite3
from pathlib import Path

from pyproj import Transformer
from shapely import from_wkb, transform, union_all
from shapely.geometry import mapping

from ..engine.inference.crown_fusion import RULES

BACK = Transformer.from_crs('EPSG:31982', 'EPSG:4326', always_xy=True)


def connect(path):
    # O executor usa um único escritor em thread dedicada e aguarda seu término
    # antes da consolidação. A conexão nunca recebe escritas concorrentes.
    db = sqlite3.connect(path, check_same_thread=False)
    db.row_factory = sqlite3.Row
    db.executescript('''
        CREATE TABLE IF NOT EXISTS windows (key TEXT PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS raw (
            id INTEGER PRIMARY KEY, key TEXT UNIQUE, engine TEXT, kind TEXT,
            score REAL, geometry BLOB);
        CREATE VIRTUAL TABLE IF NOT EXISTS raw_bounds USING rtree(id,x1,x2,y1,y2);
        CREATE INDEX IF NOT EXISTS raw_order ON raw(engine,score DESC,key);
        CREATE TABLE IF NOT EXISTS kept (id INTEGER PRIMARY KEY, stage TEXT);
        CREATE TABLE IF NOT EXISTS final (
            id INTEGER PRIMARY KEY, copa_id TEXT UNIQUE, kind TEXT, sector_id TEXT,
            score REAL, evidence TEXT, geometry BLOB, lon REAL, lat REAL);
        CREATE VIRTUAL TABLE IF NOT EXISTS final_bounds USING rtree(id,x1,x2,y1,y2);
        CREATE INDEX IF NOT EXISTS final_sector ON final(sector_id,kind);
    ''')
    return db


def insert_window(db, key, rows):
    with db:
        for row in rows:
            geometry = row['geometry']
            cursor = db.execute('INSERT INTO raw(key,engine,kind,score,geometry) VALUES(?,?,?,?,?)',
                                (row['key'], row['engine'], row['tipo'], row['score'], geometry.wkb))
            x1, y1, x2, y2 = geometry.bounds
            db.execute('INSERT INTO raw_bounds VALUES(?,?,?,?,?)', (cursor.lastrowid, x1, x2, y1, y2))
        db.execute('INSERT INTO windows VALUES(?)', (key,))


def nearby(db, geometry, table='raw', stage=None):
    if table not in ('raw', 'final'):
        raise ValueError('Tabela espacial inválida.')
    x1, y1, x2, y2 = geometry.bounds
    query = f'''SELECT r.* FROM {table} r JOIN {table}_bounds b ON r.id=b.id
        {'JOIN kept k ON k.id=r.id' if stage else ''}
        WHERE b.x1<=? AND b.x2>=? AND b.y1<=? AND b.y2>=?'''
    params = [x2, x1, y2, y1]
    if stage:
        query += ' AND k.stage=?'
        params.append(stage)
    return db.execute(query, params)


def consolidate(db, selection, sectors, ident, score, progress):
    """NMS global; recorte administrativo somente depois da deduplicação."""
    with db:
        db.execute('DELETE FROM kept')
        db.execute('DELETE FROM final_bounds')
        db.execute('DELETE FROM final')
    count = 0
    for engine, floor, stage in [('restor', .5, 'restor'), ('cambridge200', score, 'cambridge'),
                                  ('cambridge100', score, 'cambridge')]:
        # Cambridge200 precede Cambridge100, como as âncoras do V2.
        for row in db.execute('SELECT * FROM raw WHERE engine=? AND score>=? ORDER BY score DESC,key', (engine, floor)):
            geometry = from_wkb(row['geometry'])
            suppressed = False
            for other in nearby(db, geometry, stage=stage):
                if other['kind'] != row['kind']:
                    continue
                g = from_wkb(other['geometry'])
                overlap = geometry.intersection(g).area
                if overlap / (geometry.area + g.area - overlap) >= RULES['nms_iou']:
                    suppressed = True
                    break
            if not suppressed:
                db.execute('INSERT INTO kept VALUES(?,?)', (row['id'], stage))
            count += 1
            if count % 250 == 0:
                db.commit()
                progress(f'Deduplicando copas · {count:,} propostas verificadas')
        db.commit()

    from shapely import STRtree
    sector_ids = sorted(sectors)
    sector_geometries = [sectors[i] for i in sector_ids]
    tree = STRtree(sector_geometries)
    total = db.execute('SELECT count(*) FROM kept').fetchone()[0]
    for number, row in enumerate(db.execute('SELECT r.*, k.stage FROM raw r JOIN kept k ON k.id=r.id ORDER BY r.id'), 1):
        original = from_wkb(row['geometry'])
        evidence = row['engine']
        if row['stage'] == 'cambridge':
            matched = False
            for other in nearby(db, original, stage='restor'):
                g = from_wkb(other['geometry'])
                intersection = original.intersection(g).area
                union = original.area + g.area - intersection
                if intersection >= 12 * .0625 and (intersection / union >= .25 or intersection / min(original.area, g.area) >= .5):
                    matched = True
                    break
            if matched:
                continue
        geometry = original.intersection(selection)
        parts = [g for g in getattr(geometry, 'geoms', [geometry]) if g.geom_type in ('Polygon', 'MultiPolygon') and g.area > 0]
        if not parts:
            continue
        geometry = union_all(parts)
        center = geometry.centroid
        if not geometry.covers(center):
            center = geometry.representative_point()
        candidates = sorted(int(i) for i in tree.query(center, predicate='intersects'))
        if not candidates:
            raise ValueError('Uma copa consolidada ficou sem setor de referência.')
        sector_id = sector_ids[candidates[0]]  # Fronteira: desempate estável pelo código IBGE.
        kind = row['kind'] if row['stage'] == 'restor' else 'complemento_pendente'
        lon, lat = BACK.transform(center.x, center.y)
        cursor = db.execute('INSERT INTO final(copa_id,kind,sector_id,score,evidence,geometry,lon,lat) VALUES(?,?,?,?,?,?,?,?)',
                            (f'{ident}-{row["key"]}', kind, sector_id, row['score'], evidence, geometry.wkb, lon, lat))
        x1, y1, x2, y2 = geometry.bounds
        db.execute('INSERT INTO final_bounds VALUES(?,?,?,?,?)', (cursor.lastrowid, x1, x2, y1, y2))
        if number % 250 == 0:
            db.commit()
            progress(f'Consolidando indivíduos e grupos · {number:,}/{total:,}')
    db.commit()


def statistics(db, sectors, features, ident, source, progress):
    output = []
    for number, feature in enumerate(features, 1):
        sector_id = str(feature['id'])
        area = sectors[sector_id]
        masks = [from_wkb(r['geometry']).intersection(area) for r in nearby(db, area, 'final')
                 if r['kind'] != 'complemento_pendente']
        covered = union_all(masks).area if masks else 0
        counts = dict(db.execute('SELECT kind,count(*) FROM final WHERE sector_id=? GROUP BY kind', (sector_id,)))
        n = counts.get('copa_individual', 0)
        center = area.representative_point()
        lon, lat = BACK.transform(center.x, center.y)
        props = {'id': sector_id, 'status': 'concluido', 'individuos': n,
                 'grupos': counts.get('grupo_de_copas', 0), 'pendentes': counts.get('complemento_pendente', 0),
                 'area_m2': round(area.area, 4), 'copas_m2': round(covered, 4),
                 'cobertura': round(100 * covered / area.area, 4) if area.area else 0,
                 'densidade': round(n * 10000 / area.area, 4) if area.area else 0,
                 'label': [lat, lon]}
        output.append({'type': 'Feature', 'id': sector_id, 'geometry': feature['geometry'], 'properties': props})
        progress(f'Calculando estatísticas · setor {number}/{len(features)}')
    breaks = {}
    for metric in ('individuos', 'densidade', 'cobertura'):
        values = sorted(f['properties'][metric] for f in output)
        breaks[metric] = sorted(set(values[min(len(values)-1, int((len(values)-1)*q))] for q in (.2, .4, .6, .8)))
    total_area = sum(f['properties']['area_m2'] for f in output)
    canopy_area = sum(f['properties']['copas_m2'] for f in output)
    return {'type': 'FeatureCollection', 'features': output, 'base': {
        'id': ident, 'fonte_malha': source, 'modelo': 'V2 · Restor + Cambridge', 'setores': len(output),
        'individuos': sum(f['properties']['individuos'] for f in output),
        'grupos': sum(f['properties']['grupos'] for f in output), 'area_m2': total_area,
        'cobertura': 100 * canopy_area / total_area if total_area else 0, 'classes': breaks,
        'aviso': 'Estimativa automática. Grupos não equivalem a indivíduos; complementos pendentes ficam fora da cobertura.',
        'regras': RULES}}


def export_files(db, folder, metadata, progress):
    """Exportação em lotes pequenos, sem carregar a cidade toda em memória."""
    import fiona
    folder = Path(folder)
    schema = {'geometry': 'Unknown', 'properties': {'copa_id': 'str', 'tipo': 'str', 'setor_id': 'str',
              'score': 'float', 'area_m2': 'float', 'revisado': 'int'}}
    gpkg = folder / 'aracatuba.gpkg'
    # Exportações interrompidas são refeitas; a versão publicada é preservada.
    temporary = folder / 'aracatuba.part.gpkg'
    temporary.unlink(missing_ok=True)
    with fiona.open(temporary, 'w', driver='GPKG', layer='copas', crs='EPSG:31982', schema=schema) as polygons, \
         fiona.open(folder/'copas.geojson.part', 'w', driver='GeoJSON', crs='EPSG:4326', schema=schema) as geo:
        batch, geo_batch = [], []
        for index, row in enumerate(db.execute('SELECT * FROM final ORDER BY id'), 1):
            geometry = from_wkb(row['geometry'])
            props = {'copa_id': row['copa_id'], 'tipo': row['kind'], 'setor_id': row['sector_id'],
                     'score': row['score'], 'area_m2': geometry.area, 'revisado': 0}
            batch.append({'geometry': mapping(geometry), 'properties': props})
            geo_batch.append({'geometry': mapping(transform(geometry, BACK.transform, interleaved=False)), 'properties': props})
            if index % 500 == 0:
                polygons.writerecords(batch); geo.writerecords(geo_batch)
                batch, geo_batch = [], []
                progress(f'Exportando copas · {index:,}')
        polygons.writerecords(batch); geo.writerecords(geo_batch)
    point_schema = {**schema, 'geometry': 'Point'}
    with fiona.open(temporary, 'w', driver='GPKG', layer='pontos', crs='EPSG:4326', schema=point_schema) as points, \
         (folder/'pontos.geojson.part').open('w', encoding='utf-8') as geo:
        geo.write('{"type":"FeatureCollection","arboriza":'+json.dumps(metadata, ensure_ascii=False)+',"features":[')
        first = True
        batch = []
        for row in db.execute('SELECT * FROM final ORDER BY id'):
            props = {'copa_id': row['copa_id'], 'tipo': row['kind'], 'setor_id': row['sector_id'],
                     'score': row['score'], 'area_m2': from_wkb(row['geometry']).area, 'revisado': 0}
            feature = {'type': 'Feature', 'id': row['copa_id'], 'geometry': {'type': 'Point', 'coordinates': [row['lon'], row['lat']]}, 'properties': props}
            batch.append(feature)
            if len(batch)>=500:
                points.writerecords(batch); batch=[]
            geo.write(('' if first else ',')+json.dumps(feature, ensure_ascii=False, separators=(',', ':')))
            first = False
        geo.write(']}')
        points.writerecords(batch)
    temporary.replace(gpkg)
    for name in ('pontos.geojson', 'copas.geojson'):
        (folder/(name+'.part')).replace(folder/name)
