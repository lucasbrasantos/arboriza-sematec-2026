"""Caminhos locais da API, configuráveis sem depender do diretório atual."""
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parents[1]
DATA_DIR = Path(os.environ.get('ARBORIZA_DATA_DIR', BACKEND_DIR / 'data')).resolve()
DATABASE = Path(os.environ.get('ARBORIZA_DATABASE', BACKEND_DIR / 'banco' / 'arboriza.sqlite')).resolve()
RESULTS = Path(os.environ.get('ARBORIZA_RESULTS_DIR', BACKEND_DIR / 'resultados')).resolve()
MODELS_DIR = Path(os.environ.get('ARBORIZA_MODELS_DIR', BACKEND_DIR / 'modelos')).resolve()
CACHE_DIR = Path(os.environ.get('ARBORIZA_CACHE_DIR', BACKEND_DIR / 'cache')).resolve()
