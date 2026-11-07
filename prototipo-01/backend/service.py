"""Perfis Cambridge e fusão, com fontes explícitas e instâncias CUDA reutilizadas."""
import json
from time import perf_counter

from .analysis import RECORTES, read_image, write_json
from .cambridge import analyze
from .detectree import CambridgeDetector
from .multiscale import aggregate, export, proposals


def recorte_footprint(path):
    from shapely import segmentize
    from .coverage import valid_footprint
    info = path.stat()
    # A borda geográfica vira uma curva na projeção métrica. Densificar evita
    # incluir pixels fora do raster por uma aproximação de apenas quatro vértices.
    return segmentize(valid_footprint(str(path), info.st_size, info.st_mtime_ns), .00001)


PROFILES = [
    {"id": "controle", "nome": "Controle · 200 m",
     "descricao": "Controle atual preservado: GeoTIFF original nos recortes; cache WMS com download quando necessário nos setores. Janelas de 200 m."},
    {"id": "controle-datageo", "nome": "Controle · DataGEO direto",
     "descricao": "Cambridge em 200 m, buscando cada janela novamente no DataGEO, sem consultar nem preencher o cache. Compare com Controle · Acervo local."},
    {"id": "controle-local", "nome": "Controle · Acervo local",
     "descricao": "Mesmo modelo, janelas e parâmetros de Controle · DataGEO direto, lendo somente o novo acervo urbano de 25 cm, sem rede."},
    {"id": "multiescala", "nome": "Multiescala · experimental",
     "descricao": "Combina janelas de 200 e 100 m. Pode encontrar mais copas e gerar duplicações."},
    {"id": "fusao", "nome": "Restor + Cambridge · experimental",
     "descricao": "Copas e pontos vinculados; grupos e complementos separados. Restor em 0,50; este corte ajusta Cambridge. Usa somente imagens locais a 25 cm."},
]


