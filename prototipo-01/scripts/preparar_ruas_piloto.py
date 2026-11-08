"""Prepara uma amostra pequena de vias OSM para um setor, sem sobrepor arquivos."""
import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
import xml.etree.ElementTree as ET

import httpx
from pyproj import Transformer
from shapely import transform

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.detector import ROOT
from backend.territory import Territory

ROAD_TYPES = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential',
              'living_street', 'service', 'primary_link', 'secondary_link', 'tertiary_link', 'trunk_link'}
DESTINATION = ROOT / 'data' / 'ruas' / 'piloto-osm'


def prepare(sector_id, destination=DESTINATION):
    territory = Territory()
    geometry = territory.selected([sector_id])[0]
    projected = transform(geometry, territory.project.transform, interleaved=False)
    to_geo = Transformer.from_crs('EPSG:31982', 'EPSG:4326', always_xy=True)
    bounds = transform(projected.buffer(50).envelope, to_geo.transform, interleaved=False).bounds
    west, south, east, north = bounds
    if (east - west) * (north - south) > .005:
        raise ValueError('Área ampla demais para a consulta piloto; use um extrato apropriado.')
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    output = destination / f'{sector_id}.geojson'
    if output.exists():
        raise FileExistsError('Já existe uma amostra para este setor; arquivo preservado.')
    url = 'https://api.openstreetmap.org/api/0.6/map'
    response = httpx.get(url, params={'bbox': ','.join(map(str, bounds))},
                         headers={'User-Agent': 'Arboriza-Prototype/0.1 (local research pilot)'},
                         timeout=30, follow_redirects=True)
    response.raise_for_status()
    root = ET.fromstring(response.content)
    nodes = {item.attrib['id']: [float(item.attrib['lon']), float(item.attrib['lat'])]
             for item in root.findall('node')}
    features = []
    for way in root.findall('way'):
        tags = {tag.attrib['k']: tag.attrib['v'] for tag in way.findall('tag')}
        if tags.get('highway') not in ROAD_TYPES:
            continue
        refs = [item.attrib['ref'] for item in way.findall('nd')]
        if len(refs) < 2 or any(ref not in nodes for ref in refs):
            raise ValueError('Uma via veio sem geometria completa na resposta OSM.')
        features.append({'type': 'Feature', 'id': way.attrib['id'],
                         'properties': {'name': tags.get('name'), 'highway': tags['highway']},
                         'geometry': {'type': 'LineString', 'coordinates': [nodes[ref] for ref in refs]}})
    collection = {'type': 'FeatureCollection', 'features': features,
                  'arboriza': {'setor': sector_id, 'fonte_malha': territory.metadata['sha256_fonte'],
                               'fonte': 'OpenStreetMap', 'licenca': 'ODbL',
                               'url_fonte': url, 'bbox_consultada': list(bounds),
                               'sha256_resposta': hashlib.sha256(response.content).hexdigest(),
                               'coletado_em': datetime.now(timezone.utc).isoformat(),
                               'observacao': 'Amostra piloto; a API pode omitir vias sem nós na caixa consultada.'}}
    with output.open('x', encoding='utf-8') as stream:
        json.dump(collection, stream, ensure_ascii=False, allow_nan=False)
    return output, len(features)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('setor')
    args = parser.parse_args()
    path, count = prepare(args.setor)
    print(f'Amostra: {path} · {count} vias. © OpenStreetMap contributors, ODbL.')
