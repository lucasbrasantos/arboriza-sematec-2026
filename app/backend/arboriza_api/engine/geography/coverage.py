"""Cobertura dos rasters já existentes; não baixa imagens nem executa inferência."""
from functools import lru_cache
from pathlib import Path

import rasterio
from rasterio.features import shapes
from rasterio.warp import transform_geom
from shapely import transform, union_all
from shapely.geometry import shape


@lru_cache(maxsize=8)
def valid_footprint(path, size, modified_ns):
    with rasterio.open(path) as source:
        if source.crs is None or source.count < 3:
            raise ValueError("Imagem local sem CRS ou sem três bandas RGB.")
        valid = source.read_masks([1, 2, 3]).all(axis=0)
        polygons = [shape(transform_geom(source.crs, "EPSG:4326", geometry))
                    for geometry, value in shapes(valid.astype('uint8'), mask=valid, transform=source.transform)
                    if value == 1]
        return union_all(polygons)


def local_coverage(territory, ids, paths):
    geometries = territory.selected(ids)
    if not geometries:
        return {"area_total_m2": 0, "area_coberta_m2": 0, "area_pendente_m2": 0, "percentual": 0, "imagens": []}
    selected = union_all(geometries)
    footprints, names = [], []
    for name, path in paths.items():
        path = Path(path)
        if not path.is_file():
            continue
        info = path.stat()
        footprint = valid_footprint(str(path), info.st_size, info.st_mtime_ns)
        if footprint.intersects(selected):
            footprints.append(footprint)
            names.append(name)
    valid = union_all(footprints)
    project = lambda geometry: transform(geometry, territory.project.transform, interleaved=False)
    total = project(selected).area
    covered = project(selected.intersection(valid)).area if footprints else 0
    covered = min(total, covered)
    return {"area_total_m2": total, "area_coberta_m2": covered,
            "area_pendente_m2": max(0, total-covered), "percentual": 100*covered/total if total else 0,
            "imagens": names}


def coverage_by_sector(territory, ids, paths):
    """Mede pixels válidos por setor; não verifica qualidade nem executa o modelo."""
    geometries = territory.selected(ids)
    if not geometries:
        raise ValueError("Selecione ao menos um setor.")
    project = lambda geometry: transform(geometry, territory.project.transform, interleaved=False)
    footprints = []
    for path in paths.values():
        path = Path(path)
        if path.is_file():
            info = path.stat()
            footprints.append(project(valid_footprint(str(path), info.st_size, info.st_mtime_ns)))
    coverage = union_all(footprints)
    sectors = []
    for ident, geometry in zip(ids, geometries):
        sector = project(geometry)
        total = sector.area
        covered = min(total, sector.intersection(coverage).area) if footprints else 0.0
        missing = max(0.0, total - covered)
        state = "sem_imagem" if covered <= 0.001 else ("completo" if missing <= 0.01 else "parcial")
        sectors.append({"id": ident, "area_total_m2": total, "area_coberta_m2": covered,
                        "area_pendente_m2": missing, "percentual": 100 * covered / total if total else 0,
                        "estado": state})
    counts = {state: sum(item["estado"] == state for item in sectors)
              for state in ("completo", "parcial", "sem_imagem")}
    return {"setores": sectors, "contagem": counts,
            "observacao": "Cobertura geométrica das máscaras válidas; não verifica qualidade, atualidade ou licença."}
