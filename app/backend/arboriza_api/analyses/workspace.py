"""Workspace pessoal e pacotes imutáveis enviados ao acervo."""
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from shapely import union_all
from shapely.geometry import Point

from ..access.auth import current_user, admin
from ..core.database import connect
from ..core.config import RESULTS
from ..territory.router import get_territory
from ..engine.geography.street_canopies import select_canopies
from .router import read

router = APIRouter(prefix='/api', tags=['Revisão e acervo'])


def now():
    return datetime.now(timezone.utc).isoformat()


class Snapshot(BaseModel):
    model_config = ConfigDict(extra='forbid')
    layers: list[dict] = Field(max_length=100)
    visible_ids: list[str] = Field(max_length=100)
    active_id: str = Field(max_length=200)


class Save(Snapshot):
    revision: int = Field(ge=0)


class ArchiveRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(min_length=1, max_length=150)
    snapshot: Snapshot


def validate_snapshot(snapshot):
    payload = snapshot.model_dump(include={'layers', 'visible_ids', 'active_id'})
    if len(json.dumps(payload, allow_nan=False).encode()) > 30_000_000:
        raise ValueError('O conjunto excede o limite de 30 MB.')
    ids, total, scopes, global_points = set(), 0, [], set()
    for layer in payload['layers']:
        ident = layer.get('id')
        if not isinstance(ident, str) or not ident or ident in ids or len(ident) > 200:
            raise ValueError('Identificadores de camadas inválidos ou repetidos.')
        ids.add(ident)
        if any(not isinstance(layer.get(field), str) or len(layer[field]) > 500 for field in ('origin', 'category', 'execution', 'executionId')):
            raise ValueError('Metadados da camada inválidos.')
        if not isinstance(layer.get('name'), str) or not 1 <= len(layer['name']) <= 200:
            raise ValueError('Nome de camada inválido.')
        if not re.fullmatch(r'#[0-9a-fA-F]{6}', layer.get('color', '')):
            raise ValueError('Cor de camada inválida.')
        bounds = layer.get('bounds')
        if not isinstance(bounds, list) or len(bounds) != 2 or any(not isinstance(pair, list) or len(pair) != 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in pair) or abs(pair[0]) > 90 or abs(pair[1]) > 180 for pair in bounds):
            raise ValueError('Limites da camada inválidos.')
        territory = layer.get('territory')
        area = None
        if territory:
            if not isinstance(territory, dict) or not isinstance(territory.get('ids'), list) or len(territory['ids']) > 5000 or any(not isinstance(value, str) for value in territory['ids']):
                raise ValueError('Origem territorial inválida.')
            mesh = get_territory()
            if territory.get('source') != mesh.metadata['sha256_fonte']:
                raise ValueError('A malha de origem mudou.')
            selected = mesh.selected(territory.get('ids', []))
            if not selected:
                raise ValueError('Selecione setores de origem para a camada.')
            area = union_all(selected)
            scopes.append((territory['source'], sorted(territory['ids'])))
        else:
            scopes.append(None)
        execution = layer.get('executionId', '')
        if re.fullmatch(r'\d{8}T\d{6}Z-[0-9a-f]{8}', execution):
            original_request = read(execution)['request']
            if not territory or sorted(territory['ids']) != sorted(original_request.get('ids', [])) or territory['source'] != original_request.get('fonte_malha'):
                raise ValueError('Os setores de uma análise original não podem ser substituídos.')
            if original_request.get('perfil') == 'fusao' and not layer.get('linkedCrowns'):
                raise ValueError('Os vínculos do modelo v2 precisam ser preservados.')
        items = layer.get('items')
        if not isinstance(items, list):
            raise ValueError('A camada precisa de uma lista de pontos.')
        total += len(items)
        if total > 50000:
            raise ValueError('Use até 50.000 pontos por conjunto.')
        item_ids = set()
        for item in items:
            if not isinstance(item, dict) or not isinstance(item.get('properties', {}), dict) or not isinstance(item.get('label'), str) or item.get('area') != 'cidade':
                raise ValueError('Metadados do ponto inválidos.')
            position = item.get('position', [])
            if item.get('kind') != 'point' or not isinstance(item.get('id'), str) or item['id'] in item_ids or not isinstance(position, list) or len(position) != 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in position) or abs(position[0]) > 90 or abs(position[1]) > 180:
                raise ValueError('Há pontos inválidos ou repetidos.')
            item_ids.add(item['id'])
            if item['id'] in global_points:
                raise ValueError('Há identificadores de pontos repetidos entre camadas.')
            global_points.add(item['id'])
            if area is not None and not area.covers(Point(position[1], position[0])):
                raise ValueError('Há pontos fora dos setores declarados. Confira a origem territorial.')
        if layer.get('linkedCrowns') and items:
            execution = layer.get('executionId', '')
            record = read(execution)
            if record['state'] != 'concluida' or record['request'].get('perfil') != 'fusao':
                raise ValueError('Os vínculos de copa precisam de uma análise v2 concluída.')
            records, _ = select_canopies(execution, RESULTS, [{'id_camada': ident, 'ids_copas': [item.get('properties', {}).get('copa_id') for item in items]}])
            by_id = {r['id']: r for r in records}
            for item in items:
                original = by_id[item['properties']['copa_id']]
                if item['position'] != list(reversed(original['coordinates'])):
                    raise ValueError('Pontos vinculados às copas têm posição fixa.')
        segmentation = layer.get('segmentation')
        if segmentation is not None:
            if not layer.get('linkedCrowns'):
                raise ValueError('Importação de copas exige vínculos com uma análise v2 original.')
            execution = layer.get('executionId', '')
            if not re.fullmatch(r'\d{8}T\d{6}Z-[0-9a-f]{8}', execution):
                raise ValueError('Identificador de análise inválido.')
            original = json.loads((RESULTS / execution / 'copas.geojson').read_text(encoding='utf-8'))
            if segmentation != original:
                raise ValueError('A geometria original das copas não pode ser alterada.')
        # Campos de procedência são conferidos no servidor; texto de origem não certifica área.
    if any(ident not in ids for ident in payload['visible_ids']):
        raise ValueError('Há camadas visíveis que não pertencem ao conjunto.')
    if payload['layers'] and payload['active_id'] not in ids:
        raise ValueError('A camada ativa não pertence ao conjunto.')
    scope = scopes[0] if scopes and scopes[0] is not None and all(s == scopes[0] for s in scopes) else None
    key = hashlib.sha256(json.dumps(scope, sort_keys=True).encode()).hexdigest() if scope else None
    return payload, key


