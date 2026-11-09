"""Execução independente da API, com checkpoints atômicos por janela."""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from filelock import FileLock, Timeout
from shapely import STRtree, transform, union_all
from shapely.geometry import box, mapping, shape
from rasterio.features import geometry_mask

from ..core.config import RESULTS, DATA_DIR, BACKEND_DIR, MODELS_DIR
from ..core.processing import gpu_lock
from ..engine.geography.territory import Territory
from ..engine.imagery.urban_capture import atomic_json as _atomic_json
from ..engine.inference.fusion_engine import windows, mask_rows, CACHE
from . import storage

ROOT = RESULTS / 'base-urbana'
RUNNING = {'iniciando', 'processando'}


def atomic_json(path, data):
    # Windows pode bloquear replace por instantes enquanto API/antivírus lê o status.
    for attempt in range(12):
        try:
            return _atomic_json(path,data)
        except PermissionError:
            if attempt==11: raise
            time.sleep(.03*(attempt+1))


def now():
    return datetime.now(timezone.utc).isoformat()


def read_json(path, default=None):
    return json.loads(path.read_text(encoding='utf-8')) if path.is_file() else default


def folder(ident):
    if not re.fullmatch(r'\d{8}T\d{6}-[0-9a-f]{8}', ident):
        raise ValueError('Versão inválida da base urbana.')
    return ROOT / ident


def signature():
    paths = sorted((DATA_DIR/'ortofotos/acervo-urbano-25cm').glob('*.tif'))
    if not paths:
        raise ValueError('O acervo urbano local não está disponível.')
    inventory = [(str(p), p.stat().st_size, p.stat().st_mtime_ns) for p in paths]
    for p in [DATA_DIR/'territorial/setores-urbanos-aracatuba-ibge-2022.geojson',
              MODELS_DIR/'restor-tcd-r50/manifesto.json', MODELS_DIR/'restor-tcd-r50/config.yaml',
              MODELS_DIR/'restor-tcd-r50/model.pth', MODELS_DIR/'detectree2/urban_trees_Cambridge_20230630.pth']:
        inventory.append((str(p), p.stat().st_size, p.stat().st_mtime_ns))
    return hashlib.sha256(json.dumps([1, inventory]).encode()).hexdigest()


def status():
    pointer = read_json(ROOT/'current.json')
    state = read_json(folder(pointer['id'])/'estado.json') if pointer else None
    if state and state['state'] in RUNNING:
        try:
            with FileLock(str(ROOT/'worker.lock'), timeout=0):
                if time.time() - datetime.fromisoformat(state['updated_at']).timestamp() > 45:
                    state = {**state, 'state': 'interrompida', 'step': 'Processo interrompido; você pode retomar.'}
        except Timeout:
            pass
    published = read_json(ROOT/'published.json')
    return {'job': state, 'published': published}


def active():
    job = status()['job']
    return bool(job and job['state'] in RUNNING)


