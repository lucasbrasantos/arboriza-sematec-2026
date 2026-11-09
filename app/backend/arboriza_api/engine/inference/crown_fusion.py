"""Fusão de máscaras em metros; pontos e polígonos ligados, sem somar escores."""
import json
from pathlib import Path

from pyproj import Transformer
from shapely import STRtree, transform, union_all
from shapely.geometry import mapping

BACK = Transformer.from_crs('EPSG:31982', 'EPSG:4326', always_xy=True)
RULES = {'versao': 1, 'nms_iou': .5, 'matching_iou': .25,
         'matching_sobre_menor': .5, 'matching_min_pixels': 12,
         'min_area_pixels': 20, 'score_restor': .5, 'score_cambridge_padrao': .15,
         'complementos': 'pendentes_fora_da_cobertura', 'grupos': 'pontos_separados_dos_individuos'}


def suppress(rows, anchors=()):
    ordered = list(anchors) + sorted(rows, key=lambda r: (-r['score'], r['key']))
    if not ordered:
        return []
    tree = STRtree([r['geometry'] for r in ordered])
    removed, kept = set(), []
    for i, row in enumerate(ordered):
        if i in removed:
            continue
        kept.append(row)
        for j in tree.query(row['geometry'], predicate='intersects'):
            j = int(j)
            if j <= i or j < len(anchors) or j in removed or row['tipo'] != ordered[j]['tipo']:
                continue
            other = ordered[j]['geometry']
            overlap = row['geometry'].intersection(other).area
            if overlap / (row['geometry'].area + other.area - overlap) >= .5:
                removed.add(j)
    return kept


def fuse(rows, selection, analysis_id, score=.15, sectors=None):
    restor = suppress([r for r in rows if r['engine'] == 'restor' and r['score'] >= .5])
    base = suppress([r for r in rows if r['engine'] == 'cambridge200' and r['score'] >= score])
    cambridge = suppress([r for r in rows if r['engine'] == 'cambridge100' and r['score'] >= score], base)
    tree = STRtree([r['geometry'] for r in restor])
    evidence = {r['key']: [] for r in restor}
    complements = []
    for row in cambridge:
        matched = False
        for i in tree.query(row['geometry'], predicate='intersects'):
            candidate = restor[int(i)]
            intersection = candidate['geometry'].intersection(row['geometry']).area
            union = candidate['geometry'].area + row['geometry'].area - intersection
            minimum = 12 * min(row.get('pixel_area_m2', .0625), candidate.get('pixel_area_m2', .0625))
            if intersection >= minimum and (intersection/union >= .25 or intersection/min(candidate['geometry'].area, row['geometry'].area) >= .5):
                evidence[candidate['key']].append(row['key']); matched = True
        if not matched:
            complements.append(row)
    polygons, all_points, individuals, groups, pending = [], [], [], [], []
    operational = []
    for row in restor + complements:
        geometry = row['geometry'].intersection(selection)
        parts = [g for g in getattr(geometry, 'geoms', [geometry]) if g.geom_type in ('Polygon', 'MultiPolygon') and g.area > 0]
        if not parts:
            continue
        geometry = union_all(parts)
        center = geometry.centroid
        if not geometry.covers(center):
            center = geometry.representative_point()
        complement = row['engine'] != 'restor'
        ident = f'{analysis_id}-copa-{len(polygons)+1:06d}'
        correspondences = evidence.get(row['key'], [])
        kind = 'complemento_pendente' if complement else row['tipo']
        props = {'copa_id': ident, 'tipo': kind, 'origem': 'cambridge' if complement else 'restor',
                 'modelo': row['engine'], 'score': row['score'], 'revisado': False,
                 'estado_revisao': 'pendente', 'complemento': complement,
                 'contagem_individual': kind == 'copa_individual', 'analise_id': analysis_id,
                 'area_copa_m2': round(geometry.area, 4), 'evidencia': 'ambos' if correspondences else ('cambridge' if complement else 'restor'),
                 'correspondencias': correspondences, 'proposta_origem_id': row['key'],
                 'ponto_representa': 'centro_da_copa_ou_ponto_interno;nao_localizacao_do_tronco'}
        geographic = transform(geometry, BACK.transform, interleaved=False)
        lon, lat = BACK.transform(center.x, center.y)
        polygons.append({'type': 'Feature', 'id': ident, 'properties': dict(props), 'geometry': mapping(geographic)})
        point = {'type': 'Feature', 'id': ident, 'properties': dict(props),
                 'geometry': {'type': 'Point', 'coordinates': [lon, lat]}}
        all_points.append(point)
        if complement:
            pending.append(point)
        else:
            operational.append(geometry)
            (groups if kind == 'grupo_de_copas' else individuals).append(point)
    canopy = union_all(operational)
    def coverage(area):
        covered = canopy.intersection(area).area
        return {'area_m2': round(area.area, 4), 'cobertura_operacional_m2': round(covered, 4),
                'cobertura_operacional_percentual': round(100*covered/area.area, 4) if area.area else 0,
                'cobertura_confirmada_m2': 0, 'cobertura_confirmada_percentual': 0}
    report = {'perfil': 'fusao', 'modelo': 'restor-tcd-r50+detectree2-cambridge',
              'candidatos': len(individuals), 'copas_individuais': len(individuals), 'grupos_copas': len(groups),
              'complementos_pendentes': len(pending), 'propostas_totais': len(polygons), 'regras': RULES,
              'corte_score': score, 'corte_restor': .5, **coverage(selection),
              'cobertura_por_setor': {str(i): coverage(g) for i, g in (sectors or {}).items()},
              'aviso': 'Cobertura automática preliminar; grupos não equivalem a uma árvore; complementos excluídos até revisão.'}
    metadata = {'perfil': 'fusao', 'analise_id': analysis_id, 'regras': RULES}
    def collection(features):
        return {'type': 'FeatureCollection', 'features': features, 'arboriza': metadata}
    return {'copas': collection(polygons), 'pontos': collection(individuals), 'pontos-todos': collection(all_points),
            'pontos-grupos': collection(groups), 'pontos-complementos': collection(pending), 'resumo': report}


def export(result, folder):
    folder = Path(folder)
    for name, value in result.items():
        path = folder / ('resumo.json' if name == 'resumo' else name + '.geojson')
        path.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2), encoding='utf-8')
