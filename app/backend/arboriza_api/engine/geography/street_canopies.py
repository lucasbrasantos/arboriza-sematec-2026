"""Seleção revisada por IDs e cobertura geométrica das copas-base por trecho."""
import json
import math
from collections import Counter
from functools import lru_cache
from pathlib import Path

from pyproj import Transformer
from shapely import STRtree, transform, union_all
from shapely.geometry import shape

KINDS = ('copa_individual', 'grupo_de_copas', 'complemento_pendente')


@lru_cache(maxsize=8)
def _originals(folder, crown_revision, point_revision):
    folder = Path(folder)
    polygons = json.loads((folder/'copas.geojson').read_text(encoding='utf-8'))
    points = json.loads((folder/'pontos-todos.geojson').read_text(encoding='utf-8'))
    if polygons.get('arboriza', {}).get('perfil') != 'fusao' or points.get('arboriza', {}).get('perfil') != 'fusao':
        raise ValueError('A seleção de copas requer uma análise original do modelo v2.')
    project = Transformer.from_crs(4326, 31982, always_xy=True)
    by_id = {}
    for feature in points['features']:
        ident = feature['properties']['copa_id']
        coords = feature['geometry']['coordinates']
        if (feature.get('id') != ident or ident in by_id or feature['geometry']['type'] != 'Point'
                or feature['properties'].get('analise_id') != folder.name or len(coords) != 2
                or not all(math.isfinite(n) for n in coords) or abs(coords[0]) > 180 or abs(coords[1]) > 90):
            raise ValueError('Pontos originais do v2 com vínculos inválidos.')
        by_id[ident] = {'id': ident, 'coordinates': coords, 'tipo': feature['properties']['tipo']}
    seen = set()
    for feature in polygons['features']:
        ident = feature['properties']['copa_id']
        if (ident not in by_id or ident in seen or feature.get('id') != ident
                or feature['properties'].get('analise_id') != folder.name
                or feature['properties']['tipo'] not in KINDS
                or feature['properties']['tipo'] != by_id[ident]['tipo']):
            raise ValueError('Máscaras originais do v2 com vínculos inválidos.')
        geometry = shape(feature['geometry'])
        if geometry.geom_type not in ('Polygon', 'MultiPolygon') or geometry.is_empty or not geometry.is_valid:
            raise ValueError('Máscara original inválida para o diagnóstico de ruas.')
        by_id[ident]['geometry'] = transform(geometry, project.transform, interleaved=False)
        seen.add(ident)
    if seen != set(by_id):
        raise ValueError('O resultado original contém pontos sem máscaras correspondentes.')
    return by_id


def select_canopies(analysis_id, output, layers):
    # analysis_id foi validado por read_sector_analysis antes de chamar esta função.
    from .street_analysis import ANALYSIS_ID
    if not ANALYSIS_ID.fullmatch(analysis_id):
        raise ValueError('Identificador de análise inválido.')
    folder = Path(output).resolve()/analysis_id
    try:
        crown = (folder/'copas.geojson').stat()
        point = (folder/'pontos-todos.geojson').stat()
        originals = _originals(str(folder), (crown.st_size, crown.st_mtime_ns), (point.st_size, point.st_mtime_ns))
    except (OSError, KeyError, TypeError) as error:
        raise ValueError('Copas originais do v2 indisponíveis ou incompatíveis neste computador.') from error
    records, seen, layer_ids = [], set(), set()
    sent = 0
    for layer in layers:
        if layer['id_camada'] in layer_ids:
            raise ValueError('A mesma camada foi selecionada duas vezes.')
        layer_ids.add(layer['id_camada'])
        for ident in layer['ids_copas']:
            sent += 1
            if sent > 50000:
                raise ValueError('Selecione até 50.000 registros no diagnóstico.')
            if ident not in originals:
                raise ValueError('Uma copa selecionada não pertence à análise original. Use camadas da mesma execução do v2.')
            if ident not in seen:
                seen.add(ident)
                records.append(originals[ident])
    if not records:
        raise ValueError('Selecione ao menos uma camada com propostas do v2.')
    totals = Counter(r['tipo'] for r in records)
    metadata = {'multicamadas': True, 'camadas_consideradas': len(layers),
                'duplicados_ignorados': sent-len(records), 'tipos_pontos': [r['tipo'] for r in records],
                'pontos_diagnostico': [r['coordinates'] for r in records],
                'totais_por_tipo': {kind: totals[kind] for kind in KINDS},
                'criterio_cobertura': 'uniao_copas_base_na_faixa_dentro_dos_setores',
                'complementos_na_cobertura': False}
    return records, metadata


class CanopyCoverage:
    def __init__(self, records):
        self.records = records
        self.tree = STRtree([r['geometry'] for r in records])

    def measure(self, observed):
        base, kinds = [], Counter()
        for index in self.tree.query(observed, predicate='intersects'):
            record = self.records[int(index)]
            clipped = record['geometry'].intersection(observed)
            if clipped.area <= 1e-9:
                continue
            kinds[record['tipo']] += 1
            if record['tipo'] != 'complemento_pendente':
                base.append(clipped)
        area = min(observed.area, union_all(base).area) if base else 0
        return {'area_faixa_avaliada_m2': round(observed.area, 4),
                'area_copas_base_m2': round(area, 4),
                'cobertura_copas_base_percentual': round(100*area/observed.area, 4) if observed.area else 0,
                'mascaras_na_faixa_por_tipo': {kind: kinds[kind] for kind in KINDS}}
