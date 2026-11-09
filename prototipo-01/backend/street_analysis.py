"""Diagnóstico exploratório de vias e pontos, sem classificar locais para plantio."""
import json
import math
import re
from collections import Counter
from pathlib import Path

from pyproj import Transformer
from shapely import STRtree, transform, union_all
from shapely.geometry import LineString, Point, mapping, shape
from shapely.ops import substring

from .detector import DATA_ROOT
from .street_catalog import DATABASE, load_roads

ROAD_DIR = DATA_ROOT / 'ruas' / 'piloto-osm'
ANALYSIS_ID = re.compile(r'^\d{8}T\d{6}Z-[0-9a-f]{8}$')
STRETCH_M = 100
VISUAL_MARGIN_M = 20


def lines(geometry):
    if geometry.is_empty:
        return []
    if geometry.geom_type == 'LineString':
        return [geometry]
    if geometry.geom_type in ('MultiLineString', 'GeometryCollection'):
        return [line for part in geometry.geoms for line in lines(part)]
    return []


def analyze_streets(territory, ids, points, distance_m, road_dir=None, *, catalog_path=None, canopies=None):
    if not ids or not points:
        raise ValueError('Selecione uma análise territorial com pontos para examinar as ruas.')
    if not math.isfinite(distance_m) or not 5 <= distance_m <= 100:
        raise ValueError('Use uma distância de comparação entre 5 e 100 metros.')
    sector_geometries = territory.selected(ids)
    to_metric = territory.project.transform
    to_geo = Transformer.from_crs('EPSG:31982', 'EPSG:4326', always_xy=True).transform
    selected = transform(union_all(sector_geometries), to_metric, interleaved=False)
    coverage = None
    if canopies is not None:
        from .street_canopies import CanopyCoverage
        if len(canopies) != len(points):
            raise ValueError('Pontos e copas incompatíveis no diagnóstico.')
        coverage = CanopyCoverage(canopies)
    if road_dir is None:
        road_dir = ROAD_DIR
        if catalog_path is None:
            catalog_path = DATABASE
    if catalog_path is not None and Path(catalog_path).is_file():
        roads, sources, source_metadata = load_roads(catalog_path, ids, territory.metadata['sha256_fonte'])
    else:
        source_metadata = {'tipo_base_viaria': 'piloto_osm'}
        roads = {}
        sources = []
        for ident in ids:
            if not re.fullmatch(r'\d{15}', ident):
                raise ValueError('Identificador de setor inválido para a amostra de ruas.')
            path = Path(road_dir) / f'{ident}.geojson'
            if not path.is_file():
                raise ValueError('Ainda não há amostra local de ruas para todos os setores desta camada.')
            data = json.loads(path.read_text(encoding='utf-8'))
            metadata = data['arboriza']
            if metadata['setor'] != ident or metadata['fonte_malha'] != territory.metadata['sha256_fonte']:
                raise ValueError('A amostra de ruas não corresponde à versão atual da malha territorial.')
            sources.append({'setor': ident, 'coletado_em': metadata['coletado_em']})
            for feature in data['features']:
                roads[str(feature['id'])] = feature
    segments = []
    for road_id, feature in sorted(roads.items()):
        source_geometry = feature.get('metric_geometry')
        if source_geometry is None:
            source_geometry = transform(shape(feature['geometry']), to_metric, interleaved=False)
        geometry = source_geometry.intersection(selected)
        for part_index, line in enumerate(lines(geometry)):
            for i in range(math.ceil(line.length / STRETCH_M)):
                part = substring(line, i * STRETCH_M, min((i + 1) * STRETCH_M, line.length))
                if not isinstance(part, LineString) or part.length < .01:
                    continue
                vicinity = part.buffer(distance_m)
                observed = min(vicinity.area, vicinity.intersection(selected).area)
                partial = vicinity.area - observed > .01
                segments.append({'id': f'{road_id}-{part_index}-{i}', 'line': part,
                                 'nome': feature['properties'].get('name') or 'Via sem nome no OSM',
                                 'classe': feature['properties']['highway'], 'count': 0, 'points': [],
                                 'cobertura_entorno_percentual': 100 * observed / vicinity.area,
                                 'parcial': partial})
    if not segments:
        raise ValueError('A amostra não contém vias selecionadas dentro da área analisada.')
    geometries = [item['line'] for item in segments]
    tree = STRtree(geometries)
    unmatched, outside = 0, 0
    for point_index, coordinates in enumerate(points):
        if (len(coordinates) != 2 or not all(math.isfinite(v) for v in coordinates)
                or not (-180 <= coordinates[0] <= 180 and -90 <= coordinates[1] <= 90)):
            raise ValueError('A camada contém coordenadas inválidas.')
        point = transform(Point(coordinates), to_metric, interleaved=False)
        if not selected.covers(point):
            outside += 1
            continue
        nearest, distances = tree.query_nearest(point, max_distance=distance_m, return_distance=True, all_matches=True)
        if len(nearest) == 0:
            unmatched += 1
            continue
        # Empates determinísticos: um único ponto contribui para um único trecho.
        index = min((int(i) for i in nearest), key=lambda i: segments[i]['id'])
        segments[index]['count'] += 1
        segments[index]['points'].append({**({'tipo': canopies[point_index]['tipo'], 'copa_id': canopies[point_index]['id']} if coverage else {}),
                                         'indice': point_index,
                                         'posicao_m': round(segments[index]['line'].project(point), 3),
                                         'distancia_m': round(segments[index]['line'].distance(point), 3)})
    features = []
    for item in segments:
        length = item['line'].length
        canopy_properties = {}
        if coverage:
            counts = Counter(p['tipo'] for p in item['points'])
            canopy_properties = {**coverage.measure(item['line'].buffer(distance_m).intersection(selected)),
                                 'individuos_proximos': counts['copa_individual'],
                                 'grupos_proximos': counts['grupo_de_copas'],
                                 'complementos_proximos': counts['complemento_pendente'],
                                 'pontos_base_proximos': counts['copa_individual']+counts['grupo_de_copas'],
                                 'individuos_por_100m': round(counts['copa_individual']*100/length, 2)}
        features.append({'type': 'Feature', 'id': item['id'],
                         'geometry': mapping(transform(item['line'], to_geo, interleaved=False)),
                         'properties': {**canopy_properties, 'nome': item['nome'], 'classe': item['classe'],
                                        'comprimento_m': round(length, 2), 'pontos_proximos': item['count'],
                                        'pontos_por_100m': round(item['count'] * 100 / length, 2),
                                        'cobertura_entorno_percentual': round(item['cobertura_entorno_percentual'], 2),
                                        'pontos_associados': item['points'],
                                        'vizinhanca_parcial': item['parcial']}})
    return {'type': 'FeatureCollection', 'features': features,
            'arboriza': {**source_metadata, 'setores': ids, 'fonte': '© OpenStreetMap contributors', 'licenca': 'ODbL',
                         'geometria_setores': mapping(union_all(sector_geometries)),
                         # Somente a abertura da máscara visual ganha respiro; o recorte acima usa selected.
                         'geometria_contexto_visual': mapping(transform(selected.buffer(VISUAL_MARGIN_M), to_geo, interleaved=False)),
                         'margem_contexto_visual_m': VISUAL_MARGIN_M,
                         'fontes': sources, 'distancia_m': distance_m, 'tamanho_trecho_m': STRETCH_M,
                         'trechos_vizinhanca_parcial': sum(item['parcial'] for item in segments),
                         'pontos_enviados': len(points), 'pontos_sem_via_proxima': unmatched,
                         'pontos_fora_selecao': outside,
                         'aviso': 'Cadastro OSM pode conter omissões; pontos são possíveis copas, não locais de plantio.'}}


def read_sector_analysis(analysis_id, output, territory):
    if not ANALYSIS_ID.fullmatch(analysis_id):
        raise ValueError('Identificador de análise inválido.')
    path = Path(output) / analysis_id / 'resumo.json'
    if not path.is_file():
        raise ValueError('O resumo da análise territorial não está disponível neste computador.')
    data = json.loads(path.read_text(encoding='utf-8'))
    ids = data.get('ids_setores')
    if not isinstance(ids, list) or not ids or data.get('fonte_malha') != territory.metadata['sha256_fonte']:
        raise ValueError('Esta camada não possui uma análise de setores compatível com a malha atual.')
    territory.selected(ids)
    return ids
