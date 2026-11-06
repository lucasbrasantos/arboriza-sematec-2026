"""Carregamento local e inferência CUDA do Detectree2 com peso urbano Cambridge."""
import json
from pathlib import Path
from time import perf_counter

from .detector import ROOT, sha256


class CambridgeDetector:
    def __init__(self, min_score):
        import torch
        from detectron2 import _C
        from detectron2.engine import DefaultPredictor
        from detectree2.models.train import setup_cfg

        started = perf_counter()
        if not torch.cuda.is_available() or not _C.has_cuda():
            raise RuntimeError("Detectree2 exige CUDA; não há fallback automático para CPU.")
        self.manifest = json.loads(Path(__file__).with_name("cambridge-model.json").read_text())
        path = ROOT / ".models" / "detectree2" / self.manifest["file"]
        if not path.is_file() or sha256(path) != self.manifest["sha256"]:
            raise RuntimeError("Peso Cambridge ausente ou diferente do manifesto.")
        cfg = setup_cfg(update_model=str(path), workers=0, ims_per_batch=1,
                        backbone_freeze=2, warm_iter=184, gamma=.08866,
                        base_lr=.01709, weight_decay=.006519, batch_size_per_im=623,
                        out_dir=str(ROOT / ".cache" / "detectree2"))
        cfg.MODEL.DEVICE = "cuda"
        self.score_floor = min_score
        cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = min_score
        self.max_detections = cfg.TEST.DETECTIONS_PER_IMAGE
        self.config = cfg.dump()
        self.predictor = DefaultPredictor(cfg)
        self.last_input_shape = None
        def record_shape(model, args):
            self.last_input_shape = list(args[0][0]["image"].shape[-2:])
        self.predictor.model.register_forward_pre_hook(record_shape)
        torch.cuda.synchronize()
        self.load_seconds = perf_counter() - started
        self.device = {"name": torch.cuda.get_device_name(), "cuda": torch.version.cuda,
                       "capability": list(torch.cuda.get_device_capability()),
                       "free_mib_after_load": torch.cuda.mem_get_info()[0] / 2**20}

    def predict(self, rgb):
        import numpy as np
        import torch

        # DefaultPredictor recebe BGR, assim como os PNGs lidos por OpenCV no upstream.
        with torch.inference_mode():
            return self.predictor(np.ascontiguousarray(rgb[:, :, ::-1]))["instances"].to("cpu")
