"""Pesos locais, validação CUDA e inferência nativa do DeepForest."""
import hashlib
import json
import os
from pathlib import Path
from time import perf_counter

ROOT = Path(__file__).resolve().parents[1]
# Protótipo e API usam a mesma fonte de dados; modelos e ambientes continuam locais ao protótipo.
DATA_ROOT = Path(os.environ.get("ARBORIZA_DATA_DIR", ROOT.parent / "app" / "backend" / "data")).resolve()
MODEL_DIR = ROOT / ".models" / "deepforest-tree"
MANIFEST = Path(__file__).with_name("model.json")
MODEL_ID = "weecology/deepforest-tree"
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
os.environ.setdefault("TORCH_HOME", str(ROOT / ".cache" / "torch"))
os.environ.setdefault("MPLCONFIGDIR", str(ROOT / ".cache" / "matplotlib"))


def sha256(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def prepare():
    """Única operação com rede; reutiliza a revisão registrada, se existir."""
    from huggingface_hub import HfApi, snapshot_download
    from torch.hub import get_dir, load_state_dict_from_url
    from torchvision.models import ResNet50_Weights

    revision = (json.loads(MANIFEST.read_text())["revision"] if MANIFEST.exists()
                else HfApi().model_info(MODEL_ID).sha)
    snapshot_download(MODEL_ID, revision=revision, local_dir=MODEL_DIR,
                      allow_patterns=["config.json", "model.safetensors", "README.md"])
    # DeepForest 2.1 cria o backbone torchvision antes de carregar os pesos completos.
    url = ResNet50_Weights.IMAGENET1K_V1.url
    backbone = Path(get_dir()) / "checkpoints" / url.rsplit("/", 1)[1]
    load_state_dict_from_url(url, check_hash=True, progress=True)
    manifest = {
        "model_id": MODEL_ID, "revision": revision, "license": "MIT",
        "source": f"https://huggingface.co/{MODEL_ID}/tree/{revision}",
        "files": {name: sha256(MODEL_DIR / name)
                  for name in ["config.json", "model.safetensors"]},
        "backbone": {"url": url, "file": backbone.name, "sha256": sha256(backbone)},
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Pesos preparados: {revision}", flush=True)


class Detector:
    def __init__(self):
        import torch
        from torchvision.ops import nms

        started = perf_counter()
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA indisponível. Este experimento exige GPU; não usa CPU automaticamente.")
        # Executa kernels reais, incluindo o NMS usado pelo detector.
        probe = torch.ones((16, 16), device="cuda")
        _ = probe @ probe
        nms(torch.tensor([[0., 0., 2., 2.]], device="cuda"),
            torch.tensor([1.], device="cuda"), .5)
        if not MANIFEST.exists():
            raise FileNotFoundError("Prepare os pesos: python -m backend.detector")
        self.manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        for name, digest in self.manifest["files"].items():
            if sha256(MODEL_DIR / name) != digest:
                raise RuntimeError(f"Peso/configuração alterado: {name}. Prepare novamente os pesos.")
        backbone = Path(torch.hub.get_dir()) / "checkpoints" / self.manifest["backbone"]["file"]
        if sha256(backbone) != self.manifest["backbone"]["sha256"]:
            raise RuntimeError("Backbone local diferente do registrado. Prepare novamente os pesos.")
        os.environ["HF_HUB_OFFLINE"] = "1"
        from deepforest import main
        from omegaconf import OmegaConf

        self.model = main.deepforest(config_args={
            "model": {"name": str(MODEL_DIR), "revision": self.manifest["revision"]},
            "accelerator": "gpu", "devices": 1, "workers": 0, "batch_size": 1,
            "log_root": str(ROOT / ".cache" / "lightning"),
        })
        self.model.model.to("cuda").eval()
        self.config = OmegaConf.to_container(self.model.config, resolve=True)
        torch.cuda.synchronize()
        self.load_seconds = perf_counter() - started
        self.device = {"name": torch.cuda.get_device_name(),
                       "capability": list(torch.cuda.get_device_capability()),
                       "cuda": torch.version.cuda,
                       "total_mib": torch.cuda.get_device_properties(0).total_memory / 2**20}

    def predict(self, rgb, patch_size):
        import torch

        torch.cuda.synchronize()
        torch.cuda.reset_peak_memory_stats()
        started = perf_counter()
        with torch.inference_mode():
            # A implementação 2.1 usa RGB, apesar do docstring antigo mencionar BGR.
            result = self.model.predict_tile(image=rgb, patch_size=patch_size,
                                             patch_overlap=.25, dataloader_strategy="single")
        torch.cuda.synchronize()
        metrics = {"inference_seconds": perf_counter() - started,
                   "peak_allocated_mib": torch.cuda.max_memory_allocated() / 2**20,
                   "peak_reserved_mib": torch.cuda.max_memory_reserved() / 2**20}
        boxes = [] if result is None else result[
            ["xmin", "ymin", "xmax", "ymax", "score"]].to_dict("records")
        return boxes, metrics


if __name__ == "__main__":
    prepare()
