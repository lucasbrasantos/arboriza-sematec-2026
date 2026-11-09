"""Restor TCD R50 com revisão e hashes fixos; inferência exclusivamente CUDA."""
import hashlib
import json
from pathlib import Path
from time import perf_counter
from uuid import uuid4

from .detector import MODELS_DIR, sha256

MODEL = 'restor/tcd-mask-rcnn-r50'
REVISION = '0b4a94d7c81d319826b79ad1868733ae869a1141'
WEIGHT_SHA = '5c33e18df30ef39de2f9f4b309e1e63f7a351e63a930721e50ffda0efe5b19db'
DIRECTORY = MODELS_DIR / 'restor-tcd-r50'


def prepare():
    import httpx
    DIRECTORY.mkdir(parents=True, exist_ok=True)
    manifest = {'model_id': MODEL, 'revision': REVISION, 'license': 'CC-BY-NC', 'files': {}}
    with httpx.Client(timeout=httpx.Timeout(60, connect=15), follow_redirects=True) as client:
        for name in ('config.yaml', 'model.pth'):
            path = DIRECTORY / name
            if name == 'model.pth' and path.is_file() and sha256(path) == WEIGHT_SHA:
                manifest['files'][name] = WEIGHT_SHA
                continue
            url = f'https://huggingface.co/{MODEL}/resolve/{REVISION}/{name}'
            temp = path.with_name(path.name + '.' + uuid4().hex + '.part')
            try:
                hasher, size, tick = hashlib.sha256(), 0, perf_counter()
                with client.stream('GET', url) as response:
                    response.raise_for_status()
                    with temp.open('xb') as stream:
                        for chunk in response.iter_bytes():
                            stream.write(chunk); hasher.update(chunk); size += len(chunk)
                            if perf_counter()-tick >= 10:
                                print(f'{name}: {size/1024**2:.1f} MiB recebidos', flush=True); tick = perf_counter()
                checksum = hasher.hexdigest()
                if name == 'model.pth' and checksum != WEIGHT_SHA:
                    raise ValueError('Hash do peso Restor diferente da revisão oficial fixada.')
                temp.replace(path)
                manifest['files'][name] = checksum
            finally:
                temp.unlink(missing_ok=True)
    (DIRECTORY / 'manifesto.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f'Restor preparado em {DIRECTORY}', flush=True)


class RestorDetector:
    def __init__(self):
        import torch
        from detectron2 import _C
        from detectron2.config import get_cfg
        from detectron2.modeling import build_model
        if not torch.cuda.is_available() or not _C.has_cuda():
            raise RuntimeError('A fusão exige CUDA; não há fallback automático para CPU.')
        path = DIRECTORY / 'manifesto.json'
        if not path.is_file():
            raise FileNotFoundError('Pesos Restor ausentes no diretório de modelos do backend.')
        self.manifest = json.loads(path.read_text(encoding='utf-8'))
        if (self.manifest.get('revision') != REVISION
                or self.manifest.get('files', {}).get('model.pth') != WEIGHT_SHA):
            raise ValueError('Manifesto Restor incompatível com a revisão esperada.')
        for name in ('config.yaml', 'model.pth'):
            if sha256(DIRECTORY / name) != self.manifest['files'].get(name):
                raise ValueError(f'Artefato Restor alterado: {name}')
        cfg = get_cfg(); cfg.set_new_allowed(True)
        cfg.merge_from_file(str(DIRECTORY / 'config.yaml'))
        cfg.MODEL.DEVICE = 'cuda'; cfg.MODEL.WEIGHTS = str(DIRECTORY / 'model.pth')
        cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = .2
        cfg.TEST.DETECTIONS_PER_IMAGE = 512
        cfg.freeze(); self.config = cfg.dump(); self.max_detections = 512
        self.model = build_model(cfg).eval()
        checkpoint = torch.load(DIRECTORY / 'model.pth', map_location='cpu', weights_only=True)
        self.model.load_state_dict(checkpoint.get('model', checkpoint), strict=True)
        self.format = cfg.INPUT.FORMAT

    def predict(self, rgb):
        import numpy as np
        import torch
        import torch.nn.functional as F
        h, w = rgb.shape[:2]
        array = rgb[:, :, ::-1] if self.format == 'BGR' else rgb
        tensor = torch.as_tensor(np.ascontiguousarray(array.transpose(2, 0, 1)), dtype=torch.float32, device='cuda')
        # Mesma interpolação 2,5x do experimento recebido; não é super-resolução.
        tensor = F.interpolate(tensor[None], size=(round(h*2.5), round(w*2.5)), mode='bilinear', align_corners=False)[0]
        with torch.inference_mode():
            return self.model([{'image': tensor, 'height': h, 'width': w}])[0]['instances'].to('cpu')


if __name__ == '__main__':
    prepare()
