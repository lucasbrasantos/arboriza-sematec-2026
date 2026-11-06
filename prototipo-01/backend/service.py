"""Dois perfis do mesmo experimento Cambridge, reutilizando uma instância CUDA."""
import json
from time import perf_counter

from .analysis import RECORTES, read_image, write_json
from .cambridge import analyze
from .detectree import CambridgeDetector
from .multiscale import aggregate, export, proposals

PROFILES = [
    {"id": "controle", "nome": "Controle · 200 m",
     "descricao": "Mesmo modelo Cambridge, com janelas de 200 m."},
    {"id": "multiescala", "nome": "Multiescala · experimental",
     "descricao": "Combina janelas de 200 e 100 m. Pode encontrar mais copas e gerar duplicações."},
]


class AnalysisService:
    def __init__(self):
        self.detector = None

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
