"""Contrato HTTP, exclusão mútua e preservação de resultados, sem depender da GPU."""
import json
import tempfile
import time
import unittest
from pathlib import Path
from threading import Event

from fastapi.testclient import TestClient

from backend.api import create_app
from tests.test_territory import sample


class FakeService:
    def __init__(self):
        self.release = Event()
        self.fail = False

    def run(self, recorte, perfil, score, folder, progress):
        progress("Aguardando detector do teste")
        if not self.release.wait(5):
            raise RuntimeError("Teste não liberou o detector")
        if self.fail:
            raise RuntimeError("CUDA out of memory (simulado)")
        (folder / "pontos.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": []}))
        return {"candidatos": 0}

    def run_sectors(self, territory, ids, score, folder, progress):
        return self.run('setores', 'controle', score, folder, progress)

    def run_control_source(self, territory, ids, score, folder, progress, perfil):
        self.control_source = (list(ids), perfil)
        return self.run('setores', perfil, score, folder, progress)


class ApiTests(unittest.TestCase):
    def test_local_control_is_available_for_sector_requests(self):
        service = FakeService(); service.release.set()
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); path=root/'territorio.json'
            path.write_text(json.dumps(sample()),encoding='utf-8')
            with TestClient(create_app(service,root/'resultados',path)) as client:
                names=[p['id'] for p in client.get('/api/recortes').json()['perfis']]
                self.assertTrue({'controle','controle-local','controle-datageo'}.issubset(names))
                response=client.post('/api/analises/setores',json={'ids':['a'],'fonte_malha':'teste','perfil':'controle-local'})
                self.assertEqual(response.status_code,202);ident=response.json()['analysis_id']
                for _ in range(200):
                    job=client.get(f'/api/analises/{ident}').json()
                    if job['estado'] in ('concluida','erro'):break
                    time.sleep(.01)
                self.assertEqual(job['estado'],'concluida');self.assertEqual(service.control_source,(['a'],'controle-local'))

    def test_experimental_profile_routes_and_exports_separate_collections(self):
        class FusionService(FakeService):
            def run_fusion_sectors(self, territory, ids, score, folder, progress):
                self.called = (ids, score)
                self.release.set()
                self.run('setores', 'fusao', score, folder, progress)
                for name in ('copas', 'pontos-todos', 'pontos-grupos', 'pontos-complementos'):
                    (folder/(name+'.geojson')).write_text(json.dumps({'type': 'FeatureCollection', 'features': []}))
                return {'perfil': 'fusao', 'candidatos': 0, 'grupos_copas': 0, 'complementos_pendentes': 0}
        service = FusionService()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); path = root/'territorio.json'
            path.write_text(json.dumps(sample()), encoding='utf-8')
            with TestClient(create_app(service, root/'resultados', path)) as client:
                profiles = client.get('/api/recortes').json()['perfis']
                self.assertIn('fusao', [p['id'] for p in profiles])
                self.assertIn('controle', [p['id'] for p in profiles])
                response = client.post('/api/analises/setores', json={'ids':['a'], 'fonte_malha':'teste', 'perfil':'fusao', 'score':.12})
                self.assertEqual(response.status_code, 202); ident=response.json()['analysis_id']
                for _ in range(200):
                    state=client.get(f'/api/analises/{ident}').json()
                    if state['estado'] in ('concluida','erro'):break
                    time.sleep(.01)
                self.assertEqual(state['estado'], 'concluida'); self.assertEqual(service.called, (['a'], .12))
                for layer in ('copas','pontos-todos','pontos-grupos','pontos-complementos'):
                    self.assertEqual(client.get(f'/api/analises/{ident}/camadas/{layer}').json()['features'], [])
                self.assertEqual(client.get(f'/api/analises/{ident}/camadas/modelos').status_code, 422)

    def test_busy_empty_error_and_previous_result(self):
        service = FakeService()
        with tempfile.TemporaryDirectory() as temp, TestClient(create_app(service, Path(temp))) as client:
            def start():
                return client.post("/api/analises", json={"recorte": "centro"})
            def finish(ident):
                for _ in range(200):
                    value = client.get(f"/api/analises/{ident}").json()
                    if value["estado"] in ("concluida", "erro") and (Path(temp)/ident/"execucao.json").exists():
                        return value
                    time.sleep(.01)
                self.fail("Análise não terminou")
            first = start()
            self.assertEqual(first.status_code, 202)
            ident = first.json()["analysis_id"]
            self.assertEqual(start().status_code, 409)
            self.assertEqual(client.get(f"/api/analises/{ident}/geojson").status_code, 409)
            self.assertEqual(client.get("/api/recortes").status_code, 200)
            service.release.set()
            self.assertEqual(finish(ident)["resumo"]["candidatos"], 0)
            self.assertEqual(client.get(f"/api/analises/{ident}/geojson").json()["features"], [])
            service.fail = True
            with self.assertLogs(level="ERROR"):
                failed = start().json()["analysis_id"]
                self.assertEqual(finish(failed)["estado"], "erro")
            self.assertEqual(client.get(f"/api/analises/{ident}/geojson").status_code, 200)
            self.assertEqual(client.get(f"/api/analises/{failed}/geojson").status_code, 409)
            self.assertEqual(client.get("/api/analises/inexistente").status_code, 404)

    def test_validation_and_static_boundary(self):
        with tempfile.TemporaryDirectory() as temp, TestClient(create_app(FakeService(), Path(temp))) as client:
            for body in ({"recorte": "custom"}, {"recorte": "centro", "score": .01},
                         {"recorte": "centro", "score": 2}, {"recorte": "centro", "perfil": "outro"}):
                self.assertEqual(client.post("/api/analises", json=body).status_code, 422)
            welcome = client.get("/")
            self.assertEqual(welcome.status_code, 200)
            self.assertIn("Um olhar para as árvores da cidade", welcome.text)
            self.assertIn("regra.html", welcome.text)
            self.assertIn("index.html", welcome.text)
            self.assertIn("3-30-300", client.get("/regra.html").text)
            self.assertIn("Ferramentas de análise", client.get("/index.html").text)
            for path in ("/data/", "/.envs/", "/backend/api.py", "/resultados/", "/../backend/api.py"):
                self.assertEqual(client.get(path).status_code, 404)

    def test_sector_request_validation_and_shared_busy_lock(self):
        service = FakeService()
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'setores.json'
            path.write_text(json.dumps(sample()), encoding='utf-8')
            with TestClient(create_app(service, Path(temp) / 'resultados', path)) as client:
                for body in ({'ids': [], 'fonte_malha': 'teste'}, {'ids': ['unknown'], 'fonte_malha': 'teste'},
                             {'ids': ['a'], 'fonte_malha': 'desatualizada'}, {'ids': ['a'], 'fonte_malha': 'teste', 'perfil': 'multiescala'}):
                    self.assertEqual(client.post('/api/analises/setores', json=body).status_code, 422)
                response = client.post('/api/analises/setores', json={'ids': ['a'], 'fonte_malha': 'teste'})
                self.assertEqual(response.status_code, 202)
                ident = response.json()['analysis_id']
                self.assertEqual(client.post('/api/analises', json={'recorte': 'centro'}).status_code, 409)
                service.release.set()
                for _ in range(200):
                    job = client.get(f'/api/analises/{ident}').json()
                    if job['estado'] in ('concluida', 'erro'): break
                    time.sleep(.01)
                self.assertEqual(job['estado'], 'concluida')


if __name__ == "__main__":
    unittest.main()
