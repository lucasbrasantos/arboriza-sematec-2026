"""Ponto de entrada da API do produto."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from filelock import FileLock, Timeout
from .analyses import router as analyses
from .analyses import workspace
from .access import auth
from .streets import router as streets
from .territory import router as territory
from .imagery import router as imagery
from .core.config import DATABASE, DATA_DIR, MODELS_DIR
from .core.database import initialize


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app):
        DATABASE.parent.mkdir(parents=True, exist_ok=True)
        process_lock = FileLock(str(DATABASE) + '.api.lock')
        try:
            process_lock.acquire(timeout=0)
        except Timeout as error:
            raise RuntimeError('Já existe uma instância da API usando este banco.') from error
        try:
            initialize()
            analyses.start_worker()
            try:
                yield
            finally:
                analyses.stop_worker()
        finally:
            process_lock.release()

    app = FastAPI(title="Arboriza API", version="0.1.0", lifespan=lifespan)
    app.include_router(auth.router)
    app.include_router(auth.users_router)
    app.include_router(territory.router)
    app.include_router(analyses.router)
    app.include_router(workspace.router)
    app.include_router(streets.router)
    app.include_router(imagery.router)

    @app.get("/api/health")
    def health():
        return {
            "status": "ok",
            "dados_disponiveis": DATA_DIR.is_dir(),
            "modelos_disponiveis": {
                "cambridge": (MODELS_DIR / 'detectree2' / 'urban_trees_Cambridge_20230630.pth').is_file(),
                "restor": (MODELS_DIR / 'restor-tcd-r50' / 'model.pth').is_file(),
            },
        }

    return app


app = create_app()
