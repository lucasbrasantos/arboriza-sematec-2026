"""Leitura geográfica, resultados e comando do experimento (sem servidor)."""
import argparse
import json
import math
import platform
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
from time import perf_counter
from uuid import uuid4

import numpy as np
import rasterio
from PIL import Image, ImageDraw
from rasterio.warp import transform as project

from ..models.detector import DATA_ROOT, ROOT, MODEL_ID, Detector, sha256

RECORTES = {name: DATA_ROOT / "ortofotos" / f"aracatuba-{name}_rgb8.tif"
            for name in ("centro", "centro-norte")}


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
                    encoding="utf-8")


def read_image(path):
    with rasterio.open(path) as src:
        if src.crs is None or src.count < 3 or any(t != "uint8" for t in src.dtypes[:3]):
            raise ValueError("Use um GeoTIFF RGB8 com CRS válido.")
        rgb = src.read([1, 2, 3]).transpose(1, 2, 0).copy()
        valid = src.read_masks([1, 2, 3]).all(axis=0)
        rgb[~valid] = 0
        metadata = {"crs": src.crs.to_string(), "transform": list(src.transform),
                    "bounds": list(src.bounds), "width": src.width, "height": src.height,
                    "valid_pixels": int(valid.sum()), "nodata": src.nodata}
        return rgb, valid, src.transform, src.crs, metadata


def locate(boxes, affine, crs, valid, recorte, min_score, model_id=MODEL_ID, origin="deepforest"):
    """Centros em coordenadas contínuas de pixel; sem adicionar meio pixel outra vez."""
    features, diagnostics = [], []
    height, width = valid.shape
    for index, box in enumerate(boxes, 1):
        x1, y1, x2, y2, score = (float(box[k]) for k in ("xmin", "ymin", "xmax", "ymax", "score"))
        if not all(math.isfinite(v) for v in (x1, y1, x2, y2, score)):
            raise ValueError("O detector retornou uma caixa ou score não finito.")
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        reason = ("caixa_invalida" if x2 <= x1 or y2 <= y1 else
                  "fora_da_imagem" if not (0 <= cx < width and 0 <= cy < height) else
                  "pixel_invalido" if not valid[int(cy), int(cx)] else
                  "confianca_baixa" if score < min_score else "selecionada")
        ident = f"{recorte}-{index:04d}"
        diagnostics.append({"id": ident, "bbox_px": [x1, y1, x2, y2],
                            "center_px": [cx, cy], "score": score, "reason": reason})
        if reason != "selecionada":
            continue
        x, y = affine * (cx, cy)
        lng, lat = project(crs, "EPSG:4326", [x], [y])
        features.append({"type": "Feature", "id": ident,
                         "geometry": {"type": "Point", "coordinates": [lng[0], lat[0]]},
                         "properties": {"score": score, "modelo": model_id, "recorte": recorte,
                                        "origem": origin, "revisado": False,
                                        "bbox_px": [x1, y1, x2, y2]}})
    return {"type": "FeatureCollection", "features": features}, diagnostics


def save_preview(rgb, diagnostics, title, path):
    picture = Image.fromarray(rgb)
    draw = ImageDraw.Draw(picture)
    for item in diagnostics:
        if item["reason"] == "selecionada":
            draw.rectangle(item["bbox_px"], outline="#18e2a2", width=2)
            x, y = item["center_px"]
            draw.ellipse((x-3, y-3, x+3, y+3), fill="#1971c2", outline="white")
    draw.rectangle((0, 0, picture.width, 25), fill="#163322")
    draw.text((8, 6), title, fill="white")
    picture.save(path)


def analyze(detector, recorte, patch_size, min_score, output):
    started = perf_counter()
    path = RECORTES[recorte]
    rgb, valid, affine, crs, image_info = read_image(path)
    boxes, metrics = detector.predict(rgb, patch_size) if valid.any() else ([], {})
    geojson, diagnostics = locate(boxes, affine, crs, valid, recorte, min_score)
    prefix = f"deepforest-{recorte}-p{patch_size}-c{min_score:.2f}"
    output.mkdir(parents=True, exist_ok=True)
    write_json(output / f"{prefix}.geojson", geojson)
    save_preview(rgb, diagnostics, f'{recorte} | p{patch_size} | score >= {min_score:.2f} | '
                 f'{len(geojson["features"])} possiveis arvores', output / f"{prefix}.png")
    source_path = path.with_name(path.name.replace("_rgb8.tif", "_fonte.json"))
    report = {"recorte": recorte, "created_at_utc": datetime.now(timezone.utc).isoformat(),
              "image": {"file": path.name, "sha256": sha256(path), **image_info,
                        "source": json.loads(source_path.read_text(encoding="utf-8"))},
              "model": detector.manifest, "device": detector.device,
              "parameters": {"patch_size": patch_size, "patch_overlap": .25,
                             "min_score": min_score, "mosaic_iou_threshold": .15,
                             "dataloader_strategy": "single", "effective_config": detector.config},
              "counts": {"boxes_after_native_nms": len(boxes),
                         "candidates": len(geojson["features"]),
                         "discarded": len(boxes) - len(geojson["features"])},
              "timing": {**metrics, "model_load_seconds": detector.load_seconds,
                         "processing_seconds_before_report": perf_counter() - started},
              "environment": {"python": platform.python_version(), "platform": platform.platform(),
                              "packages": {p: version(p) for p in (
                                  "deepforest", "torch", "torchvision", "rasterio", "numpy", "pillow")}},
              "detections_after_native_nms": diagnostics,
              "note": "Centros de possíveis copas, não troncos nem contagem validada de árvores."}
    write_json(output / f"{prefix}.json", report)
    return report


def main():
    parser = argparse.ArgumentParser(description="DeepForest local: pontos de possíveis árvores.")
    parser.add_argument("--recorte", choices=[*RECORTES, "todos"], default="todos")
    parser.add_argument("--janelas", type=int, nargs="+", choices=[400, 800], default=[400, 800])
    parser.add_argument("--confianca", type=float, default=.5)
    parser.add_argument("--saida", type=Path, default=ROOT / "resultados")
    args = parser.parse_args()
    if not .1 <= args.confianca <= 1:
        parser.error("A confiança deve estar entre 0.1 e 1 (piso interno do modelo: 0.1).")
    names = list(RECORTES) if args.recorte == "todos" else [args.recorte]
    for name in names:
        if not RECORTES[name].is_file():
            parser.error(f"GeoTIFF ausente: {RECORTES[name]}")
    output = args.saida / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:6])
    print("Validando CUDA e carregando pesos locais...", flush=True)
    detector = Detector()
    summaries = []
    for name in names:
        for size in dict.fromkeys(args.janelas):
            print(f"Analisando {name}, janela {size}...", flush=True)
            report = analyze(detector, name, size, args.confianca, output)
            row = {"recorte": name, "janela": size, **report["counts"], **report["timing"]}
            summaries.append(row)
            print(json.dumps(row), flush=True)
    write_json(output / "comparacao.json", summaries)
    print(f"Resultados: {output}", flush=True)


if __name__ == "__main__":
    main()
