"""Seleção territorial e contrato HTTP sem imagens ou execução do modelo."""
import json
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.api import create_app
from backend.territory import Territory
from scripts.preparar_setores_ibge import prepare


def rectangle(west, south, east, north):
    return {"type": "Polygon", "coordinates": [[[west, south], [east, south], [east, north],
                                                 [west, north], [west, south]]]}


def sample():
    return {"type": "FeatureCollection", "arboriza": {"fonte": "IBGE de teste", "sha256_fonte": "teste"},
            "features": [
                {"type": "Feature", "id": "a", "properties": {},
                 "geometry": rectangle(-50.45, -21.21, -50.44, -21.20)},
                {"type": "Feature", "id": "b", "properties": {},
                 "geometry": rectangle(-50.44, -21.21, -50.43, -21.20)},
                {"type": "Feature", "id": "c", "properties": {},
                 "geometry": rectangle(-50.42, -21.21, -50.41, -21.20)},
            ]}


class TerritoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "setores.geojson"
        self.path.write_text(json.dumps(sample()), encoding="utf-8")
        self.territory = Territory(self.path)

    def test_area_intersection_excludes_touch_and_includes_tiny_overlap(self):
        self.assertEqual(self.territory.intersect(rectangle(-50.45, -21.21, -50.44, -21.20)), ["a"])
        self.assertEqual(self.territory.intersect(rectangle(-50.445, -21.205, -50.43999, -21.204)), ["a", "b"])
        self.assertEqual(self.territory.intersect(rectangle(-50.40, -21.21, -50.39, -21.20)), [])

    def test_summary_counts_union_and_rejects_unknown_or_duplicate_ids(self):
        first = self.territory.summary(["a"])
        both = self.territory.summary(["a", "b"], include_geometry=True)
        self.assertEqual(both["setores"], 2)
        self.assertGreater(both["area_m2"], first["area_m2"])
        self.assertEqual(both["bounds"], [-50.45, -21.21, -50.43, -21.20])
        self.assertIn(both["geometry"]["type"], ("Polygon", "MultiPolygon"))
        for ids in (["missing"], ["a", "a"]):
            with self.assertRaises(ValueError):
                self.territory.summary(ids)

    def test_invalid_self_crossing_draw_and_http_contract(self):
        invalid = {"type": "Polygon", "coordinates": [[[-50.45, -21.21], [-50.44, -21.20],
                    [-50.44, -21.21], [-50.45, -21.20], [-50.45, -21.21]]]}
        with TestClient(create_app(territory_path=self.path)) as client:
            self.assertEqual(len(client.get("/api/territorio/setores").json()["features"]), 3)
            self.assertEqual(client.post("/api/territorio/intersecoes", json={"geometry": invalid}).status_code, 422)
            self.assertEqual(client.post("/api/territorio/intersecoes", json={"geometry": None}).status_code, 422)
            response = client.post("/api/territorio/intersecoes", json={"geometry": rectangle(-50.45, -21.21, -50.44, -21.20)})
            self.assertEqual(response.json()["ids"], ["a"])
            self.assertEqual(client.post("/api/territorio/resumo", json={"ids": ["unknown"]}).status_code, 422)
            exported = client.post("/api/territorio/geojson", json={"ids": ["a", "b"]}).json()
            self.assertEqual(exported["arboriza"]["setores"], ["a", "b"])
            self.assertEqual(exported["features"][0]["geometry"]["type"], "Polygon")

    def test_missing_data_does_not_break_frontend(self):
        with TestClient(create_app(territory_path=self.path.parent / "missing.geojson")) as client:
            self.assertEqual(client.get("/api/territorio/setores").status_code, 503)
            self.assertEqual(client.get("/").status_code, 200)

    def test_prepare_never_overwrites_existing_data(self):
        before = self.path.read_bytes()
        with self.assertRaises(FileExistsError):
            prepare(self.path)
        self.assertEqual(self.path.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