def launch(resume=False, ids=None):
    ROOT.mkdir(parents=True, exist_ok=True)
    with FileLock(str(ROOT/'launch.lock'), timeout=2):
        current = status()['job']
        if current and current['state'] in RUNNING:
            raise ValueError('A base urbana já está em processamento.')
        if resume:
            if not current or current['state'] not in ('pausada', 'erro', 'interrompida'):
                raise ValueError('Não há processamento interrompido para retomar.')
            ident = current['id']
            if read_json(folder(ident)/'pedido.json')['signature'] != signature():
                raise ValueError('As imagens ou os modelos mudaram. Inicie uma nova versão.')
        else:
            territory = Territory()
            chosen = sorted(ids or territory.ids)
            territory.selected(chosen)
            ident = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S-') + uuid4().hex[:8]
            target = folder(ident); target.mkdir()
            atomic_json(target/'pedido.json', {'ids': chosen, 'source': territory.metadata['sha256_fonte'],
                                               'score': .15, 'signature': signature(), 'created_at': now()})
        target = folder(ident)
        (target/'pausar').unlink(missing_ok=True)
        atomic_json(target/'estado.json', {**(current if resume else {}), 'id': ident, 'state': 'iniciando',
                    'step': 'Preparando processamento', 'updated_at': now(), 'eta_seconds': None})
        atomic_json(ROOT/'current.json', {'id': ident})
        try:
            with (target/'execucao.log').open('a', encoding='utf-8') as log:
                subprocess.Popen([sys.executable, '-u', '-m', 'arboriza_api.urban_base', '--run', ident],
                                 cwd=BACKEND_DIR, stdout=log, stderr=subprocess.STDOUT,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        except Exception as error:
            atomic_json(target/'estado.json', {'id': ident, 'state': 'erro', 'step': str(error), 'updated_at': now()})
            raise
        return ident


class Paused(Exception):
    pass


def run(ident):
    from ..engine.inference.fusion_engine import FusionModels, LocalImages
    target = folder(ident)
    request = read_json(target/'pedido.json')
    state = read_json(target/'estado.json', {})
    started = time.monotonic()
    prior_elapsed = state.get('elapsed_seconds', 0)
    last_write = [0.0]

    def progress(step, force=False, **patch):
        if (target/'pausar').exists():
            raise Paused()
        state.update(patch, state='processando', step=step, updated_at=now(),
                     elapsed_seconds=round(prior_elapsed + time.monotonic()-started, 1))
        if force or time.monotonic()-last_write[0] > 1:
            atomic_json(target/'estado.json', state)
            last_write[0] = time.monotonic()

    ROOT.mkdir(parents=True, exist_ok=True)
    db = None
    try:
        with FileLock(str(ROOT/'worker.lock'), timeout=0), gpu_lock():
            if signature() != request['signature']:
                raise ValueError('As entradas mudaram; inicie uma nova versão.')
            if shutil.disk_usage(target).free < 2*1024**3:
                raise ValueError('É necessário pelo menos 2 GiB livres para processar.')
            territory = Territory()
            sectors = {i: transform(territory.by_id[i], territory.project.transform, interleaved=False) for i in request['ids']}
            selection = union_all(list(sectors.values()))
            progress('Planejando janelas do acervo', force=True, sectors=len(sectors), eta_seconds=None)
            plan = []
            for engine,size in [('restor',512),('cambridge200',800),('cambridge100',400)]:
                grid = {(x,y):bounds for g in sectors.values() for x,y,bounds in windows(g,size)}
                plan.extend((engine,size,x,y,bounds) for (x,y),bounds in sorted(grid.items(),key=lambda p:(p[0][1],p[0][0])))
            geometries = list(sectors.values())
            sector_tree = STRtree(geometries)
            db = storage.connect(target/'catalogo.sqlite')
            done = {r[0] for r in db.execute('SELECT key FROM windows')}
            pending = [w for w in plan if f'{w[0]}:{w[2]}:{w[3]}' not in done]
            state.update(total=len(plan), completed=len(done), percent=85*len(done)/max(1,len(plan)))
            samples = {}
            if pending:
                progress('Carregando Restor + Cambridge na GPU', force=True)
                models = FusionModels()
                atomic_json(target/'modelos.json', models.manifest)
                images = LocalImages(sorted((DATA_DIR/'ortofotos/acervo-urbano-25cm').glob('*.tif')))
                CACHE.mkdir(parents=True, exist_ok=True)
                remaining_counts = Counter(w[0] for w in pending)
                def prepare(item):
                    engine,size,x,y,bounds = item
                    rgb, valid, affine, _ = images.read(bounds, size)
                    window = box(*bounds)
                    local_selection = union_all([geometries[int(i)] for i in sector_tree.query(window)])
                    required = geometry_mask([mapping(local_selection.intersection(window))], out_shape=valid.shape,
                                             transform=affine, invert=True)
                    if (required & ~valid).any():
                        raise ValueError(f'Imagem incompleta: {engine}/{x}/{y}. Complete o acervo antes de retomar.')
                    hasher = hashlib.sha256(rgb.tobytes()+valid.tobytes())
                    hasher.update(json.dumps([1,models.identity,engine,bounds],sort_keys=True).encode())
                    cache = CACHE/(hasher.hexdigest()+'.json')
                    hit = cache.is_file()
                    if not required.any():
                        rows = []
                    elif hit:
                        rows = [{**r,'geometry':shape(r['geometry'])} for r in read_json(cache)['rows']]
                    else:
                        rows = None
                    return item,rgb,valid,affine,cache,hit,rows

                last_completed = [time.monotonic()]
                def save(index, prepared, instances):
                    (engine,_,x,y,_),_,valid,affine,cache,hit,rows = prepared
                    if rows is None:
                        rows = mask_rows(instances,valid,affine,engine,f'{x}-{y}')
                        atomic_json(cache, {'rows':[{**r,'geometry':mapping(r['geometry'])} for r in rows],
                                            'deteccoes_brutas':len(instances),'limite_atingido':len(instances)>=512})
                    key = f'{engine}:{x}:{y}'
                    storage.insert_window(db,key,rows); done.add(key)
                    completed_at = time.monotonic()
                    history = samples.setdefault(engine,[]); history.append(completed_at-last_completed[0])
                    last_completed[0] = completed_at
                    history[:] = history[-50:]
                    # Cada motor tem seu ritmo; valores sem amostra usam a média observada.
                    means = {k:sum(v)/len(v) for k,v in samples.items()}
                    fallback = sum(means.values())/len(means)
                    remaining_counts[engine] -= 1
                    eta = sum(means.get(k,fallback)*n for k,n in remaining_counts.items()) if index>=4 else None
                    progress(f'{engine} · {len(done):,}/{len(plan):,} janelas', completed=len(done),
                             percent=85*len(done)/len(plan), eta_seconds=round(eta) if eta is not None else None,
                             cache_windows=state.get('cache_windows',0)+int(hit))
                    if index%100==0 and shutil.disk_usage(target).free < 1024**3:
                        raise ValueError('Espaço livre abaixo de 1 GiB. Libere espaço e retome.')

                # Pipeline limitado: uma leitura adiantada, uma inferência CUDA,
                # um escritor de máscaras. Mesmos pixels, modelos e regras.
                with ThreadPoolExecutor(max_workers=1) as reader, ThreadPoolExecutor(max_workers=1) as writer:
                    upcoming = reader.submit(prepare,pending[0])
                    previous = None
                    for index,item in enumerate(pending):
                        prepared = upcoming.result()
                        if index+1<len(pending):
                            upcoming = reader.submit(prepare,pending[index+1])
                        if (target/'pausar').exists():
                            if previous: previous.result()
                            raise Paused()
                        instances = models.predict(item[0],prepared[1]) if prepared[-1] is None else None
                        if previous: previous.result()
                        previous = writer.submit(save,index,prepared,instances)
                    if previous: previous.result()
                del models
                import gc, torch
                gc.collect(); torch.cuda.empty_cache()
            progress('Consolidando copas sem duplicações', force=True, percent=86, eta_seconds=None)
            storage.consolidate(db,selection,sectors,ident,request['score'],progress)
            progress('Calculando indicadores por setor', force=True, percent=91)
            features = [f for f in territory.features if str(f['id']) in sectors]
            summary = storage.statistics(db,sectors,features,ident,request['source'],progress)
            summary['base']['created_at'] = request['created_at']
            summary['base']['completed_at'] = now()
            progress('Preparando arquivos para exportação', force=True, percent=96)
            storage.export_files(db,target,summary['base'],progress)
            atomic_json(target/'setores.geojson',summary)
            state.update(state='concluida',step='Base pronta para publicação',percent=100,eta_seconds=0,
                         updated_at=now(),elapsed_seconds=round(prior_elapsed+time.monotonic()-started,1),
                         summary=summary['base'])
            atomic_json(target/'estado.json',state)
    except Paused:
        state.update(state='pausada',step='Pausada; progresso salvo',eta_seconds=None,updated_at=now())
        atomic_json(target/'estado.json',state)
    except Exception as error:
        import traceback
        traceback.print_exc()
        state.update(state='erro',step=str(error)[:600],eta_seconds=None,updated_at=now())
        atomic_json(target/'estado.json',state)
    finally:
        if db is not None:
            db.close()


def publish():
    job = status()['job']
    if not job or job['state'] != 'concluida':
        raise ValueError('A base precisa estar concluída antes de publicar.')
    summary = read_json(folder(job['id'])/'setores.geojson')
    if summary['base']['setores'] != len(Territory().ids):
        raise ValueError('Uma base parcial de teste não pode substituir a base urbana publicada.')
    value = {**summary['base'],'published_at':now()}
    # Snapshot leve versionável: o mapa continua pronto num novo clone, sem GPU.
    snapshot = BACKEND_DIR.parent/'frontend/public/data/base-urbana-aracatuba.geojson'
    snapshot.parent.mkdir(parents=True,exist_ok=True)
    atomic_json(snapshot,summary)
    atomic_json(ROOT/'published.json',value)
    return value
