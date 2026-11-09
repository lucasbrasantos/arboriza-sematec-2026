"""Conclusão local da execução autorizada: validar, publicar, testar e enviar.

É iniciado explicitamente com --manifest, após revisão do código. Não é executado
pelo servidor nem por um usuário comum. Não usa IA ou tokens. Para antes do envio
se a branch, o commit inicial ou qualquer arquivo revisado mudar.
"""
import argparse
import ctypes
import gzip
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import time
import urllib.parse
from ctypes import wintypes

PROJECT = Path(__file__).resolve().parents[1]
BACKEND = PROJECT/'app/backend'
sys.path.insert(0,str(BACKEND))
from arboriza_api.urban_base import jobs
from arboriza_api.engine.geography.territory import Territory
from arboriza_api.urban_base.storage import from_wkb


def checksum(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()


def command(args,cwd=PROJECT):
    subprocess.run(args,cwd=cwd,check=True,env={**os.environ,'GIT_TERMINAL_PROMPT':'0','GCM_INTERACTIVE':'Never'})


def git(*args):
    return subprocess.check_output(['git',*args],cwd=PROJECT,text=True).strip()


def resources(target):
    class Memory(ctypes.Structure):
        _fields_=[('length',wintypes.DWORD),('load',wintypes.DWORD)]+[(n,ctypes.c_ulonglong) for n in
                  ['total','available','page_total','page_available','virtual_total','virtual_available','extended']]
    sample={'at':jobs.now(),'disk_free_gb':round(shutil.disk_usage(target).free/1024**3,2)}
    if os.name=='nt':
        memory=Memory();memory.length=ctypes.sizeof(memory)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(memory)):
            sample.update(ram_percent=memory.load,ram_available_gb=round(memory.available/1024**3,2))
        times=[wintypes.FILETIME() for _ in range(3)]
        if ctypes.windll.kernel32.GetSystemTimes(*(ctypes.byref(t) for t in times)):
            idle,kernel,user=[(t.dwHighDateTime<<32)+t.dwLowDateTime for t in times]
            previous=getattr(resources,'previous',None)
            total=kernel+user
            if previous and total>previous[1]: sample['cpu_percent']=round(100*(1-(idle-previous[0])/(total-previous[1])),1)
            resources.previous=(idle,total)
    if shutil.which('nvidia-smi'):
        query=subprocess.run(['nvidia-smi','--query-gpu=temperature.gpu,utilization.gpu,memory.used,memory.total,power.draw',
                              '--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=15)
        if query.returncode==0:
            values=query.stdout.strip().splitlines()[0].split(',')
            sample.update(dict(zip(['gpu_c','gpu_percent','vram_mb','vram_total_mb','gpu_watts'],[float(v.strip()) for v in values])))
    with (target/'recursos.jsonl').open('a',encoding='utf-8') as log: log.write(json.dumps(sample)+'\n')
    if sample.get('gpu_c',0)>=85 or sample.get('ram_available_gb',64)<3 or sample['disk_free_gb']<1:
        (target/'pausar').touch()
        raise RuntimeError('Pausa preventiva de recursos; consulte recursos.jsonl')
    return sample


def validate(target):
    summary=jobs.read_json(target/'setores.geojson')
    territory=Territory()
    ids=[str(f['id']) for f in summary['features']]
    assert len(ids)==len(set(ids))==len(territory.ids) and set(ids)==set(territory.ids),'Malha incompleta'
    assert summary['base']['fonte_malha']==territory.metadata['sha256_fonte'],'Malha alterada'
    for f in summary['features']:
        p=f['properties']
        assert p['status']=='concluido' and p['area_m2']>0
        assert 0<=p['cobertura']<=100 and 0<=p['copas_m2']<=p['area_m2']+.01
    assert sum(f['properties']['individuos'] for f in summary['features'])==summary['base']['individuos']
    with sqlite3.connect(f'file:{(target/"catalogo.sqlite").as_posix()}?mode=ro',uri=True) as db:
        assert db.execute('PRAGMA quick_check').fetchone()[0]=='ok'
        count=db.execute('SELECT count(*) FROM final').fetchone()[0]
        assert db.execute("SELECT count(*) FROM final WHERE kind='copa_individual'").fetchone()[0]==summary['base']['individuos']
        for geometry, in db.execute('SELECT geometry FROM final'):
            g=from_wkb(geometry)
            assert g.is_valid and not g.is_empty
    import fiona
    for layer in ['pontos','copas']:
        with fiona.open(target/'aracatuba.gpkg',layer=layer) as collection:
            assert len(collection)==count,(layer,'GeoPackage incompleto')
        with fiona.open(target/(layer+'.geojson')) as collection:
            assert len(collection)==count,(layer,'GeoJSON incompleto')
    print('Artefatos validados:',len(ids),'setores;',count,'registros;',summary['base']['individuos'],'indivíduos',flush=True)
    return summary


def release(repo,tag,commit,files):
    import httpx
    auth=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',
                        text=True,capture_output=True,check=True,
                        env={**os.environ,'GIT_TERMINAL_PROMPT':'0','GCM_INTERACTIVE':'Never'})
    credentials=dict(line.split('=',1) for line in auth.stdout.splitlines() if '=' in line)
    token=credentials.get('password')
    if not token: raise RuntimeError('Credencial GitHub indisponível para anexar a base.')
    # A credencial permanece somente em memória; nunca é escrita em logs/arquivos.
    with httpx.Client(headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json'},timeout=120) as client:
        base=f'https://api.github.com/repos/{repo}'
        response=client.get(base+'/releases/tags/'+tag)
        if response.status_code==404:
            response=client.post(base+'/releases',json={'tag_name':tag,'target_commitish':commit,
                'name':'Base urbana V2 · Araçatuba','body':'Base automática dos 499 setores urbanos. Indivíduos e grupos separados; complementos pendentes excluídos da cobertura. Resultados preliminares para revisão técnica.'})
        response.raise_for_status(); record=response.json()
        existing={a['name']:a for a in record.get('assets',[])}
        for file in files:
            if file.name in existing:
                assert existing[file.name]['size']==file.stat().st_size,'Anexo existente difere da base local'
                continue
            assert file.stat().st_size<2*1024**3,'Anexo maior que o limite do GitHub'
            url=record['upload_url'].split('{')[0]+'?name='+urllib.parse.quote(file.name)
            with file.open('rb') as stream:
                result=client.post(url,content=iter(lambda:stream.read(1024*1024),b''),
                                   headers={'Content-Type':'application/octet-stream','Content-Length':str(file.stat().st_size)},timeout=3600)
            result.raise_for_status()
            print('Anexo enviado:',file.name,file.stat().st_size,flush=True)
        return record['html_url']


def main(manifest_path):
    config=json.loads(manifest_path.read_text(encoding='utf-8'))
    target=jobs.folder(config['job_id'])
    report=target/'finalizacao.json'
    def note(stage,**extra):
        jobs.atomic_json(report,{'stage':stage,'updated_at':jobs.now(),**extra})
        print(jobs.now(),stage,flush=True)
    if os.name=='nt':
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000001)
    try:
        note('Aguardando processamento local')
        while True:
            resources(target)
            state=jobs.read_json(target/'estado.json')
            if state['state']=='concluida': break
            if state['state'] not in jobs.RUNNING:
                raise RuntimeError('Processamento não concluído: '+state['state']+' · '+state['step'])
            time.sleep(30)
        note('Validando arquivos e estatísticas')
        summary=validate(target)
        assert git('branch','--show-current')==config['branch'],'A branch mudou; envio cancelado'
        assert git('rev-parse','HEAD')==config['head'],'O commit inicial mudou; envio cancelado'
        assert not git('diff','--cached','--name-only'),'Há alterações alheias já preparadas'
        for name,expected in config['files'].items():
            assert checksum(PROJECT/name)==expected,'Arquivo mudou após revisão: '+name
        note('Executando testes finais')
        command([sys.executable,'-B','-W','ignore','-m','unittest','discover','-s','tests'],BACKEND)
        node=shutil.which('node'); npm=Path(shutil.which('npm')).parent/'node_modules/npm/bin/npm-cli.js'
        command([node,str(npm),'run','lint'],PROJECT/'app/frontend')
        command([node,str(npm),'run','build'],PROJECT/'app/frontend')
        note('Publicando snapshot permanente')
        jobs.publish()
        tag='base-urbana-'+config['job_id']
        downloads={kind:f'https://github.com/{config["repo"]}/releases/download/{tag}/{name}'
                   for kind,name in [('pontos','pontos.geojson.gz'),('copas','copas.geojson.gz'),('geopackage','aracatuba.gpkg')]}
        downloads_path=PROJECT/'app/frontend/public/data/base-urbana-downloads.json'
        jobs.atomic_json(downloads_path,downloads)
        artifacts=[]
        for name in ['pontos.geojson','copas.geojson']:
            output=target/(name+'.gz')
            with (target/name).open('rb') as source,gzip.open(output,'wb',compresslevel=4) as dest:
                shutil.copyfileobj(source,dest)
            artifacts.append(output)
        artifacts.extend([target/'aracatuba.gpkg',target/'setores.geojson'])
        generated=['app/frontend/public/data/base-urbana-aracatuba.geojson','app/frontend/public/data/base-urbana-downloads.json']
        dist=PROJECT/'app/frontend/dist/data'
        if dist.is_dir():
            for name in generated: shutil.copy2(PROJECT/name,dist/Path(name).name)
        paths=list(config['files'])+generated
        command(['git','diff','--check'])
        command(['git','add','--',*paths])
        command(['git','commit','-m','feat: adiciona base urbana V2 permanente e comparação por setores'])
        commit=git('rev-parse','HEAD')
        note('Enviando código e resumo ao GitHub',commit=commit)
        command(['git','push','origin',f'HEAD:{config["branch"]}'])
        note('Anexando arquivos completos ao GitHub',commit=commit)
        url=release(config['repo'],tag,commit,artifacts)
        note('concluido',commit=commit,release=url,summary=summary['base'],
             arquivos={p.name:p.stat().st_size for p in artifacts})
    except Exception as error:
        note('erro',error=str(error))
        raise
    finally:
        if os.name=='nt': ctypes.windll.kernel32.SetThreadExecutionState(0x80000000)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest',type=Path,required=True)
    main(parser.parse_args().manifest.resolve())