def checked(snapshot):
    try:
        return validate_snapshot(snapshot)
    except (ValueError, TypeError, KeyError, OSError, AttributeError) as error:
        raise HTTPException(422, str(error)) from error


@router.get('/workspace')
def workspace(user=Depends(current_user)):
    with connect() as db:
        row = db.execute('SELECT * FROM workspaces WHERE user_id=?', (user['id'],)).fetchone()
    return {'revision': row['revision'], 'snapshot': json.loads(row['payload']), 'updated_at': row['updated_at']} if row else {'revision': 0, 'snapshot': None}


@router.post('/workspace/validar')
def validate_workspace(body: Snapshot, _user=Depends(current_user)):
    payload, key = checked(body)
    return {'snapshot': payload, 'territorio_validado': key is not None}


@router.put('/workspace')
def save_workspace(body: Save, user=Depends(current_user)):
    payload, _ = checked(body)
    stamp = now()
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT revision FROM workspaces WHERE user_id=?', (user['id'],)).fetchone()
        revision = row['revision'] if row else 0
        if revision != body.revision:
            raise HTTPException(409, 'O espaço de trabalho mudou em outra aba. Recarregue antes de salvar.')
        db.execute('INSERT INTO workspaces(user_id, revision, payload, updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at', (user['id'], revision + 1, json.dumps(payload, allow_nan=False), stamp))
    return {'revision': revision + 1, 'updated_at': stamp}


@router.post('/acervo', status_code=201)
def send_archive(body: ArchiveRequest, user=Depends(current_user)):
    payload, key = checked(body.snapshot)
    if not payload['layers']:
        raise HTTPException(422, 'Escolha camadas para enviar ao acervo.')
    ident, stamp = uuid4().hex, now()
    with connect() as db:
        db.execute('INSERT INTO archive_packages VALUES(?,?,?,?,?,?,?,?)', (ident, body.name, json.dumps(payload, allow_nan=False), 'nao_revisado', key, stamp, stamp, user['id']))
        db.execute('INSERT INTO archive_events(package_id,action,user_id,at) VALUES(?,?,?,?)', (ident, 'enviado', user['id'], stamp))
    return {'id': ident, 'state': 'nao_revisado'}


