"""Validação técnica CUDA; entrada sintética e pesos aleatórios não medem detecção."""
import argparse
import json
import platform
import traceback
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

ROOT = Path(__file__).resolve().parents[1]


def validate(report):
    import torch
    import torchvision
    import detectron2
    from detectron2 import _C, model_zoo
    from detectron2.config import get_cfg
    from detectron2.layers import ROIAlign, ROIAlignRotated, nms_rotated
    from detectron2.modeling import build_model

    if not torch.cuda.is_available() or not _C.has_cuda():
        raise RuntimeError('PyTorch e Detectron2 precisam estar compilados com CUDA.')
    report.update(python=platform.python_version(), torch=torch.__version__,
                  torchvision=torchvision.__version__, detectron2=detectron2.__version__,
                  cuda_torch=torch.version.cuda, cuda_detectron2=_C.get_cuda_version(),
                  compiler=_C.get_compiler_version(), gpu=torch.cuda.get_device_name(),
                  capability=list(torch.cuda.get_device_capability()), extension=_C.__file__)

    boxes = torch.tensor([[0., 0., 8., 8.], [1., 1., 7., 7.], [10., 10., 12., 12.]])
    rotated = torch.tensor([[4., 4., 8., 8., 0.], [4., 4., 6., 6., 0.],
                            [11., 11., 2., 2., 0.]])
    scores = torch.tensor([0.9, 0.8, 0.7])
    for name, operation, data in [('nms', torchvision.ops.nms, boxes),
                                   ('nms_rotated', nms_rotated, rotated)]:
        result = operation(data.cuda(), scores.cuda(), 0.5)
        if not result.is_cuda or result.tolist() != [0, 2]:
            raise RuntimeError(f'Resultado inesperado em {name}.')
        report['checks'][name] = 'ok_cuda'

    image = torch.arange(64, dtype=torch.float32).reshape(1, 1, 8, 8)
    for name, layer, roi in [
        ('roi_align', ROIAlign((3, 3), 1., 2, aligned=True),
         torch.tensor([[0., 1., 1., 6., 6.]])),
        ('roi_align_rotated', ROIAlignRotated((3, 3), 1., 2),
         torch.tensor([[0., 3.5, 3.5, 5., 5., 15.]])),
    ]:
        result = layer(image.cuda(), roi.cuda())
        if not result.is_cuda:
            raise RuntimeError(f'{name} não executou na GPU.')
        torch.testing.assert_close(result.cpu(), layer(image, roi), rtol=1e-4, atol=1e-4)
        report['checks'][name] = 'ok_cuda_cpu_parity'

    torch.manual_seed(2026)
    config_name = 'COCO-InstanceSegmentation/mask_rcnn_R_101_FPN_3x.yaml'
    cfg = get_cfg()
    cfg.merge_from_file(model_zoo.get_config_file(config_name))
    cfg.MODEL.DEVICE = 'cuda'
    cfg.MODEL.WEIGHTS = ''  # Não baixar COCO; validar somente o caminho de execução.
    cfg.MODEL.ROI_HEADS.NUM_CLASSES = 1
    cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = 0.
    cfg.MODEL.RPN.PRE_NMS_TOPK_TEST = 100
    cfg.MODEL.RPN.POST_NMS_TOPK_TEST = 30
    cfg.TEST.DETECTIONS_PER_IMAGE = 5
    torch.cuda.reset_peak_memory_stats()
    start = perf_counter()
    model = build_model(cfg).eval()
    torch.cuda.synchronize()
    load_seconds = perf_counter() - start
    start = perf_counter()
    # A média da rede produz entrada normalizada neutra, sem ativações extremas
    # de um backbone profundo com pesos aleatórios.
    neutral = torch.tensor(cfg.MODEL.PIXEL_MEAN, device='cuda').view(3, 1, 1)
    with torch.inference_mode():
        instances = model([{'image': neutral.expand(3, 128, 128).contiguous(),
                            'height': 128, 'width': 128}])[0]['instances']
    torch.cuda.synchronize()
    report['mask_rcnn'] = {'config': config_name, 'input_px': [128, 128],
                          'weights': 'random', 'input': 'neutral_pixel_mean',
                          'synthetic_outputs': len(instances),
                          'masks_device': str(instances.pred_masks.device),
                          'load_seconds': load_seconds,
                          'inference_seconds': perf_counter() - start,
                          'peak_allocated_mib': torch.cuda.max_memory_allocated() / 2**20,
                          'peak_reserved_mib': torch.cuda.max_memory_reserved() / 2**20}
    if (not len(instances) or not instances.pred_masks.is_cuda
            or not torch.isfinite(instances.pred_boxes.tensor).all()
            or not torch.isfinite(instances.scores).all()):
        raise RuntimeError('A inferência não exercitou caixas e máscaras válidas na GPU.')
    report['checks']['mask_rcnn'] = 'ok_cuda_synthetic_random_weights'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida', type=Path)
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    output = args.saida or ROOT / 'resultados' / 'detectron2-windows-marco-01' / f'check-{stamp}.json'
    report = {'timestamp_utc': stamp, 'status': 'erro', 'checks': {},
              'scope': 'technical_only_not_tree_quality'}
    try:
        validate(report)
        report['status'] = 'ok'
    except Exception:
        report['error'] = traceback.format_exc()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f'Relatório: {output}')
    return 0 if report['status'] == 'ok' else 1


if __name__ == '__main__':
    raise SystemExit(main())
