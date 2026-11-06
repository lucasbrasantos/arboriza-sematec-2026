"""Seleção de setores urbanos do IBGE, independente das camadas de pontos."""
import json
import math
from pathlib import Path

from pyproj import Transformer
from shapely import STRtree, transform, union_all
from shapely.errors import GEOSException
from shapely.geometry import mapping, shape

from .detector import ROOT


DATA = ROOT / "data" / "territorial" / "setores-urbanos-aracatuba-ibge-2022.geojson"


class Territory:
    def __init__(self, path=DATA):
        self.collection = json.loads(Path(path).read_text(encoding="utf-8"))
        self.metadata = self.collection["arboriza"]
        self.features = self.collection["features"]
        self.ids = [str(feature["id"]) for feature in self.features]
        if len(self.ids) != len(set(self.ids)) or not self.ids:
            raise ValueError("A malha territorial não possui IDs únicos válidos.")
        self.geometries = [shape(feature["geometry"]) for feature in self.features]
        if any(geometry.is_empty or not geometry.is_valid for geometry in self.geometries):
            raise ValueError("A malha territorial contém geometria inválida.")
        self.by_id = dict(zip(self.ids, self.geometries))
        self.tree = STRtree(self.geometries)
        self.project = Transformer.from_crs("EPSG:4326", "EPSG:31982", always_xy=True)

    @staticmethod
    def drawing(value):
        if not isinstance(value, dict) or value.get("type") != "Polygon":
            raise ValueError("Desenhe um polígono fechado ou um retângulo.")
        try:
            geometry = shape(value)
            if geometry.is_empty or not geometry.is_valid or geometry.area <= 0:
                raise ValueError("O desenho precisa ter área e não pode cruzar a si mesmo. Desenhe novamente.")
            west, south, east, north = geometry.bounds
            if not all(math.isfinite(n) for n in geometry.bounds) or west < -180 or east > 180 or south < -85 or north > 85:
                raise ValueError("O desenho precisa permanecer dentro do mapa.")
            count = len(geometry.exterior.coords) + sum(len(ring.coords) for ring in geometry.interiors)
            if count > 3000:
                raise ValueError("O desenho contém muitos pontos. Tente um traço mais simples.")
            return geometry
        except (TypeError, KeyError, IndexError, GEOSException) as error:
            raise ValueError("Não foi possível interpretar o desenho. Tente novamente.") from error

    def intersect(self, value):
        drawing = self.drawing(value)
        # Em coordenadas geográficas só verificamos se a interseção tem área positiva.
        # Área em m² é calculada separadamente na projeção métrica.
        return sorted(self.ids[int(index)] for index in self.tree.query(drawing, predicate="intersects")
                      if self.geometries[int(index)].intersection(drawing).area > 0)

    def selected(self, ids):
        if len(ids) != len(set(ids)) or any(ident not in self.by_id for ident in ids):
            raise ValueError("A seleção contém setores desconhecidos ou repetidos.")
        return [self.by_id[ident] for ident in ids]

    def summary(self, ids, include_geometry=False):
        geometries = self.selected(ids)
        if not geometries:
            return {"setores": 0, "area_m2": 0, "bounds": None, **({"geometry": None} if include_geometry else {})}
        combined = union_all(geometries)
        projected = transform(combined, self.project.transform, interleaved=False)
        result = {"setores": len(geometries), "area_m2": projected.area, "bounds": list(combined.bounds)}
        if include_geometry:
            result["geometry"] = mapping(combined)
        return result
