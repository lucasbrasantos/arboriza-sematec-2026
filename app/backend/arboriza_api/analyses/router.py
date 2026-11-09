"""Execução serial e persistente das análises territoriais."""
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Lock
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from typing import Literal

from ..access.auth import current_user
from ..core.config import RESULTS
from ..core.database import connect
from ..engine.inference import service as engine
from ..engine.inference.analysis import RECORTES
from ..territory.router import get_territory
from ..core.processing import gpu_lock

router = APIRouter(prefix='/api/analises', tags=['Análises'])
lock = Lock()
pool = None
service = None


def now():
    return datetime.now(timezone.utc).isoformat()


def start_worker():
    global pool
    with connect() as db:
        db.execute("UPDATE analyses SET state='erro', step='Servidor reiniciado', error='A análise foi interrompida pelo reinício do servidor.', updated_at=? WHERE state IN ('pendente','processando')", (now(),))
    pool = ThreadPoolExecutor(max_workers=1)


def stop_worker():
    global pool
    if pool:
        pool.shutdown(wait=True)
        pool = None


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    ids: list[str] = Field(min_length=1, max_length=5000)
    fonte_malha: str = Field(min_length=1, max_length=128)
    perfil: Literal['controle', 'controle-datageo', 'controle-local', 'fusao'] = 'controle'
    score: float = Field(default=.15, ge=.05, le=1, allow_inf_nan=False)


class CropRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    recorte: Literal['centro', 'centro-norte']
    perfil: Literal['controle', 'controle-datageo', 'controle-local', 'multiescala', 'fusao'] = 'controle'
    score: float = Field(default=.15, ge=.05, le=1, allow_inf_nan=False)


def update(ident, state, step, summary=None, error=None):
    with connect() as db:
        db.execute('UPDATE analyses SET state=?, step=?, updated_at=?, summary=?, error=? WHERE id=?',
                   (state, step, now(), json.dumps(summary, ensure_ascii=False, allow_nan=False) if summary is not None else None, error, ident))


def work(ident, request):
    with gpu_lock():
        _work(ident, request)


def _work(ident, request):
    global service
    try:
        if service is None:
            service = engine.AnalysisService()
        folder = RESULTS / ident
        folder.mkdir(parents=True, exist_ok=False)
        def progress(step):
            update(ident, 'processando', step)
        progress('Preparando análise')
        if isinstance(request, CropRequest):
            summary = service.run(request.recorte, request.perfil, request.score, folder, progress)
        elif request.perfil in ('controle-local', 'controle-datageo'):
            summary = service.run_control_source(get_territory(), request.ids, request.score, folder, progress, request.perfil)
        else:
            runner = service.run_fusion_sectors if request.perfil == 'fusao' else service.run_sectors
            summary = runner(get_territory(), request.ids, request.score, folder, progress)
        update(ident, 'concluida', 'Concluída', summary=summary)
    except Exception as error:
        logging.exception('Falha na análise %s', ident)
        update(ident, 'erro', 'Análise interrompida', error=str(error)[:600])


@router.get('/perfis')
def profiles(_user=Depends(current_user)):
    return {
        'modelos': [
            {'id': 'controle', 'nome': 'Controle · Cambridge',
             'perfis': ['controle', 'controle-datageo', 'controle-local']},
            {'id': 'fusao', 'nome': 'Modelo v2 · Restor + Cambridge', 'perfis': ['fusao']},
        ],
        'perfis': engine.PROFILES, 'score_padrao': .15, 'score_minimo': .05,
    }


@router.get('/recortes/disponiveis')
def available_crops(_user=Depends(current_user)):
    return {'recortes': [{'id': name, 'disponivel': path.is_file()} for name, path in RECORTES.items()]}


@router.post('/setores', status_code=202)
def start(body: AnalysisRequest, user=Depends(current_user)):
    territory = get_territory()
    try:
        territory.selected(body.ids)
        if territory.metadata['sha256_fonte'] != body.fonte_malha:
            raise ValueError('A malha territorial mudou; recarregue a seleção.')
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    return enqueue(body, user)


@router.post('/recortes', status_code=202)
def start_crop(body: CropRequest, user=Depends(current_user)):
    if not RECORTES[body.recorte].is_file():
        raise HTTPException(503, 'A imagem do recorte não está disponível.')
    return enqueue(body, user)


def enqueue(body, user):
    with lock:
        from ..urban_base.jobs import active
        if active():
            raise HTTPException(409, 'A base urbana está em processamento. Pause-a antes de iniciar outra análise.')
        if pool is None:
            raise HTTPException(503, 'Executor indisponível.')
        with connect() as db:
            if db.execute("SELECT 1 FROM analyses WHERE state IN ('pendente','processando') LIMIT 1").fetchone():
                raise HTTPException(409, 'Há uma análise em andamento.')
            ident = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + uuid4().hex[:8]
            stamp = now()
            db.execute('INSERT INTO analyses(id, request, state, step, created_at, updated_at, owner) VALUES(?,?,?,?,?,?,?)',
                       (ident, body.model_dump_json(), 'pendente', 'Aguardando execução', stamp, stamp, user['id']))
        try:
            pool.submit(work, ident, body)
        except RuntimeError as error:
            update(ident, 'erro', 'Executor indisponível', error='Não foi possível iniciar a análise.')
            raise HTTPException(503, 'Não foi possível iniciar a análise.') from error
    return {'analysis_id': ident}


def read(ident):
    with connect() as db:
        row = db.execute('SELECT * FROM analyses WHERE id=?', (ident,)).fetchone()
    if row is None:
        raise HTTPException(404, 'Análise não encontrada.')
    result = dict(row)
    result['request'] = json.loads(result['request'])
    if result['summary']:
        result['summary'] = json.loads(result['summary'])
    return result


@router.get('')
def list_analyses(_user=Depends(current_user)):
    with connect() as db:
        ids = [row['id'] for row in db.execute('SELECT id FROM analyses ORDER BY created_at DESC')]
    return [read(ident) for ident in ids]


@router.get('/{ident}')
def status(ident: str, _user=Depends(current_user)):
    return read(ident)


@router.get('/{ident}/territorio')
def analysis_territory(ident: str, _user=Depends(current_user)):
    request = read(ident)['request']
    if 'ids' not in request:
        raise HTTPException(404, 'Esta análise não foi feita por setores.')
    return {'ids': request['ids'], 'fonte_malha': request['fonte_malha']}


@router.get('/{ident}/camadas/{layer}')
def layer(ident: str, layer: Literal['pontos','copas','pontos-todos','pontos-grupos','pontos-complementos'], _user=Depends(current_user)):
    record = read(ident)
    if record['state'] != 'concluida':
        raise HTTPException(409, 'O resultado ainda não está disponível.')
    path = RESULTS / ident / (layer + '.geojson')
    if not path.is_file():
        raise HTTPException(404, 'Esta análise não produziu essa camada.')
    return FileResponse(path, media_type='application/geo+json')