@router.get('/acervo')
def archive(_user=Depends(current_user)):
    with connect() as db:
        return [dict(row) for row in db.execute('SELECT id,name,state,territory_key,created_at,updated_at,owner FROM archive_packages ORDER BY created_at DESC')]


@router.get('/acervo/{ident}')
def package(ident: str, _user=Depends(current_user)):
    with connect() as db:
        row = db.execute('SELECT * FROM archive_packages WHERE id=?', (ident,)).fetchone()
    if not row:
        raise HTTPException(404, 'Pacote não encontrado.')
    return {**dict(row), 'snapshot': json.loads(row['payload']), 'payload': None}


@router.post('/acervo/{ident}/{action}')
def transition(ident: str, action: str, user=Depends(admin)):
    if action not in ('aprovar', 'publicar', 'despublicar'):
        raise HTTPException(404, 'Ação desconhecida.')
    stamp = now()
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT * FROM archive_packages WHERE id=?', (ident,)).fetchone()
        if not row:
            raise HTTPException(404, 'Pacote não encontrado.')
        if action in ('aprovar', 'publicar'):
            _, key = checked(Snapshot.model_validate(json.loads(row['payload'])))
            if not key:
                raise HTTPException(422, 'Valide a área de todas as camadas antes da aprovação.')
            if action == 'publicar' and not json.loads(row['payload'])['visible_ids']:
                raise HTTPException(422, 'O pacote não contém camadas visíveis para publicar. Envie um novo pacote com a seleção desejada.')
        if action == 'aprovar' and row['state'] != 'nao_revisado' or action == 'publicar' and row['state'] != 'aprovado' or action == 'despublicar' and row['state'] != 'publicado':
            raise HTTPException(409, 'A ação não é permitida no estado atual.')
        if action == 'publicar':
            previous = db.execute("SELECT id FROM archive_packages WHERE state='publicado' AND territory_key=?", (key,)).fetchall()
            for old in previous:
                db.execute("UPDATE archive_packages SET state='aprovado',updated_at=? WHERE id=?", (stamp, old['id']))
                db.execute('INSERT INTO archive_events(package_id,action,user_id,at) VALUES(?,?,?,?)', (old['id'], 'substituido', user['id'], stamp))
        state = 'publicado' if action == 'publicar' else 'aprovado'
        db.execute('UPDATE archive_packages SET state=?,updated_at=? WHERE id=?', (state, stamp, ident))
        db.execute('INSERT INTO archive_events(package_id,action,user_id,at) VALUES(?,?,?,?)', (ident, action, user['id'], stamp))
    return {'state': state}


@router.get('/publico/pacotes')
def published_packages():
    """Somente a seleção explicitamente publicada; sem dados do workspace pessoal."""
    with connect() as db:
        rows = db.execute("SELECT id,name,payload,updated_at FROM archive_packages WHERE state='publicado' ORDER BY updated_at DESC").fetchall()
    output = []
    for row in rows:
        snapshot = json.loads(row['payload'])
        visible = set(snapshot['visible_ids'])
        members = [layer for layer in snapshot['layers'] if layer['id'] in visible]
        living = {(layer['executionId'], item.get('properties', {}).get('copa_id')) for layer in members for item in layer['items'] if item.get('properties', {}).get('copa_id')}
        features = []
        for layer in members:
            for item in layer['items']:
                original = item.get('properties', {})
                features.append({'type': 'Feature', 'id': f"{row['id']}:{item['id']}", 'geometry': {'type': 'Point', 'coordinates': list(reversed(item['position']))}, 'properties': {'label': item['label'], 'categoria': layer['category'], 'color': layer['color'], 'tipo': original.get('tipo'), 'copa_id': original.get('copa_id'), 'score': original.get('score')}})
            for crown in layer.get('segmentation', {}).get('features', []):
                props = crown['properties']
                if (layer['executionId'], props.get('copa_id')) in living:
                    features.append({'type': 'Feature', 'id': f"{row['id']}:copa:{crown['id']}", 'geometry': crown['geometry'], 'properties': {'categoria': layer['category'], 'tipo': props.get('tipo'), 'copa_id': props.get('copa_id'), 'color': '#25b882' if props.get('tipo') == 'copa_individual' else '#f1aa43' if props.get('tipo') == 'grupo_de_copas' else '#53aff0'}})
        output.append({'id': row['id'], 'name': row['name'], 'published_at': row['updated_at'], 'bounds': [layer['bounds'] for layer in members], 'data': {'type': 'FeatureCollection', 'features': features}})
    return output
