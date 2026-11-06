"""API local: uma análise por vez; consultas e arquivos públicos continuam disponíveis."""
import logging
import traceback
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from functools import lru_cache
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
from .territory import DATA as TERRITORY_DATA, Territory


class Request(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recorte: Literal["centro", "centro-norte"]
    perfil: Literal["controle", "multiescala"] = "controle"
    score: float = Field(default=.15, ge=.05, le=1, allow_inf_nan=False)


class TerritoryDrawing(BaseModel):
    model_config = ConfigDict(extra="forbid")
    geometry: dict


class TerritorySelection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[str] = Field(max_length=5000)


class TerritoryBlockPlan(TerritorySelection):
    block_m: int = Field(ge=50, le=2000)


class SectorAnalysisRequest(TerritorySelection):
    fonte_malha: str = Field(min_length=1, max_length=128)
    score: float = Field(default=.15, ge=.05, le=1, allow_inf_nan=False)


def create_app(service=None, output=ROOT / "resultados" / "interface", territory_path=TERRITORY_DATA):
    service = service or AnalysisService()
    tasks, lock, pool = {}, Lock(), ThreadPoolExecutor(max_workers=1)
    active = None

    @asynccontextmanager
    async def lifespan(app):
        yield
        pool.shutdown(wait=True)

    app = FastAPI(title="Arboriza — Protótipo 01", lifespan=lifespan)

    @lru_cache(maxsize=1)
    def territory():
        try:
            return Territory(territory_path)
        except (OSError, KeyError, ValueError) as error:
            logging.warning("Malha territorial indisponível: %s", error)
            raise HTTPException(503, "Malha territorial indisponível. Prepare os setores do IBGE conforme o README.") from error

    @app.get("/api/territorio/setores")
    def territory_sectors():
        return territory().collection

    @app.post("/api/territorio/intersecoes")
    def territory_intersections(request: TerritoryDrawing):
        try:
            return {"ids": territory().intersect(request.geometry)}
        except ValueError as error:
            raise HTTPException(422, str(error)) from error

    @app.post("/api/territorio/resumo")
    def territory_summary(request: TerritorySelection):
        try:
            return territory().summary(request.ids)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error

    @app.post("/api/territorio/cobertura-local")
    def territory_local_coverage(request: TerritorySelection):
        from .coverage import local_coverage
        try:
            return local_coverage(territory(), request.ids, RECORTES)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error

    @app.post("/api/territorio/cobertura-por-setor")
    def territory_sector_coverage(request: TerritorySelection):
        from .coverage import coverage_by_sector
        try:
            return coverage_by_sector(territory(), request.ids, RECORTES)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error

    @app.post("/api/territorio/plano-blocos")
    def territory_block_plan(request: TerritoryBlockPlan):
        from .block_plan import plan_blocks
        try:
            return plan_blocks(territory(), request.ids, request.block_m)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error

    @app.post("/api/territorio/geojson")
    def territory_geojson(request: TerritorySelection):
        try:
            result = territory().summary(request.ids, include_geometry=True)
            if not result["geometry"]:
                raise ValueError("Selecione pelo menos um setor para exportar.")
            return {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {},
                                                                "geometry": result["geometry"]}],
                    "arboriza": {"fonte": territory().metadata, "setores": request.ids,
                                 "area_m2": result["area_m2"]}}
        except ValueError as error:
            raise HTTPException(422, str(error)) from error

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
            if isinstance(request, SectorAnalysisRequest):
                summary = service.run_sectors(territory(), request.ids, request.score, job["folder"], progress)
            else:
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

    def enqueue(request):
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

    @app.post("/api/analises", status_code=202)
    def start(request: Request):
        return enqueue(request)

    @app.post("/api/analises/setores", status_code=202)
    def start_sectors(request: SectorAnalysisRequest):
        current = territory()
        try:
            selected = current.selected(request.ids)
            if not selected:
                raise ValueError('Selecione ao menos um setor.')
            if request.fonte_malha != current.metadata['sha256_fonte']:
                raise ValueError('A malha territorial mudou; recarregue a página e refaça a seleção.')
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        return enqueue(request)

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
