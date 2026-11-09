"""Piloto Cambridge: ortofoto RGB original → janelas → caixas → pontos WGS84."""
import argparse
import gzip
import json
import math
import platform
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
from time import perf_counter
from uuid import uuid4

import numpy as np
from rasterio.warp import transform as project

from .analysis import RECORTES, locate, read_image, save_preview, write_json
from ..models.detectree import CambridgeDetector
from ..models.detector import ROOT, sha256


def pixel_size_m(affine, crs, width, height):
    x, y = affine * (width / 2, height / 2)
    lng, lat = project(crs, "EPSG:4326", [x], [y])
    zone = max(1, min(60, int((lng[0] + 180) // 6) + 1))
    utm = f"EPSG:{(32600 if lat[0] >= 0 else 32700) + zone}"
    points = [affine * (width / 2 + dx, height / 2 + dy) for dx, dy in ((0, 0), (1, 0), (0, 1))]
    east, north = project(crs, utm, [p[0] for p in points], [p[1] for p in points])
    return [math.hypot(east[i] - east[0], north[i] - north[0]) for i in (1, 2)], utm


def tile_windows(width, height, tile_width, tile_height, overlap):
    def starts(length, size):
        size = min(size, length)
        last = length - size
        return sorted({*range(0, last + 1, max(1, round(size * (1 - overlap)))), last})
    tw, th = min(tile_width, width), min(tile_height, height)
    return [(x, y, x + tw, y + th) for y in starts(height, th) for x in starts(width, tw)]


def deduplicate(rows, iou):
    """NMS global de caixas; validade é verificada antes para não suprimir pontos válidos."""
    import torch
    from torchvision.ops import box_iou, nms

    eligible = [i for i, row in enumerate(rows) if row["reason"] == "selecionada"]
    if not eligible:
        return
    boxes = torch.tensor([rows[i]["bbox_px"] for i in eligible], dtype=torch.float32)
    scores = torch.tensor([rows[i]["score"] for i in eligible], dtype=torch.float32)
    keep = nms(boxes, scores, iou).tolist()  # CPU, somente agregação; inferência permanece CUDA.
    overlaps = box_iou(boxes, boxes[keep])
    for local, index in enumerate(eligible):
        if local not in keep:
            winner = next(j for j, value in enumerate(overlaps[local]) if value > iou)
            rows[index].update(reason="sobreposicao_nms", suppressed_by=rows[eligible[keep[winner]]]["id"])


def analyze(detector, recorte, tile_m, overlap, iou, thresholds, output, progress=None):
    import torch
    from pycocotools import mask as coco_mask

    started = perf_counter()
    if progress:
        progress(f"Preparando {recorte}: janelas de {tile_m:g} m")
    path = RECORTES[recorte]
    rgb, valid, affine, crs, image_info = read_image(path)
    height, width = valid.shape
    gsd, utm = pixel_size_m(affine, crs, width, height)
    tw, th = (max(1, round(tile_m / size)) for size in gsd)
    windows = tile_windows(width, height, tw, th, overlap)
    raw, masks, tile_info = [], [], []
    torch.cuda.synchronize()
    torch.cuda.reset_peak_memory_stats()
    inference_started = perf_counter()
    for tile_id, (x, y, right, bottom) in enumerate(windows, 1):
        info = {"id": tile_id, "window_px": [x, y, right, bottom]}
        if not valid[y:bottom, x:right].any():
            tile_info.append({**info, "skipped": "sem_pixels_validos"})
            continue
        print(f"{recorte}: janela {tile_id}/{len(windows)} {info['window_px']}", flush=True)
        if progress:
            progress(f"Analisando {tile_m:g} m: janela {tile_id}/{len(windows)}")
        tick = perf_counter()
        instances = detector.predict(rgb[y:bottom, x:right])
        torch.cuda.synchronize()
        boxes = instances.pred_boxes.tensor.numpy()
        scores = instances.scores.numpy()
        tile_info.append({**info, "detections": len(instances), "seconds": perf_counter() - tick,
                          "model_input_hw": detector.last_input_shape,
                          "hit_detection_cap": len(instances) >= detector.max_detections})
        for box, score, mask in zip(boxes, scores, instances.pred_masks.numpy()):
            x1, y1, x2, y2 = box.tolist()
            cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
            ident = f"{recorte}-{len(raw)+1:04d}"
            raw.append({"xmin": x1+x, "ymin": y1+y, "xmax": x2+x, "ymax": y2+y,
                        "score": float(score), "tile_id": tile_id,
                        "center_inside_mask": bool(mask[int(cy), int(cx)])
                        if 0 <= cx < mask.shape[1] and 0 <= cy < mask.shape[0] else False,
                        "touches_window_edge": bool(x1 <= 1 or y1 <= 1 or
                                                    x2 >= right-x-1 or y2 >= bottom-y-1)})
            rle = coco_mask.encode(np.asfortranarray(mask, dtype=np.uint8))
            masks.append({"id": ident, "tile_id": tile_id, "offset_px": [x, y],
                          "size": rle["size"], "counts": rle["counts"].decode("ascii")})
    torch.cuda.synchronize()
    metrics = {"inference_and_mask_encoding_seconds": perf_counter() - inference_started,
               "peak_allocated_mib": torch.cuda.max_memory_allocated() / 2**20,
               "peak_reserved_mib": torch.cuda.max_memory_reserved() / 2**20,
               "model_load_seconds": detector.load_seconds}
    prefix = f"cambridge-{recorte}-t{tile_m:g}m"
    if progress:
        progress(f"Agregando e salvando diagnósticos de {tile_m:g} m")
    model_id = detector.manifest["model_id"]
    geojson, rows = locate(raw, affine, crs, valid, recorte, min(thresholds), model_id, "detectree2")
    for row, box in zip(rows, raw):
        row.update({key: box[key] for key in ("tile_id", "center_inside_mask", "touches_window_edge")})
    save_preview(rgb, rows, f'{recorte} | Cambridge | antes da agregacao | {len(raw)} propostas',
                 output / f"{prefix}-antes-agregacao.png")
    deduplicate(rows, iou)
    by_id = {row["id"]: row for row in rows}
    exports = []
    for threshold in thresholds:
        selected = [feature for feature in geojson["features"]
                    if by_id[feature["id"]]["reason"] == "selecionada"
                    and feature["properties"]["score"] >= threshold]
        for feature in selected:
            feature["properties"].update({key: by_id[feature["id"]][key]
                                         for key in ("tile_id", "center_inside_mask", "touches_window_edge")})
        name = f"{prefix}-c{threshold:.2f}"
        write_json(output / f"{name}.geojson", {"type": "FeatureCollection", "features": selected})
        preview = [{**row, "reason": row["reason"] if row["score"] >= threshold else "confianca_baixa"}
                   for row in rows]
        save_preview(rgb, preview, f'{recorte} | Cambridge | corte {threshold:.2f} | '
                     f'{len(selected)} possiveis arvores', output / f"{name}.png")
        exports.append({"score_threshold": threshold, "candidates": len(selected), "file": f"{name}.geojson"})
    with gzip.open(output / f"{prefix}-mascaras.json.gz", "wt", encoding="utf-8") as stream:
        json.dump(masks, stream)
    (output / f"{prefix}-config.yaml").write_text(detector.config, encoding="utf-8")
    source = path.with_name(path.name.replace("_rgb8.tif", "_fonte.json"))
    report = {"recorte": recorte, "image": {"file": path.name, "sha256": sha256(path), **image_info,
                                           "source": json.loads(source.read_text(encoding="utf-8"))},
              "model": detector.manifest, "device": detector.device,
              "parameters": {"tile_m": tile_m, "pixel_size_m": gsd, "local_utm": utm,
                             "window_px": [min(tw, width), min(th, height)], "overlap": overlap,
                             "edge_strategy": "anchor_last_full_window; overlap_can_increase_at_edges",
                             "input": "original_RGB8_to_BGR; no_color_enhancement_or_HSV",
                             "score_floor": detector.score_floor, "export_thresholds": thresholds,
                             "mosaic_nms_box_iou": iou, "mosaic_method": "torchvision.ops.nms_cpu",
                             "native_nms": "Detectron2 RPN/ROI; see config.yaml",
                             "batch_size": 1, "workers": 0},
              "counts": {"before_mosaic_nms": len(raw),
                         "after_mosaic_nms": sum(row["reason"] == "selecionada" for row in rows),
                         "reasons": {reason: sum(row["reason"] == reason for row in rows)
                                     for reason in sorted({row["reason"] for row in rows})}},
              "exports": exports, "windows": tile_info, "detections": rows,
              "timing": {**metrics, "processing_seconds_before_report": perf_counter() - started},
              "environment": {"python": platform.python_version(), "platform": platform.platform(),
                              "packages": {p: version(p) for p in ("detectree2", "detectron2", "torch",
                                           "torchvision", "rasterio", "numpy", "pycocotools")}},
              "note": "Centros de caixas de possíveis copas. Score não é probabilidade. Referência não revisada."}
    write_json(output / f"{prefix}.json", report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recorte", choices=[*RECORTES, "todos"], default="todos")
    parser.add_argument("--janela-m", type=float, default=200)
    parser.add_argument("--sobreposicao", type=float, default=.25)
    parser.add_argument("--iou", type=float, default=.5)
    parser.add_argument("--cortes", type=float, nargs="+", default=[.15, .30, .50])
    parser.add_argument("--nota", default="", help="Condições externas, como emulador aberto.")
    parser.add_argument("--saida", type=Path, default=ROOT / "resultados" / "detectree2-cambridge-piloto")
    args = parser.parse_args()
    if (not math.isfinite(args.janela_m) or args.janela_m <= 0 or not 0 <= args.sobreposicao < 1
            or not 0 <= args.iou <= 1 or not all(0 < c <= 1 for c in args.cortes)):
        parser.error("Use janela positiva, sobreposição [0,1), IoU [0,1] e cortes (0,1].")
    names = list(RECORTES) if args.recorte == "todos" else [args.recorte]
    thresholds = sorted(set(args.cortes))
    output = args.saida / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:6])
    output.mkdir(parents=True, exist_ok=False)
    write_json(output / "execucao.json", {"status": "processando", "note": args.nota})
    try:
        print("Conferindo peso Cambridge e carregando modelo na GPU...", flush=True)
        detector = CambridgeDetector(min(thresholds))
        summaries = []
        for name in names:
            report = analyze(detector, name, args.janela_m, args.sobreposicao, args.iou, thresholds, output)
            summary = {"recorte": name, **report["counts"], "exports": report["exports"], **report["timing"]}
            summaries.append(summary)
            print(json.dumps(summary), flush=True)
        write_json(output / "comparacao.json", summaries)
        write_json(output / "execucao.json", {"status": "concluida", "note": args.nota})
    except Exception as error:
        write_json(output / "execucao.json", {"status": "erro", "error": str(error), "note": args.nota})
        raise
    finally:
        print(f"Resultados: {output}", flush=True)


if __name__ == "__main__":
    main()