class AnalysisService:
    def __init__(self):
        self.detector = None
        self.fusion = None

    def run_fusion(self, geometry, score, folder, progress, sectors=None, paths=None):
        from .fusion_engine import FusionModels, LocalImages, run_fusion
        if self.fusion is None:
            progress('Conferindo pesos e carregando Restor + Cambridge na GPU')
            self.fusion = FusionModels()
        return run_fusion(self.fusion, geometry, folder, score, progress, LocalImages(paths), sectors)

    def run_fusion_sectors(self, territory, ids, score, folder, progress):
        from shapely import transform, union_all
        geometries = territory.selected(ids)
        projected = [transform(g, territory.project.transform, interleaved=False) for g in geometries]
        result = self.run_fusion(union_all(projected), score, folder, progress, dict(zip(ids, projected)))
        result.update(ids_setores=list(ids), setores=len(ids), fonte_malha=territory.metadata['sha256_fonte'])
        write_json(folder/'resumo.json', result)
        return result

    def run_control_source(self, territory, ids, score, folder, progress, perfil):
        from .control_sources import LocalControlSource, direct_datageo
        from .sector_analysis import run_sector_analysis
        loaded_now = self.detector is None
        tick = perf_counter()
        if loaded_now:
            progress('Conferindo pesos e carregando Cambridge na GPU')
            self.detector = CambridgeDetector(.05)
        load_seconds = perf_counter()-tick if loaded_now else 0
        progress('Preparando acervo local' if perfil == 'controle-local' else 'Preparando download direto, sem cache')
        provider = LocalControlSource() if perfil == 'controle-local' else direct_datageo
        if perfil == 'controle-local':
            progress(f'Acervo indexado: {len(provider.images.sources)} blocos; '
                     f'{provider.images.metadata_opens} metadados atualizados')
        result = run_sector_analysis(self.detector, territory, ids, score, folder, progress,
                                     image_provider=provider, profile=perfil, metric_grid=True)
        result.update(fonte_imagens='acervo_local' if perfil == 'controle-local' else 'datageo_direto_sem_cache',
                      modelo_carregado_agora=loaded_now, carregamento_modelo_s=load_seconds,
                      max_deteccoes=self.detector.max_detections, peso_sha256=self.detector.manifest['sha256'])
        if perfil == 'controle-local':
            result.update(indexacao_acervo_s=provider.images.index_seconds,
                          metadados_acervo_atualizados=provider.images.metadata_opens)
        (folder/'configuracao_controle.yaml').write_text(self.detector.config, encoding='utf-8')
        write_json(folder/'resumo.json', result)
        return result

    def run_sectors(self, territory, ids, score, folder, progress):
        from .sector_analysis import run_sector_analysis
        loaded_now = self.detector is None
        started = perf_counter()
        if loaded_now:
            progress('Conferindo pesos e carregando Cambridge na GPU')
            self.detector = CambridgeDetector(.05)
        load_seconds = perf_counter() - started if loaded_now else 0
        result = run_sector_analysis(self.detector, territory, ids, score, folder, progress)
        result.update(modelo_carregado_agora=loaded_now, carregamento_modelo_s=load_seconds)
        write_json(folder / 'resumo.json', result)
        return result

    def run(self, recorte, perfil, score, folder, progress):
        if perfil in ('controle-local', 'controle-datageo'):
            from types import SimpleNamespace
            from pyproj import Transformer
            geometry = recorte_footprint(RECORTES[recorte])
            region = SimpleNamespace(selected=lambda _: [geometry],
                                     project=Transformer.from_crs(4326, 31982, always_xy=True),
                                     metadata={'sha256_fonte': 'recorte:' + recorte})
            result = self.run_control_source(region, [recorte], score, folder, progress, perfil)
            for key in ('ids_setores', 'setores', 'fonte_malha'):
                result.pop(key, None)
            result.update(recorte=recorte, tipo_area='recorte')
            write_json(folder/'resumo.json', result)
            return result
        if perfil == 'fusao':
            from pyproj import Transformer
            from shapely import transform
            path = RECORTES[recorte]
            selected = recorte_footprint(path)
            geometry = transform(selected, Transformer.from_crs(4326, 31982, always_xy=True).transform, interleaved=False)
            return self.run_fusion(geometry, score, folder, progress, paths=[path])
        loaded_now = self.detector is None
        load_started = perf_counter()
        if loaded_now:
            progress("Conferindo pesos e carregando Cambridge na GPU")
            self.detector = CambridgeDetector(.05)
        load_seconds = perf_counter() - load_started if loaded_now else 0
        sizes = (200,) if perfil == "controle" else (200, 100)
        reports = {size: analyze(self.detector, recorte, size, .25, .5, [score], folder, progress)
                   for size in sizes}
        report = reports[200]
        if perfil == "controle":
            result = report["exports"][0]
        else:
            progress("Combinando escalas e removendo sobreposições")
            tick = perf_counter()
            base, rejected = aggregate(proposals(report, 200, folder), containment=None)
            kept, extra = aggregate(proposals(reports[100], 100, folder), anchors=base, containment=None)
            rgb, _, affine, crs, _ = read_image(RECORTES[recorte])
            result = export(recorte, "200m-mais-100m-iou", kept, rejected + extra,
                            report, rgb, affine, crs, folder, perf_counter()-tick, score)
        progress("Salvando pontos e resumo")
        points = json.loads((folder / result["file"]).read_text(encoding="utf-8"))
        for feature in points["features"]:
            feature["properties"].update(perfil=perfil, corte_score=score, analise_id=folder.name)
        write_json(folder / "pontos.geojson", points)
        summary = {"candidatos": len(points["features"]), "modelo": report["model"]["model_id"],
                   "modelo_carregado_agora": loaded_now,
                   "carregamento_modelo_s": load_seconds,
                   "pico_vram_mib": max(r["timing"]["peak_allocated_mib"] for r in reports.values()),
                   "janelas_m": list(sizes), "sobreposicao": .25,
                   "deduplicacao": "caixas_iou_0.5" if perfil == "controle" else "mascaras_iou_0.5_sem_contencao"}
        write_json(folder / "resumo.json", summary)
        return summary


if __name__ == "__main__":
    import argparse
    from datetime import datetime, timezone
    from uuid import uuid4
    from .detector import ROOT

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recorte", choices=RECORTES, required=True)
    parser.add_argument("--perfil", choices=[p["id"] for p in PROFILES], default="controle")
    parser.add_argument("--score", type=float, default=.15)
    args = parser.parse_args()
    if not .05 <= args.score <= 1:
        parser.error("Use score entre 0.05 e 1.")
    folder = ROOT / "resultados" / "comando" / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ-") + uuid4().hex[:8])
    folder.mkdir(parents=True)
    write_json(folder / "parametros.json", vars(args))
    print(json.dumps(AnalysisService().run(args.recorte, args.perfil, args.score, folder, print), indent=2))
    print(f"Resultados: {folder}")
