"""Operação administrativa e leitura pública da base explicitamente publicada."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from typing import Literal
from ..access.auth import admin
from ..core.database import connect
from ..core.config import BACKEND_DIR
from ..analyses import router as analyses
from . import jobs

router = APIRouter(prefix='/api/base-urbana',tags=['Base urbana'])


@router.get('/status')
def status(_admin=Depends(admin)):
    return jobs.status()


@router.post('/{action}')
def operate(action: Literal['iniciar','retomar','pausar','publicar'], _admin=Depends(admin)):
    try:
        with analyses.lock:
            if action == 'pausar':
                state = jobs.status()['job']
                if not state or state['state'] not in jobs.RUNNING:
                    raise ValueError('Não há processamento em andamento.')
                (jobs.folder(state['id'])/'pausar').touch()
                return {'id':state['id']}
            if action == 'publicar':
                return jobs.publish()
            with connect() as db:
                if db.execute("SELECT 1 FROM analyses WHERE state IN ('pendente','processando')").fetchone():
                    raise ValueError('Aguarde a análise atual terminar antes de atualizar a base.')
            # Libera modelos mantidos pela API antes de carregar o processo independente.
            analyses.service = None
            import gc, sys
            gc.collect()
            if 'torch' in sys.modules:
                sys.modules['torch'].cuda.empty_cache()
            return {'id':jobs.launch(resume=action=='retomar')}
    except (ValueError, OSError) as error:
        raise HTTPException(409,str(error)) from error


@router.get('/publicada')
def published():
    pointer = jobs.read_json(jobs.ROOT/'published.json')
    if not pointer:
        snapshot = BACKEND_DIR.parent/'frontend/public/data/base-urbana-aracatuba.geojson'
        if snapshot.is_file():
            return FileResponse(snapshot,media_type='application/geo+json',headers={'Cache-Control':'no-cache'})
        return JSONResponse({'type':'FeatureCollection','features':[],'base':None},headers={'Cache-Control':'no-cache'})
    return FileResponse(jobs.folder(pointer['id'])/'setores.geojson',media_type='application/geo+json',headers={'Cache-Control':'no-cache'})


@router.get('/exportar/{kind}')
def export(kind: Literal['pontos','copas','geopackage']):
    pointer = jobs.read_json(jobs.ROOT/'published.json')
    if not pointer:
        downloads = jobs.read_json(BACKEND_DIR.parent/'frontend/public/data/base-urbana-downloads.json',{})
        if kind in downloads:
            return RedirectResponse(downloads[kind],status_code=307)
        raise HTTPException(404,'Ainda não há base urbana publicada.')
    name = 'aracatuba.gpkg' if kind=='geopackage' else kind+'.geojson'
    return FileResponse(jobs.folder(pointer['id'])/name,filename='arboriza-aracatuba-'+name)
