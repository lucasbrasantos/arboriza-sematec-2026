"""API local: uma análise por vez; consultas e arquivos públicos continuam disponíveis."""
import logging
import traceback
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from time import perf_counter
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

from .analysis import RECORTES, write_json
from .detector import ROOT
from .service import AnalysisService, PROFILES


class Request(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recorte: Literal["centro", "centro-norte"]
    perfil: Literal["controle", "multiescala"] = "controle"
    score: float = Field(default=.15, ge=.05, le=1, allow_inf_nan=False)


def create_app(service=None, output=ROOT / "resultados" / "interface"):
    service = service or AnalysisService()
    tasks, lock, pool = {}, Lock(), ThreadPoolExecutor(max_workers=1)
    active = None

    @asynccontextmanager
    async def lifespan(app):
        yield
        pool.shutdown(wait=True)

    app = FastAPI(title="Arboriza — Protótipo 01", lifespan=lifespan)

    def snapshot(ident):
        with lock:
            if ident not in tasks:
                raise HTTPException(404, "Análise não encontrada nesta execução do servidor.")
            job = tasks[ident]
            return {**{k: v for k, v in job.items() if k not in ("folder", "started")},
                    "duracao_s": job.get("duracao_s", perf_counter() - job["started"])}

    def work(ident, request):
        nonlocal active
        job = tasks[ident]
        def progress(step):
            with lock:
                job.update(estado="processando", etapa=step)
        try:
            progress("Preparando análise")
            summary = service.run(request.recorte, request.perfil, request.score, job["folder"], progress)
            with lock:
                job.update(estado="concluida", etapa="Concluída", resumo=summary)
        except Exception as error:
            logging.exception("Falha na análise %s", ident)
            with lock:
                job.update(estado="erro", etapa="Análise interrompida", erro=str(error)[:600])
            try:
                (job["folder"] / "erro.log").write_text(traceback.format_exc(), encoding="utf-8")
            except OSError:
                logging.exception("Não foi possível gravar o diagnóstico %s", ident)
        finally:
            with lock:
                job["duracao_s"] = perf_counter() - job["started"]
            try:
                write_json(job["folder"] / "execucao.json", snapshot(ident))
            except OSError:
                logging.exception("Não foi possível gravar o estado %s", ident)
            finally:
                with lock:
                    active = None

    @app.get("/api/recortes")
    def recortes():
        import rasterio
        from rasterio.warp import transform_bounds
        items = []
        for ident, path in RECORTES.items():
            item = {"id": ident, "nome": "Centro" if ident == "centro" else "Centro-norte",
                    "disponivel": path.is_file()}
            if path.is_file():
                with rasterio.open(path) as src:
                    west, south, east, north = transform_bounds(src.crs, "EPSG:4326", *src.bounds)
                item["bounds"] = [[south, west], [north, east]]
            items.append(item)
        return {"recortes": items, "perfis": PROFILES, "score_padrao": .15, "score_minimo": .05}

    @app.post("/api/analises", status_code=202)
    def start(request: Request):
        nonlocal active
        with lock:
            if active is not None:
                raise HTTPException(409, "Há uma análise em andamento. Aguarde a conclusão.")
            ident = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ-") + uuid4().hex[:8]
            folder = Path(output) / ident
            folder.mkdir(parents=True, exist_ok=False)
            tasks[ident] = {"id": ident, **request.model_dump(), "estado": "pendente", "etapa": "Aguardando execução",
                            "criada_em": datetime.now(timezone.utc).isoformat(), "started": perf_counter(), "folder": folder}
            active = ident
            pool.submit(work, ident, request)
        return {"analysis_id": ident}

    @app.get("/api/analises/{ident}")
    def status(ident: str):
        return snapshot(ident)

    @app.get("/api/analises/{ident}/geojson")
    def geojson(ident: str):
        if snapshot(ident)["estado"] != "concluida":
            raise HTTPException(409, "O resultado ainda não está disponível.")
        return FileResponse(tasks[ident]["folder"] / "pontos.geojson", media_type="application/geo+json")

    app.mount("/", StaticFiles(directory=ROOT / "frontend", html=True), name="interface")
    return app
