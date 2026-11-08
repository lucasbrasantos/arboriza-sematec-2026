"""Obtém e indexa eixos OSM para todos os setores urbanos; nenhuma ortofoto/GPU."""
import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from uuid import uuid4

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.street_catalog import DATABASE, ENDPOINT, build_catalog, query_for, query_identity
from backend.territory import Territory
from backend.urban_capture import atomic_json


def log(text):
    print(f'[{datetime.now().astimezone():%H:%M:%S}] {text}', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--atualizar', action='store_true', help='Consultar OSM novamente, substituindo o catálogo só ao concluir.')
    parser.add_argument('--endpoint', default=ENDPOINT)
    parser.add_argument('--destino', type=Path, default=DATABASE)
    args = parser.parse_args()
    territory = Territory()
    query, bounds = query_for(territory)
    identity = query_identity(query, territory.metadata['sha256_fonte'])
    folder = args.destino.parent
    folder.mkdir(parents=True, exist_ok=True)
    raw = folder/f'overpass-{identity}.json'
    manifest = folder/f'overpass-{identity}.metadata.json'
    started = perf_counter()
    log(f'{len(territory.ids)} setores urbanos; bbox de aquisição {bounds}; filtro espacial local de 50 m.')
    if raw.is_file() and manifest.is_file() and not args.atualizar:
        provenance = json.loads(manifest.read_text(encoding='utf-8'))
        if provenance['sha256_resposta'] != hashlib.sha256(raw.read_bytes()).hexdigest():
            raise ValueError('Resposta local alterada. Use --atualizar para buscar novamente.')
        log(f'Reutilizando resposta OSM local ({raw.stat().st_size/1024**2:.2f} MiB); sem rede.')
    else:
        temporary = raw.with_name(raw.name+'.'+uuid4().hex+'.part')
        try:
            log(f'Consultando {args.endpoint}; o servidor pode levar alguns instantes antes de enviar dados…')
            size, tick, digest = 0, perf_counter(), hashlib.sha256()
            with httpx.Client(timeout=httpx.Timeout(210, connect=20), follow_redirects=True,
                              headers={'User-Agent': 'Arboriza/0.2 (urban road catalogue; local research)'}) as client:
                with client.stream('POST', args.endpoint, data={'data': query}) as response:
                    response.raise_for_status()
                    with temporary.open('xb') as output:
                        for chunk in response.iter_bytes():
                            size += len(chunk)
                            if size > 128*1024**2:
                                raise ValueError('Resposta excedeu o limite de 128 MiB; acervo anterior preservado.')
                            output.write(chunk); digest.update(chunk)
                            if perf_counter()-tick >= 5:
                                log(f'Recebidos {size/1024**2:.2f} MiB'); tick = perf_counter()
            payload = json.loads(temporary.read_text(encoding='utf-8'))
            if payload.get('remark') or not isinstance(payload.get('elements'), list):
                raise ValueError('Overpass retornou aviso/resposta parcial. Nenhum catálogo foi substituído.')
            temporary.replace(raw)
            provenance = {'url_fonte': args.endpoint, 'consulta': query, 'bbox_consultada': bounds,
                          'coletado_em': datetime.now(timezone.utc).isoformat(), 'sha256_resposta': digest.hexdigest(),
                          'bytes_resposta': size, 'aquisicao_s': round(perf_counter()-started, 3)}
            atomic_json(manifest, provenance)
            log(f'Recebidos {size/1024**2:.2f} MiB, {len(payload["elements"])} vias; aquisição {provenance["aquisicao_s"]:.2f} s.')
        finally:
            temporary.unlink(missing_ok=True)
    payload = json.loads(raw.read_text(encoding='utf-8'))
    metadata = build_catalog(payload, territory, args.destino, provenance, log)
    atomic_json(folder/'manifesto.json', metadata)
    log(f'Banco: {args.destino}; {args.destino.stat().st_size/1024**2:.2f} MiB; total {perf_counter()-started:.2f} s.')


if __name__ == '__main__':
    try:
        main()
    except (httpx.HTTPError, ValueError, OSError) as error:
        log(f'ERRO: {error}. Catálogo publicado anteriormente preservado. Execute novamente para retomar.')
        raise SystemExit(1)
