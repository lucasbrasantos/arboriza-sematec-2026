"""Exclusão entre os processos que usam os modelos CUDA."""
from filelock import FileLock
from .config import CACHE_DIR


def gpu_lock():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return FileLock(str(CACHE_DIR / 'processamento-gpu.lock'))
